begin;

-- Every released contact belongs to a wave, and every wave must be reviewed
-- before the next one can be released.
alter table public.campaign_contacts add column wave_id uuid;
alter table public.campaign_contacts
  add constraint campaign_contacts_wave_id_org_id_fkey
  foreign key (wave_id,org_id) references public.campaign_waves(id,org_id) on delete restrict;
create index campaign_contacts_wave_idx on public.campaign_contacts(wave_id,status) where wave_id is not null;

alter table public.campaign_waves
  add column review_status text not null default 'pending'
    check (review_status in ('pending','in_review','approved','blocked')),
  add column review_required_count smallint not null default 0,
  add column review_completed_count smallint not null default 0,
  add column review_critical_count smallint not null default 0,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz;

create table public.campaign_wave_contact_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  wave_id uuid not null,
  campaign_contact_id uuid not null,
  required_for_gate boolean not null default true,
  outcome text not null default 'pending'
    check (outcome in ('pending','approved','needs_adjustment','critical')),
  notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id,org_id) references public.campaigns(id,org_id) on delete cascade,
  foreign key (wave_id,org_id) references public.campaign_waves(id,org_id) on delete cascade,
  foreign key (campaign_contact_id,org_id) references public.campaign_contacts(id,org_id) on delete cascade,
  unique(wave_id,campaign_contact_id),
  unique(id,org_id)
);
create index campaign_wave_reviews_gate_idx
  on public.campaign_wave_contact_reviews(wave_id,outcome) where required_for_gate;

create table public.campaign_wave_review_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  wave_id uuid not null,
  review_id uuid,
  requested_action text not null check(requested_action in ('review_item','approve_wave')),
  outcome text check(outcome in ('approved','needs_adjustment','critical')),
  notes text,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  resulting_status text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (wave_id,org_id) references public.campaign_waves(id,org_id) on delete restrict,
  foreign key (review_id,org_id) references public.campaign_wave_contact_reviews(id,org_id) on delete restrict
);

create or replace function private.process_campaign_wave_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_wave public.campaign_waves%rowtype;v_review public.campaign_wave_contact_reviews%rowtype;
  v_completed integer;v_critical integer;v_pending integer;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_wave_review_forbidden' using errcode='42501';
  end if;
  select * into v_wave from public.campaign_waves where id=new.wave_id and org_id=new.org_id for update;
  if not found then raise exception 'campaign_wave_not_found' using errcode='22023'; end if;
  if new.requested_action='review_item' then
    if new.review_id is null or new.outcome is null then raise exception 'campaign_review_item_required' using errcode='22023'; end if;
    select * into v_review from public.campaign_wave_contact_reviews
      where id=new.review_id and wave_id=v_wave.id and org_id=new.org_id for update;
    if not found then raise exception 'campaign_review_item_not_found' using errcode='22023'; end if;
    if new.outcome in ('needs_adjustment','critical') and nullif(trim(new.notes),'') is null then
      raise exception 'campaign_review_notes_required' using errcode='22023';
    end if;
    update public.campaign_wave_contact_reviews set outcome=new.outcome,notes=nullif(trim(new.notes),''),
      reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_review.id;
    select count(*) filter(where required_for_gate and outcome<>'pending'),
           count(*) filter(where required_for_gate and outcome='critical')
      into v_completed,v_critical from public.campaign_wave_contact_reviews where wave_id=v_wave.id;
    update public.campaign_waves set review_status=case when v_critical>0 then 'blocked' else 'in_review' end,
      review_completed_count=v_completed,review_critical_count=v_critical where id=v_wave.id;
    if new.outcome='critical' then
      update public.campaigns set status='paused',paused_reason='critical_wave_review',version=version+1,updated_at=now()
      where id=v_wave.campaign_id and status='running';
    end if;
    new.resulting_status:=case when v_critical>0 then 'blocked' else 'in_review' end;
  elsif new.requested_action='approve_wave' then
    select count(*) filter(where required_for_gate and outcome<>'approved'),
           count(*) filter(where required_for_gate and outcome='critical'),
           count(*) filter(where required_for_gate and outcome<>'pending')
      into v_pending,v_critical,v_completed from public.campaign_wave_contact_reviews where wave_id=v_wave.id;
    if v_wave.review_required_count=0 or v_pending>0 or v_critical>0 then
      raise exception 'campaign_wave_review_incomplete' using errcode='22023';
    end if;
    update public.campaign_waves set review_status='approved',review_completed_count=v_completed,
      review_critical_count=0,reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_wave.id;
    new.resulting_status:='approved';
  else raise exception 'unsupported_campaign_review_action' using errcode='22023'; end if;
  new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'campaign.wave_review_'||new.requested_action,'campaign_waves',v_wave.id,
    jsonb_build_object('review_id',new.review_id,'outcome',new.outcome,'result',new.resulting_status));
  return new;
end; $$;
revoke all on function private.process_campaign_wave_review_request() from public,anon,authenticated,service_role;
create trigger campaign_wave_review_process before insert on public.campaign_wave_review_requests
for each row execute function private.process_campaign_wave_review_request();

-- Preserve all original limits and add the mandatory quality gate.
create or replace function private.process_campaign_wave_release_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype;v_wave_no int;v_wave uuid;v_contact public.campaign_contacts%rowtype;
  v_phone text;v_released int:=0;v_suppressed int:=0;v_limit int;v_review_required int;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_wave_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.status not in ('approved','running') then raise exception 'campaign_not_releasable' using errcode='22023'; end if;
  if not exists(select 1 from public.whatsapp_connections where id=v_campaign.connection_id and status='active' and campaign_enabled) then raise exception 'active_campaign_connection_required' using errcode='22023'; end if;
  if exists(select 1 from public.system_pauses where org_id=new.org_id and active and (scope_type in ('global','organization','proactive') or (scope_type='campaign' and scope_id=v_campaign.id))) then raise exception 'campaign_pause_active' using errcode='55000'; end if;
  select coalesce(max(wave_number),0)+1 into v_wave_no from public.campaign_waves where campaign_id=v_campaign.id;
  if v_wave_no>1 and not exists(select 1 from public.campaign_waves where campaign_id=v_campaign.id and wave_number=v_wave_no-1 and review_status='approved') then
    raise exception 'previous_campaign_wave_review_required' using errcode='22023';
  end if;
  v_limit:=case when v_wave_no=1 then 20 when v_wave_no=2 then 50 else 500 end;
  if new.requested_count>v_limit then raise exception 'campaign_wave_limit_%',v_limit using errcode='22023'; end if;
  insert into public.campaign_waves(org_id,campaign_id,wave_number,requested_count,status,approved_by,approved_at)
  values(new.org_id,v_campaign.id,v_wave_no,new.requested_count,'draft',new.actor_user_id,now()) returning id into v_wave;
  for v_contact in select * from public.campaign_contacts where campaign_id=v_campaign.id and status='ready'
    order by priority desc,created_at for update skip locked limit new.requested_count loop
    select e164 into v_phone from public.contact_phones where contact_id=v_contact.contact_id and status='active' order by is_primary desc limit 1;
    if v_phone is null or exists(select 1 from public.opt_outs where operation_id=v_campaign.operation_id and contact_id=v_contact.contact_id and revoked_at is null)
       or exists(select 1 from public.suppression_entries where operation_id=v_campaign.operation_id and phone_e164=v_phone and revoked_at is null and (expires_at is null or expires_at>now())) then
      update public.campaign_contacts set status='suppressed',wave_id=v_wave,suppression_reason='opt_out_or_suppression',last_revalidated_at=now(),updated_at=now() where id=v_contact.id;
      v_suppressed:=v_suppressed+1;
    else
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
      values(new.org_id,v_campaign.operation_id,'campaign.contact.dispatch','campaign_contact',v_contact.id,'campaign-dispatch',now(),
        'campaign-contact:'||v_contact.id::text||':attempt:1',jsonb_build_object('campaign_id',v_campaign.id,'campaign_contact_id',v_contact.id,'wave_id',v_wave,'connection_id',v_campaign.connection_id,'phone',v_phone),new.actor_user_id);
      update public.campaign_contacts set status='queued',wave_id=v_wave,next_send_at=now(),last_revalidated_at=now(),updated_at=now() where id=v_contact.id;
      v_released:=v_released+1;
    end if;
  end loop;
  v_review_required:=case when v_wave_no=1 then v_released when v_wave_no=2 then ceil(v_released*0.30)::int else ceil(v_released*0.10)::int end;
  insert into public.campaign_wave_contact_reviews(org_id,campaign_id,wave_id,campaign_contact_id,required_for_gate)
  select new.org_id,v_campaign.id,v_wave,id,true from public.campaign_contacts
  where wave_id=v_wave and status='queued' order by priority desc,created_at limit v_review_required;
  update public.campaign_waves set status='released',released_count=v_released,suppressed_count=v_suppressed,
    review_required_count=v_review_required,review_status=case when v_review_required=0 then 'approved' else 'pending' end,
    reviewed_at=case when v_review_required=0 then now() else null end,released_at=now() where id=v_wave;
  update public.campaigns set status='running',version=version+1,updated_at=now() where id=v_campaign.id;
  new.wave_id:=v_wave;new.released_count:=v_released;new.suppressed_count:=v_suppressed;new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'campaign.wave_released','campaign_waves',v_wave,
    jsonb_build_object('released',v_released,'suppressed',v_suppressed,'wave',v_wave_no,'review_required',v_review_required));
  return new;
end; $$;

-- Operational WhatsApp messages are addressed to team members, separately from lead conversations.
create table public.operational_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  connection_id uuid not null,
  recipient_membership_id uuid not null,
  to_e164 text not null check(to_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  body text not null check(char_length(trim(body)) between 1 and 4096),
  purpose text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed','suppressed')),
  provider_message_id text,
  provider_timestamp timestamptz,
  error_redacted text,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key(connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete restrict,
  foreign key(recipient_membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  unique(org_id,dedupe_key),
  unique(id,org_id)
);
create index operational_messages_recipient_idx on public.operational_messages(recipient_membership_id,status,created_at desc);

create or replace function private.enqueue_operational_message(
  p_org uuid,p_operation uuid,p_recipient uuid,p_body text,p_purpose text,p_entity_type text,p_entity_id uuid,p_dedupe_key text
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection uuid;v_phone text;v_message uuid;
begin
  select p.whatsapp_e164 into v_phone from public.memberships m join public.profiles p on p.user_id=m.user_id
    where m.id=p_recipient and m.org_id=p_org and m.status='active';
  select w.id into v_connection from public.whatsapp_connections w
    where w.org_id=p_org and w.operation_id=p_operation and w.status='active'
    order by case when w.provider='meta_cloud' then 0 else 1 end,w.created_at limit 1;
  if v_phone is null or v_connection is null then return null; end if;
  insert into public.operational_messages(org_id,operation_id,connection_id,recipient_membership_id,to_e164,body,purpose,entity_type,entity_id,dedupe_key)
  values(p_org,p_operation,v_connection,p_recipient,v_phone,p_body,p_purpose,p_entity_type,p_entity_id,p_dedupe_key)
  on conflict(org_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id into v_message;
  insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload)
  values(p_org,p_operation,'operational.message.send','operational_message',v_message,'outbound-whatsapp',now(),
    'operational-message-send:'||v_message::text,jsonb_build_object('message_id',v_message))
  on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return v_message;
end; $$;
revoke all on function private.enqueue_operational_message(uuid,uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated,service_role;

-- The existing delivery worker can now claim either a conversation message or an operational message.
create or replace function public.claim_outbound_message(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_operational public.operational_messages%rowtype;v_message public.messages%rowtype;
  v_conversation public.conversations%rowtype;v_phone text;v_connection public.whatsapp_connections%rowtype;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_operational from public.operational_messages where id=p_message_id for update;
  if found then
    if v_operational.status<>'queued' then return jsonb_build_object('status','ignored'); end if;
    select * into v_connection from public.whatsapp_connections where id=v_operational.connection_id;
    if not found or v_connection.status<>'active' then
      update public.operational_messages set status='suppressed',error_redacted='Conexao operacional inativa.',updated_at=now() where id=p_message_id;
      return jsonb_build_object('status','suppressed');
    end if;
    update public.operational_messages set status='sending',metadata=metadata||jsonb_build_object('send_started_at',now()),updated_at=now() where id=p_message_id;
    return jsonb_build_object('status','claimed','message_id',v_operational.id,'org_id',v_operational.org_id,'operation_id',v_operational.operation_id,
      'connection_id',v_connection.id,'integration_account_id',v_connection.integration_account_id,'provider',v_connection.provider,
      'endpoint_url',v_connection.endpoint_url,'to_e164',v_operational.to_e164,'body',v_operational.body,'connection_settings',v_connection.settings);
  end if;
  select * into v_message from public.messages where id=p_message_id for update;
  if not found or v_message.direction<>'outbound' or v_message.provider_status<>'queued' then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  select * into v_connection from public.whatsapp_connections where id=v_conversation.connection_id;
  select e164 into v_phone from public.contact_phones where contact_id=v_conversation.contact_id and status='active' order by is_primary desc,created_at limit 1;
  if v_phone is null or v_connection.status<>'active' or (v_message.sender_type='ai' and (v_conversation.ownership<>'ai' or v_conversation.ai_mode<>'production' or v_conversation.status<>'active'))
     or (coalesce((v_message.metadata->>'opt_out_ack')::boolean,false)=false and exists(select 1 from public.opt_outs o where o.operation_id=v_conversation.operation_id and o.contact_id=v_conversation.contact_id and o.revoked_at is null))
     or exists(select 1 from public.suppression_entries s where s.operation_id=v_conversation.operation_id and s.phone_e164=v_phone and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())) then
    update public.messages set provider_status='suppressed',error_redacted='Envio bloqueado por conexao, ownership, opt-out ou supressao.' where id=v_message.id;
    update public.campaign_contacts set status='suppressed',suppression_reason='runtime_revalidation',last_revalidated_at=now(),updated_at=now()
      where id=nullif(v_message.metadata->>'campaign_contact_id','')::uuid;
    return jsonb_build_object('status','suppressed');
  end if;
  update public.messages set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('send_state','sending','send_started_at',now(),'send_attempt',coalesce((metadata->>'send_attempt')::integer,0)+1) where id=v_message.id;
  return jsonb_build_object('status','claimed','message_id',v_message.id,'org_id',v_message.org_id,'operation_id',v_message.operation_id,
    'conversation_id',v_message.conversation_id,'connection_id',v_connection.id,'integration_account_id',v_connection.integration_account_id,
    'provider',v_connection.provider,'endpoint_url',v_connection.endpoint_url,'to_e164',v_phone,'body',v_message.body,'connection_settings',v_connection.settings);
end; $$;

create or replace function public.complete_outbound_message(p_message_id uuid,p_provider_message_id text,p_provider_timestamp timestamptz default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_conversation uuid;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.operational_messages set status='sent',provider_message_id=p_provider_message_id,provider_timestamp=coalesce(p_provider_timestamp,now()),
    error_redacted=null,metadata=metadata||jsonb_build_object('send_completed_at',now()),updated_at=now()
    where id=p_message_id and status='sending';
  if found then return; end if;
  update public.messages set provider_status='sent',provider_message_id=p_provider_message_id,provider_timestamp=coalesce(p_provider_timestamp,now()),error_redacted=null,
    metadata=(metadata-'send_state')||jsonb_build_object('send_completed_at',now()) where id=p_message_id and provider_status='queued' returning conversation_id into v_conversation;
  if v_conversation is not null then
    update public.conversations set last_outbound_at=now(),last_message_preview=(select left(coalesce(body,'[midia]'),180) from public.messages where id=p_message_id),version=version+1,updated_at=now() where id=v_conversation;
    update public.campaign_contacts set status='contacted',attempts=attempts+1,next_send_at=null,last_revalidated_at=now(),updated_at=now()
      where id=(select nullif(metadata->>'campaign_contact_id','')::uuid from public.messages where id=p_message_id);
  end if;
end; $$;

create or replace function public.fail_outbound_message(p_message_id uuid,p_error_code text,p_error_redacted text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.operational_messages set status='failed',error_redacted=left(coalesce(p_error_redacted,'Falha no envio.'),500),
    metadata=metadata||jsonb_build_object('send_error_code',left(p_error_code,100),'send_failed_at',now()),updated_at=now()
    where id=p_message_id and status='sending';
  if found then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    select org_id,operation_id,'warning','whatsapp','Falha em mensagem operacional',left(coalesce(p_error_redacted,'Falha no envio.'),500),
      'operational_message',id,'operational-send-failed:'||id::text from public.operational_messages where id=p_message_id
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    return;
  end if;
  update public.messages set provider_status='failed',error_redacted=left(coalesce(p_error_redacted,'Falha no envio.'),500),
    metadata=(metadata-'send_state')||jsonb_build_object('send_error_code',left(p_error_code,100),'send_failed_at',now()) where id=p_message_id and provider_status='queued';
  insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
  select org_id,operation_id,'warning','whatsapp','Falha no envio WhatsApp',left(coalesce(p_error_redacted,'Falha no envio.'),500),'message',id,'message-send-failed:'||id::text from public.messages where id=p_message_id
  on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
end; $$;

-- Extend event consumption with WhatsApp call offers and silent lead confirmation.
create or replace function public.consume_runtime_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_type text:=p_event->>'event_type';v_event_id uuid;v_offer public.call_offers%rowtype;v_call public.calls%rowtype;
  v_operational uuid;v_conversation uuid;v_message uuid;v_body text;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  begin v_event_id:=(p_event->>'event_id')::uuid; exception when others then v_event_id:=null; end;
  if v_type='call.offer_sent.v1' then
    select * into v_offer from public.call_offers where id=(p_event->'payload'->>'offer_id')::uuid;
    select * into v_call from public.calls where id=v_offer.call_id;
    if found then
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,source_event_id)
      values(v_offer.org_id,v_offer.recipient_membership_id,'app','Nova oportunidade de call',
        'Uma call esta disponivel. Abra a agenda para aceitar antes do vencimento.',v_event_id)
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
        '. Se precisar ajustar, responda por aqui.';
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
  end if;
  return jsonb_build_object('status','acknowledged');
end; $$;

create or replace function private.schedule_call_unassigned_escalation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
  select c.org_id,c.operation_id,'call.unassigned.escalate','call',c.id,'scheduled-actions',
    least(now()+interval '1 hour',greatest(now(),c.starts_at-interval '10 minutes')),
    'call-unassigned-escalate:'||c.id::text,jsonb_build_object('call_id',c.id),new.actor_user_id
  from public.calls c where c.id=new.call_id
  on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return new;
end; $$;
revoke all on function private.schedule_call_unassigned_escalation() from public,anon,authenticated,service_role;
create trigger call_distribution_schedule_escalation after insert on public.call_distribution_requests
for each row execute function private.schedule_call_unassigned_escalation();

-- Preserve phase 13 and add operational-message and call-escalation jobs.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_phase13;
revoke all on function public.execute_runtime_job_phase13(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_phase13(uuid) to service_role;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;v_call public.calls%rowtype;v_member record;v_message uuid;v_offset integer;v_severity text;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type in ('operational.message.send','outbound.message.send') then
    return jsonb_build_object('status','send','message_id',(v_job.payload->>'message_id')::uuid);
  elsif v_job.job_type='call.unassigned.escalate' then
    select * into v_call from public.calls where id=(v_job.payload->>'call_id')::uuid;
    if not found or v_call.status not in ('awaiting_distribution','distributing','unassigned_alerted') or v_call.assigned_membership_id is not null then
      return jsonb_build_object('status','cancelled');
    end if;
    update public.calls set status='unassigned_alerted',version=version+1,updated_at=now() where id=v_call.id and status<>'unassigned_alerted';
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_call.org_id,v_call.operation_id,'critical','call','Call continua sem corretor',
      'A distribuicao nao recebeu aceite. Um gestor deve atribuir ou reagendar imediatamente.','call',v_call.id,'call-unassigned-t1h:'||v_call.id::text)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    for v_member in select s.membership_id from public.membership_call_settings s
      where s.operation_id=v_call.operation_id and s.receive_urgent_call_alerts loop
      perform private.enqueue_operational_message(v_call.org_id,v_call.operation_id,v_member.membership_id,
        'URGENTE: call de '||to_char(v_call.starts_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI')||
        ' continua sem corretor. Abra o Gril > Agenda para resolver.','call_unassigned','call',v_call.id,
        'call-unassigned-whatsapp:'||v_call.id::text||':'||v_member.membership_id::text);
    end loop;
    return jsonb_build_object('status','completed');
  elsif v_job.job_type='call.result.escalate' then
    select * into v_call from public.calls where id=(v_job.payload->>'call_id')::uuid;
    if not found or v_call.status<>'assigned' or v_call.assigned_membership_id is null then return jsonb_build_object('status','cancelled'); end if;
    v_offset:=coalesce((v_job.payload->>'offset_hours')::integer,1);v_severity:=case when v_offset>=24 then 'critical' else 'warning' end;
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_call.org_id,v_call.operation_id,v_severity,'call','Resultado da call ainda pendente',
      'A call terminou ha aproximadamente '||v_offset||' hora(s). Registre o resultado e a proxima acao.',
      'call',v_call.id,'call-result-escalate:'||v_call.id::text||':'||v_offset)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    perform private.enqueue_operational_message(v_call.org_id,v_call.operation_id,v_call.assigned_membership_id,
      'Resultado pendente: registre no Gril o desfecho da call encerrada ha '||v_offset||' hora(s).',
      'call_result_due','call',v_call.id,'call-result-whatsapp:'||v_call.id::text||':'||v_offset);
    return jsonb_build_object('status','completed');
  end if;
  return public.execute_runtime_job_phase13(p_job_id);
end; $$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

-- Preferred receivers can only be changed by a team manager through the existing audited command.
-- Self-service keeps the current preference instead of forcibly clearing it.
create or replace function private.process_call_settings_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_membership public.memberships%rowtype;v_self boolean;v_existing_preferred boolean:=false;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_settings_forbidden' using errcode='42501'; end if;
  select * into v_membership from public.memberships where id=new.membership_id and org_id=new.org_id and status='active';
  if not found or not exists(select 1 from public.membership_operations where membership_id=v_membership.id and operation_id=new.operation_id) then raise exception 'membership_operation_not_found' using errcode='22023'; end if;
  v_self:=v_membership.user_id=(select auth.uid());
  if not v_self and not private.has_org_permission(new.org_id,'team.manage') then raise exception 'call_settings_forbidden' using errcode='42501'; end if;
  select coalesce(is_preferred_receiver,false) into v_existing_preferred from public.membership_call_settings where membership_id=new.membership_id;
  if v_self and not private.has_org_permission(new.org_id,'team.manage') then new.is_preferred_receiver:=v_existing_preferred; end if;
  insert into public.membership_call_settings(membership_id,org_id,operation_id,can_receive_calls,is_preferred_receiver,receive_urgent_call_alerts)
  values(new.membership_id,new.org_id,new.operation_id,new.can_receive_calls,new.is_preferred_receiver,new.receive_urgent_call_alerts)
  on conflict(membership_id) do update set operation_id=excluded.operation_id,can_receive_calls=excluded.can_receive_calls,
    is_preferred_receiver=excluded.is_preferred_receiver,receive_urgent_call_alerts=excluded.receive_urgent_call_alerts,
    version=public.membership_call_settings.version+1,updated_at=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'call.settings_updated','memberships',new.membership_id,
    jsonb_build_object('enabled',new.can_receive_calls,'preferred',new.is_preferred_receiver));
  new.processed_at:=now();return new;
end; $$;

alter table public.campaign_wave_contact_reviews enable row level security;
alter table public.campaign_wave_review_requests enable row level security;
alter table public.operational_messages enable row level security;
create policy campaign_wave_reviews_manager_select on public.campaign_wave_contact_reviews for select to authenticated
  using((select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_wave_review_requests_actor_select on public.campaign_wave_review_requests for select to authenticated
  using(actor_user_id=(select auth.uid()));
create policy campaign_wave_review_requests_manager_insert on public.campaign_wave_review_requests for insert to authenticated
  with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));
create policy operational_messages_visible on public.operational_messages for select to authenticated
  using(recipient_membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'pipeline.manage')));

grant select on public.campaign_wave_contact_reviews,public.operational_messages to authenticated;
grant select,insert on public.campaign_wave_review_requests to authenticated;
grant all on public.campaign_wave_contact_reviews,public.campaign_wave_review_requests,public.operational_messages to service_role;

create index ai_action_executions_execution_org_idx on public.ai_action_executions(execution_id,org_id);
create index ai_action_executions_org_idx on public.ai_action_executions(org_id);

comment on table public.campaign_wave_contact_reviews is 'Quality sample gate: wave 1=100%, wave 2=30%, subsequent waves=10%; the next wave is blocked until every required item is approved.';
comment on table public.operational_messages is 'Auditable WhatsApp delivery to team members, separate from lead conversations.';

commit;
