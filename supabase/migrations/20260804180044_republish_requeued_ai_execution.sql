begin;

-- A failed/superseded execution can be reused by the manual and automatic
-- recovery paths. Requeueing alone is insufficient: the original outbox event
-- was already consumed, so publish a fresh event for the runtime worker.
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
  v_recovery_key text;
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
      v_recovery_key := 'ai-inbound-recovery:' || v_existing.id::text || ':' ||
        extract(epoch from coalesce(v_existing.completed_at, v_existing.created_at))::bigint::text;

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

      insert into private.outbox_events(
        org_id, operation_id, event_type, aggregate_type, aggregate_id,
        payload, idempotency_key
      ) values (
        v_existing.org_id,
        v_existing.operation_id,
        'ai.execution_requeued.v1',
        'ai_execution',
        v_existing.id,
        jsonb_build_object(
          'execution_id', v_existing.id,
          'mode', v_existing.mode,
          'source', 'inbound_recovery'
        ),
        v_recovery_key
      ) on conflict (idempotency_key) do nothing;
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

commit;
