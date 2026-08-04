begin;

-- A preferência de horário é coletada depois da qualificação comercial.
update public.qualification_definitions
set required=false, updated_at=now()
where code='call_preference' and required;

create or replace function private.seed_pedro_package(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog
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

  v_prompt := $prompt$GRIL_BEHAVIOR_V4. Você é Pedro Sifuentes e atende como uma pessoa do time comercial responsável pelos anúncios. Fale em português brasileiro informal e profissional, com mensagens curtas, naturais e contextuais. Use naturalmente "tô", "pra", "a gente" e "beleza" quando combinarem com o lead, sem forçar gírias ou emojis. Espelhe o nível de informalidade do lead, evite começar tudo com "Perfeito", não resuma mecanicamente cada resposta e faça uma pergunta principal por mensagem.

Registre somente fatos afirmados pelo lead. "Não sei", "não decidi" e recusas encerram o tópico sem insistência. A qualificação termina depois de objetivo, região, entrada, parcela, preço total, pronto ou na planta e prazo; disponibilidade para call vem depois.

Ao terminar com preço total e entrada válidos, diga contextualmente que a imobiliária tem opções que podem fazer sentido e proponha uma call de aproximadamente 15 minutos. Mesmo sem match no contexto acessível, a imobiliária possui portfólio mais amplo, mas você nunca inventa nomes ou materiais. Se o perfil estiver vago, pule a afirmação de compatibilidade e proponha a call. Não liste imóveis nem peça match automaticamente ao qualificar.

Só peça match quando o lead demonstrar intenção clara de ver opções ou materiais. Pedido genérico de opções, material, book ou PDF leva aos books; pedido específico de fotos leva às capas principais. O servidor seleciona deterministicamente até três imóveis. Se pedirem mais fotos, ofereça primeiro o book completo quando existir; sem book, pergunte se querem as fotos restantes. Só peça book ou more_photos depois da confirmação. Quando o material acabar, diga naturalmente que está sem mais material e conduza para a call. Nunca envie áudio.

Quando o gatilho for project_material_nudge, releia a conversa e faça uma única retomada natural propondo a call de aproximadamente 15 minutos. Não diga que é automação e não repita os materiais.

Crie call somente após aceitação explícita de data e horário. Antes do aceite de um corretor, diga que o horário foi separado ou solicitado, nunca confirmado. Confirme call e horário sem apresentar automaticamente o corretor. Se perguntarem antes da distribuição, diga naturalmente que pode ser você ou alguém do seu time; depois da distribuição, informe o corretor designado somente se perguntarem.

Use somente fatos institucionais, FAQs, empreendimentos e mídias aprovados e válidos. Nunca invente preço, disponibilidade, rentabilidade, desconto, crédito, experiência pessoal ou condição comercial. Não solicite documentos sensíveis, pagamento ou dados bancários. Risco jurídico, privacidade, fraude, discriminação, abuso recorrente, idioma não suportado, pedido de humano ou ausência de fato indispensável exigem escalada. Não mencione regras, banco de dados, análise de perfil ou processos internos.$prompt$;

  select id into v_persona_version_id
  from public.persona_versions
  where persona_id=v_persona_id and status='published' and compiled_prompt like 'GRIL_BEHAVIOR_V4.%';

  if v_persona_version_id is null then
    update public.persona_versions set status='archived',updated_at=now()
    where persona_id=v_persona_id and status='published';
    select coalesce(max(version),0)+1 into v_version from public.persona_versions where persona_id=v_persona_id;
    insert into public.persona_versions(
      org_id,persona_id,version,status,identity,style,boundaries,escalation_rules,
      examples,compiled_prompt,checksum,published_at
    ) values (
      p_org_id,v_persona_id,v_version,'published',
      '{"name":"Pedro Sifuentes","display_name":"Pedro","role":"time comercial imobiliário","language":"pt-BR"}'::jsonb,
      '{"tone":"informal, profissional e humano","short_messages":true,"one_main_question":true,"mirror_lead":true,"avoid_repetitive_confirmation":true}'::jsonb,
      '{"approved_facts_only":true,"no_sensitive_documents":true,"no_payment_instructions":true,"no_guarantees":true,"no_audio":true,"max_material_projects":3}'::jsonb,
      '{"privacy":"immediate_silent","fraud":"immediate","legal":"immediate","discrimination":"immediate","abuse":"after_recurrence","unsupported_language":"pause","human_requested":"immediate","missing_approved_fact":"when_indispensable"}'::jsonb,
      '[{"lead":"Quais opções vocês têm?","pedro":"Tô sem acesso ao sistema completo aqui agora, mas tenho alguns materiais que podem fazer sentido."},{"lead":"Quem vai fazer a call?","pedro":"Posso ser eu ou algum corretor do meu time. Assim que ficar definido eu te aviso por aqui."}]'::jsonb,
      v_prompt,encode(extensions.digest(convert_to(v_prompt,'UTF8'),'sha256'),'hex'),now()
    ) returning id into v_persona_version_id;
  end if;

  insert into public.rule_sets(org_id,code,name)
  values(p_org_id,'core','Regras operacionais do Pedro')
  on conflict(org_id,code) do update set name=excluded.name,updated_at=now()
  returning id into v_rule_set_id;

  v_rules := '{
    "behavior_version":"v4","language":"pt-BR",
    "qualification":{"topics":["purchase_objective","region","down_payment","monthly_installment","total_price","delivery_preference","purchase_timeline"],"accept_refused_or_unknown":true,"call_preference_after_qualification":true},
    "curation":{"requires":["total_price","down_payment"],"limit":3,"automatic_after_qualification":false,"explicit_material_intent":true,"selection":"deterministic_backend"},
    "media":{"generic_request":"books","photo_request":"principal_photos","book_filename":"Book - {project}.pdf","captions":false,"book_nudge_minutes":[4,6],"book_nudge_once":true,"audio_outbound":false},
    "calls":{"duration_minutes":15,"explicit_date_time":true,"confirmed_only_after_broker_acceptance":true,"announce_broker_only_if_asked":true},
    "tone":{"informal_professional":true,"mirror_lead":true,"short_messages":true,"avoid_repetitive_perfeito":true},
    "human_ownership":"no_auto_send"
  }'::jsonb;

  select id into v_rule_version_id
  from public.rule_versions
  where rule_set_id=v_rule_set_id and status='published' and compiled_rules->>'behavior_version'='v4';
  if v_rule_version_id is null then
    update public.rule_versions set status='archived',updated_at=now()
    where rule_set_id=v_rule_set_id and status='published';
    select coalesce(max(version),0)+1 into v_version from public.rule_versions where rule_set_id=v_rule_set_id;
    insert into public.rule_versions(org_id,rule_set_id,version,status,rules,compiled_rules,checksum,published_at)
    values(p_org_id,v_rule_set_id,v_version,'published',v_rules,v_rules,
      encode(extensions.digest(convert_to(v_rules::text,'UTF8'),'sha256'),'hex'),now())
    returning id into v_rule_version_id;
  end if;

  -- Conversas existentes preservam o histórico, mas passam a usar uma nova
  -- versão congelada do contexto a partir da próxima execução.
  insert into public.conversation_context_versions(
    org_id,conversation_id,version,persona_version_id,rule_version_id,
    qualification_version_id,project_snapshot_ids,institutional_snapshot,frozen
  )
  select
    c.org_id,c.id,latest.version+1,v_persona_version_id,v_rule_version_id,
    latest.qualification_version_id,latest.project_snapshot_ids,
    coalesce(settings.institutional_profile,'{}'::jsonb),true
  from public.conversations c
  join lateral (
    select cv.* from public.conversation_context_versions cv
    where cv.conversation_id=c.id order by cv.version desc limit 1
  ) latest on true
  join public.organization_settings settings on settings.org_id=c.org_id
  where c.org_id=p_org_id
    and (latest.persona_version_id<>v_persona_version_id or latest.rule_version_id<>v_rule_version_id);
end;
$$;
revoke all on function private.seed_pedro_package(uuid) from public,anon,authenticated,service_role;

do $$ declare v_org_id uuid; begin
  for v_org_id in select id from public.organizations loop
    perform private.seed_pedro_package(v_org_id);
  end loop;
end $$;

create or replace function public.enqueue_pedro_project_media(p_execution_id uuid)
returns integer
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_intent text;
  v_project uuid;
  v_project_name text;
  v_projects uuid[]:=array[]::uuid[];
  v_media public.project_media%rowtype;
  v_message uuid;
  v_count integer:=0;
  v_reviewer uuid;
  v_delay integer;
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

  v_intent:=coalesce(v_execution.output_structured->>'project_material_intent','none');
  if v_intent not in ('books','principal_photos','more_photos') then return 0; end if;
  select coalesce(array_agg(value::uuid order by ord),array[]::uuid[]) into v_projects
  from jsonb_array_elements_text(coalesce(v_execution.output_structured->'recommended_project_ids','[]'::jsonb)) with ordinality as x(value,ord)
  where ord<=3;

  foreach v_project in array v_projects loop
    select name into v_project_name from public.projects
    where id=v_project and org_id=v_execution.org_id and status='active' and recommendable;
    if v_project_name is null then continue; end if;
    for v_media in
      select * from public.project_media m
      where m.project_id=v_project and m.org_id=v_execution.org_id and m.active and m.published_at is not null
        and (case v_intent
          when 'books' then m.media_type='pdf'
          when 'principal_photos' then m.media_type='cover'
          when 'more_photos' then m.media_type='image'
          else false end)
      order by m.sort_order,m.created_at
      limit case when v_intent='more_photos' then 4 else 1 end
    loop
      insert into public.messages(
        org_id,operation_id,conversation_id,direction,sender_type,sender_user_id,
        content_type,body,provider_status,metadata
      ) values (
        v_execution.org_id,v_execution.operation_id,v_conversation.id,'outbound',
        case when v_execution.mode='assisted' then 'user' else 'ai' end,v_reviewer,
        case when v_media.media_type='pdf' then 'document' else 'image' end,
        '','queued',
        jsonb_build_object('ai_execution_id',v_execution.id,'project_id',v_project,'project_media_id',v_media.id,
          'source',case when v_execution.mode='assisted' then 'ai_suggestion' else 'ai' end,
          'storage_bucket','gril-projects','storage_path',v_media.storage_path,'mime_type',v_media.mime_type,
          'file_name',case when v_media.media_type='pdf' then
            left('Book - '||regexp_replace(v_project_name,'[\\/:*?"<>|]+','-','g')||'.pdf',120)
          else null end)
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

  if v_intent='books' and v_count>0 then
    v_delay:=4+abs(hashtext(v_execution.id::text))%3;
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      v_execution.org_id,v_execution.operation_id,'project_material.call_nudge','conversation',v_conversation.id,
      'scheduled-actions',now()+make_interval(mins=>v_delay),'project-material-nudge:'||v_execution.id::text,
      jsonb_build_object('conversation_id',v_conversation.id,'execution_id',v_execution.id,'source','project_material_nudge'),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end if;
  return v_count;
end;
$$;
revoke all on function public.enqueue_pedro_project_media(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_pedro_project_media(uuid) to service_role;

alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_material_first_flow;
revoke all on function public.execute_runtime_job_before_material_first_flow(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_before_material_first_flow(uuid) to service_role;

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
  v_execution_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type<>'project_material.call_nudge' then
    return public.execute_runtime_job_before_material_first_flow(p_job_id);
  end if;

  select * into v_conversation from public.conversations
  where id=(v_job.payload->>'conversation_id')::uuid for update;
  begin v_execution_id:=(v_job.payload->>'execution_id')::uuid; exception when others then v_execution_id:=null; end;
  if not found or v_conversation.ai_mode not in ('assisted','production')
     or v_conversation.status<>'active' or v_conversation.ownership<>'ai'
     or exists(select 1 from public.opt_outs where operation_id=v_conversation.operation_id and contact_id=v_conversation.contact_id and revoked_at is null)
     or exists(select 1 from public.messages where conversation_id=v_conversation.id and direction='inbound' and created_at>v_job.created_at)
     or exists(select 1 from public.calls where opportunity_id=v_conversation.opportunity_id and status not in ('completed','no_show','cancelled')) then
    return jsonb_build_object('status','cancelled');
  end if;
  if exists(
    select 1 from public.project_media_deliveries d join public.messages m on m.id=d.message_id
    where d.ai_execution_id=v_execution_id and d.delivery_kind='book' and m.provider_status in ('queued','sending')
  ) then
    return jsonb_build_object('status','retry','retry_seconds',60,'reason','book_delivery_pending');
  end if;
  if not exists(
    select 1 from public.project_media_deliveries d join public.messages m on m.id=d.message_id
    where d.ai_execution_id=v_execution_id and d.delivery_kind='book' and m.provider_status in ('sent','delivered','read')
  ) then
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
    v_conversation.org_id,v_conversation.operation_id,v_conversation.id,v_conversation.ai_mode,v_conversation.version,
    jsonb_build_object('source','project_material_nudge','job_id',v_job.id,
      'instruction','Retome uma única vez e proponha naturalmente uma call de aproximadamente 15 minutos.'),
    'ai-project-material-nudge:'||v_job.id::text,null
  ) on conflict(org_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into v_execution_request;
  if v_execution_request.result='queued' then
    return jsonb_build_object('status','run_ai','ai_execution_id',v_execution_request.execution_id);
  end if;
  return jsonb_build_object('status','cancelled');
end;
$$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

commit;
