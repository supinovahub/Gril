begin;

-- Keep the organization-level Pedro mode and every eligible AI-owned
-- conversation in sync. Privacy, opt-out, archived contacts, human ownership
-- and paused conversations are never re-enabled by this trigger.
create or replace function private.sync_conversation_ai_mode_from_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_synced integer := 0;
begin
  if new.ai_global_mode is not distinct from old.ai_global_mode then
    return new;
  end if;

  if new.ai_global_mode = 'off' then
    update public.conversations c
    set ai_mode = 'off', version = c.version + 1, updated_at = now()
    where c.org_id = new.org_id and c.ai_mode <> 'off';
  else
    update public.conversations c
    set ai_mode = new.ai_global_mode, version = c.version + 1, updated_at = now()
    where c.org_id = new.org_id
      and c.status = 'active'
      and c.ownership = 'ai'
      and c.pause_reason is null
      and c.ai_mode is distinct from new.ai_global_mode
      and exists (
        select 1 from public.contacts ct
        where ct.id = c.contact_id and ct.status = 'active'
      )
      and not exists (
        select 1 from public.opt_outs oo
        where oo.operation_id = c.operation_id
          and oo.contact_id = c.contact_id
          and oo.revoked_at is null
      )
      and not exists (
        select 1
        from public.contact_phones cp
        join public.suppression_entries se
          on se.operation_id = c.operation_id
         and se.phone_e164 = cp.e164
         and se.revoked_at is null
         and (se.expires_at is null or se.expires_at > now())
        where cp.contact_id = c.contact_id and cp.status = 'active'
      );
  end if;

  get diagnostics v_synced = row_count;
  insert into audit.events (
    org_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    new.org_id,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    'organization.ai_mode_synced',
    'organizations',
    new.org_id,
    jsonb_build_object('from', old.ai_global_mode, 'to', new.ai_global_mode, 'conversations', v_synced)
  );
  return new;
end;
$$;

revoke all on function private.sync_conversation_ai_mode_from_organization()
  from public, anon, authenticated, service_role;

drop trigger if exists organization_settings_sync_conversation_ai_mode
  on public.organization_settings;
create trigger organization_settings_sync_conversation_ai_mode
after update of ai_global_mode on public.organization_settings
for each row execute function private.sync_conversation_ai_mode_from_organization();

-- Revalidate the final AI boundary immediately before creating an execution.
-- This protects the runtime even if a conversation row ever becomes stale.
create or replace function private.is_conversation_ai_eligible(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    join public.contacts ct on ct.id = c.contact_id
    join public.organization_settings os on os.org_id = c.org_id
    where c.id = p_conversation_id
      and c.status = 'active'
      and c.ownership = 'ai'
      and c.pause_reason is null
      and c.ai_mode <> 'off'
      and os.ai_global_mode = c.ai_mode
      and os.ai_global_mode <> 'off'
      and ct.status = 'active'
      and not exists (
        select 1 from public.opt_outs oo
        where oo.operation_id = c.operation_id
          and oo.contact_id = c.contact_id
          and oo.revoked_at is null
      )
      and not exists (
        select 1
        from public.contact_phones cp
        join public.suppression_entries se
          on se.operation_id = c.operation_id
         and se.phone_e164 = cp.e164
         and se.revoked_at is null
         and (se.expires_at is null or se.expires_at > now())
        where cp.contact_id = c.contact_id and cp.status = 'active'
      )
  );
$$;

revoke all on function private.is_conversation_ai_eligible(uuid)
  from public, anon, authenticated, service_role;

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
  v_existing uuid;
begin
  if (select auth.role()) <> 'service_role' then
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

  select id into v_existing
  from public.ai_executions
  where request_message_id = p_message_id and mode = v_conversation.ai_mode
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('status', 'existing', 'execution_id', v_existing);
  end if;

  insert into public.capacity_reservation_requests (
    org_id, operation_id, conversation_id, action, source
  ) values (
    v_message.org_id, v_message.operation_id, v_message.conversation_id, 'reserve', 'inbound'
  ) returning * into v_capacity;
  if v_capacity.result = 'backlog' then
    return jsonb_build_object('status', 'ignored', 'reason', 'capacity_backlog');
  end if;

  insert into public.ai_execution_requests (
    org_id, operation_id, conversation_id, request_message_id, mode,
    expected_conversation_version, input_snapshot, idempotency_key, actor_user_id
  ) values (
    v_message.org_id, v_message.operation_id, v_message.conversation_id, v_message.id,
    v_conversation.ai_mode, v_conversation.version,
    jsonb_build_object('source', 'whatsapp_inbound', 'message_id', v_message.id),
    'ai-inbound:' || v_message.id::text || ':' || v_conversation.ai_mode,
    null
  ) returning * into v_request;
  return jsonb_build_object('status', v_request.result, 'execution_id', v_request.execution_id);
exception when unique_violation then
  select id into v_existing
  from public.ai_executions
  where request_message_id = p_message_id and mode = v_conversation.ai_mode
  limit 1;
  return jsonb_build_object('status', 'existing', 'execution_id', v_existing);
end;
$$;

revoke all on function public.ensure_inbound_ai_execution(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_inbound_ai_execution(uuid) to service_role;

-- Returning a conversation to Pedro now restores the current organization
-- mode, revalidates hard stops and requeues the latest inbound message once.
create or replace function private.process_conversation_takeover_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
  v_membership_id uuid;
  v_ai_mode text := 'off';
  v_message_id uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'conversation_action_actor_mismatch' using errcode = '42501';
  end if;

  select * into v_conversation
  from public.conversations c
  where c.id = new.conversation_id
  for update;
  if not found or v_conversation.org_id <> new.org_id
     or not private.can_access_conversation(v_conversation.id) then
    raise exception 'conversation_action_forbidden' using errcode = '42501';
  end if;
  if v_conversation.version <> new.expected_version then
    raise exception 'conversation_version_conflict' using errcode = '40001';
  end if;

  v_membership_id := private.current_membership_id(new.org_id);
  if new.action = 'return_to_ai' then
    select ai_global_mode into v_ai_mode
    from public.organization_settings
    where org_id = new.org_id;
    if coalesce(v_ai_mode, 'off') = 'off' then
      raise exception 'ai_global_mode_off' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.contacts ct
      where ct.id = v_conversation.contact_id and ct.status = 'active'
    ) then
      raise exception 'contact_not_active' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.opt_outs oo
      where oo.operation_id = v_conversation.operation_id
        and oo.contact_id = v_conversation.contact_id
        and oo.revoked_at is null
    ) then
      raise exception 'active_opt_out_blocks_ai' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.contact_phones cp
      join public.suppression_entries se
        on se.operation_id = v_conversation.operation_id
       and se.phone_e164 = cp.e164
       and se.revoked_at is null
       and (se.expires_at is null or se.expires_at > now())
      where cp.contact_id = v_conversation.contact_id and cp.status = 'active'
    ) then
      raise exception 'active_suppression_blocks_ai' using errcode = '22023';
    end if;
  end if;

  update public.conversations
  set ownership = case when new.action = 'return_to_ai' then 'ai' else 'human' end,
      assigned_membership_id = case
        when new.action = 'return_to_ai' then null
        else coalesce(assigned_membership_id, v_membership_id)
      end,
      status = case
        when new.action = 'close' then 'closed'
        when new.action = 'pause' then 'paused'
        else 'active'
      end,
      ai_mode = case when new.action = 'return_to_ai' then v_ai_mode else 'off' end,
      pause_reason = case
        when new.action = 'pause' then coalesce(nullif(trim(new.reason), ''), 'Pausa manual')
        else null
      end,
      closed_at = case when new.action = 'close' then now() else null end,
      version = version + 1,
      updated_at = now()
  where id = v_conversation.id;

  if new.action = 'return_to_ai' then
    select m.id into v_message_id
    from public.messages m
    where m.conversation_id = v_conversation.id and m.direction = 'inbound'
    order by m.created_at desc, m.id desc
    limit 1;
    if v_message_id is not null then
      insert into private.outbox_events (
        org_id, operation_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
      ) values (
        new.org_id, v_conversation.operation_id, 'message.inbound.requeued.v1',
        'message', v_message_id, jsonb_build_object('message_id', v_message_id),
        'conversation-return-ai:' || new.id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  end if;

  insert into audit.events (
    org_id, operation_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.org_id, v_conversation.operation_id, (select auth.uid()),
    'conversation.' || new.action, 'conversations', v_conversation.id,
    jsonb_build_object(
      'reason', new.reason,
      'from_version', v_conversation.version,
      'ai_mode', case when new.action = 'return_to_ai' then v_ai_mode else 'off' end
    )
  );
  new.resulting_version := v_conversation.version + 1;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_conversation_takeover_request()
  from public, anon, authenticated, service_role;

-- These two crons only produced queue messages. The runtime worker already
-- dispatches and consumes them in one bounded cycle, so parallel dispatchers
-- could lease far more work than one invocation could consume.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
    where jobname in ('gril-outbox-dispatch', 'gril-scheduled-job-dispatch')
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

-- Recover the currently reported assisted conversation without hard-coding a
-- generated database id. This is intentionally limited to assisted mode, so
-- the correction can create a suggestion but can never send automatically.
do $$
declare
  v_target record;
  v_message_id uuid;
begin
  for v_target in
    select c.id, c.org_id, c.operation_id
    from public.conversations c
    join public.contacts ct on ct.id = c.contact_id
    join public.whatsapp_connections wc on wc.id = c.connection_id
    join public.organization_settings os on os.org_id = c.org_id
    where lower(trim(ct.name)) = 'arthur rocha'
      and wc.provider = 'uazapi'
      and wc.phone_e164 = '+5511997175136'
      and os.ai_global_mode = 'assisted'
      and c.status = 'active'
      and c.ownership = 'ai'
      and c.pause_reason is null
      and ct.status = 'active'
      and not exists (
        select 1 from public.opt_outs oo
        where oo.operation_id = c.operation_id
          and oo.contact_id = c.contact_id
          and oo.revoked_at is null
      )
      and not exists (
        select 1
        from public.contact_phones cp
        join public.suppression_entries se
          on se.operation_id = c.operation_id
         and se.phone_e164 = cp.e164
         and se.revoked_at is null
         and (se.expires_at is null or se.expires_at > now())
        where cp.contact_id = c.contact_id and cp.status = 'active'
      )
  loop
    update public.conversations
    set ai_mode = 'assisted', version = version + 1, updated_at = now()
    where id = v_target.id and ai_mode <> 'assisted';

    select m.id into v_message_id
    from public.messages m
    where m.conversation_id = v_target.id and m.direction = 'inbound'
    order by m.created_at desc, m.id desc
    limit 1;
    if v_message_id is not null then
      insert into private.outbox_events (
        org_id, operation_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
      ) values (
        v_target.org_id, v_target.operation_id, 'message.inbound.requeued.v1',
        'message', v_message_id, jsonb_build_object('message_id', v_message_id),
        'repair-assisted-conversation:' || v_message_id::text
      ) on conflict (idempotency_key) do nothing;
    end if;
  end loop;
end;
$$;

commit;
