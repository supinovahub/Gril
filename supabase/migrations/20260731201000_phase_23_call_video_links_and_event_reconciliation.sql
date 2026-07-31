begin;

alter table public.whatsapp_message_templates
  drop constraint whatsapp_message_templates_parameter_strategy_check;
alter table public.whatsapp_message_templates
  add constraint whatsapp_message_templates_parameter_strategy_check
  check(parameter_strategy in ('none','first_name','body','call_datetime','call_link'));

create or replace function private.meta_template_parameters(
  p_strategy text,p_body text,p_conversation uuid,p_metadata jsonb
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_value text;v_call public.calls%rowtype;
begin
  if p_strategy='none' then return '[]'::jsonb;
  elsif p_strategy='body' then v_value:=p_body;
  elsif p_strategy='first_name' then
    select split_part(ct.name,' ',1) into v_value from public.conversations c join public.contacts ct on ct.id=c.contact_id where c.id=p_conversation;
  elsif p_strategy in ('call_datetime','call_link') then
    select * into v_call from public.calls where id=nullif(p_metadata->>'call_id','')::uuid;
    if p_strategy='call_datetime' then
      v_value:=to_char(v_call.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI');
    else
      v_value:=v_call.video_link;
    end if;
  end if;
  return case when nullif(trim(v_value),'') is null then '[]'::jsonb else jsonb_build_array(left(v_value,1024)) end;
end; $$;

create or replace function public.get_outbound_template(p_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_metadata jsonb;v_strategy text;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select metadata into v_metadata from public.operational_messages where id=p_message_id;
  if not found then select metadata into v_metadata from public.messages where id=p_message_id; end if;
  if v_metadata is null then return jsonb_build_object('required',false); end if;
  select parameter_strategy into v_strategy from public.whatsapp_message_templates
    where id=nullif(v_metadata->>'meta_template_id','')::uuid;
  return jsonb_build_object('required',coalesce((v_metadata->>'meta_template_required')::boolean,false),
    'missing',coalesce((v_metadata->>'meta_template_missing')::boolean,false),
    'name',v_metadata->>'meta_template_name','language',v_metadata->>'meta_template_language',
    'parameters',coalesce(v_metadata->'meta_template_parameters','[]'::jsonb),'purpose',v_metadata->>'meta_template_purpose',
    'strategy',v_strategy);
end; $$;

create table public.call_video_link_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,
  video_link text not null check(char_length(video_link) between 12 and 2000),
  expected_call_version integer not null check(expected_call_version>0),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  result text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(call_id,org_id) references public.calls(id,org_id) on delete restrict
);

create or replace function private.process_call_video_link_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype;v_membership uuid;v_is_service boolean:=(select auth.role())='service_role';
begin
  if not v_is_service and ((select auth.uid()) is null or new.actor_user_id<>(select auth.uid())) then
    raise exception 'call_video_link_forbidden' using errcode='42501';
  end if;
  select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.version<>new.expected_call_version then raise exception 'call_version_conflict' using errcode='40001'; end if;
  if v_call.format<>'video' or v_call.status in ('completed','no_show','cancelled') then
    raise exception 'call_video_link_invalid_state' using errcode='22023';
  end if;
  if new.video_link !~ '^https://[^[:space:]]+$' then raise exception 'call_video_link_requires_https' using errcode='22023'; end if;
  if not v_is_service then
    v_membership:=private.current_membership_id(new.org_id);
    if not private.has_org_permission(new.org_id,'pipeline.manage') and v_call.assigned_membership_id is distinct from v_membership then
      raise exception 'call_video_link_forbidden' using errcode='42501';
    end if;
  end if;
  update public.calls set video_link=new.video_link,version=version+1,updated_at=now() where id=v_call.id;
  update public.alerts set status='resolved',resolved_at=now(),updated_at=now()
    where org_id=new.org_id and dedupe_key='call-video-link-missing:'||v_call.id::text and status<>'resolved';
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'call.video_link_updated','calls',v_call.id,
    jsonb_build_object('previous_configured',v_call.video_link is not null,'host',split_part(split_part(new.video_link,'://',2),'/',1)));
  new.result:='updated';new.processed_at:=now();return new;
end; $$;

create trigger call_video_link_request_process before insert on public.call_video_link_requests
for each row execute function private.process_call_video_link_request();

alter table public.call_video_link_requests enable row level security;
create policy call_video_link_requests_actor_select on public.call_video_link_requests for select to authenticated
using(actor_user_id=(select auth.uid()));
create policy call_video_link_requests_actor_insert on public.call_video_link_requests for insert to authenticated
with check(actor_user_id=(select auth.uid()) and (select private.is_active_org_member(org_id)));
grant select,insert on public.call_video_link_requests to authenticated;
grant all on public.call_video_link_requests to service_role;

create or replace function public.consume_runtime_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_type text:=p_event->>'event_type';v_event_id uuid;v_offer public.call_offers%rowtype;v_call public.calls%rowtype;
  v_alert public.alerts%rowtype;v_member public.memberships%rowtype;v_operational uuid;v_conversation uuid;v_message uuid;v_body text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  begin v_event_id:=(p_event->>'event_id')::uuid; exception when others then v_event_id:=null; end;
  if v_type='call.offer_sent.v1' then
    select * into v_offer from public.call_offers where id=(p_event->'payload'->>'offer_id')::uuid;
    select * into v_call from public.calls where id=v_offer.call_id;
    if found then
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,source_event_id)
      values(v_offer.org_id,v_offer.recipient_membership_id,'app','Nova oportunidade de call','Uma call esta disponivel. Abra a agenda para aceitar antes do vencimento.',v_event_id),
        (v_offer.org_id,v_offer.recipient_membership_id,'push','Nova oportunidade de call','Uma call esta disponivel. Abra a agenda para aceitar antes do vencimento.',v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
      v_body:='Nova call disponivel para '||to_char(v_call.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||
        '. Abra o Gril > Agenda para aceitar antes do vencimento da oferta.';
      v_operational:=private.enqueue_operational_message(v_offer.org_id,v_call.operation_id,v_offer.recipient_membership_id,v_body,
        'call_offer','call',v_call.id,'call-offer-whatsapp:'||v_offer.id::text);
      if v_operational is null then
        insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
        values(v_offer.org_id,v_call.operation_id,'warning','call','Oferta sem WhatsApp operacional',
          'O corretor recebeu a notificacao no app, mas nao ha perfil ou conexao ativa para o WhatsApp operacional.',
          'call_offer',v_offer.id,'call-offer-no-whatsapp:'||v_offer.id::text)
        on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
      end if;
    end if;
    return jsonb_build_object('status','call_offer_notified');
  elsif v_type='call.offer_accepted.v1' then
    select * into v_call from public.calls where id=(p_event->'payload'->>'call_id')::uuid;
    select o.current_conversation_id into v_conversation from public.opportunities o where o.id=v_call.opportunity_id;
    if v_conversation is not null then
      v_body:='Seu horario foi confirmado para '||to_char(v_call.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY as HH24:MI')||
        case when v_call.format='video' and v_call.video_link is not null then E'.\n\nLink: '||v_call.video_link else '. Se precisar ajustar, responda por aqui.' end;
      insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,metadata)
      values(v_call.org_id,v_call.operation_id,v_conversation,'outbound','system','text',v_body,'queued',jsonb_build_object('call_id',v_call.id,'call_confirmation',true))
      returning id into v_message;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload)
      values(v_call.org_id,v_call.operation_id,'outbound.message.send','message',v_message,'outbound-whatsapp',now(),
        'call-confirmation-send:'||v_call.id::text,jsonb_build_object('message_id',v_message))
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    end if;
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload)
    values
      (v_call.org_id,v_call.operation_id,'call.result.escalate','call',v_call.id,'scheduled-actions',v_call.ends_at+interval '1 hour','call-result-escalate:'||v_call.id::text||':1',jsonb_build_object('call_id',v_call.id,'offset_hours',1)),
      (v_call.org_id,v_call.operation_id,'call.result.escalate','call',v_call.id,'scheduled-actions',v_call.ends_at+interval '4 hours','call-result-escalate:'||v_call.id::text||':4',jsonb_build_object('call_id',v_call.id,'offset_hours',4)),
      (v_call.org_id,v_call.operation_id,'call.result.escalate','call',v_call.id,'scheduled-actions',v_call.ends_at+interval '24 hours','call-result-escalate:'||v_call.id::text||':24',jsonb_build_object('call_id',v_call.id,'offset_hours',24))
    on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
    return jsonb_build_object('status','call_acceptance_notified');
  elsif v_type='notification.alert_created.v1' then
    select * into v_alert from public.alerts where id=(p_event->'payload'->>'alert_id')::uuid;
    if not found then return jsonb_build_object('status','ignored'); end if;
    for v_member in select m.* from public.memberships m where m.org_id=v_alert.org_id and m.status='active' and m.role in ('owner','manager')
      and (v_alert.operation_id is null or m.role='owner' or exists(select 1 from public.membership_operations mo where mo.membership_id=m.id and mo.operation_id=v_alert.operation_id)) loop
      insert into public.notifications(org_id,recipient_membership_id,alert_id,channel,title,body,source_event_id)
      values(v_alert.org_id,v_member.id,v_alert.id,'app',v_alert.title,v_alert.body,v_event_id),
        (v_alert.org_id,v_member.id,v_alert.id,'push',v_alert.title,v_alert.body,v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
    end loop;
    return jsonb_build_object('status','notification_created');
  end if;
  return jsonb_build_object('status','acknowledged');
end; $$;

revoke all on function private.meta_template_parameters(text,text,uuid,jsonb),private.process_call_video_link_request(),public.get_outbound_template(uuid),public.consume_runtime_event(jsonb) from public,anon,authenticated;
grant execute on function public.get_outbound_template(uuid),public.consume_runtime_event(jsonb) to service_role;

comment on table public.call_video_link_requests is 'Audited command for an owner, manager or assigned broker to set the HTTPS link of an active video call.';

commit;
