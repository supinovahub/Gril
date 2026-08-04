begin;

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
    cross join lateral (
      select coalesce(
        (select r.timezone from public.availability_rules r
          where r.membership_id=s.membership_id and r.active limit 1),
        'America/Sao_Paulo'
      ) timezone
    ) z
    where (c.slot at time zone z.timezone)::date
        = ((c.slot+interval '30 minutes') at time zone z.timezone)::date
      and private.membership_is_available(s.membership_id,c.slot,c.slot+interval '30 minutes')
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

commit;
