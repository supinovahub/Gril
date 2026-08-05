begin;

alter table public.escalations
  add column if not exists source_message_id uuid references public.messages(id) on delete set null,
  add column if not exists source_execution_id uuid references public.ai_executions(id) on delete set null,
  add column if not exists contextual_evidence text,
  add column if not exists confidence numeric check (confidence is null or confidence between 0 and 1);

create unique index if not exists escalations_source_execution_uidx
  on public.escalations(source_execution_id)
  where source_execution_id is not null;

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
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_message_id uuid;
  v_ack uuid;
  v_delay integer;
  v_seed integer;
  v_active integer;
  v_category text;
  v_reason text;
  v_evidence text;
  v_confidence numeric;
  v_severity text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if nullif(trim(p_output_text),'') is null or char_length(p_output_text)>4096 then
    raise exception 'ai_output_invalid' using errcode='22023';
  end if;

  select * into v_execution from public.ai_executions where id=p_execution_id for update;
  if not found or v_execution.status<>'running' then return jsonb_build_object('status','ignored'); end if;
  if v_execution.conversation_id is not null then
    select * into v_conversation from public.conversations where id=v_execution.conversation_id for update;
    if not found or v_conversation.version<>v_execution.expected_conversation_version then
      update public.ai_executions
      set status='superseded',error_code='conversation_version_conflict',
          error_redacted='Uma mensagem mais recente substituiu esta execução.',completed_at=now()
      where id=v_execution.id;
      return jsonb_build_object('status','superseded');
    end if;
  end if;

  update public.ai_executions
  set status='completed',output_text=p_output_text,output_structured=coalesce(p_output_structured,'{}'::jsonb),
      response_id=p_response_id,model_returned=p_model_returned,
      input_tokens=greatest(0,coalesce(p_input_tokens,0)),output_tokens=greatest(0,coalesce(p_output_tokens,0)),
      latency_ms=greatest(0,coalesce(p_latency_ms,0)),completed_at=now()
  where id=v_execution.id;

  insert into public.usage_ledger(org_id,operation_id,execution_id,usage_type,model_identifier,input_tokens,output_tokens,estimated_cost)
  select v_execution.org_id,v_execution.operation_id,v_execution.id,
    case when v_execution.mode in ('simulator','regression') then v_execution.mode else 'service' end,
    coalesce(p_model_returned,m.model_identifier,'unknown'),greatest(0,coalesce(p_input_tokens,0)),
    greatest(0,coalesce(p_output_tokens,0)),0
  from public.model_profiles m where m.id=v_execution.model_profile_id;

  if coalesce(p_output_structured->>'action','reply')<>'reply'
     and v_execution.conversation_id is not null
     and v_execution.mode<>'shadow' then
    v_category:=coalesce(nullif(p_output_structured->'escalation'->>'category',''),'other');
    if v_category not in (
      'commercial_risk','opt_out','privacy_opt_out','legal','privacy','fraud','sensitive_document',
      'missing_approved_fact','call_conflict','human_requested','payment','identity_question','wrong_number',
      'origin_contested','unsupported_language','abuse','discrimination','other'
    ) then v_category:='other'; end if;
    v_reason:=left(coalesce(nullif(p_output_structured->'escalation'->>'reason',''),'Pedro solicitou revisão humana após analisar o contexto.'),1000);
    v_evidence:=left(nullif(p_output_structured->'escalation'->>'contextual_evidence',''),1000);
    v_confidence:=greatest(0,least(1,coalesce((p_output_structured->'escalation'->>'confidence')::numeric,0.8)));
    v_severity:=case when v_category='identity_question' then 'silent' else 'immediate' end;

    update public.conversations
    set status='paused',ownership='pending_handoff',pause_reason=v_category,ai_mode='off',
        version=version+1,updated_at=now()
    where id=v_conversation.id;

    update public.scheduled_jobs
    set status='cancelled',lease_until=null,updated_at=now()
    where org_id=v_conversation.org_id and status in ('pending','leased')
      and aggregate_type='conversation' and aggregate_id=v_conversation.id
      and job_type in ('followup.ai_turn','followup.future.expire','followup.project_material_nudge');

    insert into public.escalations(
      org_id,operation_id,conversation_id,opportunity_id,category,severity,reason,
      source_message_id,source_execution_id,contextual_evidence,confidence
    ) values (
      v_execution.org_id,v_execution.operation_id,v_conversation.id,v_conversation.opportunity_id,
      v_category,v_severity,v_reason,v_execution.request_message_id,v_execution.id,v_evidence,v_confidence
    ) on conflict(source_execution_id) where source_execution_id is not null do update
      set category=excluded.category,severity=excluded.severity,reason=excluded.reason,
          contextual_evidence=excluded.contextual_evidence,confidence=excluded.confidence;

    if v_category in ('opt_out','privacy_opt_out') then
      update public.scheduled_jobs
      set status='cancelled',lease_until=null,updated_at=now()
      where org_id=v_conversation.org_id and status in ('pending','leased')
        and (
          (aggregate_type='conversation' and aggregate_id=v_conversation.id)
          or payload->>'conversation_id'=v_conversation.id::text
          or payload->>'contact_id'=v_conversation.contact_id::text
        );

      insert into public.opt_outs(org_id,operation_id,contact_id,reason,source)
      values(v_conversation.org_id,v_conversation.operation_id,v_conversation.contact_id,'Solicitado na conversa após análise contextual','contact')
      on conflict(operation_id,contact_id,channel) where revoked_at is null do nothing;
    end if;

    if v_category in ('privacy','privacy_opt_out')
       and not exists(select 1 from public.privacy_requests where contact_id=v_conversation.contact_id and status in ('open','reviewing')) then
      insert into public.privacy_requests(org_id,contact_id,request_type)
      values(v_conversation.org_id,v_conversation.contact_id,'restriction');
    end if;

    if v_execution.request_message_id is not null
       and v_category in ('opt_out','privacy_opt_out','wrong_number','origin_contested')
       and not exists(
         select 1 from public.messages m
         where m.conversation_id=v_conversation.id
           and m.metadata->>'control_ack_for'=v_execution.request_message_id::text
       ) then
      insert into public.messages(
        org_id,operation_id,conversation_id,direction,sender_type,content_type,body,
        provider_status,reply_to_message_id,metadata
      ) values (
        v_execution.org_id,v_execution.operation_id,v_conversation.id,'outbound','system','text',
        case
          when v_category in ('opt_out','privacy_opt_out') then 'blz pode deixar'
          when v_category='wrong_number' then 'opa foi mal pode deixar'
          else 'entendi foi mal... vou verificar isso aqui certinho'
        end,
        'queued',v_execution.request_message_id,
        jsonb_build_object('control_ack_for',v_execution.request_message_id,'contextual_control',v_category)
      ) returning id into v_ack;
      insert into public.scheduled_jobs(
        org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
      ) values (
        v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_ack,
        'outbound-whatsapp',now(),'contextual-control-ack:'||v_execution.request_message_id::text,
        jsonb_build_object('message_id',v_ack),3
      ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;

    if v_category='wrong_number' and v_execution.request_message_id is not null then
      insert into public.scheduled_jobs(
        org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
      ) values (
        v_execution.org_id,v_execution.operation_id,'contact.wrong_number.finalize','conversation',v_conversation.id,
        'scheduled-actions',now()+interval '5 minutes','wrong-number-finalize:'||v_execution.request_message_id::text,
        jsonb_build_object('conversation_id',v_conversation.id,'message_id',v_execution.request_message_id),3
      ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;

    return jsonb_build_object('status','escalated','category',v_category);
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
      update public.ai_executions
      set error_code='production_preconditions_changed',
          error_redacted='A resposta foi gerada, mas o envio foi bloqueado por uma regra de ação.'
      where id=v_execution.id;
      return jsonb_build_object('status','blocked');
    end if;
    insert into public.messages(
      org_id,operation_id,conversation_id,direction,sender_type,content_type,body,
      provider_status,reply_to_message_id,metadata
    ) values (
      v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,'outbound','ai','text',
      p_output_text,'queued',v_execution.request_message_id,jsonb_build_object('ai_execution_id',v_execution.id)
    ) returning id into v_message_id;
    v_seed:=abs(hashtext(v_execution.id::text));
    select coalesce(active_count,0) into v_active from public.operation_capacity where operation_id=v_execution.operation_id;
    if coalesce(v_active,0)>=25 then v_delay:=v_seed%6;
    elsif char_length(p_output_text)<=160 then v_delay:=4+(v_seed%9);
    elsif char_length(p_output_text)<=600 then v_delay:=12+(v_seed%24);
    else v_delay:=25+(v_seed%36); end if;
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message_id,
      'outbound-whatsapp',now()+make_interval(secs=>v_delay),'ai-message-send:'||v_message_id::text,
      jsonb_build_object('message_id',v_message_id,'planned_delay_seconds',v_delay),3
    );
    return jsonb_build_object('status','send_scheduled','message_id',v_message_id,'planned_delay_seconds',v_delay);
  end if;
  return jsonb_build_object('status','completed');
end;
$$;

revoke all on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)
from public,anon,authenticated;
grant execute on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)
to service_role;

commit;
