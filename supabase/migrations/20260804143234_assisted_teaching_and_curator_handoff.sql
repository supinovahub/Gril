begin;

alter table public.whatsapp_connections
  add column if not exists outbound_paused boolean not null default false,
  add column if not exists outbound_pause_reason text,
  add column if not exists outbound_paused_at timestamptz;

create or replace function private.can_access_internal_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(
    select 1 from public.internal_threads t
    where t.id=p_thread_id and (
      (
        t.thread_type='broker_assistant'
        and t.broker_membership_id=private.current_membership_id(t.org_id)
        and exists(
          select 1 from public.conversation_access_grants g
          where g.conversation_id=t.conversation_id
            and g.membership_id=t.broker_membership_id
            and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now()
        )
      )
      or (t.thread_type<>'broker_assistant' and private.has_org_role(t.org_id,array['owner','manager']::text[]))
      or private.has_org_role(t.org_id,array['owner']::text[])
      or private.has_org_permission(t.org_id,'ai.manage')
      or private.has_contractual_support(t.org_id,false)
    )
  )
$$;
revoke all on function private.can_access_internal_thread(uuid) from public,anon;
grant execute on function private.can_access_internal_thread(uuid) to authenticated;

create or replace function private.register_assisted_learning_candidate(
  p_suggestion public.ai_suggestions,
  p_conversation public.conversations,
  p_actor_user_id uuid,
  p_ideal_response text,
  p_kind text
)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_learning uuid;v_thread uuid;begin
  insert into public.learning_suggestions(
    org_id,operation_id,conversation_id,message_id,source,observed_response,
    human_observation,suggested_change,scope,evidence,status,candidate_kind,created_by
  ) values (
    p_suggestion.org_id,p_conversation.operation_id,p_conversation.id,null,
    'assisted_correction',p_suggestion.body,
    case when p_kind='teach_only' then 'O gestor ensinou uma resposta sem enviá-la ao lead.' else 'O gestor editou a sugestão antes do envio.' end,
    p_ideal_response,'style',jsonb_build_array(jsonb_build_object('suggestion_id',p_suggestion.id,'conversation_id',p_conversation.id)),
    'new','potential_rule',p_actor_user_id
  ) returning id into v_learning;

  insert into public.internal_threads(
    org_id,operation_id,assistant_role,thread_type,title,conversation_id,opportunity_id,
    status,priority,requires_action,source,metadata,created_by
  ) values (
    p_suggestion.org_id,p_conversation.operation_id,'lionel','learning','Curar correção do atendimento',
    p_conversation.id,p_conversation.opportunity_id,'discussing','normal',false,'assisted_correction',
    jsonb_build_object('learning_suggestion_id',v_learning,'ai_suggestion_id',p_suggestion.id),p_actor_user_id
  ) returning id into v_thread;
  update public.learning_suggestions set source_thread_id=v_thread where id=v_learning;
  insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
  values(p_suggestion.org_id,v_thread,'lionel','context_update',
    'Recebi uma correção do modo assisted. Antes de transformá-la em regra, preciso entender: isso vale apenas para este caso ou deve se repetir em situações semelhantes?',
    jsonb_build_object('learning_suggestion_id',v_learning));
  return v_learning;
end;$$;
revoke all on function private.register_assisted_learning_candidate(public.ai_suggestions,public.conversations,uuid,text,text)
from public,anon,authenticated,service_role;

create or replace function private.process_ai_suggestion_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request public.message_send_requests%rowtype;
  v_execution public.ai_executions%rowtype;
  v_message_id uuid;
  v_previous_role text;
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
    update public.ai_executions set status='failed',error_code='manager_teaching_revision',error_redacted='Nova orientação humana solicitou regeneração.',completed_at=now() where id=v_execution.id;
    select id into v_message_id from public.messages where conversation_id=v_conversation.id and direction='inbound' order by created_at desc,id desc limit 1;
    if v_message_id is not null then
      v_previous_role:=coalesce(current_setting('request.jwt.claim.role',true),'authenticated');
      perform set_config('request.jwt.claim.role','service_role',true);
      perform public.ensure_inbound_ai_execution(v_message_id);
      perform set_config('request.jwt.claim.role',v_previous_role,true);
    end if;
    new.result:='teaching_registered';
  else
    perform private.apply_approved_assisted_actions(v_suggestion.execution_id,new.actor_user_id,v_conversation.version);
    insert into public.message_send_requests(org_id,conversation_id,actor_user_id,body,expected_conversation_version,source,ai_suggestion_id)
    values(new.org_id,v_conversation.id,new.actor_user_id,coalesce(nullif(trim(new.edited_body),''),v_suggestion.body),v_conversation.version,'ai_suggestion',v_suggestion.id)
    returning * into v_request;
    if nullif(trim(new.edited_body),'') is not null and trim(new.edited_body)<>trim(v_suggestion.body) then
      perform private.register_assisted_learning_candidate(v_suggestion,v_conversation,new.actor_user_id,trim(new.edited_body),'send_and_teach');
    end if;
    update public.ai_suggestions set body=coalesce(nullif(trim(new.edited_body),''),body),status='approved',reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    perform public.enqueue_pedro_project_media(v_suggestion.execution_id);
    new.message_id:=v_request.message_id;new.result:='sent';
  end if;

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'ai.suggestion_'||new.action,'ai_suggestions',v_suggestion.id,
    jsonb_build_object('message_id',new.message_id,'structured_actions_applied',new.action='send'));
  return new;
end;$$;
revoke all on function private.process_ai_suggestion_review_request() from public,anon,authenticated,service_role;

-- Production is restricted to reactivation campaigns. Normal inbound remains
-- off, shadow or assisted even if a stale configuration still used production.
update public.organization_settings
set ai_global_mode='assisted',inbound_ai_mode='assisted'
where ai_global_mode='production';
alter table public.organization_settings
  add constraint organization_settings_inbound_no_production_check
  check (ai_global_mode<>'production');

create or replace function private.enforce_reactivation_production_gate()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_settings public.organization_settings%rowtype;begin
  if new.ai_mode<>'production' then return new;end if;
  if new.campaign_type<>'reactivation' then raise exception 'production_only_for_reactivation' using errcode='22023';end if;
  select * into v_settings from public.organization_settings where org_id=new.org_id;
  if v_settings.reactivation_ai_mode<>'production' or v_settings.reactivation_release_state='blocked' then
    raise exception 'reactivation_production_not_released' using errcode='22023';
  end if;
  return new;
end;$$;
revoke all on function private.enforce_reactivation_production_gate() from public,anon,authenticated,service_role;
drop trigger if exists campaigns_reactivation_production_gate on public.campaigns;
create trigger campaigns_reactivation_production_gate before insert or update of ai_mode,campaign_type on public.campaigns
for each row execute function private.enforce_reactivation_production_gate();

create or replace function private.enforce_campaign_contact_allowlist()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype;v_release text;begin
  select * into v_campaign from public.campaigns where id=new.campaign_id;
  if v_campaign.ai_mode<>'production' then return new;end if;
  select reactivation_release_state into v_release from public.organization_settings where org_id=new.org_id;
  if v_release='test_controlled' and not exists(
    select 1 from public.contact_phones cp join public.ai_test_allowlist a
      on a.org_id=cp.org_id and a.phone_e164=cp.e164 and a.active
    where cp.contact_id=new.contact_id and cp.status='active'
  ) then raise exception 'campaign_contact_not_allowlisted' using errcode='22023';end if;
  return new;
end;$$;
revoke all on function private.enforce_campaign_contact_allowlist() from public,anon,authenticated,service_role;
drop trigger if exists campaign_contacts_allowlist_gate on public.campaign_contacts;
create trigger campaign_contacts_allowlist_gate before insert or update of contact_id,campaign_id on public.campaign_contacts
for each row execute function private.enforce_campaign_contact_allowlist();

create or replace function private.route_completed_call_to_manager()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype;v_conversation public.conversations%rowtype;v_thread uuid;begin
  if new.result not in ('start_negotiation','lost','no_result') then return new;end if;
  select * into v_call from public.calls where id=new.call_id;
  select * into v_conversation from public.conversations
  where opportunity_id=v_call.opportunity_id and status in ('active','paused')
  order by updated_at desc limit 1 for update;
  if v_conversation.id is null then return new;end if;
  update public.conversations set ownership='human',ai_mode='assisted',journey='post_call',autonomy_override='low',
    status='active',pause_reason='post_call_manager_review',version=version+1,updated_at=now()
  where id=v_conversation.id;
  update public.conversation_access_grants set revoked_at=now(),revoked_by=new.recorded_by
  where conversation_id=v_conversation.id and reason='call_window' and revoked_at is null;
  insert into public.internal_threads(org_id,operation_id,assistant_role,thread_type,title,conversation_id,opportunity_id,
    status,priority,requires_action,source,metadata,created_by)
  values(new.org_id,v_call.operation_id,'pedro','lead_case','Próximo passo após a call',v_conversation.id,v_call.opportunity_id,
    'awaiting_response','high',true,'post_call',jsonb_build_object('call_id',v_call.id,'call_result_id',new.id,'result',new.result),new.recorded_by)
  returning id into v_thread;
  insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
  values(new.org_id,v_thread,'pedro','context_update',
    'A call foi concluída e o acesso operacional do corretor foi encerrado. Estou em modo assisted e autonomia baixa. Vou revisar o resultado e propor ao dono ou gestor o próximo passo antes de qualquer envio ao lead.',
    jsonb_build_object('call_id',v_call.id,'result',new.result));
  return new;
end;$$;
revoke all on function private.route_completed_call_to_manager() from public,anon,authenticated,service_role;
drop trigger if exists call_result_route_to_manager on public.call_results;
create trigger call_result_route_to_manager after insert on public.call_results
for each row execute function private.route_completed_call_to_manager();

commit;
