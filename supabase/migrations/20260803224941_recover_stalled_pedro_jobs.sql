begin;

-- A successful job transition must satisfy the scheduled_jobs invariant.
-- The previous implementation changed the status without recording completed_at,
-- so Postgres rejected the acknowledgement after the external effect had run.
create or replace function public.finish_runtime_job(
  p_job_id uuid,
  p_success boolean,
  p_error_redacted text default null,
  p_retry_seconds integer default 30
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_status text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_job
  from public.scheduled_jobs
  where id = p_job_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_success then
    update public.scheduled_jobs
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        lease_until = null,
        last_error = null,
        updated_at = now()
    where id = v_job.id;

    if v_job.job_type = 'ai.inbound.aggregate' then
      update public.alerts a
      set status = 'resolved',
          resolved_at = coalesce(a.resolved_at, now()),
          updated_at = now()
      where a.status <> 'resolved'
        and a.entity_type = 'scheduled_jobs'
        and a.entity_id in (
          select old.id
          from public.scheduled_jobs old
          where old.id <> v_job.id
            and old.org_id = v_job.org_id
            and old.job_type = 'ai.inbound.aggregate'
            and old.aggregate_id = v_job.aggregate_id
            and old.status = 'dead'
        );

      update public.scheduled_jobs old
      set status = 'cancelled',
          lease_until = null,
          updated_at = now()
      where old.id <> v_job.id
        and old.org_id = v_job.org_id
        and old.job_type = 'ai.inbound.aggregate'
        and old.aggregate_id = v_job.aggregate_id
        and old.status = 'dead';
    end if;

    return 'completed';
  end if;

  v_status := case
    when v_job.attempts + 1 >= v_job.max_attempts then 'dead'
    else 'pending'
  end;

  update public.scheduled_jobs
  set status = v_status,
      attempts = attempts + 1,
      completed_at = null,
      lease_until = null,
      last_error = left(coalesce(p_error_redacted, 'runtime_error'), 500),
      run_at = case
        when v_status = 'pending' then now() + make_interval(
          secs => greatest(5, least(coalesce(p_retry_seconds, 30), 3600))
        )
        else run_at
      end,
      updated_at = now()
  where id = v_job.id;

  if v_status = 'dead' then
    insert into public.alerts(
      org_id, operation_id, severity, category, title, body,
      entity_type, entity_id, dedupe_key
    ) values (
      v_job.org_id, v_job.operation_id, 'critical', 'dead_letter',
      'Job esgotou tentativas',
      'O job ' || v_job.job_type || ' precisa de revisão manual.',
      'scheduled_jobs', v_job.id, 'dead-job:' || v_job.id::text
    )
    on conflict (org_id, dedupe_key)
      where dedupe_key is not null and status <> 'resolved'
      do nothing;
  end if;

  return v_status;
end;
$$;

revoke all on function public.finish_runtime_job(uuid, boolean, text, integer)
  from public, anon, authenticated;
grant execute on function public.finish_runtime_job(uuid, boolean, text, integer)
  to service_role;

-- Aggregate rapid inbound messages while guaranteeing that a message arriving
-- during an active lease receives a successor job instead of being absorbed by
-- work that has already started.
create or replace function public.schedule_inbound_ai_aggregation(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_message public.messages%rowtype;
  v_settings public.operation_settings%rowtype;
  v_existing public.scheduled_jobs%rowtype;
  v_first timestamptz;
  v_run_at timestamptz;
  v_job uuid;
  v_base_dedupe text;
  v_dedupe text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_message
  from public.messages
  where id = p_message_id and direction = 'inbound';

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'inbound_message_not_found');
  end if;

  select * into v_settings
  from public.operation_settings
  where operation_id = v_message.operation_id;

  v_base_dedupe := 'ai-inbound-aggregate:' || v_message.conversation_id::text;
  v_dedupe := v_base_dedupe;
  v_first := v_message.created_at;

  select * into v_existing
  from public.scheduled_jobs j
  where j.org_id = v_message.org_id
    and j.dedupe_key = v_base_dedupe
    and j.status in ('pending', 'leased')
  order by j.created_at
  limit 1
  for update;

  if found then
    v_first := coalesce(
      (v_existing.payload ->> 'first_message_at')::timestamptz,
      v_message.created_at
    );
  end if;

  v_run_at := least(
    v_first + make_interval(secs => coalesce(v_settings.max_grouping_seconds, 30)),
    v_message.created_at + make_interval(secs => coalesce(v_settings.grouping_seconds, 10))
  );

  if v_existing.id is not null and v_existing.status = 'pending' then
    update public.scheduled_jobs
    set run_at = v_run_at,
        payload = jsonb_build_object(
          'conversation_id', v_message.conversation_id,
          'message_id', v_message.id,
          'first_message_at', v_first
        ),
        updated_at = now()
    where id = v_existing.id
    returning id into v_job;

    return jsonb_build_object('status', 'scheduled', 'job_id', v_job, 'run_at', v_run_at);
  end if;

  if v_existing.id is not null
     and v_existing.status = 'leased'
     and v_existing.lease_until <= now() then
    update public.scheduled_jobs
    set status = 'pending',
        lease_until = null,
        completed_at = null,
        run_at = v_run_at,
        payload = jsonb_build_object(
          'conversation_id', v_message.conversation_id,
          'message_id', v_message.id,
          'first_message_at', v_first
        ),
        last_error = 'expired_lease_recovered',
        updated_at = now()
    where id = v_existing.id
    returning id into v_job;

    return jsonb_build_object('status', 'recovered', 'job_id', v_job, 'run_at', v_run_at);
  end if;

  if v_existing.id is not null and v_existing.status = 'leased' then
    v_dedupe := v_base_dedupe || ':after:' || v_message.id::text;
  end if;

  insert into public.scheduled_jobs(
    org_id, operation_id, job_type, aggregate_type, aggregate_id,
    target_queue, run_at, dedupe_key, payload, max_attempts
  ) values (
    v_message.org_id, v_message.operation_id, 'ai.inbound.aggregate',
    'conversation', v_message.conversation_id, 'scheduled-actions', v_run_at,
    v_dedupe,
    jsonb_build_object(
      'conversation_id', v_message.conversation_id,
      'message_id', v_message.id,
      'first_message_at', v_first
    ),
    3
  )
  on conflict (org_id, dedupe_key) where status in ('pending', 'leased')
  do update
    set run_at = excluded.run_at,
        payload = excluded.payload,
        updated_at = now()
    where public.scheduled_jobs.status = 'pending'
  returning id into v_job;

  if v_job is null then
    select id into v_job
    from public.scheduled_jobs
    where org_id = v_message.org_id
      and dedupe_key = v_dedupe
      and status in ('pending', 'leased')
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object('status', 'scheduled', 'job_id', v_job, 'run_at', v_run_at);
end;
$$;

revoke all on function public.schedule_inbound_ai_aggregation(uuid)
  from public, anon, authenticated;
grant execute on function public.schedule_inbound_ai_aggregation(uuid)
  to service_role;

-- Reuse the same idempotent execution when a manual recovery retries a failed
-- or superseded turn. Completed turns remain immutable.
create or replace function public.ensure_inbound_ai_execution(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_message public.messages%rowtype;
  v_conversation public.conversations%rowtype;
  v_request public.ai_execution_requests%rowtype;
  v_capacity public.capacity_reservation_requests%rowtype;
  v_existing public.ai_executions%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_message
  from public.messages
  where id = p_message_id and direction = 'inbound';
  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'inbound_message_not_found');
  end if;

  select * into v_conversation
  from public.conversations
  where id = v_message.conversation_id
  for update;
  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'conversation_not_found');
  end if;
  if not private.is_conversation_ai_eligible(v_conversation.id) then
    return jsonb_build_object('status', 'ignored', 'reason', 'ai_not_eligible');
  end if;

  select * into v_existing
  from public.ai_executions
  where request_message_id = p_message_id
    and mode = v_conversation.ai_mode
  limit 1
  for update;

  if v_existing.id is not null then
    if v_existing.status in ('failed', 'superseded') then
      update public.ai_executions
      set status = 'queued',
          expected_conversation_version = v_conversation.version,
          input_snapshot = jsonb_build_object(
            'source', 'whatsapp_inbound_recovery',
            'message_id', v_message.id
          ),
          output_text = null,
          output_structured = null,
          response_id = null,
          model_returned = null,
          input_tokens = null,
          output_tokens = null,
          latency_ms = null,
          error_code = null,
          error_redacted = null,
          started_at = null,
          completed_at = null
      where id = v_existing.id;
    elsif v_existing.status = 'completed'
          and v_existing.mode in ('shadow', 'assisted')
          and v_existing.output_text is not null
          and not exists (
            select 1 from public.ai_suggestions s
            where s.execution_id = v_existing.id
          ) then
      insert into public.ai_suggestions(
        org_id, execution_id, conversation_id, body
      ) values (
        v_existing.org_id, v_existing.id,
        v_existing.conversation_id, v_existing.output_text
      );
    end if;

    return jsonb_build_object(
      'status', 'existing',
      'execution_id', v_existing.id,
      'execution_status', case
        when v_existing.status in ('failed', 'superseded') then 'queued'
        else v_existing.status
      end
    );
  end if;

  insert into public.capacity_reservation_requests(
    org_id, operation_id, conversation_id, action, source
  ) values (
    v_message.org_id, v_message.operation_id,
    v_message.conversation_id, 'reserve', 'inbound'
  ) returning * into v_capacity;

  if v_capacity.result = 'backlog' then
    return jsonb_build_object('status', 'ignored', 'reason', 'capacity_backlog');
  end if;

  insert into public.ai_execution_requests(
    org_id, operation_id, conversation_id, request_message_id, mode,
    expected_conversation_version, input_snapshot, idempotency_key, actor_user_id
  ) values (
    v_message.org_id, v_message.operation_id, v_message.conversation_id,
    v_message.id, v_conversation.ai_mode, v_conversation.version,
    jsonb_build_object('source', 'whatsapp_inbound', 'message_id', v_message.id),
    'ai-inbound:' || v_message.id::text || ':' || v_conversation.ai_mode,
    null
  ) returning * into v_request;

  return jsonb_build_object(
    'status', v_request.result,
    'execution_id', v_request.execution_id
  );
exception when unique_violation then
  select * into v_existing
  from public.ai_executions
  where request_message_id = p_message_id
    and mode = v_conversation.ai_mode
  limit 1;
  return jsonb_build_object('status', 'existing', 'execution_id', v_existing.id);
end;
$$;

revoke all on function public.ensure_inbound_ai_execution(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_inbound_ai_execution(uuid)
  to service_role;

-- The normal path should self-heal without requiring a human to press a
-- button. Only active, AI-owned and deterministic-safe conversations qualify.
create or replace function public.recover_stalled_inbound_ai(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_target record;
  v_result jsonb;
  v_scheduled integer := 0;
  v_inspected integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  for v_target in
    select c.id as conversation_id, latest.id as message_id
    from public.conversations c
    join lateral (
      select m.id, m.created_at
      from public.messages m
      where m.conversation_id = c.id and m.direction = 'inbound'
      order by m.created_at desc, m.id desc
      limit 1
    ) latest on true
    where private.is_conversation_ai_eligible(c.id)
      and latest.created_at <= now() - interval '45 seconds'
      and not exists (
        select 1
        from public.ai_executions e
        where e.request_message_id = latest.id
          and e.mode = c.ai_mode
      )
    order by latest.created_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  loop
    v_inspected := v_inspected + 1;
    v_result := public.schedule_inbound_ai_aggregation(v_target.message_id);
    if v_result ->> 'job_id' is not null then
      v_scheduled := v_scheduled + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'inspected', v_inspected,
    'scheduled', v_scheduled
  );
end;
$$;

revoke all on function public.recover_stalled_inbound_ai(integer)
  from public, anon, authenticated;
grant execute on function public.recover_stalled_inbound_ai(integer)
  to service_role;

-- Seed recovery for conversations already affected before this migration.
select public.recover_stalled_inbound_ai(100);

commit;
