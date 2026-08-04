begin;

-- Uazapi can report messages written directly in the connected WhatsApp app.
-- Handle those before the normal inbound trigger and do not let them look like
-- lead messages or API echoes.
create or replace function private.process_external_outbound_webhook_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_contact_id uuid;
  v_opportunity_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_stage_id uuid;
  v_webhook_id uuid;
  v_ai_mode text;
begin
  if coalesce(new.payload #>> '{_gril,event_kind}', '') <> 'external_outbound' then
    return new;
  end if;

  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'webhook_ingest_service_role_required' using errcode = '42501';
  end if;

  select * into v_connection
  from public.whatsapp_connections c
  where c.id = new.connection_id and c.org_id = new.org_id
  for update;

  if not found or v_connection.status <> 'active' or not v_connection.inbound_enabled then
    raise exception 'connection_not_active_for_inbound' using errcode = '22023';
  end if;

  insert into private.webhook_inbox(
    org_id, connection_id, provider, external_event_id, payload_sha256, payload
  ) values (
    new.org_id, new.connection_id, v_connection.provider,
    new.external_event_id, new.payload_sha256, new.payload
  )
  on conflict(connection_id, external_event_id) do nothing
  returning id into v_webhook_id;

  if v_webhook_id is null then
    return null;
  end if;

  -- API-originated messages may still arrive despite provider filters. A
  -- provider id already known by Gril is only an echo and must not trigger a
  -- human handoff.
  select m.conversation_id, m.id into v_conversation_id, v_message_id
  from public.messages m
  where m.org_id = new.org_id
    and m.provider_message_id = new.provider_message_id
  order by m.created_at desc
  limit 1;
  if found then
    update private.webhook_inbox
    set status = 'processed', attempts = 1, processed_at = now()
    where id = v_webhook_id;
    return null;
  end if;

  select cp.contact_id into v_contact_id
  from public.contact_phones cp
  where cp.org_id = new.org_id
    and cp.e164 = new.from_e164
    and cp.status = 'active'
  for update;

  if not found then
    insert into public.contacts(org_id, name, created_by)
    values(new.org_id, coalesce(nullif(trim(new.contact_name), ''), 'Contato do WhatsApp'), null)
    returning id into v_contact_id;
    insert into public.contact_phones(org_id, contact_id, e164, original, is_primary)
    values(new.org_id, v_contact_id, new.from_e164, new.from_e164, true);
  end if;

  select o.id into v_opportunity_id
  from public.opportunities o
  where o.org_id = new.org_id
    and o.operation_id = v_connection.operation_id
    and o.contact_id = v_contact_id
    and o.status = 'open'
  order by o.created_at desc
  limit 1
  for update;

  if not found then
    select id into v_stage_id
    from public.pipeline_stages
    where org_id = new.org_id and code = 'new';
    insert into public.opportunities(
      org_id, operation_id, contact_id, pipeline_stage_id, source, created_by
    ) values (
      new.org_id, v_connection.operation_id, v_contact_id, v_stage_id,
      'whatsapp_device', null
    ) returning id into v_opportunity_id;
    insert into public.opportunity_stage_history(
      org_id, operation_id, opportunity_id, to_stage_id,
      actor_type, reason, opportunity_version
    ) values (
      new.org_id, v_connection.operation_id, v_opportunity_id, v_stage_id,
      'system', 'Criada por mensagem enviada no celular conectado', 1
    );
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.opportunity_id = v_opportunity_id
    and c.status in ('active', 'paused')
  for update;

  if not found then
    select case
      when ai_global_mode = 'production' then 'assisted'
      else ai_global_mode
    end into v_ai_mode
    from public.organization_settings
    where org_id = new.org_id;

    insert into public.conversations(
      org_id, operation_id, contact_id, opportunity_id, connection_id,
      status, ownership, ai_mode, pause_reason
    ) values (
      new.org_id, v_connection.operation_id, v_contact_id, v_opportunity_id,
      v_connection.id, 'active', 'pending_handoff', coalesce(v_ai_mode, 'off'),
      'external_human_intervention'
    ) returning id into v_conversation_id;
    update public.opportunities
    set current_conversation_id = v_conversation_id,
        version = version + 1,
        updated_at = now()
    where id = v_opportunity_id;
  end if;

  insert into public.messages(
    org_id, operation_id, conversation_id, direction, sender_type,
    content_type, body, provider_message_id, provider_status,
    provider_timestamp, metadata
  ) values (
    new.org_id, v_connection.operation_id, v_conversation_id, 'outbound', 'user',
    new.content_type, new.body, new.provider_message_id, 'sent',
    coalesce(new.provider_timestamp, now()),
    new.payload || jsonb_build_object(
      'source', 'whatsapp_device',
      'external_human_intervention', true
    )
  ) returning id into v_message_id;

  update public.conversations
  set connection_id = v_connection.id,
      status = 'active',
      closed_at = null,
      ownership = 'pending_handoff',
      assigned_membership_id = null,
      pause_reason = 'external_human_intervention',
      last_outbound_at = coalesce(new.provider_timestamp, now()),
      last_message_preview = left(coalesce(new.body, '[' || new.content_type || ']'), 180),
      version = version + 1,
      updated_at = now()
  where id = v_conversation_id;

  update public.ai_suggestions
  set status = 'superseded'
  where conversation_id = v_conversation_id and status = 'pending';

  update public.scheduled_jobs
  set status = 'cancelled',
      last_error = 'external_human_intervention',
      updated_at = now()
  where aggregate_type = 'conversation'
    and aggregate_id = v_conversation_id
    and status = 'pending'
    and job_type in ('ai.inbound.aggregate', 'followup.ai_turn', 'followup.future.expire');

  insert into public.escalations(
    org_id, operation_id, conversation_id, opportunity_id,
    category, severity, reason
  )
  select
    new.org_id, v_connection.operation_id, v_conversation_id, v_opportunity_id,
    'external_human_intervention', 'normal',
    'Uma pessoa respondeu pelo celular conectado. Pedro deve considerar a mensagem como contexto e aguardar orientação do gestor.'
  where not exists (
    select 1 from public.escalations e
    where e.conversation_id = v_conversation_id
      and e.category = 'external_human_intervention'
      and e.status <> 'resolved'
  );

  insert into private.outbox_events(
    org_id, operation_id, event_type, aggregate_type, aggregate_id,
    payload, idempotency_key
  ) values (
    new.org_id, v_connection.operation_id,
    'message.external_human_intervention.v1', 'conversation', v_conversation_id,
    jsonb_build_object(
      'message_id', v_message_id,
      'opportunity_id', v_opportunity_id,
      'connection_id', v_connection.id
    ),
    'external-outbound:' || new.connection_id::text || ':' || new.external_event_id
  );

  update public.opportunities
  set last_activity_at = now(), updated_at = now()
  where id = v_opportunity_id;

  update private.webhook_inbox
  set status = 'processed', attempts = 1, processed_at = now()
  where id = v_webhook_id;

  return null;
end;
$$;

revoke all on function private.process_external_outbound_webhook_request()
from public, anon, authenticated, service_role;

drop trigger if exists webhook_ingest_external_outbound_process
on public.webhook_ingest_requests;
create trigger webhook_ingest_external_outbound_process
before insert on public.webhook_ingest_requests
for each row execute function private.process_external_outbound_webhook_request();

-- Repair the confirmed false positive for Arthur Rocha. Preserve the audit
-- trail and the already-delivered acknowledgement, but remove the incorrect
-- suppression and restore the assisted conversation.
update public.suppression_entries
set revoked_at = now()
where id = '59220f67-9a98-4a91-81dd-4b60720865ba'::uuid
  and source = 'wrong_number'
  and revoked_at is null;

update public.conversations
set status = 'active',
    closed_at = null,
    ownership = 'ai',
    ai_mode = 'assisted',
    pause_reason = null,
    version = version + 1,
    updated_at = now()
where id = 'c4cd43ef-dc0e-42bf-82fa-6834e91c927b'::uuid
  and pause_reason = 'wrong_number';

update public.ai_suggestions
set status = 'superseded'
where conversation_id = 'c4cd43ef-dc0e-42bf-82fa-6834e91c927b'::uuid
  and status = 'pending';

do $$
declare
  v_conversation public.conversations%rowtype;
  v_message public.messages%rowtype;
  v_previous_role text;
begin
  select * into v_conversation
  from public.conversations
  where id = 'c4cd43ef-dc0e-42bf-82fa-6834e91c927b'::uuid;
  if not found or v_conversation.status <> 'active' then
    return;
  end if;

  select * into v_message
  from public.messages
  where conversation_id = v_conversation.id and direction = 'inbound'
  order by coalesce(provider_timestamp, created_at) desc, created_at desc
  limit 1;

  v_previous_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  perform set_config('request.jwt.claim.role', 'service_role', true);

  insert into public.capacity_reservation_requests(
    org_id, operation_id, conversation_id, action, source
  ) values (
    v_conversation.org_id, v_conversation.operation_id,
    v_conversation.id, 'wake', 'inbound'
  );

  if v_message.id is not null then
    insert into public.scheduled_jobs(
      org_id, operation_id, job_type, aggregate_type, aggregate_id,
      target_queue, run_at, dedupe_key, payload, max_attempts
    ) values (
      v_conversation.org_id, v_conversation.operation_id,
      'ai.inbound.aggregate', 'conversation', v_conversation.id,
      'scheduled-actions', now() + interval '2 seconds',
      'incident-recovery:arthur-wrong-number:' || v_message.id::text,
      jsonb_build_object(
        'conversation_id', v_conversation.id,
        'message_id', v_message.id,
        'first_message_at', coalesce(v_message.provider_timestamp, v_message.created_at)
      ),
      3
    ) on conflict do nothing;
  end if;

  insert into audit.events(
    org_id, operation_id, action, entity_type, entity_id, metadata
  ) values (
    v_conversation.org_id, v_conversation.operation_id,
    'conversation.false_wrong_number_recovered', 'conversations', v_conversation.id,
    jsonb_build_object(
      'source_message_id', 'd5396375-e679-4cba-9c0f-fe9fe10a9447',
      'suppression_entry_id', '59220f67-9a98-4a91-81dd-4b60720865ba'
    )
  );

  perform set_config('request.jwt.claim.role', v_previous_role, true);
end;
$$;

commit;
