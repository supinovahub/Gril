begin;

-- A newly confirmed slot for the same opportunity supersedes every open future
-- call. This works for calls created by Pedro and by the dashboard because both
-- paths use call_creation_requests. The new call then follows normal atomic
-- distribution, while the former slot and offers are invalidated exactly once.
create or replace function private.supersede_calls_on_new_slot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_new_call public.calls%rowtype;
  v_old_call public.calls%rowtype;
  v_previous_count integer := -1;
  v_cancelled integer := 0;
begin
  if new.call_id is null or new.result not in ('awaiting_distribution', 'awaiting_manager') then
    return new;
  end if;

  select * into v_new_call
  from public.calls
  where id = new.call_id
  for update;

  for v_old_call in
    select *
    from public.calls
    where org_id = new.org_id
      and operation_id = new.operation_id
      and opportunity_id = new.opportunity_id
      and id <> new.call_id
      and status not in ('completed', 'no_show', 'cancelled')
      and starts_at > now()
    order by created_at
    for update
  loop
    v_previous_count := greatest(v_previous_count, v_old_call.reschedule_count);

    update public.call_offers
    set status = 'cancelled', responded_at = coalesce(responded_at, now())
    where call_id = v_old_call.id
      and status in ('scheduled', 'pending');

    update public.call_assignments
    set active = false,
        revoked_at = now(),
        revoked_by = new.actor_user_id,
        revocation_reason = 'rescheduled'
    where call_id = v_old_call.id and active;

    update public.scheduled_jobs
    set status = 'cancelled', lease_until = null, updated_at = now()
    where aggregate_type = 'call'
      and aggregate_id = v_old_call.id
      and status in ('pending', 'leased');

    update public.calls
    set status = 'cancelled', completed_at = now(), version = version + 1, updated_at = now()
    where id = v_old_call.id;

    update public.call_holds
    set status = 'cancelled'
    where id = v_old_call.hold_id
      and status in ('active', 'confirmed');

    v_cancelled := v_cancelled + 1;
  end loop;

  if v_cancelled > 0 then
    update public.calls
    set reschedule_count = least(20, v_previous_count + 1),
        version = version + 1,
        updated_at = now()
    where id = new.call_id;

    if v_previous_count + 1 >= 3 then
      insert into public.alerts(
        org_id, operation_id, severity, category, title, body,
        entity_type, entity_id, dedupe_key
      ) values (
        new.org_id, new.operation_id, 'warning', 'call',
        'Call reagendada três vezes',
        'Revise o histórico e confirme se a nova tentativa ainda deve seguir.',
        'call', new.call_id,
        'call-third-reschedule:' || new.call_id::text
      )
      on conflict (org_id, dedupe_key) do nothing;
    end if;

    insert into audit.events(
      org_id, operation_id, actor_user_id, action, entity_type, entity_id, metadata
    ) values (
      new.org_id, new.operation_id, new.actor_user_id,
      'call.rescheduled', 'calls', new.call_id,
      jsonb_build_object('cancelled_previous_calls', v_cancelled, 'reschedule_count', v_previous_count + 1)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.supersede_calls_on_new_slot()
  from public, anon, authenticated, service_role;

drop trigger if exists call_creation_supersede_previous_slot on public.call_creation_requests;
create trigger call_creation_supersede_previous_slot
after insert on public.call_creation_requests
for each row
when (new.call_id is not null)
execute function private.supersede_calls_on_new_slot();

commit;
