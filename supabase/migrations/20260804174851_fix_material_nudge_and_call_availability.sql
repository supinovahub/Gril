begin;

-- Pedro receives only slots that are truly available according to the same
-- membership predicate used by call distribution. The model never sees
-- membership identities, only safe ISO timestamps and aggregate capacity.
create or replace function public.get_pedro_available_call_slots(
  p_operation_id uuid,
  p_from timestamptz default now() + interval '10 minutes',
  p_to timestamptz default now() + interval '7 days',
  p_limit integer default 16
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_result jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if p_operation_id is null or p_from is null or p_to is null
     or p_to <= p_from or p_to > p_from + interval '14 days'
     or p_limit < 1 or p_limit > 50 then
    raise exception 'call_slot_window_invalid' using errcode='22023';
  end if;
  if not exists(select 1 from public.operations where id=p_operation_id) then
    raise exception 'operation_not_found' using errcode='22023';
  end if;

  with candidate_slots as (
    select slot
    from generate_series(
      date_trunc('hour',greatest(p_from,now()+interval '10 minutes')),
      p_to,
      interval '30 minutes'
    ) slot
    where slot >= greatest(p_from,now()+interval '10 minutes')
  ), available_slots as (
    select c.slot,count(distinct s.membership_id)::integer available_members
    from candidate_slots c
    join public.membership_call_settings s
      on s.operation_id=p_operation_id and s.can_receive_calls
    where private.membership_is_available(s.membership_id,c.slot,c.slot+interval '30 minutes')
    group by c.slot
    order by c.slot
    limit p_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('starts_at',slot,'available_members',available_members)
      order by slot
    ),
    '[]'::jsonb
  ) into v_result
  from available_slots;
  return v_result;
end;
$$;
revoke all on function public.get_pedro_available_call_slots(uuid,timestamptz,timestamptz,integer)
  from public,anon,authenticated;
grant execute on function public.get_pedro_available_call_slots(uuid,timestamptz,timestamptz,integer)
  to service_role;

-- Defense in depth: a material nudge is text-only. Even if an old worker or a
-- malformed model output asks for books again, suppress the delivery before
-- enqueue_pedro_project_media can create outbound jobs or another nudge.
create or replace function private.prevent_material_nudge_redelivery()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  if exists(
    select 1 from public.ai_executions e
    where e.id=new.ai_execution_id
      and e.input_snapshot->>'source'='project_material_nudge'
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_material_nudge_redelivery()
  from public,anon,authenticated,service_role;
drop trigger if exists project_media_deliveries_block_nudge_redelivery
  on public.project_media_deliveries;
create trigger project_media_deliveries_block_nudge_redelivery
before insert on public.project_media_deliveries
for each row execute function private.prevent_material_nudge_redelivery();

-- Remove child nudges created by the defective behavior. Normal original
-- material nudges are intentionally preserved.
update public.scheduled_jobs j
set status='cancelled',lease_until=null,updated_at=now(),last_error='superseded_recursive_material_nudge'
where j.job_type='project_material.call_nudge'
  and j.status in ('pending','leased')
  and exists(
    select 1 from public.ai_executions e
    where e.id::text=j.payload->>'execution_id'
      and e.input_snapshot->>'source'='project_material_nudge'
  );

commit;
