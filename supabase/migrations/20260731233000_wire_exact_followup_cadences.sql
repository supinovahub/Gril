begin;

-- The phase-13 executor originally selected the newest published plan for both
-- strategies. Keep its transactional completion contract, but replace only the
-- jobs that it created with the exact named cadence requested by Pedro.
create or replace function private.enforce_exact_followup_cadence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_opportunity public.opportunities%rowtype;
  v_strategy text;
  v_plan_id uuid;
  v_step public.followup_steps%rowtype;
  v_replaced integer := 0;
begin
  if new.action_type <> 'followup' or new.status <> 'executed' then
    return new;
  end if;

  v_strategy := coalesce(new.action_input->>'strategy', 'none');
  if v_strategy not in ('short', 'long') then
    return new;
  end if;

  select * into v_execution
  from public.ai_executions
  where id = new.execution_id and org_id = new.org_id;

  if not found or v_execution.mode <> 'production' or v_execution.conversation_id is null then
    return new;
  end if;

  select * into v_conversation
  from public.conversations
  where id = v_execution.conversation_id;

  select * into v_opportunity
  from public.opportunities
  where id = v_conversation.opportunity_id;

  -- Only replace jobs actually created by complete_pedro_turn. This preserves
  -- the original guards for reply/escalation and call creation.
  with cancelled as (
    update public.scheduled_jobs
    set status = 'cancelled', updated_at = now()
    where org_id = new.org_id
      and aggregate_type = 'conversation'
      and aggregate_id = v_conversation.id
      and job_type = 'followup.ai_turn'
      and status = 'pending'
      and dedupe_key like 'followup:' || v_conversation.id::text || ':' || v_execution.id::text || ':%'
    returning 1
  )
  select count(*) into v_replaced from cancelled;

  if v_replaced = 0 then
    return new;
  end if;

  select id into v_plan_id
  from public.followup_plans
  where operation_id = v_execution.operation_id
    and status = 'published'
    and name = case
      when v_strategy = 'short' then 'Cadencia curta padrao'
      else 'Cadencia longa padrao'
    end
  order by version desc
  limit 1;

  if v_plan_id is null then
    raise exception 'requested_followup_plan_not_found' using errcode = '22023';
  end if;

  for v_step in
    select * from public.followup_steps where plan_id = v_plan_id order by step_number
  loop
    insert into public.scheduled_jobs(
      org_id, operation_id, job_type, aggregate_type, aggregate_id,
      target_queue, run_at, dedupe_key, payload, max_attempts
    ) values (
      new.org_id, v_execution.operation_id, 'followup.ai_turn', 'conversation', v_conversation.id,
      'scheduled-actions', now() + make_interval(mins => v_step.delay_minutes),
      'followup-exact:' || v_conversation.id::text || ':' || v_execution.id::text || ':' || v_strategy || ':' || v_step.step_number::text,
      jsonb_build_object(
        'conversation_id', v_conversation.id,
        'opportunity_id', v_opportunity.id,
        'cadence', v_strategy,
        'step_number', v_step.step_number,
        'instruction', v_step.instruction
      ),
      3
    )
    on conflict (org_id, dedupe_key) where status in ('pending', 'leased') do nothing;
  end loop;

  -- A short cadence becomes the long cadence after 24 hours without a reply.
  if v_strategy = 'short' then
    select id into v_plan_id
    from public.followup_plans
    where operation_id = v_execution.operation_id
      and status = 'published'
      and name = 'Cadencia longa padrao'
    order by version desc
    limit 1;

    if v_plan_id is null then
      raise exception 'long_followup_plan_not_found' using errcode = '22023';
    end if;

    for v_step in
      select * from public.followup_steps where plan_id = v_plan_id order by step_number
    loop
      insert into public.scheduled_jobs(
        org_id, operation_id, job_type, aggregate_type, aggregate_id,
        target_queue, run_at, dedupe_key, payload, max_attempts
      ) values (
        new.org_id, v_execution.operation_id, 'followup.ai_turn', 'conversation', v_conversation.id,
        'scheduled-actions', now() + interval '24 hours' + make_interval(mins => v_step.delay_minutes),
        'followup-exact:' || v_conversation.id::text || ':' || v_execution.id::text || ':short-to-long:' || v_step.step_number::text,
        jsonb_build_object(
          'conversation_id', v_conversation.id,
          'opportunity_id', v_opportunity.id,
          'cadence', 'short-to-long',
          'step_number', v_step.step_number,
          'instruction', v_step.instruction
        ),
        3
      )
      on conflict (org_id, dedupe_key) where status in ('pending', 'leased') do nothing;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_exact_followup_cadence()
  from public, anon, authenticated, service_role;

drop trigger if exists ai_action_execution_exact_followup on public.ai_action_executions;
create trigger ai_action_execution_exact_followup
after insert on public.ai_action_executions
for each row
when (new.action_type = 'followup' and new.status = 'executed')
execute function private.enforce_exact_followup_cadence();

-- A no-show is only registered by a human after the call. Once confirmed, the
-- exact 10m/2h/8h/24h/48h cadence is queued and then falls back to the long
-- cadence. Runtime guards still cancel it on reply, opt-out or human ownership.
create or replace function private.schedule_confirmed_no_show_cadence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_call public.calls%rowtype;
  v_conversation public.conversations%rowtype;
  v_plan_id uuid;
  v_step public.followup_steps%rowtype;
begin
  if new.result <> 'no_show' then
    return new;
  end if;

  select * into v_call from public.calls where id = new.call_id;
  select * into v_conversation
  from public.conversations
  where org_id = new.org_id
    and operation_id = v_call.operation_id
    and opportunity_id = v_call.opportunity_id
    and status = 'active'
  order by created_at desc
  limit 1;

  if v_conversation.id is null
     or v_conversation.ownership <> 'ai'
     or v_conversation.ai_mode <> 'production' then
    return new;
  end if;

  update public.scheduled_jobs
  set status = 'cancelled', updated_at = now()
  where org_id = new.org_id
    and aggregate_type = 'conversation'
    and aggregate_id = v_conversation.id
    and job_type = 'followup.ai_turn'
    and status = 'pending';

  select id into v_plan_id
  from public.followup_plans
  where operation_id = v_call.operation_id
    and status = 'published'
    and name = 'Cadencia no-show'
  order by version desc
  limit 1;

  if v_plan_id is null then
    raise exception 'no_show_followup_plan_not_found' using errcode = '22023';
  end if;

  for v_step in
    select * from public.followup_steps where plan_id = v_plan_id order by step_number
  loop
    insert into public.scheduled_jobs(
      org_id, operation_id, job_type, aggregate_type, aggregate_id,
      target_queue, run_at, dedupe_key, payload, max_attempts
    ) values (
      new.org_id, v_call.operation_id, 'followup.ai_turn', 'conversation', v_conversation.id,
      'scheduled-actions', now() + make_interval(mins => v_step.delay_minutes),
      'no-show:' || new.call_id::text || ':' || v_step.step_number::text,
      jsonb_build_object(
        'conversation_id', v_conversation.id,
        'opportunity_id', v_call.opportunity_id,
        'cadence', 'no-show',
        'call_id', new.call_id,
        'step_number', v_step.step_number,
        'instruction', v_step.instruction
      ),
      3
    )
    on conflict (org_id, dedupe_key) where status in ('pending', 'leased') do nothing;
  end loop;

  select id into v_plan_id
  from public.followup_plans
  where operation_id = v_call.operation_id
    and status = 'published'
    and name = 'Cadencia longa padrao'
  order by version desc
  limit 1;

  for v_step in
    select * from public.followup_steps where plan_id = v_plan_id order by step_number
  loop
    insert into public.scheduled_jobs(
      org_id, operation_id, job_type, aggregate_type, aggregate_id,
      target_queue, run_at, dedupe_key, payload, max_attempts
    ) values (
      new.org_id, v_call.operation_id, 'followup.ai_turn', 'conversation', v_conversation.id,
      'scheduled-actions', now() + interval '48 hours' + make_interval(mins => v_step.delay_minutes),
      'no-show-long:' || new.call_id::text || ':' || v_step.step_number::text,
      jsonb_build_object(
        'conversation_id', v_conversation.id,
        'opportunity_id', v_call.opportunity_id,
        'cadence', 'no-show-to-long',
        'call_id', new.call_id,
        'step_number', v_step.step_number,
        'instruction', v_step.instruction
      ),
      3
    )
    on conflict (org_id, dedupe_key) where status in ('pending', 'leased') do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function private.schedule_confirmed_no_show_cadence()
  from public, anon, authenticated, service_role;

drop trigger if exists call_result_confirmed_no_show_cadence on public.call_results;
create trigger call_result_confirmed_no_show_cadence
after insert on public.call_results
for each row
when (new.result = 'no_show')
execute function private.schedule_confirmed_no_show_cadence();

-- The audit feed can use invoker rights plus tenant RLS. This removes an
-- unnecessary authenticated SECURITY DEFINER surface while keeping the screen.
drop policy if exists audit_events_explicitly_private on audit.events;
create policy audit_events_manager_select
on audit.events
for select
to authenticated
using (
  private.has_org_role(org_id, array['owner', 'manager']::text[])
  or private.has_org_permission(org_id, 'reports.view')
);

grant usage on schema audit to authenticated, service_role;
grant select on audit.events to authenticated;

create or replace function public.list_audit_events(p_org_id uuid, p_limit integer default 200)
returns table(
  id uuid,
  operation_id uuid,
  actor_user_id uuid,
  actor_type text,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select e.id, e.operation_id, e.actor_user_id, e.actor_type, e.action,
         e.entity_type, e.entity_id, e.metadata, e.occurred_at
  from audit.events e
  where e.org_id = p_org_id
  order by e.occurred_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

revoke all on function public.list_audit_events(uuid, integer) from public, anon;
grant execute on function public.list_audit_events(uuid, integer) to authenticated, service_role;

commit;
