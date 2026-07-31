begin;

-- Runtime consumers are deliberately exposed only as service-role RPCs. The
-- browser never reads PGMQ or Vault directly.
create or replace function private.route_event_queue(p_event_type text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_event_type like 'message.inbound%' or p_event_type like 'ai.%' then 'ai-turns'
    when p_event_type like 'message.send%' then 'outbound-whatsapp'
    when p_event_type like 'call.%' then 'call-distribution'
    when p_event_type like 'campaign.%' then 'campaign-dispatch'
    when p_event_type like 'notification.%' or p_event_type like 'alert.%' then 'notifications'
    when p_event_type like 'media.%' then 'media-processing'
    else 'reconciliation'
  end;
$$;
revoke all on function private.route_event_queue(text) from public, anon, authenticated, service_role;

create or replace function public.runtime_queue_read(
  p_queue_name text,
  p_visibility_timeout integer default 90,
  p_limit integer default 5
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if p_queue_name not in (
    'ai-turns','outbound-whatsapp','scheduled-actions','call-distribution',
    'campaign-dispatch','media-processing','notifications','reconciliation'
  ) then
    raise exception 'runtime_queue_not_allowed' using errcode='22023';
  end if;
  return query
    select r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
    from pgmq.read(
      p_queue_name,
      greatest(15, least(coalesce(p_visibility_timeout,90),600)),
      greatest(1, least(coalesce(p_limit,5),25)),
      '{}'::jsonb
    ) r;
end;
$$;
revoke all on function public.runtime_queue_read(text,integer,integer) from public, anon, authenticated;
grant execute on function public.runtime_queue_read(text,integer,integer) to service_role;

create or replace function public.runtime_queue_archive(p_queue_name text,p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_queue_name not in ('ai-turns','outbound-whatsapp','scheduled-actions','call-distribution','campaign-dispatch','media-processing','notifications','reconciliation') then
    raise exception 'runtime_queue_not_allowed' using errcode='22023';
  end if;
  return pgmq.archive(p_queue_name,p_msg_id);
end;
$$;
revoke all on function public.runtime_queue_archive(text,bigint) from public, anon, authenticated;
grant execute on function public.runtime_queue_archive(text,bigint) to service_role;

create or replace function public.runtime_queue_retry(p_queue_name text,p_msg_id bigint,p_delay_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_queue_name not in ('ai-turns','outbound-whatsapp','scheduled-actions','call-distribution','campaign-dispatch','media-processing','notifications','reconciliation') then
    raise exception 'runtime_queue_not_allowed' using errcode='22023';
  end if;
  perform pgmq.set_vt(p_queue_name,p_msg_id,greatest(5,least(coalesce(p_delay_seconds,30),3600)));
  return true;
end;
$$;
revoke all on function public.runtime_queue_retry(text,bigint,integer) from public, anon, authenticated;
grant execute on function public.runtime_queue_retry(text,bigint,integer) to service_role;

create or replace function public.dispatch_runtime_sources(p_batch_size integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_events integer;v_jobs integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  v_events:=private.dispatch_outbox(greatest(1,least(coalesce(p_batch_size,100),500)));
  v_jobs:=private.dispatch_due_jobs(greatest(1,least(coalesce(p_batch_size,100),500)));
  return jsonb_build_object('events',v_events,'jobs',v_jobs);
end;
$$;
revoke all on function public.dispatch_runtime_sources(integer) from public, anon, authenticated;
grant execute on function public.dispatch_runtime_sources(integer) to service_role;

-- New inbound conversations inherit the owner-controlled global AI mode. The
-- seeded default remains off, so production cannot start by accident.
create or replace function private.apply_default_conversation_ai_mode()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_mode text;
begin
  select ai_global_mode into v_mode from public.organization_settings where org_id=new.org_id;
  if coalesce(v_mode,'off') <> 'off' then
    update public.conversations set ai_mode=v_mode,updated_at=now() where id=new.id;
    new.ai_mode:=v_mode;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_default_conversation_ai_mode() from public, anon, authenticated, service_role;
create trigger conversations_default_ai_mode
after insert on public.conversations
for each row execute function private.apply_default_conversation_ai_mode();

create unique index if not exists ai_executions_one_inbound_mode_idx
  on public.ai_executions(request_message_id,mode)
  where request_message_id is not null and mode in ('shadow','assisted','production');

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
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_message from public.messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('status','ignored','reason','inbound_message_not_found'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  if not found or v_conversation.status<>'active' or v_conversation.ai_mode='off' or v_conversation.ownership='human' then
    return jsonb_build_object('status','ignored','reason','ai_not_eligible');
  end if;
  select id into v_existing from public.ai_executions where request_message_id=p_message_id and mode=v_conversation.ai_mode limit 1;
  if v_existing is not null then return jsonb_build_object('status','existing','execution_id',v_existing); end if;

  insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
  values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'reserve','inbound')
  returning * into v_capacity;
  if v_capacity.result='backlog' then return jsonb_build_object('status','ignored','reason','capacity_backlog'); end if;

  insert into public.ai_execution_requests(
    org_id,operation_id,conversation_id,request_message_id,mode,
    expected_conversation_version,input_snapshot,idempotency_key,actor_user_id
  ) values (
    v_message.org_id,v_message.operation_id,v_message.conversation_id,v_message.id,v_conversation.ai_mode,
    v_conversation.version,jsonb_build_object('source','whatsapp_inbound','message_id',v_message.id),
    'ai-inbound:'||v_message.id::text||':'||v_conversation.ai_mode,null
  ) returning * into v_request;
  return jsonb_build_object('status',v_request.result,'execution_id',v_request.execution_id);
exception when unique_violation then
  select id into v_existing from public.ai_executions where request_message_id=p_message_id and mode=v_conversation.ai_mode limit 1;
  return jsonb_build_object('status','existing','execution_id',v_existing);
end;
$$;
revoke all on function public.ensure_inbound_ai_execution(uuid) from public, anon, authenticated;
grant execute on function public.ensure_inbound_ai_execution(uuid) to service_role;

create or replace function public.apply_inbound_control_intent(p_message_id uuid,p_intent text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_message public.messages%rowtype;v_conversation public.conversations%rowtype;v_ack uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_intent not in ('opt_out','privacy','sensitive_document') then raise exception 'control_intent_invalid' using errcode='22023'; end if;
  select * into v_message from public.messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  if p_intent='opt_out' then
    insert into public.opt_outs(org_id,operation_id,contact_id,reason,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.contact_id,'Solicitado na conversa','contact')
    on conflict (operation_id,contact_id,channel) where revoked_at is null do nothing;
    update public.conversations set ai_mode='off',updated_at=now() where id=v_conversation.id;
    if not exists(select 1 from public.messages m where m.conversation_id=v_conversation.id and m.metadata->>'control_ack_for'=v_message.id::text) then
      insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
      values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'outbound','system','text','Tudo bem. Não enviaremos novas mensagens por aqui.','queued',v_message.id,
        jsonb_build_object('control_ack_for',v_message.id,'opt_out_ack',true)) returning id into v_ack;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_message.org_id,v_message.operation_id,'message.outbound.send','message',v_ack,'outbound-whatsapp',now(),'opt-out-ack:'||v_message.id::text,jsonb_build_object('message_id',v_ack),3);
    end if;
    return jsonb_build_object('status','opted_out','message_id',v_ack);
  end if;
  update public.conversations set status='paused',ownership='pending_handoff',pause_reason=p_intent,ai_mode='off',updated_at=now() where id=v_conversation.id;
  insert into public.escalations(org_id,operation_id,conversation_id,opportunity_id,category,severity,reason)
  values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,v_conversation.opportunity_id,p_intent,'immediate',
    case when p_intent='privacy' then 'Solicitação de privacidade exige atendimento humano.' else 'Possível documento sensível recebido; conteúdo não enviado ao modelo.' end);
  return jsonb_build_object('status','paused_for_handoff');
end;
$$;
revoke all on function public.apply_inbound_control_intent(uuid,text) from public, anon, authenticated;
grant execute on function public.apply_inbound_control_intent(uuid,text) to service_role;

create or replace function public.start_ai_execution(p_execution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_count integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.ai_executions set status='running',started_at=now(),error_code=null,error_redacted=null
  where id=p_execution_id and status='queued';
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;
revoke all on function public.start_ai_execution(uuid) from public, anon, authenticated;
grant execute on function public.start_ai_execution(uuid) to service_role;

create or replace function public.complete_ai_execution(
  p_execution_id uuid,
  p_output_text text,
  p_output_structured jsonb,
  p_response_id text,
  p_model_returned text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_message_id uuid;
  v_delay integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if nullif(trim(p_output_text),'') is null or char_length(p_output_text)>4096 then raise exception 'ai_output_invalid' using errcode='22023'; end if;
  select * into v_execution from public.ai_executions where id=p_execution_id for update;
  if not found or v_execution.status<>'running' then return jsonb_build_object('status','ignored'); end if;

  if v_execution.conversation_id is not null then
    select * into v_conversation from public.conversations where id=v_execution.conversation_id for update;
    if not found or v_conversation.version<>v_execution.expected_conversation_version then
      update public.ai_executions set status='superseded',error_code='conversation_version_conflict',error_redacted='Uma mensagem mais recente substituiu esta execução.',completed_at=now()
      where id=v_execution.id;
      return jsonb_build_object('status','superseded');
    end if;
  end if;

  update public.ai_executions set status='completed',output_text=p_output_text,output_structured=coalesce(p_output_structured,'{}'::jsonb),
    response_id=p_response_id,model_returned=p_model_returned,input_tokens=greatest(0,coalesce(p_input_tokens,0)),
    output_tokens=greatest(0,coalesce(p_output_tokens,0)),latency_ms=greatest(0,coalesce(p_latency_ms,0)),completed_at=now()
  where id=v_execution.id;
  insert into public.usage_ledger(org_id,operation_id,execution_id,usage_type,model_identifier,input_tokens,output_tokens,estimated_cost)
  select v_execution.org_id,v_execution.operation_id,v_execution.id,
    case when v_execution.mode in ('simulator','regression') then v_execution.mode else 'service' end,
    coalesce(p_model_returned,m.model_identifier,'unknown'),greatest(0,coalesce(p_input_tokens,0)),greatest(0,coalesce(p_output_tokens,0)),0
  from public.model_profiles m where m.id=v_execution.model_profile_id;

  if coalesce(p_output_structured->>'action','reply')<>'reply' and v_execution.conversation_id is not null then
    update public.conversations set status='paused',ownership='pending_handoff',pause_reason='ai_escalation',updated_at=now() where id=v_execution.conversation_id;
    insert into public.escalations(org_id,operation_id,conversation_id,opportunity_id,category,severity,reason)
    select v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,c.opportunity_id,
      coalesce(nullif(p_output_structured->>'action',''),'ai_escalation'),'immediate',
      left(coalesce(nullif(p_output_structured->>'escalation_reason',''),'Pedro solicitou revisão humana.'),1000)
    from public.conversations c where c.id=v_execution.conversation_id;
    return jsonb_build_object('status','escalated');
  end if;

  if v_execution.mode in ('shadow','assisted') then
    insert into public.ai_suggestions(org_id,execution_id,conversation_id,body)
    values(v_execution.org_id,v_execution.id,v_execution.conversation_id,p_output_text);
    return jsonb_build_object('status','suggestion_created');
  end if;

  if v_execution.mode='production' then
    if v_conversation.ai_mode<>'production' or v_conversation.ownership<>'ai' or v_conversation.status<>'active'
       or exists(select 1 from public.opt_outs o where o.operation_id=v_conversation.operation_id and o.contact_id=v_conversation.contact_id and o.revoked_at is null)
       or exists(select 1 from public.system_pauses s where s.org_id=v_conversation.org_id and s.active and s.scope_type in ('global','organization')) then
      update public.ai_executions set error_code='production_preconditions_changed',error_redacted='A resposta foi gerada, mas o envio foi bloqueado por uma regra determinística.' where id=v_execution.id;
      return jsonb_build_object('status','blocked');
    end if;
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
    values(v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,'outbound','ai','text',p_output_text,'queued',v_execution.request_message_id,
      jsonb_build_object('ai_execution_id',v_execution.id)) returning id into v_message_id;
    v_delay:=least(25,greatest(3,ceil(char_length(p_output_text)/18.0)::integer));
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
    values(v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message_id,'outbound-whatsapp',now()+make_interval(secs=>v_delay),
      'ai-message-send:'||v_message_id::text,jsonb_build_object('message_id',v_message_id),3);
    return jsonb_build_object('status','send_scheduled','message_id',v_message_id);
  end if;
  return jsonb_build_object('status','completed');
end;
$$;
revoke all on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer) to service_role;

create or replace function public.fail_ai_execution(p_execution_id uuid,p_error_code text,p_error_redacted text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.ai_executions set status='failed',error_code=left(coalesce(p_error_code,'runtime_error'),100),error_redacted=left(coalesce(p_error_redacted,'Falha ao executar IA.'),500),completed_at=now()
  where id=p_execution_id and status in ('queued','running');
  insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
  select org_id,operation_id,'warning','ai','Falha na execução do Pedro',left(coalesce(p_error_redacted,'Falha ao executar IA.'),500),'ai_execution',id,'ai-execution-failed:'||id::text
  from public.ai_executions where id=p_execution_id
  on conflict (org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
end;
$$;
revoke all on function public.fail_ai_execution(uuid,text,text) from public, anon, authenticated;
grant execute on function public.fail_ai_execution(uuid,text,text) to service_role;

create or replace function public.retry_ai_execution(p_execution_id uuid,p_error_code text,p_error_redacted text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_count integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.ai_executions set status='queued',started_at=null,error_code=left(coalesce(p_error_code,'retryable_error'),100),
    error_redacted=left(coalesce(p_error_redacted,'Falha temporária; nova tentativa agendada.'),500)
  where id=p_execution_id and status='running';
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;
revoke all on function public.retry_ai_execution(uuid,text,text) from public, anon, authenticated;
grant execute on function public.retry_ai_execution(uuid,text,text) to service_role;

create or replace function public.apply_provider_message_status(
  p_connection_id uuid,p_provider_message_id text,p_status text,p_provider_timestamp timestamptz default null,p_error_redacted text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_message public.messages%rowtype;v_rank_old integer;v_rank_new integer;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_status not in ('sent','delivered','read','failed') then raise exception 'provider_status_invalid' using errcode='22023'; end if;
  select m.* into v_message from public.messages m join public.conversations c on c.id=m.conversation_id
  where c.connection_id=p_connection_id and m.provider_message_id=p_provider_message_id and m.direction='outbound' for update of m;
  if not found then return false; end if;
  v_rank_old:=case v_message.provider_status when 'queued' then 0 when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end;
  v_rank_new:=case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else -1 end;
  if p_status='failed' and v_message.provider_status in ('queued','sent') then
    update public.messages set provider_status='failed',provider_timestamp=coalesce(p_provider_timestamp,provider_timestamp),error_redacted=left(p_error_redacted,500) where id=v_message.id;
    return true;
  elsif v_rank_new>v_rank_old then
    update public.messages set provider_status=p_status,provider_timestamp=coalesce(p_provider_timestamp,provider_timestamp),error_redacted=null where id=v_message.id;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.apply_provider_message_status(uuid,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.apply_provider_message_status(uuid,text,text,timestamptz,text) to service_role;

create or replace function public.claim_outbound_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_message public.messages%rowtype;v_conversation public.conversations%rowtype;v_phone text;v_connection public.whatsapp_connections%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_message from public.messages where id=p_message_id for update;
  if not found or v_message.direction<>'outbound' or v_message.provider_status<>'queued' then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  select * into v_connection from public.whatsapp_connections where id=v_conversation.connection_id;
  select e164 into v_phone from public.contact_phones where contact_id=v_conversation.contact_id and status='active' order by is_primary desc,created_at limit 1;
  if v_phone is null or v_connection.status<>'active' or (v_message.sender_type='ai' and (v_conversation.ownership<>'ai' or v_conversation.ai_mode<>'production' or v_conversation.status<>'active'))
     or (coalesce((v_message.metadata->>'opt_out_ack')::boolean,false)=false and exists(select 1 from public.opt_outs o where o.operation_id=v_conversation.operation_id and o.contact_id=v_conversation.contact_id and o.revoked_at is null))
     or exists(select 1 from public.suppression_entries s where s.operation_id=v_conversation.operation_id and s.phone_e164=v_phone and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())) then
    update public.messages set provider_status='suppressed',error_redacted='Envio bloqueado por conexão, ownership, opt-out ou supressão.' where id=v_message.id;
    update public.campaign_contacts set status='suppressed',suppression_reason='runtime_revalidation',last_revalidated_at=now(),updated_at=now()
    where id=nullif(v_message.metadata->>'campaign_contact_id','')::uuid;
    return jsonb_build_object('status','suppressed');
  end if;
  update public.messages set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('send_state','sending','send_started_at',now(),'send_attempt',coalesce((metadata->>'send_attempt')::integer,0)+1)
  where id=v_message.id;
  return jsonb_build_object('status','claimed','message_id',v_message.id,'org_id',v_message.org_id,'operation_id',v_message.operation_id,
    'conversation_id',v_message.conversation_id,'connection_id',v_connection.id,'integration_account_id',v_connection.integration_account_id,
    'provider',v_connection.provider,'endpoint_url',v_connection.endpoint_url,'to_e164',v_phone,'body',v_message.body,
    'connection_settings',v_connection.settings);
end;
$$;
revoke all on function public.claim_outbound_message(uuid) from public, anon, authenticated;
grant execute on function public.claim_outbound_message(uuid) to service_role;

create or replace function public.complete_outbound_message(p_message_id uuid,p_provider_message_id text,p_provider_timestamp timestamptz default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_conversation uuid;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.messages set provider_status='sent',provider_message_id=p_provider_message_id,provider_timestamp=coalesce(p_provider_timestamp,now()),error_redacted=null,
    metadata=(metadata-'send_state')||jsonb_build_object('send_completed_at',now()) where id=p_message_id and provider_status='queued' returning conversation_id into v_conversation;
  if v_conversation is not null then
    update public.conversations set last_outbound_at=now(),last_message_preview=(select left(coalesce(body,'[mídia]'),180) from public.messages where id=p_message_id),version=version+1,updated_at=now() where id=v_conversation;
    update public.campaign_contacts set status='contacted',attempts=attempts+1,next_send_at=null,last_revalidated_at=now(),updated_at=now()
    where id=(select nullif(metadata->>'campaign_contact_id','')::uuid from public.messages where id=p_message_id);
  end if;
end;
$$;
revoke all on function public.complete_outbound_message(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.complete_outbound_message(uuid,text,timestamptz) to service_role;

create or replace function public.fail_outbound_message(p_message_id uuid,p_error_code text,p_error_redacted text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.messages set provider_status='failed',error_redacted=left(coalesce(p_error_redacted,'Falha no envio.'),500),metadata=(metadata-'send_state')||jsonb_build_object('send_error_code',left(p_error_code,100),'send_failed_at',now()) where id=p_message_id and provider_status='queued';
  insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
  select org_id,operation_id,'warning','whatsapp','Falha no envio WhatsApp',left(coalesce(p_error_redacted,'Falha no envio.'),500),'message',id,'message-send-failed:'||id::text from public.messages where id=p_message_id
  on conflict (org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
end;
$$;
revoke all on function public.fail_outbound_message(uuid,text,text) from public, anon, authenticated;
grant execute on function public.fail_outbound_message(uuid,text,text) to service_role;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_offer public.call_offers%rowtype;
  v_call public.calls%rowtype;
  v_campaign public.campaigns%rowtype;
  v_campaign_contact public.campaign_contacts%rowtype;
  v_contact public.contacts%rowtype;
  v_conversation public.conversations%rowtype;
  v_message_id uuid;
  v_body text;
  v_local_time time;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;

  if v_job.job_type='campaign.contact.dispatch' then
    select * into v_campaign_contact from public.campaign_contacts where id=(v_job.payload->>'campaign_contact_id')::uuid for update;
    select * into v_campaign from public.campaigns where id=v_campaign_contact.campaign_id for update;
    select * into v_contact from public.contacts where id=v_campaign_contact.contact_id;
    if not found or v_campaign.status<>'running' or v_campaign_contact.status<>'queued' then return jsonb_build_object('status','cancelled'); end if;
    v_local_time:=(now() at time zone v_campaign.timezone)::time;
    if v_local_time<v_campaign.send_window_start or v_local_time>=v_campaign.send_window_end then return jsonb_build_object('status','retry','retry_seconds',900,'reason','outside_send_window'); end if;
    if exists(select 1 from public.opt_outs where operation_id=v_campaign.operation_id and contact_id=v_campaign_contact.contact_id and revoked_at is null) then
      update public.campaign_contacts set status='suppressed',suppression_reason='opt_out',last_revalidated_at=now(),updated_at=now() where id=v_campaign_contact.id;
      return jsonb_build_object('status','cancelled');
    end if;
    select c.* into v_conversation from public.conversations c where c.opportunity_id=v_campaign_contact.opportunity_id and c.status in ('active','paused') for update;
    if not found then
      insert into public.conversations(org_id,operation_id,contact_id,opportunity_id,connection_id,status,ownership,ai_mode)
      values(v_campaign.org_id,v_campaign.operation_id,v_campaign_contact.contact_id,v_campaign_contact.opportunity_id,v_campaign.connection_id,'active','ai',v_campaign.ai_mode)
      returning * into v_conversation;
      update public.conversations set ai_mode=v_campaign.ai_mode where id=v_conversation.id;
      update public.opportunities set current_conversation_id=v_conversation.id,version=version+1,updated_at=now() where id=v_campaign_contact.opportunity_id;
    end if;
    v_body:=replace(replace(replace(v_campaign.opening_template,'{{nome}}',split_part(v_contact.name,' ',1)),'{{name}}',split_part(v_contact.name,' ',1)),'{{first_name}}',split_part(v_contact.name,' ',1));
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,metadata)
    values(v_campaign.org_id,v_campaign.operation_id,v_conversation.id,'outbound','system','text',v_body,'queued',
      jsonb_build_object('campaign_id',v_campaign.id,'campaign_contact_id',v_campaign_contact.id,'runtime_job_id',v_job.id)) returning id into v_message_id;
    return jsonb_build_object('status','send','message_id',v_message_id);
  end if;

  if v_job.job_type='call.offer.activate' then
    select * into v_offer from public.call_offers where id=(v_job.payload->>'offer_id')::uuid for update;
    select * into v_call from public.calls where id=v_offer.call_id;
    if not found or v_offer.status<>'scheduled' or v_call.status not in ('distributing','unassigned_alerted') or v_offer.expires_at<=now() then
      update public.call_offers set status=case when status='scheduled' then 'cancelled' else status end where id=v_offer.id;
      return jsonb_build_object('status','cancelled');
    end if;
    update public.call_offers set status='pending',sent_at=now() where id=v_offer.id;
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values(v_offer.org_id,v_call.operation_id,'call.offer_sent.v1','call_offer',v_offer.id,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer.id),'call-offer:'||v_offer.id::text)
    on conflict (idempotency_key) do nothing;
    return jsonb_build_object('status','completed');
  end if;

  if v_job.job_type='call.reminder.lead' then
    select * into v_call from public.calls where id=(v_job.payload->>'call_id')::uuid;
    if not found or v_call.status<>'assigned' then return jsonb_build_object('status','cancelled'); end if;
    select c.* into v_conversation from public.opportunities o join public.conversations c on c.id=o.current_conversation_id where o.id=v_call.opportunity_id;
    if not found then return jsonb_build_object('status','cancelled'); end if;
    v_body:=case when (v_job.payload->>'offset')::integer<=10 then 'Lembrete: nossa conversa começa em cerca de 10 minutos. Até já!' else 'Passando para lembrar da nossa conversa agendada para hoje. Se precisar ajustar, me avise por aqui.' end;
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,metadata)
    values(v_call.org_id,v_call.operation_id,v_conversation.id,'outbound','system','text',v_body,'queued',jsonb_build_object('call_id',v_call.id,'runtime_job_id',v_job.id)) returning id into v_message_id;
    return jsonb_build_object('status','send','message_id',v_message_id);
  end if;

  if v_job.job_type='call.result.due' then
    select * into v_call from public.calls where id=(v_job.payload->>'call_id')::uuid;
    if found and v_call.status='assigned' then
      insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
      values(v_call.org_id,v_call.operation_id,'warning','call','Resultado da call pendente','Registre o resultado para manter o funil atualizado.','call',v_call.id,'call-result-due:'||v_call.id::text)
      on conflict (org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    end if;
    return jsonb_build_object('status','completed');
  end if;

  return jsonb_build_object('status','unsupported','reason','unsupported_job_type');
end;
$$;
revoke all on function public.execute_runtime_job(uuid) from public, anon, authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

alter table public.notifications add column source_event_id uuid;
create unique index notifications_source_event_idx on public.notifications(recipient_membership_id,source_event_id,channel) where source_event_id is not null;

create or replace function public.consume_runtime_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_type text:=p_event->>'event_type';v_event_id uuid;v_offer public.call_offers%rowtype;v_call public.calls%rowtype;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  begin v_event_id:=(p_event->>'event_id')::uuid; exception when others then v_event_id:=null; end;
  if v_type='call.offer_sent.v1' then
    select * into v_offer from public.call_offers where id=(p_event->'payload'->>'offer_id')::uuid;
    select * into v_call from public.calls where id=v_offer.call_id;
    if found then
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,source_event_id)
      values(v_offer.org_id,v_offer.recipient_membership_id,'app','Nova oportunidade de call',
        'Uma call está disponível. Abra a agenda para aceitar antes do vencimento.',v_event_id)
      on conflict (recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
    end if;
    return jsonb_build_object('status','notification_created');
  end if;
  return jsonb_build_object('status','acknowledged');
end;
$$;
revoke all on function public.consume_runtime_event(jsonb) from public, anon, authenticated;
grant execute on function public.consume_runtime_event(jsonb) to service_role;

create or replace function public.finish_runtime_job(p_job_id uuid,p_success boolean,p_error_redacted text default null,p_retry_seconds integer default 30)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_job public.scheduled_jobs%rowtype;v_status text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id for update;
  if not found then return 'missing'; end if;
  if p_success then
    update public.scheduled_jobs set status='completed',lease_until=null,last_error=null,updated_at=now() where id=v_job.id;
    return 'completed';
  end if;
  v_status:=case when v_job.attempts+1>=v_job.max_attempts then 'dead' else 'pending' end;
  update public.scheduled_jobs set status=v_status,attempts=attempts+1,lease_until=null,last_error=left(coalesce(p_error_redacted,'runtime_error'),500),
    run_at=case when v_status='pending' then now()+make_interval(secs=>greatest(5,least(coalesce(p_retry_seconds,30),3600))) else run_at end,updated_at=now() where id=v_job.id;
  if v_status='dead' then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_job.org_id,v_job.operation_id,'critical','dead_letter','Job esgotou tentativas','O job '||v_job.job_type||' precisa de revisão manual.','scheduled_jobs',v_job.id,'dead-job:'||v_job.id::text)
    on conflict (org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  end if;
  return v_status;
end;
$$;
revoke all on function public.finish_runtime_job(uuid,boolean,text,integer) from public, anon, authenticated;
grant execute on function public.finish_runtime_job(uuid,boolean,text,integer) to service_role;

create or replace function public.claim_retention_purge(p_limit integer default 10)
returns table(id uuid,org_id uuid,entity_type text,entity_id uuid,storage_bucket text,storage_path text,action text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  return query with picked as (
    select q.id from private.retention_purge_queue q where q.status in ('pending','failed') and q.due_at<=now() and q.attempts<5
    order by q.due_at for update skip locked limit greatest(1,least(coalesce(p_limit,10),50))
  ), changed as (
    update private.retention_purge_queue q set status='processing',attempts=attempts+1,last_error_redacted=null
    from picked where q.id=picked.id returning q.*
  ) select c.id,c.org_id,c.entity_type,c.entity_id,c.storage_bucket,c.storage_path,c.action from changed c;
end;
$$;
revoke all on function public.claim_retention_purge(integer) from public, anon, authenticated;
grant execute on function public.claim_retention_purge(integer) to service_role;

create or replace function public.finish_retention_purge(p_id uuid,p_success boolean,p_error_redacted text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update private.retention_purge_queue set status=case when p_success then 'completed' else 'failed' end,last_error_redacted=case when p_success then null else left(coalesce(p_error_redacted,'storage_delete_failed'),500) end where id=p_id and status='processing';
end;
$$;
revoke all on function public.finish_retention_purge(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.finish_retention_purge(uuid,boolean,text) to service_role;

-- The final deployment calls this once with its public HTTPS URL and a random
-- secret. Supabase Cron then invokes the bounded worker every minute, avoiding
-- dependency on the Vercel plan's Cron quota.
create extension if not exists pg_net with schema extensions;
create or replace function public.configure_runtime_worker(p_base_url text,p_worker_secret text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_url_id uuid;v_secret_id uuid;v_command text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_base_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' or char_length(p_worker_secret)<32 then raise exception 'runtime_endpoint_invalid' using errcode='22023'; end if;
  select id into v_url_id from vault.decrypted_secrets where name='gril_runtime_base_url';
  if v_url_id is null then perform vault.create_secret(rtrim(p_base_url,'/'),'gril_runtime_base_url','URL pública do worker Gril'); else perform vault.update_secret(v_url_id,rtrim(p_base_url,'/')); end if;
  select id into v_secret_id from vault.decrypted_secrets where name='gril_runtime_worker_secret';
  if v_secret_id is null then perform vault.create_secret(p_worker_secret,'gril_runtime_worker_secret','Bearer do worker Gril'); else perform vault.update_secret(v_secret_id,p_worker_secret); end if;
  if exists(select 1 from cron.job where jobname='gril-runtime-worker') then perform cron.unschedule('gril-runtime-worker'); end if;
  v_command := $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='gril_runtime_base_url') || '/api/internal/workers/drain',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='gril_runtime_worker_secret')),
      body := '{"source":"supabase_cron"}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cmd$;
  perform cron.schedule('gril-runtime-worker','* * * * *',v_command);
end;
$$;
revoke all on function public.configure_runtime_worker(text,text) from public, anon, authenticated;
grant execute on function public.configure_runtime_worker(text,text) to service_role;

commit;
