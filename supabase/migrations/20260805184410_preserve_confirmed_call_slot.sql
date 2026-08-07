begin;

-- A repeated action for the same opportunity and slot is an update to the
-- existing call, not a new reservation. This prevents a format-only AI turn
-- from creating a second call and firing the reschedule trigger.
create unique index if not exists calls_active_slot_unique_idx
  on public.calls (org_id, operation_id, opportunity_id, starts_at)
  where status not in ('completed', 'no_show', 'cancelled');

create or replace function private.process_call_creation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_opp public.opportunities%rowtype;
  v_stage public.pipeline_stages%rowtype;
  v_existing_call public.calls%rowtype;
  v_hold uuid;
  v_call uuid;
  v_status text;
  v_effective_format text;
  v_is_service boolean := (select auth.role()) = 'service_role';
begin
  if not v_is_service
     and ((select auth.uid()) is null
       or new.actor_user_id <> (select auth.uid())
       or not private.has_org_permission(new.org_id, 'pipeline.manage')) then
    raise exception 'call_creation_forbidden' using errcode = '42501';
  end if;
  if new.format not in ('video', 'phone', 'unknown') or not new.lead_confirmed then
    raise exception 'lead_confirmation_and_format_required' using errcode = '22023';
  end if;

  select * into v_opp
  from public.opportunities
  where id = new.opportunity_id and org_id = new.org_id
  for update;
  if not found
     or v_opp.operation_id <> new.operation_id
     or v_opp.version <> new.expected_opportunity_version
     or v_opp.status <> 'open' then
    raise exception 'opportunity_version_or_state_conflict' using errcode = '40001';
  end if;
  select * into v_stage from public.pipeline_stages where id = v_opp.pipeline_stage_id;
  if v_stage.position > 3 then
    raise exception 'call_not_allowed_after_human_pipeline' using errcode = '22023';
  end if;

  -- Keep the canonical call when a retry or a format-only turn reaches the
  -- transactional boundary with the same confirmed timestamp.
  select * into v_existing_call
  from public.calls
  where org_id = new.org_id
    and operation_id = new.operation_id
    and opportunity_id = new.opportunity_id
    and starts_at = new.starts_at
    and status not in ('completed', 'no_show', 'cancelled')
    and starts_at > now()
  order by created_at desc
  limit 1
  for update;

  if found then
    v_effective_format := case
      when new.format in ('video', 'phone')
        and (v_existing_call.status <> 'assigned' or v_existing_call.format = 'unknown')
        then new.format
      else v_existing_call.format
    end;

    if v_effective_format <> v_existing_call.format then
      update public.calls
      set format = v_effective_format,
          version = version + 1,
          updated_at = now()
      where id = v_existing_call.id;
      update public.call_holds
      set preferred_format = v_effective_format
      where id = v_existing_call.hold_id
        and status in ('active', 'escalated', 'confirmed');
    end if;

    insert into audit.events(org_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (
      new.org_id,
      new.actor_user_id,
      'call.reused',
      'calls',
      v_existing_call.id,
      jsonb_build_object(
        'starts_at', v_existing_call.starts_at,
        'requested_format', new.format,
        'effective_format', v_effective_format
      )
    );
    new.call_id := v_existing_call.id;
    new.result := 'reused_existing';
    new.processed_at := now();
    return new;
  end if;

  if new.starts_at <= now() + interval '10 minutes' then
    raise exception 'call_start_too_close' using errcode = '22023';
  end if;

  v_status := case when new.starts_at < now() + interval '1 hour'
    then 'awaiting_manager' else 'awaiting_distribution' end;
  insert into public.call_holds (
    org_id, operation_id, opportunity_id, starts_at, ends_at, preferred_format,
    status, expires_at, lead_confirmed, created_by
  ) values (
    new.org_id, new.operation_id, new.opportunity_id, new.starts_at,
    new.starts_at + interval '20 minutes', new.format,
    case when v_status = 'awaiting_manager' then 'escalated' else 'active' end,
    least(new.starts_at, now() + interval '15 minutes'), true, new.actor_user_id
  ) returning id into v_hold;
  insert into public.calls (
    org_id, operation_id, hold_id, opportunity_id, starts_at, ends_at,
    blocked_until, status, format
  ) values (
    new.org_id, new.operation_id, v_hold, new.opportunity_id, new.starts_at,
    new.starts_at + interval '20 minutes', new.starts_at + interval '30 minutes',
    v_status, new.format
  ) returning id into v_call;
  if v_status = 'awaiting_manager' then
    insert into public.alerts(
      org_id, operation_id, severity, category, title, body, entity_type,
      entity_id, dedupe_key
    ) values (
      new.org_id, new.operation_id, 'critical', 'call',
      'Call com menos de uma hora',
      'O horário foi separado, mas exige resolução humana silenciosa.',
      'call', v_call, 'call-short-lead:' || v_call::text
    );
  else
    insert into private.outbox_events(
      org_id, operation_id, event_type, aggregate_type, aggregate_id, payload,
      idempotency_key
    ) values (
      new.org_id, new.operation_id, 'call.hold_created.v1', 'call', v_call,
      jsonb_build_object('call_id', v_call), 'call-created:' || v_call::text
    );
  end if;
  insert into audit.events(org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id, new.actor_user_id, 'call.created', 'calls', v_call,
    jsonb_build_object('starts_at', new.starts_at, 'status', v_status)
  );
  new.call_id := v_call;
  new.result := v_status;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_call_creation_request() from public, anon, authenticated, service_role;

commit;
