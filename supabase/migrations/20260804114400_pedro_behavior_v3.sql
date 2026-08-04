begin;

-- Publish the behavioral package produced by the product discovery without
-- rewriting context already pinned to an earlier conversation version.
create or replace function private.seed_pedro_package(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_persona_id uuid;
  v_rule_set_id uuid;
  v_persona_version_id uuid;
  v_rule_version_id uuid;
  v_version integer;
  v_prompt text;
  v_rules jsonb;
begin
  insert into public.organization_settings(org_id) values(p_org_id)
  on conflict(org_id) do nothing;

  insert into public.personas(org_id,code,name,identity_name)
  values(p_org_id,'pedro','Pedro — SDR imobiliário','Pedro Sifuentes')
  on conflict(org_id,code) do update
    set name=excluded.name,identity_name=excluded.identity_name,updated_at=now()
  returning id into v_persona_id;

  v_prompt := 'GRIL_BEHAVIOR_V3. Você é Pedro Sifuentes e se apresenta apenas como Pedro, SDR imobiliário da operação. ' ||
    'Fale em português brasileiro com naturalidade, clareza e objetividade. Varie o tamanho das mensagens e faça no máximo uma pergunta principal por vez. ' ||
    'Não transforme a conversa em interrogatório: responda perguntas paralelas antes de retomar a qualificação, não repita o que já foi respondido e aceite recusas sem pressionar. ' ||
    'Abreviações, emoji e kkk só cabem depois de existir rapport e quando o lead estiver leve; diante de irritação, abandone humor e seja direto. ' ||
    'Depois de uma ou duas trocas casuais, retome o objetivo comercial naturalmente. Nunca invente biografia, experiência pessoal ou lembranças e não revele nem negue ser IA. ' ||
    'Use exclusivamente perfil institucional, FAQs, fatos e empreendimentos aprovados e válidos recebidos no contexto. Nunca invente preço, disponibilidade, rentabilidade, prazo, desconto, crédito ou condição comercial. ' ||
    'Não peça documento sensível, pagamento, Pix, boleto ou dado bancário. Risco jurídico, privacidade, fraude, discriminação, abuso recorrente, idioma não suportado, pedido de humano ou falta de fato indispensável exigem escalada. ' ||
    'Registre qualificação somente quando o lead afirmar o dado; nunca estime renda, entrada, orçamento ou prazo. ' ||
    'Curadoria exige preço total e entrada válidos e oferece no máximo dois imóveis. Na primeira recomendação mencione somente nome e bairro ou região; a capa é enviada pelo servidor. ' ||
    'Se pedirem material adicional, pergunte se preferem mais fotos ou o book e envie apenas a escolha. Nunca envie áudio. ' ||
    'Crie call somente após aceitação explícita de data e horário. Até um corretor aceitar, diga que o horário foi separado ou solicitado, nunca confirmado; depois pergunte vídeo ou telefone. ' ||
    'Se o lead pedir nominalmente uma pessoa real, escale. Reação a material não prova interesse e joinha só vale como sim após pergunta binária textual.';

  select id into v_persona_version_id
  from public.persona_versions
  where persona_id=v_persona_id and status='published' and compiled_prompt like 'GRIL_BEHAVIOR_V3.%';

  if v_persona_version_id is null then
    update public.persona_versions set status='archived',updated_at=now()
    where persona_id=v_persona_id and status='published';
    select coalesce(max(version),0)+1 into v_version from public.persona_versions where persona_id=v_persona_id;
    insert into public.persona_versions(
      org_id,persona_id,version,status,identity,style,boundaries,escalation_rules,
      examples,compiled_prompt,checksum,published_at
    ) values (
      p_org_id,v_persona_id,v_version,'published',
      '{"name":"Pedro Sifuentes","display_name":"Pedro","role":"SDR imobiliário","language":"pt-BR","invented_personal_history":false}'::jsonb,
      '{"tone":"natural, informal e humano","one_main_question":true,"answer_then_resume":true,"accept_refusal":true,"avoid_repetition":true,"humor":"only_after_rapport","emoji":"only_after_rapport","irritation":"direct_without_humor"}'::jsonb,
      '{"approved_facts_only":true,"no_sensitive_documents":true,"no_payment_instructions":true,"no_guarantees":true,"no_audio":true,"no_ai_identity_answer":true,"max_recommendations":2}'::jsonb,
      '{"privacy":"immediate_silent","fraud":"immediate","legal":"immediate","discrimination":"immediate","abuse":"after_recurrence","unsupported_language":"pause","human_requested":"immediate","missing_approved_fact":"when_indispensable"}'::jsonb,
      '[{"lead":"Quero cancelar a call","pedro":"Claro. Qual horário fica melhor para remarcar?"},{"lead":"Pode mandar mais material?","pedro":"Você prefere mais fotos ou o book completo?"},{"lead":"Esse horário está confirmado?","pedro":"O horário foi separado e está aguardando o aceite de um corretor."}]'::jsonb,
      v_prompt,encode(extensions.digest(convert_to(v_prompt,'UTF8'),'sha256'),'hex'),now()
    ) returning id into v_persona_version_id;
  end if;

  insert into public.rule_sets(org_id,code,name)
  values(p_org_id,'core','Regras operacionais do Pedro')
  on conflict(org_id,code) do update set name=excluded.name,updated_at=now()
  returning id into v_rule_set_id;

  v_rules := '{
    "behavior_version":"v3","language":"pt-BR",
    "capacity":{"proactive_pause":25,"absolute":30},
    "opt_out":{"effect":"immediate","ack":"brief_except_combined_privacy"},
    "human_ownership":"no_auto_send",
    "qualification":{"explicit_values_only":true,"ignore_expired":true,"accept_refusal":true},
    "curation":{"requires":["total_price","down_payment"],"limit":2,"first_message_fields":["name","location"],"send_cover":true},
    "media":{"max_photos":5,"principal_first":true,"additional_choice":["more_photos","book"],"audio_outbound":false},
    "calls":{"explicit_date_time":true,"confirmed_only_after_broker_acceptance":true,"ask_format_after_hold":true},
    "followup":{"assisted_creates_suggestion":true,"production_sends":true,"cancel_on_human_ownership":true},
    "escalate":["privacy","sensitive_document","payment","legal","fraud","discrimination","abuse","unsupported_language","identity_question","human_requested","missing_approved_fact"]
  }'::jsonb;
  select id into v_rule_version_id
  from public.rule_versions
  where rule_set_id=v_rule_set_id and status='published' and compiled_rules->>'behavior_version'='v3';
  if v_rule_version_id is null then
    update public.rule_versions set status='archived',updated_at=now()
    where rule_set_id=v_rule_set_id and status='published';
    select coalesce(max(version),0)+1 into v_version from public.rule_versions where rule_set_id=v_rule_set_id;
    insert into public.rule_versions(org_id,rule_set_id,version,status,rules,compiled_rules,checksum,published_at)
    values(p_org_id,v_rule_set_id,v_version,'published',v_rules,v_rules,
      encode(extensions.digest(convert_to(v_rules::text,'UTF8'),'sha256'),'hex'),now())
    returning id into v_rule_version_id;
  end if;

  insert into public.model_profiles(
    org_id,model_identifier,name,workload_role,reasoning_effort,text_verbosity,status,is_default
  ) values
    (p_org_id,'gpt-5.6-sol','OpenAI GPT-5.6 Sol','quality','medium','low','draft',true),
    (p_org_id,'gpt-5.6-terra','OpenAI GPT-5.6 Terra','balanced','low','low','draft',false),
    (p_org_id,'gpt-5.6-luna','OpenAI GPT-5.6 Luna','extraction','none','low','draft',false)
  on conflict(org_id,model_identifier,workload_role) do nothing;
end;
$$;
revoke all on function private.seed_pedro_package(uuid) from public,anon,authenticated,service_role;

do $$ declare v_org_id uuid; begin
  for v_org_id in select id from public.organizations loop
    perform private.seed_pedro_package(v_org_id);
  end loop;
end $$;

-- Add the deterministic controls that must bypass the language model.
alter function public.apply_inbound_control_intent(uuid,text)
  rename to apply_inbound_control_intent_before_behavior_v3;
revoke all on function public.apply_inbound_control_intent_before_behavior_v3(uuid,text)
  from public,anon,authenticated;
grant execute on function public.apply_inbound_control_intent_before_behavior_v3(uuid,text) to service_role;

create or replace function public.apply_inbound_control_intent(p_message_id uuid,p_intent text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_message public.messages%rowtype;
  v_conversation public.conversations%rowtype;
  v_reason text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if p_intent in ('opt_out','privacy','sensitive_document','payment','wrong_number','origin_contested','identity_question') then
    return public.apply_inbound_control_intent_before_behavior_v3(p_message_id,p_intent);
  end if;
  if p_intent not in ('privacy_opt_out','legal','fraud','discrimination','unsupported_language','abuse') then
    raise exception 'control_intent_invalid' using errcode='22023';
  end if;
  select * into v_message from public.messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;

  if p_intent='privacy_opt_out' then
    perform public.apply_inbound_control_intent_before_behavior_v3(p_message_id,'privacy');
    insert into public.opt_outs(org_id,operation_id,contact_id,reason,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.contact_id,'Solicitado junto com privacidade','contact')
    on conflict(operation_id,contact_id,channel) where revoked_at is null do nothing;
    update public.conversations set ai_mode='off',updated_at=now() where id=v_conversation.id;
    return jsonb_build_object('status','privacy_and_opt_out_applied');
  end if;

  update public.conversations
  set status='paused',ownership='pending_handoff',pause_reason=p_intent,ai_mode='off',version=version+1,updated_at=now()
  where id=v_conversation.id;
  v_reason:=case p_intent
    when 'legal' then 'Menção jurídica ou ameaça exige atendimento humano.'
    when 'fraud' then 'Pedido ou indício de fraude exige atendimento humano.'
    when 'discrimination' then 'Pedido discriminatório exige atendimento humano.'
    when 'unsupported_language' then 'O atendimento automático não prossegue no idioma identificado.'
    else 'Abuso recorrente exige decisão humana antes de continuar.' end;
  insert into public.escalations(org_id,operation_id,conversation_id,opportunity_id,category,severity,reason)
  values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,v_conversation.opportunity_id,p_intent,'immediate',v_reason);
  return jsonb_build_object('status','paused_for_handoff');
end;
$$;
revoke all on function public.apply_inbound_control_intent(uuid,text) from public,anon,authenticated;
grant execute on function public.apply_inbound_control_intent(uuid,text) to service_role;

-- Apply every approved structured action before sending an assisted reply. If
-- any mutation fails, the review request and outgoing message roll back too.
create or replace function private.apply_approved_assisted_actions(
  p_execution_id uuid,p_actor_user_id uuid,p_expected_conversation_version integer
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_opportunity public.opportunities%rowtype;
  v_item jsonb;
  v_definition public.qualification_definitions%rowtype;
  v_value_request public.qualification_value_requests%rowtype;
  v_match_request public.project_match_requests%rowtype;
  v_call_request public.call_creation_requests%rowtype;
  v_distribution_request public.call_distribution_requests%rowtype;
  v_kind text;
  v_state text;
  v_followup text;
  v_previous_role text;
begin
  select * into v_execution from public.ai_executions where id=p_execution_id for update;
  if not found or v_execution.status<>'completed' or v_execution.mode<>'assisted'
     or v_execution.conversation_id is null then
    raise exception 'assisted_execution_not_applicable' using errcode='22023';
  end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id for update;
  if not found or v_conversation.status<>'active' or v_conversation.version<>p_expected_conversation_version then
    raise exception 'version_conflict' using errcode='40001';
  end if;
  select * into v_opportunity from public.opportunities where id=v_conversation.opportunity_id for update;
  v_previous_role:=coalesce(current_setting('request.jwt.claim.role',true),'authenticated');
  perform set_config('request.jwt.claim.role','service_role',true);

  delete from public.ai_action_executions
  where execution_id=v_execution.id and status='skipped'
    and action_type in ('qualification','project_match','call','followup');

  for v_item in select value from jsonb_array_elements(coalesce(v_execution.output_structured->'qualification_updates','[]'::jsonb)) loop
    select * into v_definition from public.qualification_definitions
    where org_id=v_execution.org_id and code=v_item->>'code' and active;
    if not found then raise exception 'qualification_definition_not_found'; end if;
    v_kind:=v_item->>'value_kind';
    v_state:=case when v_kind in ('refused','unknown') then v_kind else 'valid' end;
    if v_kind='number' and v_definition.answer_type not in ('money','number') then raise exception 'qualification_type_mismatch'; end if;
    if v_kind='boolean' and v_definition.answer_type<>'boolean' then raise exception 'qualification_type_mismatch'; end if;
    if v_kind='text' and v_definition.answer_type in ('money','number','boolean') then raise exception 'qualification_type_mismatch'; end if;
    insert into public.qualification_value_requests(
      org_id,opportunity_id,definition_id,value_text,value_number,value_boolean,state,source,
      confidence,source_message_id,actor_user_id,human_confirmed
    ) values (
      v_execution.org_id,v_opportunity.id,v_definition.id,
      case when v_kind='text' then nullif(trim(v_item->>'value_text'),'') end,
      case when v_kind='number' then (v_item->>'value_number')::numeric end,
      case when v_kind='boolean' then (v_item->>'value_boolean')::boolean end,
      v_state,'ai',greatest(0,least(1,coalesce((v_item->>'confidence')::numeric,0.5))),
      v_execution.request_message_id,p_actor_user_id,false
    ) returning * into v_value_request;
    insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
    values(v_execution.org_id,v_execution.id,'qualification',v_item,'executed',
      jsonb_build_object('code',v_definition.code,'result',v_value_request.result,'approved_by',p_actor_user_id))
    on conflict do nothing;
  end loop;

  if coalesce((v_execution.output_structured->>'request_project_match')::boolean,false) then
    insert into public.project_match_requests(org_id,opportunity_id,actor_user_id)
    values(v_execution.org_id,v_opportunity.id,p_actor_user_id) returning * into v_match_request;
    update public.project_matches set sent_at=now()
    where request_id=v_match_request.id and project_id in (
      select value::uuid from jsonb_array_elements_text(coalesce(v_execution.output_structured->'recommended_project_ids','[]'::jsonb))
    );
    insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
    values(v_execution.org_id,v_execution.id,'project_match',jsonb_build_object('requested',true),'executed',
      jsonb_build_object('result_count',v_match_request.result_count,'approved_by',p_actor_user_id));
  end if;

  if v_execution.output_structured->'call_request' is not null
     and v_execution.output_structured->'call_request'<>'null'::jsonb then
    insert into public.call_creation_requests(
      org_id,operation_id,opportunity_id,starts_at,format,lead_confirmed,expected_opportunity_version,actor_user_id
    ) values (
      v_execution.org_id,v_execution.operation_id,v_opportunity.id,
      (v_execution.output_structured->'call_request'->>'starts_at')::timestamptz,
      v_execution.output_structured->'call_request'->>'format',true,v_opportunity.version,p_actor_user_id
    ) returning * into v_call_request;
    if v_call_request.result='awaiting_distribution' then
      insert into public.call_distribution_requests(org_id,call_id,actor_user_id)
      values(v_execution.org_id,v_call_request.call_id,p_actor_user_id) returning * into v_distribution_request;
    end if;
    insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
    values(v_execution.org_id,v_execution.id,'call',v_execution.output_structured->'call_request','executed',
      jsonb_build_object('call_id',v_call_request.call_id,'result',v_call_request.result,
        'distribution',v_distribution_request.result,'approved_by',p_actor_user_id));
  end if;

  v_followup:=coalesce(v_execution.output_structured->>'followup_strategy','none');
  if v_followup in ('cancel','short','long','future') then
    update public.scheduled_jobs set status='cancelled',updated_at=now()
    where org_id=v_execution.org_id and aggregate_type='conversation' and aggregate_id=v_conversation.id
      and job_type in ('followup.ai_turn','followup.future.expire') and status='pending';
  end if;
  insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
  values(v_execution.org_id,v_execution.id,'followup',jsonb_build_object('strategy',v_followup),'executed',
    jsonb_build_object('strategy',v_followup,'approved_by',p_actor_user_id));

  perform set_config('request.jwt.claim.role',v_previous_role,true);
  return jsonb_build_object('status','applied','strategy',v_followup);
end;
$$;
revoke all on function private.apply_approved_assisted_actions(uuid,uuid,integer)
  from public,anon,authenticated,service_role;

create or replace function private.process_ai_suggestion_review_request()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request public.message_send_requests%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then
    raise exception 'suggestion_review_forbidden' using errcode='42501';
  end if;
  select * into v_suggestion from public.ai_suggestions
  where id=new.suggestion_id and org_id=new.org_id for update;
  if not found or v_suggestion.status<>'pending' or v_suggestion.conversation_id is null
     or not private.can_access_conversation(v_suggestion.conversation_id) then
    raise exception 'suggestion_not_reviewable' using errcode='22023';
  end if;
  select * into v_conversation from public.conversations where id=v_suggestion.conversation_id for update;
  if new.action='discard' then
    update public.ai_suggestions set status='rejected',reviewed_by=new.actor_user_id,reviewed_at=now()
    where id=v_suggestion.id;
    new.result:='discarded';
  else
    if new.expected_conversation_version is null or new.expected_conversation_version<>v_conversation.version then
      raise exception 'version_conflict' using errcode='40001';
    end if;
    perform private.apply_approved_assisted_actions(
      v_suggestion.execution_id,new.actor_user_id,v_conversation.version
    );
    insert into public.message_send_requests(
      org_id,conversation_id,actor_user_id,body,expected_conversation_version,source,ai_suggestion_id
    ) values (
      new.org_id,v_conversation.id,new.actor_user_id,
      coalesce(nullif(trim(new.edited_body),''),v_suggestion.body),v_conversation.version,
      'ai_suggestion',v_suggestion.id
    ) returning * into v_request;
    update public.ai_suggestions
    set body=coalesce(nullif(trim(new.edited_body),''),body),status='approved',reviewed_by=new.actor_user_id,reviewed_at=now()
    where id=v_suggestion.id;
    perform public.enqueue_pedro_project_media(v_suggestion.execution_id);
    new.message_id:=v_request.message_id;
    new.result:='sent';
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'ai.suggestion_'||new.action,'ai_suggestions',v_suggestion.id,
    jsonb_build_object('message_id',new.message_id,'structured_actions_applied',new.action='send'));
  return new;
end;
$$;
revoke all on function private.process_ai_suggestion_review_request()
  from public,anon,authenticated,service_role;

-- Assisted approvals send the same approved assets as production, while
-- preserving AI ownership and attributing the approval to the reviewer.
create or replace function public.enqueue_pedro_project_media(p_execution_id uuid)
returns integer
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request jsonb;
  v_kind text;
  v_project uuid;
  v_projects uuid[]:=array[]::uuid[];
  v_media public.project_media%rowtype;
  v_message uuid;
  v_count integer:=0;
  v_reviewer uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_execution from public.ai_executions where id=p_execution_id and status='completed';
  if not found or v_execution.mode not in ('production','assisted') or v_execution.conversation_id is null then return 0; end if;
  if v_execution.mode='assisted' then
    select reviewed_by into v_reviewer from public.ai_suggestions
    where execution_id=v_execution.id and status='approved' order by reviewed_at desc limit 1;
    if v_reviewer is null then return 0; end if;
  end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id;
  if v_conversation.status<>'active' or v_conversation.ownership<>'ai' then return 0; end if;
  v_request:=v_execution.output_structured->'project_media_request';
  if v_request is not null and v_request<>'null'::jsonb then
    v_projects:=array[(v_request->>'project_id')::uuid];
    v_kind:=v_request->>'kind';
  else
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_projects
    from jsonb_array_elements_text(coalesce(v_execution.output_structured->'recommended_project_ids','[]'::jsonb));
    v_kind:='principal';
  end if;
  foreach v_project in array v_projects loop
    if not exists(select 1 from public.projects where id=v_project and org_id=v_execution.org_id and status='active' and recommendable) then
      continue;
    end if;
    for v_media in
      select * from public.project_media m
      where m.project_id=v_project and m.org_id=v_execution.org_id and m.active and m.published_at is not null
        and (case v_kind when 'principal' then m.media_type='cover' when 'more_photos' then m.media_type='image'
             when 'book' then m.media_type='pdf' else false end)
      order by case when m.media_type='cover' then 0 when m.media_type='image' then 1 else 2 end,m.sort_order,m.created_at
    loop
      insert into public.messages(
        org_id,operation_id,conversation_id,direction,sender_type,sender_user_id,
        content_type,body,provider_status,metadata
      ) values (
        v_execution.org_id,v_execution.operation_id,v_conversation.id,'outbound',
        case when v_execution.mode='assisted' then 'user' else 'ai' end,v_reviewer,
        case when v_media.media_type='pdf' then 'document' else 'image' end,
        coalesce(v_media.title,case when v_media.media_type='pdf' then 'Book do empreendimento' else 'Foto do empreendimento' end),'queued',
        jsonb_build_object('ai_execution_id',v_execution.id,'project_id',v_project,'project_media_id',v_media.id,
          'source',case when v_execution.mode='assisted' then 'ai_suggestion' else 'ai' end,
          'storage_bucket','gril-projects','storage_path',v_media.storage_path,'mime_type',v_media.mime_type,
          'file_name',case when v_media.media_type='pdf' then coalesce(nullif(v_media.title,''),'book')||'.pdf' else null end)
      ) returning id into v_message;
      insert into public.project_media_deliveries(org_id,ai_execution_id,project_media_id,message_id,delivery_kind)
      values(v_execution.org_id,v_execution.id,v_media.id,v_message,
        case when v_media.media_type='cover' then 'principal' when v_media.media_type='pdf' then 'book' else 'more_photos' end)
      on conflict(ai_execution_id,project_media_id) do nothing;
      if found then
        insert into public.scheduled_jobs(
          org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
        ) values (
          v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message,'outbound-whatsapp',
          now()+make_interval(secs=>2+v_count*2),'project-media-send:'||v_execution.id::text||':'||v_media.id::text,
          jsonb_build_object('message_id',v_message),3
        ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
        v_count:=v_count+1;
      else
        delete from public.messages where id=v_message;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_pedro_project_media(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_pedro_project_media(uuid) to service_role;

-- Exact cadences can run in both automatic and assisted modes. In assisted
-- mode each scheduled turn creates another suggestion instead of auto-sending.
create or replace function private.enforce_exact_followup_cadence()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_opportunity public.opportunities%rowtype;
  v_strategy text;
  v_plan_id uuid;
  v_step public.followup_steps%rowtype;
  v_replaced integer:=0;
begin
  if new.action_type<>'followup' or new.status<>'executed' then return new; end if;
  v_strategy:=coalesce(new.action_input->>'strategy','none');
  if v_strategy not in ('short','long') then return new; end if;
  select * into v_execution from public.ai_executions where id=new.execution_id and org_id=new.org_id;
  if not found or v_execution.mode not in ('production','assisted') or v_execution.conversation_id is null then return new; end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id;
  select * into v_opportunity from public.opportunities where id=v_conversation.opportunity_id;
  with cancelled as (
    update public.scheduled_jobs set status='cancelled',updated_at=now()
    where org_id=new.org_id and aggregate_type='conversation' and aggregate_id=v_conversation.id
      and job_type='followup.ai_turn' and status='pending'
      and dedupe_key like 'followup:'||v_conversation.id::text||':'||v_execution.id::text||':%'
    returning 1
  ) select count(*) into v_replaced from cancelled;
  if v_replaced=0 and v_execution.mode='production' then return new; end if;
  select id into v_plan_id from public.followup_plans
  where operation_id=v_execution.operation_id and status='published'
    and name=case when v_strategy='short' then 'Cadencia curta padrao' else 'Cadencia longa padrao' end
  order by version desc limit 1;
  if v_plan_id is null then raise exception 'requested_followup_plan_not_found' using errcode='22023'; end if;
  for v_step in select * from public.followup_steps where plan_id=v_plan_id order by step_number loop
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      new.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      now()+make_interval(mins=>v_step.delay_minutes),
      'followup-exact:'||v_conversation.id::text||':'||v_execution.id::text||':'||v_strategy||':'||v_step.step_number::text,
      jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity.id,'cadence',v_strategy,
        'step_number',v_step.step_number,'instruction',v_step.instruction),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;
  if v_strategy='short' then
    select id into v_plan_id from public.followup_plans
    where operation_id=v_execution.operation_id and status='published' and name='Cadencia longa padrao'
    order by version desc limit 1;
    if v_plan_id is null then raise exception 'long_followup_plan_not_found' using errcode='22023'; end if;
    for v_step in select * from public.followup_steps where plan_id=v_plan_id order by step_number loop
      insert into public.scheduled_jobs(
        org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
      ) values (
        new.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
        now()+interval '24 hours'+make_interval(mins=>v_step.delay_minutes),
        'followup-exact:'||v_conversation.id::text||':'||v_execution.id::text||':short-to-long:'||v_step.step_number::text,
        jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity.id,'cadence','short-to-long',
          'step_number',v_step.step_number,'instruction',v_step.instruction),3
      ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_exact_followup_cadence() from public,anon,authenticated,service_role;

create or replace function private.schedule_future_purchase_cadence()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_day integer;
begin
  if new.action_type<>'followup' or new.status<>'executed' or new.action_input->>'strategy'<>'future' then return new; end if;
  select * into v_execution from public.ai_executions where id=new.execution_id;
  if not found or v_execution.mode not in ('production','assisted') or v_execution.conversation_id is null then return new; end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id;
  update public.scheduled_jobs set status='cancelled',updated_at=now()
  where org_id=new.org_id and aggregate_type='conversation' and aggregate_id=v_conversation.id
    and job_type in ('followup.ai_turn','followup.future.expire') and status='pending';
  foreach v_day in array array[30,60,90,120,150,180] loop
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      new.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      coalesce(v_execution.completed_at,now())+make_interval(days=>v_day),
      'future-purchase:'||v_conversation.id::text||':'||v_execution.id::text||':'||v_day::text,
      jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_conversation.opportunity_id,
        'cadence','future_purchase','day',v_day,
        'instruction','Retome com contexto e valor, sem pressionar. Confirme se o horizonte de compra mudou.'),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;
  insert into public.scheduled_jobs(
    org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
  ) values (
    new.org_id,v_execution.operation_id,'followup.future.expire','conversation',v_conversation.id,'scheduled-actions',
    coalesce(v_execution.completed_at,now())+interval '180 days 1 hour',
    'future-purchase-expire:'||v_conversation.id::text||':'||v_execution.id::text,
    jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_conversation.opportunity_id),3
  ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return new;
end;
$$;
revoke all on function private.schedule_future_purchase_cadence() from public,anon,authenticated,service_role;

-- Intercept assisted follow-ups at the outermost dispatcher. Production keeps
-- the already hardened wrapper chain.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_behavior_v3;
revoke all on function public.execute_runtime_job_before_behavior_v3(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_before_behavior_v3(uuid) to service_role;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_conversation public.conversations%rowtype;
  v_capacity public.capacity_reservation_requests%rowtype;
  v_execution_request public.ai_execution_requests%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type='followup.ai_turn' then
    select * into v_conversation from public.conversations
    where id=(v_job.payload->>'conversation_id')::uuid for update;
    if v_conversation.ai_mode<>'assisted' then
      return public.execute_runtime_job_before_behavior_v3(p_job_id);
    end if;
    if v_conversation.status<>'active' or v_conversation.ownership<>'ai'
       or exists(select 1 from public.opt_outs where operation_id=v_conversation.operation_id and contact_id=v_conversation.contact_id and revoked_at is null)
       or exists(select 1 from public.messages where conversation_id=v_conversation.id and direction='inbound' and created_at>v_job.created_at) then
      return jsonb_build_object('status','cancelled');
    end if;
    insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'reserve','followup') returning * into v_capacity;
    if v_capacity.result in ('proactive_paused','backlog') then
      return jsonb_build_object('status','retry','retry_seconds',300,'reason','capacity_paused');
    end if;
    insert into public.ai_execution_requests(
      org_id,operation_id,conversation_id,mode,expected_conversation_version,input_snapshot,idempotency_key,actor_user_id
    ) values (
      v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'assisted',v_conversation.version,
      jsonb_build_object('source','followup','job_id',v_job.id,'instruction',v_job.payload->>'instruction','step_number',v_job.payload->>'step_number'),
      'ai-followup:'||v_job.id::text,null
    ) on conflict(org_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
    returning * into v_execution_request;
    if v_execution_request.result='queued' then
      return jsonb_build_object('status','run_ai','ai_execution_id',v_execution_request.execution_id);
    end if;
    return jsonb_build_object('status','cancelled');
  end if;
  return public.execute_runtime_job_before_behavior_v3(p_job_id);
end;
$$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

commit;
