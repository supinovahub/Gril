begin;

alter table public.conversation_summaries
  add column source_execution_id uuid references public.ai_executions(id) on delete set null;
create unique index conversation_summaries_source_execution_idx
  on public.conversation_summaries(source_execution_id) where source_execution_id is not null;

create or replace function public.store_conversation_summary(
  p_conversation_id uuid,p_summary text,p_facts jsonb,p_source_execution_id uuid
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_conversation public.conversations%rowtype; v_message uuid; v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_conversation from public.conversations where id=p_conversation_id;
  if not found or char_length(trim(coalesce(p_summary,''))) not between 1 and 2000 then raise exception 'summary_invalid' using errcode='22023'; end if;
  select id into v_message from public.messages where conversation_id=p_conversation_id order by coalesce(provider_timestamp,created_at) desc,id desc limit 1;
  insert into public.conversation_summaries(org_id,conversation_id,message_cursor_id,summary,facts,generated_by,source_execution_id)
  values(v_conversation.org_id,p_conversation_id,v_message,trim(p_summary),jsonb_build_object('items',coalesce(p_facts,'[]'::jsonb)), 'ai',p_source_execution_id)
  on conflict(source_execution_id) where source_execution_id is not null do update set
    summary=excluded.summary,facts=excluded.facts,message_cursor_id=excluded.message_cursor_id
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.store_conversation_summary(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.store_conversation_summary(uuid,text,jsonb,uuid) to service_role;

create or replace function public.apply_inbound_control_intent(p_message_id uuid,p_intent text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_message public.messages%rowtype;v_conversation public.conversations%rowtype;v_ack uuid;v_phone text;v_reason text;v_severity text:='immediate';
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_intent not in ('opt_out','privacy','sensitive_document','payment','wrong_number','origin_contested','identity_question') then
    raise exception 'control_intent_invalid' using errcode='22023'; end if;
  select * into v_message from public.messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  if p_intent='opt_out' then
    insert into public.opt_outs(org_id,operation_id,contact_id,reason,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.contact_id,'Solicitado na conversa','contact')
    on conflict(operation_id,contact_id,channel) where revoked_at is null do nothing;
    update public.conversations set ai_mode='off',updated_at=now() where id=v_conversation.id;
    if not exists(select 1 from public.messages m where m.conversation_id=v_conversation.id and m.metadata->>'control_ack_for'=v_message.id::text) then
      insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
      values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'outbound','system','text','blz pode deixar','queued',v_message.id,
        jsonb_build_object('control_ack_for',v_message.id,'opt_out_ack',true)) returning id into v_ack;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_message.org_id,v_message.operation_id,'message.outbound.send','message',v_ack,'outbound-whatsapp',now(),'opt-out-ack:'||v_message.id::text,jsonb_build_object('message_id',v_ack),3)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;
    return jsonb_build_object('status','opted_out','message_id',v_ack);
  end if;

  if p_intent='wrong_number' then
    if not exists(select 1 from public.messages m where m.conversation_id=v_conversation.id and m.metadata->>'control_ack_for'=v_message.id::text) then
      insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
      values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'outbound','system','text','opa foi mal pode deixar','queued',v_message.id,
        jsonb_build_object('control_ack_for',v_message.id,'wrong_number_ack',true)) returning id into v_ack;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_message.org_id,v_message.operation_id,'message.outbound.send','message',v_ack,'outbound-whatsapp',now(),'wrong-number-ack:'||v_message.id::text,jsonb_build_object('message_id',v_ack),3)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_message.org_id,v_message.operation_id,'contact.wrong_number.finalize','conversation',v_conversation.id,'scheduled-actions',now()+interval '5 minutes',
        'wrong-number-finalize:'||v_message.id::text,jsonb_build_object('conversation_id',v_conversation.id,'message_id',v_message.id),3)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;
    update public.conversations set ai_mode='off',ownership='pending_handoff',pause_reason='wrong_number',updated_at=now() where id=v_conversation.id;
    return jsonb_build_object('status','wrong_number_pending_finalize','message_id',v_ack);
  end if;

  if p_intent='origin_contested' then
    if not exists(select 1 from public.messages m where m.conversation_id=v_conversation.id and m.metadata->>'control_ack_for'=v_message.id::text) then
      insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
      values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'outbound','system','text','entendi foi mal... vou verificar isso aqui certinho','queued',v_message.id,
        jsonb_build_object('control_ack_for',v_message.id,'origin_contested_ack',true)) returning id into v_ack;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_message.org_id,v_message.operation_id,'message.outbound.send','message',v_ack,'outbound-whatsapp',now(),'origin-contested-ack:'||v_message.id::text,jsonb_build_object('message_id',v_ack),3)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;
  end if;

  update public.conversations set status='paused',ownership='pending_handoff',pause_reason=p_intent,ai_mode='off',updated_at=now() where id=v_conversation.id;
  v_reason:=case p_intent
    when 'privacy' then 'Solicitação de privacidade exige atendimento humano.'
    when 'sensitive_document' then 'Possível documento sensível recebido; conteúdo não enviado ao modelo.'
    when 'payment' then 'Menção a pagamento, Pix, boleto, sinal ou reserva exige condução de dono ou gestor.'
    when 'origin_contested' then 'O contato contestou a origem ou autorização do cadastro.'
    when 'identity_question' then 'O contato perguntou diretamente se o atendimento é feito por IA; nenhuma resposta automática foi enviada.'
    else 'Controle determinístico exigiu atendimento humano.' end;
  if p_intent='identity_question' then v_severity:='silent'; end if;
  insert into public.escalations(org_id,operation_id,conversation_id,opportunity_id,category,severity,reason)
  values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,v_conversation.opportunity_id,p_intent,v_severity,v_reason);
  if p_intent='privacy' and not exists(select 1 from public.privacy_requests where contact_id=v_conversation.contact_id and status in ('open','reviewing')) then
    insert into public.privacy_requests(org_id,contact_id,request_type) values(v_conversation.org_id,v_conversation.contact_id,'restriction');
  end if;
  return jsonb_build_object('status','paused_for_handoff','message_id',v_ack);
end; $$;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;v_conversation public.conversations%rowtype;v_capacity public.capacity_reservation_requests%rowtype;
  v_execution_request public.ai_execution_requests%rowtype;v_result jsonb;v_message public.messages%rowtype;v_phone text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;

  if v_job.job_type='contact.wrong_number.finalize' then
    select * into v_conversation from public.conversations where id=(v_job.payload->>'conversation_id')::uuid for update;
    if not found then return jsonb_build_object('status','ignored'); end if;
    select e164 into v_phone from public.contact_phones where contact_id=v_conversation.contact_id and status='active' order by is_primary desc,created_at limit 1;
    if v_phone is not null then
      insert into public.suppression_entries(org_id,operation_id,phone_e164,reason,source)
      values(v_conversation.org_id,v_conversation.operation_id,v_phone,'Número informado como incorreto','wrong_number')
      on conflict(operation_id,phone_e164) where revoked_at is null do nothing;
      update public.contact_phones set status='inactive',is_primary=false,updated_at=now() where contact_id=v_conversation.contact_id and e164=v_phone;
    end if;
    update public.conversations set status='closed',closed_at=now(),ai_mode='off',ownership='human',pause_reason='wrong_number',updated_at=now() where id=v_conversation.id;
    update public.campaign_contacts set status='excluded',suppression_reason='wrong_number',next_send_at=null,updated_at=now() where contact_id=v_conversation.contact_id and status not in ('completed','excluded','opted_out');
    update public.scheduled_jobs set status='cancelled',lease_until=null,updated_at=now()
    where org_id=v_conversation.org_id and id<>v_job.id and status in ('pending','leased') and (
      aggregate_id=v_conversation.id or aggregate_id in (select id from public.campaign_contacts where contact_id=v_conversation.contact_id)
    );
    insert into audit.events(org_id,operation_id,actor_type,action,entity_type,entity_id,metadata)
    values(v_conversation.org_id,v_conversation.operation_id,'system','contact.wrong_number_finalized','contacts',v_conversation.contact_id,jsonb_build_object('phone',v_phone));
    return jsonb_build_object('status','completed');
  end if;

  if v_job.job_type='followup.ai_turn' then
    select * into v_conversation from public.conversations where id=(v_job.payload->>'conversation_id')::uuid for update;
    if not found or v_conversation.status<>'active' or v_conversation.ownership<>'ai' or v_conversation.ai_mode<>'production'
       or exists(select 1 from public.opt_outs where operation_id=v_conversation.operation_id and contact_id=v_conversation.contact_id and revoked_at is null)
       or exists(select 1 from public.messages where conversation_id=v_conversation.id and direction='inbound' and created_at>v_job.created_at) then
      return jsonb_build_object('status','cancelled');
    end if;
    insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'reserve','followup') returning * into v_capacity;
    if v_capacity.result in ('proactive_paused','backlog') then return jsonb_build_object('status','retry','retry_seconds',300,'reason','capacity_paused'); end if;
    insert into public.ai_execution_requests(org_id,operation_id,conversation_id,mode,expected_conversation_version,input_snapshot,idempotency_key,actor_user_id)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'production',v_conversation.version,
      jsonb_build_object('source','followup','job_id',v_job.id,'instruction',v_job.payload->>'instruction','step_number',v_job.payload->>'step_number'),
      'ai-followup:'||v_job.id::text,null)
    on conflict(org_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into v_execution_request;
    if v_execution_request.result='queued' then return jsonb_build_object('status','run_ai','ai_execution_id',v_execution_request.execution_id); end if;
    return jsonb_build_object('status','cancelled');
  end if;

  v_result:=public.execute_runtime_job_phase12(p_job_id);
  if v_job.job_type='campaign.contact.dispatch' and v_result->>'status'='send' then
    select * into v_message from public.messages where id=(v_result->>'message_id')::uuid;
    select * into v_conversation from public.conversations where id=v_message.conversation_id;
    insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'reserve','campaign') returning * into v_capacity;
    if v_capacity.result in ('proactive_paused','backlog') then delete from public.messages where id=v_message.id; return jsonb_build_object('status','retry','retry_seconds',300,'reason','capacity_paused'); end if;
  end if;
  return v_result;
end; $$;

revoke all on function public.apply_inbound_control_intent(uuid,text),public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.apply_inbound_control_intent(uuid,text),public.execute_runtime_job(uuid) to service_role;

commit;
