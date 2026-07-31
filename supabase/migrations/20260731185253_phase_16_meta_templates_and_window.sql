begin;

create table public.whatsapp_message_templates(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  connection_id uuid not null,
  external_name text not null,
  language text not null,
  category text,
  provider_status text not null,
  components jsonb not null default '[]'::jsonb,
  variable_count smallint not null default 0 check(variable_count between 0 and 20),
  purpose text check(purpose in ('campaign','followup','call_reminder','operational','general')),
  parameter_strategy text not null default 'none' check(parameter_strategy in ('none','first_name','body','call_datetime')),
  enabled boolean not null default false,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key(connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete cascade,
  unique(connection_id,external_name,language),
  unique(id,org_id),
  check(not enabled or (provider_status='APPROVED' and variable_count<=1 and purpose is not null))
);
create index whatsapp_message_templates_purpose_idx on public.whatsapp_message_templates(connection_id,purpose) where enabled;

alter table public.campaigns add column message_template_id uuid;
alter table public.campaigns add constraint campaigns_message_template_id_org_id_fkey
  foreign key(message_template_id,org_id) references public.whatsapp_message_templates(id,org_id) on delete restrict;
alter table public.campaign_creation_requests add column message_template_id uuid;

create or replace function private.process_campaign_creation_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype;v_consent uuid;v_campaign uuid;v_template public.whatsapp_message_templates%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_creation_forbidden' using errcode='42501';
  end if;
  select * into v_connection from public.whatsapp_connections where id=new.connection_id and org_id=new.org_id;
  if not found or v_connection.operation_id<>new.operation_id or v_connection.status<>'active' or not v_connection.campaign_enabled then
    raise exception 'active_campaign_connection_required' using errcode='22023';
  end if;
  if v_connection.provider='meta_cloud' then
    select * into v_template from public.whatsapp_message_templates where id=new.message_template_id and org_id=new.org_id
      and connection_id=v_connection.id and enabled and provider_status='APPROVED' and purpose='campaign' and variable_count<=1;
    if not found then raise exception 'approved_meta_campaign_template_required' using errcode='22023'; end if;
  elsif new.message_template_id is not null then raise exception 'template_only_for_meta' using errcode='22023'; end if;
  if new.ai_mode not in ('off','shadow','assisted','production') then raise exception 'invalid_ai_mode' using errcode='22023'; end if;
  insert into public.consent_declarations(org_id,operation_id,statement_text,source_description,confirmed_by)
  values(new.org_id,new.operation_id,trim(new.consent_statement),trim(new.consent_source),new.actor_user_id) returning id into v_consent;
  insert into public.campaigns(org_id,operation_id,connection_id,consent_declaration_id,name,ai_mode,opening_template,message_template_id,created_by)
  values(new.org_id,new.operation_id,new.connection_id,v_consent,trim(new.name),new.ai_mode,trim(new.opening_template),new.message_template_id,new.actor_user_id)
  returning id into v_campaign;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'campaign.created','campaigns',v_campaign,jsonb_build_object('consent_id',v_consent,'ai_mode',new.ai_mode,'template_id',new.message_template_id));
  new.campaign_id:=v_campaign;new.processed_at:=now();return new;
end; $$;

create or replace function private.meta_template_parameters(
  p_strategy text,p_body text,p_conversation uuid,p_metadata jsonb
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_value text;v_call public.calls%rowtype;
begin
  if p_strategy='none' then return '[]'::jsonb;
  elsif p_strategy='body' then v_value:=p_body;
  elsif p_strategy='first_name' then
    select split_part(ct.name,' ',1) into v_value from public.conversations c join public.contacts ct on ct.id=c.contact_id where c.id=p_conversation;
  elsif p_strategy='call_datetime' then
    select * into v_call from public.calls where id=nullif(p_metadata->>'call_id','')::uuid;
    v_value:=to_char(v_call.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI');
  end if;
  return case when nullif(trim(v_value),'') is null then '[]'::jsonb else jsonb_build_array(left(v_value,1024)) end;
end; $$;
revoke all on function private.meta_template_parameters(text,text,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function private.prepare_meta_conversation_message()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_conversation public.conversations%rowtype;v_connection public.whatsapp_connections%rowtype;
  v_template public.whatsapp_message_templates%rowtype;v_purpose text;v_required boolean:=false;
begin
  if new.direction<>'outbound' then return new; end if;
  select * into v_conversation from public.conversations where id=new.conversation_id;
  select * into v_connection from public.whatsapp_connections where id=v_conversation.connection_id;
  if not found or v_connection.provider<>'meta_cloud' then return new; end if;
  if new.metadata ? 'campaign_id' then
    v_required:=true;v_purpose:='campaign';
    select t.* into v_template from public.campaigns c join public.whatsapp_message_templates t on t.id=c.message_template_id
      where c.id=(new.metadata->>'campaign_id')::uuid and t.enabled and t.provider_status='APPROVED';
  elsif v_conversation.last_inbound_at is null or v_conversation.last_inbound_at<now()-interval '24 hours' then
    v_required:=true;
    v_purpose:=case when new.metadata ? 'call_id' then 'call_reminder' when new.sender_type='ai' then 'followup' else 'general' end;
    select * into v_template from public.whatsapp_message_templates where connection_id=v_connection.id and enabled
      and provider_status='APPROVED' and purpose=v_purpose and variable_count<=1 order by updated_at desc limit 1;
  end if;
  if v_required then
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('meta_template_required',true,'meta_template_purpose',v_purpose);
    if v_template.id is not null then
      new.metadata:=new.metadata||jsonb_build_object('meta_template_id',v_template.id,'meta_template_name',v_template.external_name,
        'meta_template_language',v_template.language,'meta_template_parameters',private.meta_template_parameters(v_template.parameter_strategy,new.body,new.conversation_id,new.metadata));
    else new.metadata:=new.metadata||jsonb_build_object('meta_template_missing',true); end if;
  end if;
  return new;
end; $$;
revoke all on function private.prepare_meta_conversation_message() from public,anon,authenticated,service_role;
create trigger messages_prepare_meta_template before insert on public.messages
for each row execute function private.prepare_meta_conversation_message();

create or replace function private.prepare_meta_operational_message()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype;v_template public.whatsapp_message_templates%rowtype;
begin
  select * into v_connection from public.whatsapp_connections where id=new.connection_id;
  if not found or v_connection.provider<>'meta_cloud' then return new; end if;
  select * into v_template from public.whatsapp_message_templates where connection_id=v_connection.id and enabled
    and provider_status='APPROVED' and purpose='operational' and variable_count<=1 order by updated_at desc limit 1;
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('meta_template_required',true,'meta_template_purpose','operational');
  if v_template.id is not null then
    new.metadata:=new.metadata||jsonb_build_object('meta_template_id',v_template.id,'meta_template_name',v_template.external_name,
      'meta_template_language',v_template.language,'meta_template_parameters',private.meta_template_parameters(v_template.parameter_strategy,new.body,null,'{}'::jsonb));
  else new.metadata:=new.metadata||jsonb_build_object('meta_template_missing',true); end if;
  return new;
end; $$;
revoke all on function private.prepare_meta_operational_message() from public,anon,authenticated,service_role;
create trigger operational_messages_prepare_meta_template before insert on public.operational_messages
for each row execute function private.prepare_meta_operational_message();

create or replace function public.get_outbound_template(p_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_metadata jsonb;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select metadata into v_metadata from public.operational_messages where id=p_message_id;
  if not found then select metadata into v_metadata from public.messages where id=p_message_id; end if;
  if v_metadata is null then return jsonb_build_object('required',false); end if;
  return jsonb_build_object('required',coalesce((v_metadata->>'meta_template_required')::boolean,false),
    'missing',coalesce((v_metadata->>'meta_template_missing')::boolean,false),
    'name',v_metadata->>'meta_template_name','language',v_metadata->>'meta_template_language',
    'parameters',coalesce(v_metadata->'meta_template_parameters','[]'::jsonb),'purpose',v_metadata->>'meta_template_purpose');
end; $$;
revoke all on function public.get_outbound_template(uuid) from public,anon,authenticated;
grant execute on function public.get_outbound_template(uuid) to service_role;

create or replace function public.block_outbound_template_missing(p_message_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_operation uuid;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  update public.operational_messages set status='suppressed',error_redacted='Template Meta aprovado nao configurado para esta finalidade.',updated_at=now()
    where id=p_message_id and status='sending' returning org_id,operation_id into v_org,v_operation;
  if not found then
    update public.messages set provider_status='suppressed',error_redacted='Template Meta aprovado nao configurado fora da janela de 24 horas.'
      where id=p_message_id and provider_status='queued' returning org_id,operation_id into v_org,v_operation;
  end if;
  if v_org is not null then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_org,v_operation,'warning','whatsapp','Envio Meta bloqueado por template',
      'Sincronize e habilite um template aprovado para esta finalidade antes de reenviar.','message',p_message_id,'meta-template-missing:'||p_message_id::text)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  end if;
end; $$;
revoke all on function public.block_outbound_template_missing(uuid) from public,anon,authenticated;
grant execute on function public.block_outbound_template_missing(uuid) to service_role;

alter table public.whatsapp_message_templates enable row level security;
create policy whatsapp_templates_manager_select on public.whatsapp_message_templates for select to authenticated
using((select private.has_org_permission(org_id,'settings.manage')) or (select private.has_org_permission(org_id,'campaigns.manage')));
grant select on public.whatsapp_message_templates to authenticated;
grant all on public.whatsapp_message_templates to service_role;

comment on table public.whatsapp_message_templates is 'Templates synchronized from Meta. Autonomous use is limited to approved templates with at most one deterministic variable.';
commit;
