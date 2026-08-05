begin;

alter table public.ai_executions
  add column if not exists model_output_structured jsonb,
  add column if not exists validated_action_plan jsonb,
  add column if not exists decision_validation_status text,
  add column if not exists decision_validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists decision_hash text;

alter table public.ai_executions drop constraint if exists ai_executions_decision_validation_status_check;
alter table public.ai_executions add constraint ai_executions_decision_validation_status_check
  check (decision_validation_status is null or decision_validation_status in ('accepted','rejected','invalidated_by_human'));

comment on column public.ai_executions.model_output_structured is
  'Decisão estruturada original e imutável produzida pelo Pedro antes da execução.';
comment on column public.ai_executions.validated_action_plan is
  'Plano aceito pelos gates técnicos. Deve preservar exatamente as ações escolhidas pelo Pedro.';

-- Preserve the previous implementation for its transactional effects, but
-- reject the entire transaction if it rewrites text or structured actions.
alter function public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer)
  rename to complete_pedro_turn_before_explicit_actions;
revoke all on function public.complete_pedro_turn_before_explicit_actions(uuid,text,jsonb,text,text,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.complete_pedro_turn_before_explicit_actions(uuid,text,jsonb,text,text,integer,integer,integer)
  to service_role;

create function public.complete_pedro_turn(
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
  v_result jsonb;
  v_stored public.ai_executions%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;

  v_result:=public.complete_pedro_turn_before_explicit_actions(
    p_execution_id,p_output_text,p_output_structured,p_response_id,p_model_returned,
    p_input_tokens,p_output_tokens,p_latency_ms
  );
  select * into v_stored from public.ai_executions where id=p_execution_id;
  if v_stored.status='completed' and (
    v_stored.output_text is distinct from p_output_text
    or v_stored.output_structured is distinct from p_output_structured
  ) then
    raise exception 'executor_semantic_mutation_blocked' using errcode='22023';
  end if;
  return v_result;
end;
$$;
revoke all on function public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer)
  to service_role;

-- The legacy completion function applied policy effects correctly but authored
-- canned acknowledgements. The wrapper removes those uncommitted rows and only
-- schedules a lead-facing message when Pedro explicitly supplied reply.
alter function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)
  rename to complete_ai_execution_before_explicit_actions;
revoke all on function public.complete_ai_execution_before_explicit_actions(uuid,text,jsonb,text,text,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.complete_ai_execution_before_explicit_actions(uuid,text,jsonb,text,text,integer,integer,integer)
  to service_role;

create function public.complete_ai_execution(
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
  v_result jsonb;
  v_execution public.ai_executions%rowtype;
  v_ack_ids uuid[]:=array[]::uuid[];
  v_reply text;
  v_message uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  v_result:=public.complete_ai_execution_before_explicit_actions(
    p_execution_id,p_output_text,p_output_structured,p_response_id,p_model_returned,
    p_input_tokens,p_output_tokens,p_latency_ms
  );

  if coalesce(p_output_structured->>'action','reply')<>'reply' then
    select * into v_execution from public.ai_executions where id=p_execution_id;
    select coalesce(array_agg(id),array[]::uuid[]) into v_ack_ids
    from public.messages
    where conversation_id=v_execution.conversation_id
      and metadata->>'control_ack_for'=v_execution.request_message_id::text;
    delete from public.scheduled_jobs
    where aggregate_type='message' and aggregate_id=any(v_ack_ids)
      and status in ('pending','leased');
    delete from public.messages where id=any(v_ack_ids);

    v_reply:=nullif(trim(p_output_structured->>'reply'),'');
    if v_reply is not null and v_execution.conversation_id is not null and v_execution.mode<>'shadow' then
      insert into public.messages(
        org_id,operation_id,conversation_id,direction,sender_type,content_type,body,
        provider_status,reply_to_message_id,metadata
      ) values (
        v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,'outbound','ai','text',v_reply,
        'queued',v_execution.request_message_id,
        jsonb_build_object('ai_execution_id',v_execution.id,'explicit_escalation_reply',true)
      ) returning id into v_message;
      insert into public.scheduled_jobs(
        org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
      ) values (
        v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message,
        'outbound-whatsapp',now(),'ai-explicit-escalation-reply:'||v_execution.id::text,
        jsonb_build_object('message_id',v_message),3
      ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)
  to service_role;

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
  v_project uuid;
  v_kind text;
  v_project_name text;
  v_media public.project_media%rowtype;
  v_message uuid;
  v_count integer:=0;
  v_request_count integer;
  v_reviewer uuid;
  v_delay integer;
  v_sent_book boolean:=false;
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

  for v_request in
    select value from jsonb_array_elements(
      case
        when jsonb_typeof(v_execution.output_structured->'project_media_requests')='array'
          then v_execution.output_structured->'project_media_requests'
        when jsonb_typeof(v_execution.output_structured->'project_media_request')='object'
          then jsonb_build_array(v_execution.output_structured->'project_media_request')
        else '[]'::jsonb
      end
    )
  loop
    begin
      v_project:=(v_request->>'project_id')::uuid;
    exception when others then
      raise exception 'explicit_project_id_invalid' using errcode='22023';
    end;
    v_kind:=v_request->>'kind';
    if v_kind not in ('book','principal','more_photos') then
      raise exception 'explicit_project_media_kind_invalid' using errcode='22023';
    end if;
    select name into v_project_name from public.projects
    where id=v_project and org_id=v_execution.org_id and status='active' and recommendable;
    if v_project_name is null then
      raise exception 'explicit_project_not_available' using errcode='22023';
    end if;

    v_request_count:=0;
    for v_media in
      select * from public.project_media m
      where m.project_id=v_project and m.org_id=v_execution.org_id and m.active and m.published_at is not null
        and (case v_kind
          when 'book' then m.media_type='pdf'
          when 'principal' then m.media_type='cover'
          when 'more_photos' then m.media_type='image'
          else false end)
      order by m.sort_order,m.created_at
      limit case when v_kind='more_photos' then 4 else 1 end
    loop
      insert into public.messages(
        org_id,operation_id,conversation_id,direction,sender_type,sender_user_id,
        content_type,body,provider_status,metadata
      ) values (
        v_execution.org_id,v_execution.operation_id,v_conversation.id,'outbound',
        case when v_execution.mode='assisted' then 'user' else 'ai' end,v_reviewer,
        case when v_media.media_type='pdf' then 'document' else 'image' end,'','queued',
        jsonb_build_object('ai_execution_id',v_execution.id,'project_id',v_project,'project_media_id',v_media.id,
          'explicit_project_media_request',v_request,
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
        v_request_count:=v_request_count+1;
        if v_kind='book' then v_sent_book:=true; end if;
      else
        delete from public.messages where id=v_message;
      end if;
    end loop;
    if v_request_count=0 and not exists(
      select 1 from public.project_media_deliveries d
      where d.ai_execution_id=v_execution.id
        and d.delivery_kind=case when v_kind='principal' then 'principal' when v_kind='book' then 'book' else 'more_photos' end
        and d.project_media_id in (select id from public.project_media where project_id=v_project)
    ) then
      raise exception 'explicit_project_media_not_available' using errcode='22023';
    end if;
  end loop;

  if v_sent_book then
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

create or replace function private.process_ai_suggestion_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request public.message_send_requests%rowtype;
  v_execution public.ai_executions%rowtype;
  v_message_id uuid;
  v_previous_role text;
  v_edited boolean:=false;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then
    raise exception 'suggestion_review_forbidden' using errcode='42501';
  end if;
  select * into v_suggestion from public.ai_suggestions where id=new.suggestion_id and org_id=new.org_id for update;
  if not found or v_suggestion.status<>'pending' or v_suggestion.conversation_id is null
     or not private.can_access_conversation(v_suggestion.conversation_id) then
    raise exception 'suggestion_not_reviewable' using errcode='22023';
  end if;
  select * into v_conversation from public.conversations where id=v_suggestion.conversation_id for update;

  if new.action in ('send','teach_only')
     and (new.expected_conversation_version is null or new.expected_conversation_version<>v_conversation.version) then
    raise exception 'version_conflict' using errcode='40001';
  end if;
  if new.action='teach_only' and not (
    private.has_org_role(new.org_id,array['owner','manager']::text[])
    or private.has_org_permission(new.org_id,'ai.manage')
  ) then raise exception 'teaching_forbidden' using errcode='42501';end if;

  if new.action='discard' then
    update public.ai_suggestions set status='rejected',reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    new.result:='discarded';
  elsif new.action='teach_only' then
    if nullif(trim(new.edited_body),'') is null then raise exception 'teaching_body_required' using errcode='22023';end if;
    update public.conversation_ai_guidance set status='superseded' where conversation_id=v_conversation.id and status='active';
    insert into public.conversation_ai_guidance(org_id,conversation_id,source_suggestion_id,guidance,exact_reply,created_by)
    values(new.org_id,v_conversation.id,v_suggestion.id,trim(new.edited_body),true,new.actor_user_id);
    perform private.register_assisted_learning_candidate(v_suggestion,v_conversation,new.actor_user_id,trim(new.edited_body),'teach_only');
    update public.ai_suggestions set status='rejected',reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    select * into v_execution from public.ai_executions where id=v_suggestion.execution_id for update;
    update public.ai_executions set status='failed',error_code='manager_teaching_revision',
      error_redacted='Nova orientação humana solicitou regeneração.',completed_at=now()
    where id=v_execution.id;
    select id into v_message_id from public.messages where conversation_id=v_conversation.id and direction='inbound'
    order by created_at desc,id desc limit 1;
    if v_message_id is not null then
      v_previous_role:=coalesce(current_setting('request.jwt.claim.role',true),'authenticated');
      perform set_config('request.jwt.claim.role','service_role',true);
      perform public.ensure_inbound_ai_execution(v_message_id);
      perform set_config('request.jwt.claim.role',v_previous_role,true);
    end if;
    new.result:='teaching_registered';
  else
    v_edited:=nullif(trim(new.edited_body),'') is not null and trim(new.edited_body)<>trim(v_suggestion.body);
    if not v_edited then
      perform private.apply_approved_assisted_actions(v_suggestion.execution_id,new.actor_user_id,v_conversation.version);
    end if;
    insert into public.message_send_requests(org_id,conversation_id,actor_user_id,body,expected_conversation_version,source,ai_suggestion_id)
    values(new.org_id,v_conversation.id,new.actor_user_id,
      coalesce(nullif(trim(new.edited_body),''),v_suggestion.body),v_conversation.version,'ai_suggestion',v_suggestion.id)
    returning * into v_request;
    if v_edited then
      perform private.register_assisted_learning_candidate(v_suggestion,v_conversation,new.actor_user_id,trim(new.edited_body),'send_and_teach');
      update public.ai_executions set validated_action_plan=null,decision_validation_status='invalidated_by_human',
        decision_validation_errors='["human_edited_reply"]'::jsonb
      where id=v_suggestion.execution_id;
    end if;
    update public.ai_suggestions set body=coalesce(nullif(trim(new.edited_body),''),body),status='approved',
      reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    if not v_edited then
      perform public.enqueue_pedro_project_media(v_suggestion.execution_id);
    end if;
    new.message_id:=v_request.message_id;new.result:='sent';
  end if;

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'ai.suggestion_'||new.action,'ai_suggestions',v_suggestion.id,
    jsonb_build_object('message_id',new.message_id,'structured_actions_applied',new.action='send' and not v_edited,
      'human_edit_invalidated_plan',v_edited));
  return new;
end;
$$;
revoke all on function private.process_ai_suggestion_review_request() from public,anon,authenticated,service_role;

commit;
