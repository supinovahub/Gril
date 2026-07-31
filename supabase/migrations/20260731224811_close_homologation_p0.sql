begin;

-- Configuration required by the product contract. Defaults match the seven
-- product documents and remain editable per operation.
alter table public.organization_settings
  add column fallback_model_profile_id uuid,
  add constraint organization_settings_fallback_model_fkey
    foreign key (fallback_model_profile_id,org_id)
    references public.model_profiles(id,org_id) on delete set null;

alter table public.operation_settings
  add column inbound_window_start time not null default '05:00',
  add column inbound_window_end time not null default '23:59:59',
  add column campaign_window_start time not null default '08:30',
  add column campaign_window_end time not null default '20:30',
  add column grouping_seconds smallint not null default 10 check(grouping_seconds between 1 and 30),
  add column max_grouping_seconds smallint not null default 30 check(max_grouping_seconds between 10 and 60),
  add column operational_phone_e164 text check(operational_phone_e164 is null or operational_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint operation_settings_grouping_order_check check(max_grouping_seconds>=grouping_seconds);

alter table public.campaigns alter column send_window_start set default '08:30';
alter table public.campaigns alter column send_window_end set default '20:30';

alter table public.invitation_links alter column expires_at drop not null;
alter table public.invitation_links drop constraint invitation_links_check1;
alter table public.invitation_links add constraint invitation_links_expiry_check check(expires_at is null or expires_at>created_at);

-- Atomic self-service bootstrap. The browser can only create one first tenant
-- for its own authenticated user; all domain records are created in one tx.
create table public.organization_bootstrap_requests(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  organization_name text not null check(char_length(trim(organization_name)) between 2 and 120),
  operation_name text not null check(char_length(trim(operation_name)) between 2 and 120),
  timezone text not null default 'America/Sao_Paulo',
  organization_id uuid references public.organizations(id) on delete restrict,
  operation_id uuid,
  membership_id uuid,
  result text not null default 'pending' check(result in ('pending','created')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.organization_bootstrap_requests enable row level security;

create or replace function private.safe_slug(p_value text)
returns text language sql immutable set search_path=pg_catalog as $$
  select trim(both '-' from regexp_replace(
    translate(lower(trim(p_value)),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+','-','g'));
$$;
revoke all on function private.safe_slug(text) from public,anon,authenticated,service_role;

create or replace function private.process_organization_bootstrap_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_operation uuid;v_membership uuid;v_org_slug text;v_operation_slug text;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then
    raise exception 'bootstrap_forbidden' using errcode='42501';
  end if;
  if exists(select 1 from public.memberships where user_id=new.actor_user_id and status in ('pending','active','suspended')) then
    raise exception 'bootstrap_membership_exists' using errcode='22023';
  end if;
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then
    raise exception 'bootstrap_timezone_invalid' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.actor_user_id::text,0));
  v_org_slug:=coalesce(nullif(private.safe_slug(new.organization_name),''),'organizacao');
  while exists(select 1 from public.organizations where slug=v_org_slug) loop
    v_org_slug:=left(v_org_slug,52)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,7);
  end loop;
  v_operation_slug:=coalesce(nullif(private.safe_slug(new.operation_name),''),'operacao');
  insert into public.organizations(name,slug,timezone)
    values(trim(new.organization_name),v_org_slug,new.timezone) returning id into v_org;
  insert into public.operations(org_id,name,slug,timezone,is_default)
    values(v_org,trim(new.operation_name),v_operation_slug,new.timezone,true) returning id into v_operation;
  insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
    values(v_org,new.actor_user_id,'owner','active',now(),new.actor_user_id) returning id into v_membership;
  insert into public.membership_operations(membership_id,operation_id,org_id)
    values(v_membership,v_operation,v_org);
  new.organization_id:=v_org;new.operation_id:=v_operation;new.membership_id:=v_membership;
  new.result:='created';new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(v_org,new.actor_user_id,'organization.bootstrapped','organizations',v_org,
      jsonb_build_object('operation_id',v_operation,'membership_id',v_membership));
  return new;
end; $$;
revoke all on function private.process_organization_bootstrap_request() from public,anon,authenticated,service_role;
create trigger organization_bootstrap_process before insert on public.organization_bootstrap_requests
for each row execute function private.process_organization_bootstrap_request();
create policy organization_bootstrap_insert_self on public.organization_bootstrap_requests
  for insert to authenticated with check(actor_user_id=(select auth.uid()));
create policy organization_bootstrap_select_self on public.organization_bootstrap_requests
  for select to authenticated using(actor_user_id=(select auth.uid()));
grant select,insert on public.organization_bootstrap_requests to authenticated;
grant all on public.organization_bootstrap_requests to service_role;

-- A manager can stop the operation in an emergency. Only an owner can edit,
-- delete or resume an active pause (the existing owner policies remain).
drop policy if exists system_pauses_insert_owner on public.system_pauses;
create policy system_pauses_insert_manager on public.system_pauses for insert to authenticated
  with check(
    paused_by=(select auth.uid()) and
    ((select private.has_org_role(org_id,array['owner']::text[])) or
     (select private.has_org_permission(org_id,'settings.manage')))
  );

-- Suspending or revoking a membership immediately removes application access
-- through RLS and invalidates refreshable Auth sessions. Existing access JWTs
-- still expire normally, but every app/DAL/RLS operation rechecks membership.
create or replace function private.apply_membership_access_revocation()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.status='active' and new.status in ('suspended','revoked') then
    delete from auth.sessions where user_id=new.user_id;
    update public.membership_call_settings set can_receive_calls=false,version=version+1,updated_at=now() where membership_id=new.id;
    update public.availability_rules set active=false,updated_at=now() where membership_id=new.id and active;
    update public.push_subscriptions set revoked_at=coalesce(revoked_at,now()) where user_id=new.user_id and revoked_at is null;
    insert into public.alerts(org_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
      select new.org_id,'critical','access','Usuário removido com call futura atribuída',
        'Revise e redistribua as calls futuras deste usuário.','membership',new.id,'membership-future-calls:'||new.id::text
      where exists(select 1 from public.calls where assigned_membership_id=new.id and status='assigned' and starts_at>now())
      on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.apply_membership_access_revocation() from public,anon,authenticated,service_role;
create trigger memberships_access_revocation after update of status on public.memberships
for each row execute function private.apply_membership_access_revocation();

-- Suggestions in assisted mode are reviewed and sent atomically. A direct
-- UPDATE cannot accidentally mark a suggestion as sent without a send request.
alter table public.ai_suggestions add constraint ai_suggestions_id_org_id_key unique(id,org_id);
create table public.ai_suggestion_review_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  suggestion_id uuid not null,
  action text not null check(action in ('send','discard')),
  edited_body text check(edited_body is null or char_length(trim(edited_body)) between 1 and 4096),
  expected_conversation_version integer,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  message_id uuid,
  result text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(suggestion_id,org_id) references public.ai_suggestions(id,org_id) on delete restrict
);
alter table public.ai_suggestion_review_requests enable row level security;
create or replace function private.process_ai_suggestion_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_suggestion public.ai_suggestions%rowtype;v_conversation public.conversations%rowtype;v_request public.message_send_requests%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'suggestion_review_forbidden' using errcode='42501'; end if;
  select * into v_suggestion from public.ai_suggestions where id=new.suggestion_id and org_id=new.org_id for update;
  if not found or v_suggestion.status<>'pending' or v_suggestion.conversation_id is null
     or not private.can_access_conversation(v_suggestion.conversation_id) then
    raise exception 'suggestion_not_reviewable' using errcode='22023';
  end if;
  select * into v_conversation from public.conversations where id=v_suggestion.conversation_id for update;
  if new.action='discard' then
    update public.ai_suggestions set status='rejected',reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    new.result:='discarded';
  else
    if new.expected_conversation_version is null or new.expected_conversation_version<>v_conversation.version then
      raise exception 'version_conflict' using errcode='40001';
    end if;
    insert into public.message_send_requests(org_id,conversation_id,actor_user_id,body,expected_conversation_version)
      values(new.org_id,v_conversation.id,new.actor_user_id,coalesce(nullif(trim(new.edited_body),''),v_suggestion.body),v_conversation.version)
      returning * into v_request;
    update public.ai_suggestions set body=coalesce(nullif(trim(new.edited_body),''),body),status='approved',reviewed_by=new.actor_user_id,reviewed_at=now() where id=v_suggestion.id;
    new.message_id:=v_request.message_id;new.result:='sent';
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,new.actor_user_id,'ai.suggestion_'||new.action,'ai_suggestions',v_suggestion.id,jsonb_build_object('message_id',new.message_id));
  return new;
end; $$;
revoke all on function private.process_ai_suggestion_review_request() from public,anon,authenticated,service_role;
create trigger ai_suggestion_review_process before insert on public.ai_suggestion_review_requests
for each row execute function private.process_ai_suggestion_review_request();
create policy ai_suggestion_review_insert_visible on public.ai_suggestion_review_requests for insert to authenticated
  with check(actor_user_id=(select auth.uid()) and private.is_active_org_member(org_id));
create policy ai_suggestion_review_select_self on public.ai_suggestion_review_requests for select to authenticated
  using(actor_user_id=(select auth.uid()));
grant select,insert on public.ai_suggestion_review_requests to authenticated;
grant all on public.ai_suggestion_review_requests to service_role;

-- Deterministic cadence catalog. Delay is measured from the moment the plan is
-- created/selected, matching the product documents.
create or replace function private.seed_default_followup_plan(p_org_id uuid,p_operation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_plan uuid;
begin
  if exists(select 1 from public.followup_plans where operation_id=p_operation_id and name='Cadencia longa padrao' and version=2) then return; end if;
  update public.followup_plans set status='archived' where operation_id=p_operation_id and status='published';
  insert into public.followup_plans(org_id,operation_id,name,version,status,max_attempts,horizon_days,published_at)
    values(p_org_id,p_operation_id,'Cadencia longa padrao',2,'published',20,180,now()) returning id into v_plan;
  insert into public.followup_steps(org_id,plan_id,step_number,delay_minutes,instruction) values
    (p_org_id,v_plan,1,5,'Retomar naturalmente no inicio da cadencia.'),(p_org_id,v_plan,2,1440,'Retomar em um dia.'),
    (p_org_id,v_plan,3,2880,'Retomar em dois dias.'),(p_org_id,v_plan,4,5760,'Retomar em quatro dias.'),
    (p_org_id,v_plan,5,10080,'Retomar em sete dias.'),(p_org_id,v_plan,6,14400,'Retomar em dez dias.'),
    (p_org_id,v_plan,7,20160,'Retomar em quatorze dias.'),(p_org_id,v_plan,8,30240,'Retomar em vinte e um dias.'),
    (p_org_id,v_plan,9,43200,'Retomar em trinta dias.'),(p_org_id,v_plan,10,64800,'Retomar em quarenta e cinco dias.'),
    (p_org_id,v_plan,11,86400,'Retomar em sessenta dias.'),(p_org_id,v_plan,12,108000,'Retomar em setenta e cinco dias.'),
    (p_org_id,v_plan,13,129600,'Retomar em noventa dias.'),(p_org_id,v_plan,14,151200,'Retomar em cento e cinco dias.'),
    (p_org_id,v_plan,15,172800,'Retomar em cento e vinte dias.'),(p_org_id,v_plan,16,194400,'Retomar em cento e trinta e cinco dias.'),
    (p_org_id,v_plan,17,216000,'Retomar em cento e cinquenta dias.'),(p_org_id,v_plan,18,230400,'Retomar em cento e sessenta dias.'),
    (p_org_id,v_plan,19,244800,'Retomar em cento e setenta dias.'),(p_org_id,v_plan,20,259200,'Encerrar a cadencia em cento e oitenta dias com opt-out facil.');
end; $$;
revoke all on function private.seed_default_followup_plan(uuid,uuid) from public,anon,authenticated,service_role;

do $$ declare r record; begin
  for r in select id,org_id from public.operations where status<>'archived' loop
    perform private.seed_default_followup_plan(r.org_id,r.id);
  end loop;
end $$;

-- Exact auxiliary cadences are data, not model decisions.
do $$ declare r record;v_plan uuid; begin
  for r in select id,org_id from public.operations where status<>'archived' loop
    if not exists(select 1 from public.followup_plans where operation_id=r.id and name='Cadencia curta padrao' and status='published') then
      insert into public.followup_plans(org_id,operation_id,name,version,status,max_attempts,horizon_days,published_at)
        values(r.org_id,r.id,'Cadencia curta padrao',1,'published',5,1,now()) returning id into v_plan;
      insert into public.followup_steps(org_id,plan_id,step_number,delay_minutes,instruction) values
        (r.org_id,v_plan,1,60,'Retomar em uma hora.'),(r.org_id,v_plan,2,240,'Retomar em quatro horas.'),
        (r.org_id,v_plan,3,480,'Retomar em oito horas.'),(r.org_id,v_plan,4,840,'Retomar em quatorze horas.'),
        (r.org_id,v_plan,5,1320,'Encerrar a cadencia curta em vinte e duas horas.');
    end if;
    if not exists(select 1 from public.followup_plans where operation_id=r.id and name='Cadencia no-show' and status='published') then
      insert into public.followup_plans(org_id,operation_id,name,version,status,max_attempts,horizon_days,published_at)
        values(r.org_id,r.id,'Cadencia no-show',1,'published',5,2,now()) returning id into v_plan;
      insert into public.followup_steps(org_id,plan_id,step_number,delay_minutes,instruction) values
        (r.org_id,v_plan,1,10,'Confirmar se houve imprevisto.'),(r.org_id,v_plan,2,120,'Oferecer reagendamento em duas horas.'),
        (r.org_id,v_plan,3,480,'Retomar em oito horas.'),(r.org_id,v_plan,4,1440,'Retomar em vinte e quatro horas.'),
        (r.org_id,v_plan,5,2880,'Encerrar no-show em quarenta e oito horas.');
    end if;
    if not exists(select 1 from public.followup_plans where operation_id=r.id and name='Compra futura' and status='published') then
      insert into public.followup_plans(org_id,operation_id,name,version,status,max_attempts,horizon_days,published_at)
        values(r.org_id,r.id,'Compra futura',1,'published',3,180,'now') returning id into v_plan;
      insert into public.followup_steps(org_id,plan_id,step_number,delay_minutes,instruction) values
        (r.org_id,v_plan,1,129600,'Retomar noventa dias antes do mes alvo.'),(r.org_id,v_plan,2,43200,'Retomar trinta dias antes do mes alvo.'),
        (r.org_id,v_plan,3,10080,'Retomar sete dias antes do mes alvo.');
    end if;
  end loop;
end $$;

-- Campaign imports preserve mapping and source hash, expose five examples for
-- approval, and enforce 20 / 50 / all remaining on the server.
alter table public.campaign_import_requests
  add column mapping jsonb not null default '{"name":"name","phone":"phone"}'::jsonb,
  add column file_sha256 text check(file_sha256 is null or file_sha256~'^[a-f0-9]{64}$');
alter table public.campaign_imports add column file_sha256 text check(file_sha256 is null or file_sha256~'^[a-f0-9]{64}$');
alter table public.campaigns add column opening_examples jsonb not null default '[]'::jsonb check(jsonb_typeof(opening_examples)='array');
create unique index campaign_imports_file_hash_idx on public.campaign_imports(campaign_id,file_sha256) where file_sha256 is not null;

create or replace function private.process_campaign_import_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype;v_import uuid;v_row jsonb;v_num int:=0;v_name text;v_phone text;
  v_contact uuid;v_opportunity uuid;v_import_row uuid;v_stage uuid;v_valid int:=0;v_dup int:=0;v_error int:=0;v_examples jsonb;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_import_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.status not in ('draft','importing','review') then raise exception 'campaign_not_importable' using errcode='22023'; end if;
  if jsonb_array_length(new.rows)=0 or jsonb_array_length(new.rows)>v_campaign.max_contacts then raise exception 'campaign_row_limit' using errcode='22023'; end if;
  if new.file_sha256 is not null and exists(select 1 from public.campaign_imports where campaign_id=new.campaign_id and file_sha256=new.file_sha256) then raise exception 'campaign_file_already_imported' using errcode='23505'; end if;
  select id into v_stage from public.pipeline_stages where org_id=new.org_id and code='new';
  insert into public.campaign_imports(org_id,campaign_id,filename,mapping,file_sha256,status,total_rows,imported_by)
    values(new.org_id,new.campaign_id,new.filename,new.mapping,new.file_sha256,'processing',jsonb_array_length(new.rows),new.actor_user_id) returning id into v_import;
  update public.campaigns set status='importing',version=version+1,updated_at=now() where id=new.campaign_id;
  for v_row in select value from jsonb_array_elements(new.rows) loop
    v_num:=v_num+1;v_name:=nullif(trim(v_row->>'name'),'');v_phone:=nullif(regexp_replace(v_row->>'phone','[[:space:]()-]','','g'),'');v_contact:=null;v_opportunity:=null;
    if v_name is null or char_length(v_name)<2 or v_phone is null or v_phone!~'^\+[1-9][0-9]{7,14}$' then
      insert into public.campaign_import_rows(org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,error_code)
        values(new.org_id,v_import,v_num,v_row,v_name,v_phone,'error','invalid_name_or_e164');v_error:=v_error+1;continue;
    end if;
    select cp.contact_id into v_contact from public.contact_phones cp where cp.org_id=new.org_id and cp.e164=v_phone and cp.status='active';
    if v_contact is null then
      insert into public.contacts(org_id,name,created_by) values(new.org_id,v_name,new.actor_user_id) returning id into v_contact;
      insert into public.contact_phones(org_id,contact_id,e164,original,is_primary) values(new.org_id,v_contact,v_phone,v_phone,true);
    end if;
    if exists(select 1 from public.campaign_contacts where campaign_id=new.campaign_id and contact_id=v_contact) then
      insert into public.campaign_import_rows(org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,error_code,contact_id)
        values(new.org_id,v_import,v_num,v_row,v_name,v_phone,'duplicate','already_in_campaign',v_contact);v_dup:=v_dup+1;continue;
    end if;
    select id into v_opportunity from public.opportunities where org_id=new.org_id and operation_id=v_campaign.operation_id and contact_id=v_contact and status='open' order by created_at desc limit 1;
    if v_opportunity is null then insert into public.opportunities(org_id,operation_id,contact_id,pipeline_stage_id,source,created_by)
      values(new.org_id,v_campaign.operation_id,v_contact,v_stage,'campaign',new.actor_user_id) returning id into v_opportunity;end if;
    insert into public.campaign_import_rows(org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,contact_id,opportunity_id)
      values(new.org_id,v_import,v_num,v_row,v_name,v_phone,'valid',v_contact,v_opportunity) returning id into v_import_row;
    insert into public.campaign_contacts(org_id,campaign_id,contact_id,opportunity_id,import_row_id) values(new.org_id,new.campaign_id,v_contact,v_opportunity,v_import_row);
    v_valid:=v_valid+1;
  end loop;
  select coalesce(jsonb_agg(replace(v_campaign.opening_template,'{{name}}',name)),'[]'::jsonb) into v_examples from
    (select c.name from public.campaign_contacts cc join public.contacts c on c.id=cc.contact_id where cc.campaign_id=new.campaign_id order by cc.created_at limit 5) s;
  update public.campaign_imports set status='review',valid_rows=v_valid,duplicate_rows=v_dup,error_rows=v_error,completed_at=now() where id=v_import;
  update public.campaigns set status='review',opening_examples=v_examples,version=version+1,updated_at=now() where id=new.campaign_id;
  new.import_id:=v_import;new.valid_rows:=v_valid;new.duplicate_rows:=v_dup;new.error_rows:=v_error;new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,new.actor_user_id,'campaign.import_reviewed','campaign_imports',v_import,jsonb_build_object('valid',v_valid,'duplicates',v_dup,'errors',v_error,'mapping',new.mapping,'file_sha256',new.file_sha256));
  return new;
end; $$;

create or replace function private.next_campaign_slot(p_operation uuid,p_candidate timestamptz)
returns timestamptz language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_settings public.operation_settings%rowtype;v_tz text;v_local timestamp;v_start time;v_end time;
begin
  select * into v_settings from public.operation_settings where operation_id=p_operation;
  v_tz:=coalesce(v_settings.business_hours->>'timezone','America/Sao_Paulo');v_start:=coalesce(v_settings.campaign_window_start,'08:30');v_end:=coalesce(v_settings.campaign_window_end,'20:30');
  v_local:=p_candidate at time zone v_tz;
  if v_local::time<v_start then return (v_local::date+v_start) at time zone v_tz;
  elsif v_local::time>v_end then return ((v_local::date+1)+v_start) at time zone v_tz;
  end if;
  return p_candidate;
end; $$;
revoke all on function private.next_campaign_slot(uuid,timestamptz) from public,anon,authenticated,service_role;

create or replace function private.process_campaign_wave_release_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype;v_wave_no int;v_wave uuid;v_contact public.campaign_contacts%rowtype;v_phone text;
  v_released int:=0;v_suppressed int:=0;v_required int;v_review_required int;v_remaining int;v_slot timestamptz;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_wave_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.status not in ('approved','running') then raise exception 'campaign_not_releasable' using errcode='22023'; end if;
  if not exists(select 1 from public.whatsapp_connections where id=v_campaign.connection_id and status='active' and campaign_enabled) then raise exception 'active_campaign_connection_required' using errcode='22023'; end if;
  if exists(select 1 from public.system_pauses where org_id=new.org_id and active and (scope_type in ('global','organization','proactive') or (scope_type='campaign' and scope_id=v_campaign.id))) then raise exception 'campaign_pause_active' using errcode='55000'; end if;
  select coalesce(max(wave_number),0)+1 into v_wave_no from public.campaign_waves where campaign_id=v_campaign.id;
  if v_wave_no>3 then raise exception 'campaign_all_waves_released' using errcode='22023'; end if;
  if v_wave_no>1 and not exists(select 1 from public.campaign_waves where campaign_id=v_campaign.id and wave_number=v_wave_no-1 and review_status='approved') then raise exception 'previous_campaign_wave_review_required' using errcode='22023'; end if;
  select count(*) into v_remaining from public.campaign_contacts where campaign_id=v_campaign.id and status='ready';
  if v_remaining=0 then raise exception 'campaign_no_remaining_contacts' using errcode='22023'; end if;
  v_required:=case when v_wave_no=1 then least(20,v_remaining) when v_wave_no=2 then least(50,v_remaining) else v_remaining end;new.requested_count:=v_required;
  insert into public.campaign_waves(org_id,campaign_id,wave_number,requested_count,status,approved_by,approved_at)
    values(new.org_id,v_campaign.id,v_wave_no,v_required,'draft',new.actor_user_id,now()) returning id into v_wave;
  select greatest(now(),coalesce(max(run_at)+interval '1 minute',now())) into v_slot from public.scheduled_jobs
    where target_queue='campaign-dispatch' and status in ('pending','leased') and payload->>'connection_id'=v_campaign.connection_id::text;
  for v_contact in select * from public.campaign_contacts where campaign_id=v_campaign.id and status='ready' order by priority desc,created_at for update skip locked loop
    exit when v_released>=v_required;
    select e164 into v_phone from public.contact_phones where contact_id=v_contact.contact_id and status='active' order by is_primary desc limit 1;
    if v_phone is null or exists(select 1 from public.opt_outs where operation_id=v_campaign.operation_id and contact_id=v_contact.contact_id and revoked_at is null)
       or exists(select 1 from public.suppression_entries where operation_id=v_campaign.operation_id and phone_e164=v_phone and revoked_at is null and (expires_at is null or expires_at>now())) then
      update public.campaign_contacts set status='suppressed',wave_id=v_wave,suppression_reason='opt_out_or_suppression',last_revalidated_at=now(),updated_at=now() where id=v_contact.id;v_suppressed:=v_suppressed+1;
    else
      v_slot:=private.next_campaign_slot(v_campaign.operation_id,v_slot);
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
        values(new.org_id,v_campaign.operation_id,'campaign.contact.dispatch','campaign_contact',v_contact.id,'campaign-dispatch',v_slot,
          'campaign-contact:'||v_contact.id::text||':attempt:1',jsonb_build_object('campaign_id',v_campaign.id,'campaign_contact_id',v_contact.id,'wave_id',v_wave,'connection_id',v_campaign.connection_id,'phone',v_phone),new.actor_user_id);
      update public.campaign_contacts set status='queued',wave_id=v_wave,next_send_at=v_slot,last_revalidated_at=now(),updated_at=now() where id=v_contact.id;
      v_released:=v_released+1;v_slot:=v_slot+interval '1 minute';
    end if;
  end loop;
  v_review_required:=case when v_wave_no=1 then v_released when v_wave_no=2 then ceil(v_released*0.30)::int else ceil(v_released*0.10)::int end;
  insert into public.campaign_wave_contact_reviews(org_id,campaign_id,wave_id,campaign_contact_id,required_for_gate)
    select new.org_id,v_campaign.id,v_wave,id,true from public.campaign_contacts where wave_id=v_wave and status='queued' order by priority desc,created_at limit v_review_required;
  update public.campaign_waves set status='released',released_count=v_released,suppressed_count=v_suppressed,review_required_count=v_review_required,
    review_status=case when v_review_required=0 then 'approved' else 'pending' end,reviewed_at=case when v_review_required=0 then now() else null end,released_at=now() where id=v_wave;
  update public.campaigns set status='running',version=version+1,updated_at=now() where id=v_campaign.id;
  new.wave_id:=v_wave;new.released_count:=v_released;new.suppressed_count:=v_suppressed;new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,new.actor_user_id,'campaign.wave_released','campaign_waves',v_wave,jsonb_build_object('released',v_released,'suppressed',v_suppressed,'wave',v_wave_no,'review_required',v_review_required));
  return new;
end; $$;

-- Inbound aggregation is scheduled once per conversation. New inbound messages
-- extend the 10-second quiet period without exceeding 30 seconds total.
create or replace function public.schedule_inbound_ai_aggregation(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_message public.messages%rowtype;v_conversation public.conversations%rowtype;v_settings public.operation_settings%rowtype;
  v_first timestamptz;v_run_at timestamptz;v_job uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_message from public.messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('status','ignored'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id;
  select * into v_settings from public.operation_settings where operation_id=v_message.operation_id;
  v_first:=v_message.created_at;v_run_at:=v_message.created_at+make_interval(secs=>coalesce(v_settings.grouping_seconds,10));
  select coalesce((payload->>'first_message_at')::timestamptz,v_first) into v_first
    from public.scheduled_jobs where org_id=v_message.org_id and dedupe_key='ai-inbound-aggregate:'||v_message.conversation_id::text
      and status in ('pending','leased') order by created_at limit 1;
  v_first:=coalesce(v_first,v_message.created_at);
  v_run_at:=least(v_first+make_interval(secs=>coalesce(v_settings.max_grouping_seconds,30)),
                  v_message.created_at+make_interval(secs=>coalesce(v_settings.grouping_seconds,10)));
  insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
    values(v_message.org_id,v_message.operation_id,'ai.inbound.aggregate','conversation',v_message.conversation_id,'scheduled-actions',v_run_at,
      'ai-inbound-aggregate:'||v_message.conversation_id::text,
      jsonb_build_object('conversation_id',v_message.conversation_id,'message_id',v_message.id,'first_message_at',v_first),3)
  on conflict(org_id,dedupe_key) where status in ('pending','leased') do update
    set run_at=excluded.run_at,payload=excluded.payload,updated_at=now()
  returning id into v_job;
  return jsonb_build_object('status','scheduled','job_id',v_job,'run_at',v_run_at);
end; $$;
revoke all on function public.schedule_inbound_ai_aggregation(uuid) from public,anon,authenticated;
grant execute on function public.schedule_inbound_ai_aggregation(uuid) to service_role;

-- Permanent queue failures are preserved with a redacted payload and an alert.
create table private.runtime_dead_letters(
  id uuid primary key default gen_random_uuid(),queue_name text not null,msg_id bigint not null,read_count integer not null,
  event_type text,org_id uuid,operation_id uuid,payload jsonb not null default '{}'::jsonb,error_code text,error_redacted text,
  created_at timestamptz not null default now(),unique(queue_name,msg_id)
);
revoke all on private.runtime_dead_letters from public,anon,authenticated,service_role;
grant select,insert on private.runtime_dead_letters to service_role;
create or replace function public.runtime_queue_dead_letter(p_queue_name text,p_msg_id bigint,p_read_count integer,p_payload jsonb,p_error_code text,p_error_redacted text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid;v_org uuid;v_operation uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  begin v_org:=(p_payload->>'org_id')::uuid; exception when others then v_org:=null; end;
  begin v_operation:=(p_payload->>'operation_id')::uuid; exception when others then v_operation:=null; end;
  insert into private.runtime_dead_letters(queue_name,msg_id,read_count,event_type,org_id,operation_id,payload,error_code,error_redacted)
    values(left(p_queue_name,100),p_msg_id,greatest(p_read_count,0),left(p_payload->>'event_type',160),v_org,v_operation,
      p_payload-'secret'-'api_key'-'token'-'authorization',left(p_error_code,100),left(p_error_redacted,500))
  on conflict(queue_name,msg_id) do update set read_count=excluded.read_count,error_code=excluded.error_code,error_redacted=excluded.error_redacted
  returning id into v_id;
  if v_org is not null then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
      values(v_org,v_operation,'critical','queue','Evento enviado para dead-letter',
        'Uma falha definitiva foi preservada para reprocessamento seguro.','runtime_dead_letter',v_id,'dead-letter:'||p_queue_name||':'||p_msg_id)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  end if;
  perform public.runtime_queue_archive(p_queue_name,p_msg_id);
  return v_id;
end; $$;
revoke all on function public.runtime_queue_dead_letter(text,bigint,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.runtime_queue_dead_letter(text,bigint,integer,jsonb,text,text) to service_role;

-- Privacy requests require an audited decision. Destructive actions are staged
-- and never executed from an unreviewed browser request.
alter table public.privacy_requests
  add column resolution_notes text,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column export_snapshot jsonb,
  add column execution_proof jsonb;

create table public.privacy_review_requests(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  privacy_request_id uuid not null,action text not null check(action in ('start_review','legal_hold','release_hold','complete','reject')),
  notes text not null check(char_length(trim(notes)) between 5 and 2000),actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  resulting_status text,processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
  foreign key(privacy_request_id,org_id) references public.privacy_requests(id,org_id) on delete restrict
);
alter table public.privacy_review_requests enable row level security;
create or replace function private.process_privacy_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_request public.privacy_requests%rowtype;v_snapshot jsonb;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or
     not (private.has_org_role(new.org_id,array['owner']::text[]) or private.has_org_permission(new.org_id,'contacts.manage')) then
    raise exception 'privacy_review_forbidden' using errcode='42501';
  end if;
  select * into v_request from public.privacy_requests where id=new.privacy_request_id and org_id=new.org_id for update;
  if not found then raise exception 'privacy_request_not_found' using errcode='22023'; end if;
  if new.action='start_review' and v_request.status='open' then new.resulting_status:='reviewing';
  elsif new.action='legal_hold' and v_request.status in ('open','reviewing') then new.resulting_status:='blocked_legal_hold';
  elsif new.action='release_hold' and v_request.status='blocked_legal_hold' then new.resulting_status:='reviewing';
  elsif new.action='reject' and v_request.status in ('open','reviewing','blocked_legal_hold') then new.resulting_status:='rejected';
  elsif new.action='complete' and v_request.status='reviewing' then
    if v_request.request_type in ('deletion','anonymization') and nullif(trim(new.notes),'') is null then raise exception 'privacy_execution_proof_required' using errcode='22023'; end if;
    new.resulting_status:='completed';
  else raise exception 'privacy_transition_invalid' using errcode='22023'; end if;
  if v_request.request_type in ('access','export') and new.action='complete' then
    select jsonb_build_object('contact',to_jsonb(c),'phones',coalesce((select jsonb_agg(to_jsonb(p)) from public.contact_phones p where p.contact_id=c.id),'[]'::jsonb),
      'opportunities',coalesce((select jsonb_agg(to_jsonb(o)) from public.opportunities o where o.contact_id=c.id),'[]'::jsonb)) into v_snapshot
      from public.contacts c where c.id=v_request.contact_id;
  end if;
  update public.privacy_requests set status=new.resulting_status,resolution_notes=trim(new.notes),reviewed_by=new.actor_user_id,reviewed_at=now(),
    legal_hold_reason=case when new.action='legal_hold' then trim(new.notes) when new.action='release_hold' then null else legal_hold_reason end,
    export_snapshot=coalesce(v_snapshot,export_snapshot),execution_proof=case when new.action='complete' then jsonb_build_object('notes',trim(new.notes),'actor',new.actor_user_id,'at',now()) else execution_proof end,
    completed_at=case when new.resulting_status in ('completed','rejected') then now() else null end,updated_at=now()
    where id=v_request.id;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,new.actor_user_id,'privacy.'||new.action,'privacy_requests',v_request.id,jsonb_build_object('result',new.resulting_status));
  return new;
end; $$;
revoke all on function private.process_privacy_review_request() from public,anon,authenticated,service_role;
create trigger privacy_review_process before insert on public.privacy_review_requests for each row execute function private.process_privacy_review_request();
create policy privacy_review_insert_manager on public.privacy_review_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (private.has_org_role(org_id,array['owner']::text[]) or private.has_org_permission(org_id,'contacts.manage')));
create policy privacy_review_select_manager on public.privacy_review_requests for select to authenticated using(private.has_org_role(org_id,array['owner']::text[]) or private.has_org_permission(org_id,'contacts.manage'));
grant select,insert on public.privacy_review_requests to authenticated;
grant all on public.privacy_review_requests to service_role;

-- Sensitive attachments are hidden from brokers unless an explicit, audited
-- grant exists for that attachment and membership.
alter table public.attachments add constraint attachments_id_org_id_key unique(id,org_id);
create table public.attachment_access_grants(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
  attachment_id uuid not null,membership_id uuid not null,reason text not null check(char_length(trim(reason)) between 5 and 500),
  granted_by uuid not null references auth.users(id) on delete restrict,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),
  foreign key(attachment_id,org_id) references public.attachments(id,org_id) on delete cascade,
  foreign key(membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  unique(attachment_id,membership_id)
);
alter table public.attachment_access_grants enable row level security;
create policy attachment_grants_select_relevant on public.attachment_access_grants for select to authenticated using(
  private.has_org_role(org_id,array['owner','manager']::text[]) or membership_id=private.current_membership_id(org_id));
create policy attachment_grants_manage_manager on public.attachment_access_grants for all to authenticated using(private.has_org_role(org_id,array['owner','manager']::text[])) with check(private.has_org_role(org_id,array['owner','manager']::text[]) and granted_by=(select auth.uid()));
grant select,insert,update,delete on public.attachment_access_grants to authenticated;
grant all on public.attachment_access_grants to service_role;
drop policy if exists attachments_select_visible on public.attachments;
create policy attachments_select_visible on public.attachments for select to authenticated using(
  exists(select 1 from public.messages m where m.id=attachments.message_id and private.can_access_conversation(m.conversation_id))
  and (sensitivity='normal' or private.has_org_role(org_id,array['owner','manager']::text[]) or exists(
    select 1 from public.attachment_access_grants g where g.attachment_id=attachments.id and g.membership_id=private.current_membership_id(attachments.org_id)
      and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())))
);

-- Call distribution completes the preferred round before entering 5/5/5 and
-- broadcast. Declines and returns are audited and work from app or WhatsApp.
alter table public.calls add column preferred_round_completed boolean not null default false;

create table private.operational_reply_receipts(
  id uuid primary key default gen_random_uuid(),org_id uuid not null,connection_id uuid not null,membership_id uuid not null,
  external_event_id text not null,normalized_action text not null,result jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
  unique(connection_id,external_event_id)
);
revoke all on private.operational_reply_receipts from public,anon,authenticated,service_role;
grant select,insert on private.operational_reply_receipts to service_role;

create or replace function private.apply_call_member_action(p_call uuid,p_membership uuid,p_action text,p_offer uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype;v_offer public.call_offers%rowtype;v_assignment public.call_assignments%rowtype;v_request public.call_distribution_requests%rowtype;
begin
  select * into v_call from public.calls where id=p_call for update;
  if not found then return jsonb_build_object('status','call_not_found'); end if;
  if p_action in ('accept','decline') then
    select * into v_offer from public.call_offers where id=p_offer and call_id=v_call.id and recipient_membership_id=p_membership for update;
    if not found or v_offer.status<>'pending' or v_offer.expires_at<=now() then return jsonb_build_object('status','offer_unavailable'); end if;
  end if;
  if p_action='accept' then
    if v_call.status not in ('distributing','awaiting_distribution','unassigned_alerted') or exists(select 1 from public.call_assignments where call_id=v_call.id and active) then
      update public.call_offers set status='lost_race',responded_at=now() where id=v_offer.id;
      return jsonb_build_object('status','lost_race');
    end if;
    if not private.membership_is_available(p_membership,v_call.starts_at,v_call.blocked_until) then return jsonb_build_object('status','member_unavailable'); end if;
    insert into public.call_assignments(org_id,call_id,membership_id,offer_id,assignment_type,assigned_by)
      values(v_call.org_id,v_call.id,p_membership,v_offer.id,case when v_offer.offer_type='nominal' then 'nominal' else 'accepted' end,p_actor)
      returning * into v_assignment;
    update public.call_offers set status=case when id=v_offer.id then 'accepted' else 'lost_race' end,responded_at=now()
      where call_id=v_call.id and status in ('pending','scheduled');
    update public.calls set status='assigned',assigned_membership_id=p_membership,version=version+1,updated_at=now() where id=v_call.id;
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
      values(v_call.org_id,v_call.operation_id,'call.offer_accepted.v1','call',v_call.id,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer.id,'membership_id',p_membership),'call-accepted:'||v_call.id::text)
      on conflict(idempotency_key) do nothing;
    return jsonb_build_object('status','accepted','call_id',v_call.id);
  elsif p_action='decline' then
    update public.call_offers set status='declined',responded_at=now() where id=v_offer.id;
    if v_offer.offer_type in ('preferred','nominal') and not exists(select 1 from public.call_offers where call_id=v_call.id and offer_type in ('preferred','nominal') and status='pending' and id<>v_offer.id) then
      update public.calls set preferred_round_completed=true,version=version+1,updated_at=now() where id=v_call.id;
      insert into public.call_distribution_requests(org_id,call_id,actor_user_id) values(v_call.org_id,v_call.id,null) returning * into v_request;
    end if;
    return jsonb_build_object('status','declined','call_id',v_call.id);
  elsif p_action='return' then
    select * into v_assignment from public.call_assignments where call_id=v_call.id and membership_id=p_membership and active for update;
    if not found then return jsonb_build_object('status','assignment_not_found'); end if;
    update public.call_assignments set active=false,revoked_at=now(),revoked_by=p_actor,revocation_reason='returned_by_member' where id=v_assignment.id;
    update public.calls set status='awaiting_distribution',assigned_membership_id=null,preferred_round_completed=true,version=version+1,updated_at=now() where id=v_call.id;
    insert into public.call_distribution_requests(org_id,call_id,actor_user_id) values(v_call.org_id,v_call.id,null) returning * into v_request;
    return jsonb_build_object('status','returned','call_id',v_call.id);
  end if;
  return jsonb_build_object('status','unsupported_action');
end; $$;
revoke all on function private.apply_call_member_action(uuid,uuid,text,uuid,uuid) from public,anon,authenticated,service_role;

create table public.call_offer_response_requests(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,offer_id uuid,action text not null check(action in ('decline','return')),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),result jsonb,processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
  foreign key(call_id,org_id) references public.calls(id,org_id) on delete restrict,
  foreign key(offer_id,org_id) references public.call_offers(id,org_id) on delete restrict
);
alter table public.call_offer_response_requests enable row level security;
create or replace function private.process_call_offer_response_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_membership uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_response_forbidden' using errcode='42501'; end if;
  select id into v_membership from public.memberships where org_id=new.org_id and user_id=new.actor_user_id and status='active';
  if v_membership is null then raise exception 'active_membership_required' using errcode='42501'; end if;
  new.result:=private.apply_call_member_action(new.call_id,v_membership,new.action,new.offer_id,new.actor_user_id);
  if new.result->>'status' not in ('declined','returned') then raise exception 'call_response_rejected' using errcode='22023'; end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,new.actor_user_id,'call.'||new.action,'calls',new.call_id,new.result);
  return new;
end; $$;
revoke all on function private.process_call_offer_response_request() from public,anon,authenticated,service_role;
create trigger call_offer_response_process before insert on public.call_offer_response_requests for each row execute function private.process_call_offer_response_request();
create policy call_offer_response_insert_self on public.call_offer_response_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.is_active_org_member(org_id));
create policy call_offer_response_select_self on public.call_offer_response_requests for select to authenticated using(actor_user_id=(select auth.uid()));
grant select,insert on public.call_offer_response_requests to authenticated;
grant all on public.call_offer_response_requests to service_role;

create or replace function public.process_operational_whatsapp_reply(p_connection_id uuid,p_from_e164 text,p_external_event_id text,p_body text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype;v_membership public.memberships%rowtype;v_offer public.call_offers%rowtype;v_assignment public.call_assignments%rowtype;
  v_action text;v_body text;v_result jsonb;v_receipt uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_connection from public.whatsapp_connections where id=p_connection_id and status='active';
  if not found then return jsonb_build_object('status','not_operational'); end if;
  select m.* into v_membership from public.memberships m join public.profiles p on p.user_id=m.user_id
    join public.membership_operations mo on mo.membership_id=m.id and mo.operation_id=v_connection.operation_id
    where m.org_id=v_connection.org_id and m.status='active' and p.whatsapp_e164=p_from_e164 limit 1;
  if not found then return jsonb_build_object('status','not_operational'); end if;
  select id into v_receipt from private.operational_reply_receipts where connection_id=p_connection_id and external_event_id=p_external_event_id;
  if v_receipt is not null then return jsonb_build_object('status','duplicate','operational',true,'receipt_id',v_receipt); end if;
  v_body:=translate(lower(trim(coalesce(p_body,''))),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc');
  v_action:=case when v_body~'^(aceito|aceitar|sim|ok|confirmo)\b' then 'accept'
    when v_body~'^(recuso|recusar|nao posso|não posso|declino)\b' then 'decline'
    when v_body~'^(devolver|devolvo|retornar|nao consigo atender|não consigo atender)\b' then 'return' else 'unknown' end;
  if v_action in ('accept','decline') then
    select o.* into v_offer from public.call_offers o join public.calls c on c.id=o.call_id
      where o.recipient_membership_id=v_membership.id and o.status='pending' and o.expires_at>now()
        and c.operation_id=v_connection.operation_id order by o.created_at desc limit 1;
    if found then v_result:=private.apply_call_member_action(v_offer.call_id,v_membership.id,v_action,v_offer.id,v_membership.user_id);
    else v_result:=jsonb_build_object('status','offer_not_found'); end if;
  elsif v_action='return' then
    select a.* into v_assignment from public.call_assignments a join public.calls c on c.id=a.call_id
      where a.membership_id=v_membership.id and a.active and c.operation_id=v_connection.operation_id and c.starts_at>now()
      order by c.starts_at limit 1;
    if found then v_result:=private.apply_call_member_action(v_assignment.call_id,v_membership.id,'return',null,v_membership.user_id);
    else v_result:=jsonb_build_object('status','assignment_not_found'); end if;
  else v_result:=jsonb_build_object('status','operational_message_ignored'); end if;
  insert into private.operational_reply_receipts(org_id,connection_id,membership_id,external_event_id,normalized_action,result)
    values(v_connection.org_id,p_connection_id,v_membership.id,left(p_external_event_id,300),v_action,v_result) returning id into v_receipt;
  return v_result||jsonb_build_object('operational',true,'receipt_id',v_receipt);
end; $$;
revoke all on function public.process_operational_whatsapp_reply(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.process_operational_whatsapp_reply(uuid,text,text,text) to service_role;

-- Preferred offers are never repeated after expiry/decline/return.
create or replace function private.process_call_distribution_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype;v_member record;v_offer uuid;v_count int:=0;v_preferred_count int;v_position int:=0;v_send_at timestamptz;v_is_service boolean:=(select auth.role())='service_role';
begin
  if not v_is_service and ((select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'pipeline.manage')) then raise exception 'call_distribution_forbidden' using errcode='42501'; end if;
  select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.status not in ('awaiting_distribution','distributing','unassigned_alerted') or v_call.starts_at<=now() or exists(select 1 from public.call_assignments where call_id=v_call.id and active) then raise exception 'call_not_distributable' using errcode='22023'; end if;
  update public.call_offers set status='cancelled',responded_at=now() where call_id=v_call.id and status in ('scheduled','pending');
  select count(*) into v_preferred_count from public.membership_call_settings s where not v_call.preferred_round_completed and s.operation_id=v_call.operation_id and s.is_preferred_receiver
    and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until) and not exists(select 1 from public.call_assignments a where a.call_id=v_call.id and a.membership_id=s.membership_id and not a.active)
    and (v_call.nominal_membership_id is null or s.membership_id=v_call.nominal_membership_id);
  if v_call.nominal_membership_id is not null and not v_call.preferred_round_completed then v_preferred_count:=1; end if;
  if v_preferred_count>0 then
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id
      and (case when v_call.nominal_membership_id is not null then s.membership_id=v_call.nominal_membership_id else s.is_preferred_receiver end)
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until) loop
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
        values(new.org_id,v_call.id,v_member.membership_id,1,case when v_call.nominal_membership_id is null then 'preferred' else 'nominal' end,'pending',now(),least(v_call.starts_at,now()+interval '30 minutes')) returning id into v_offer;
      insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
        values(new.org_id,v_call.operation_id,'call.offer_sent.v1','call_offer',v_offer,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer,'date_only',v_call.starts_at),'call-offer:'||v_offer::text);
      v_count:=v_count+1;
    end loop;
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
      values(new.org_id,v_call.operation_id,'call.preferred.expire','call',v_call.id,'call-distribution',least(v_call.starts_at,now()+interval '30 minutes'),
        'call-preferred-expire:'||v_call.id::text,jsonb_build_object('call_id',v_call.id),new.actor_user_id)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  else
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id and not s.is_preferred_receiver
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until)
      and not exists(select 1 from public.call_assignments a where a.call_id=v_call.id and a.membership_id=s.membership_id and not a.active)
      order by s.updated_at,s.membership_id loop
      v_position:=v_position+1;if v_position>3 then exit;end if;v_send_at:=now()+make_interval(mins=>5*(v_position-1));
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
        values(new.org_id,v_call.id,v_member.membership_id,2,'sequential',case when v_position=1 then 'pending' else 'scheduled' end,v_send_at,v_send_at+interval '5 minutes') returning id into v_offer;
      if v_position=1 then insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
        values(new.org_id,v_call.operation_id,'call.offer_sent.v1','call_offer',v_offer,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer),'call-offer:'||v_offer::text);
      else insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
        values(new.org_id,v_call.operation_id,'call.offer.activate','call_offer',v_offer,'call-distribution',v_send_at,'call-offer-activate:'||v_offer::text,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer),new.actor_user_id);end if;
      v_count:=v_count+1;
    end loop;
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until)
      and not exists(select 1 from public.call_assignments a where a.call_id=v_call.id and a.membership_id=s.membership_id and not a.active) loop
      v_send_at:=now()+interval '15 minutes';
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
        values(new.org_id,v_call.id,v_member.membership_id,3,'broadcast','scheduled',v_send_at,v_call.starts_at) on conflict(call_id,recipient_membership_id,round) do nothing returning id into v_offer;
      if v_offer is not null then insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
        values(new.org_id,v_call.operation_id,'call.offer.activate','call_offer',v_offer,'call-distribution',v_send_at,'call-offer-activate:'||v_offer::text,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer),new.actor_user_id);v_count:=v_count+1;end if;
    end loop;
  end if;
  if v_count=0 then update public.calls set status='unassigned_alerted',version=version+1 where id=v_call.id;new.result:='no_eligible_member';
  else update public.calls set status='distributing',version=version+1 where id=v_call.id;new.result:='offers_created';end if;
  new.offer_count:=v_count;new.processed_at:=now();return new;
end; $$;

-- Wrapper around the current runtime executor adds grouped inbound processing
-- and honors the operation's inbound window before delegating other jobs.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_p0;
revoke all on function public.execute_runtime_job_before_p0(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_before_p0(uuid) to service_role;
create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;v_settings public.operation_settings%rowtype;v_message uuid;v_local timestamp;v_next timestamptz;v_execution jsonb;v_call public.calls%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type='call.preferred.expire' then
    select * into v_call from public.calls where id=(v_job.payload->>'call_id')::uuid for update;
    if not found or v_call.status<>'distributing' or exists(select 1 from public.call_assignments where call_id=v_call.id and active) then return jsonb_build_object('status','cancelled'); end if;
    update public.call_offers set status='expired',responded_at=now() where call_id=v_call.id and offer_type in ('preferred','nominal') and status='pending';
    update public.calls set preferred_round_completed=true,version=version+1,updated_at=now() where id=v_call.id;
    insert into public.call_distribution_requests(org_id,call_id,actor_user_id) values(v_call.org_id,v_call.id,null);
    return jsonb_build_object('status','completed');
  elsif v_job.job_type='ai.inbound.aggregate' then
    select * into v_settings from public.operation_settings where operation_id=v_job.operation_id;
    v_local:=now() at time zone coalesce((v_settings.business_hours->>'timezone'),'America/Sao_Paulo');
    if v_local::time < coalesce(v_settings.inbound_window_start,'05:00') or v_local::time > coalesce(v_settings.inbound_window_end,'23:59:59') then
      v_local:=v_local+(case when v_local::time>coalesce(v_settings.inbound_window_end,'23:59:59') then interval '1 day' else interval '0 day' end);
      v_next:=make_timestamptz(extract(year from v_local)::int,extract(month from v_local)::int,
        extract(day from v_local)::int,
        extract(hour from coalesce(v_settings.inbound_window_start,'05:00'))::int,extract(minute from coalesce(v_settings.inbound_window_start,'05:00'))::int,0,
        coalesce((v_settings.business_hours->>'timezone'),'America/Sao_Paulo'));
      return jsonb_build_object('status','retry','retry_seconds',greatest(60,extract(epoch from v_next-now())::int),'reason','outside_inbound_window');
    end if;
    select id into v_message from public.messages where conversation_id=v_job.aggregate_id and direction='inbound' order by created_at desc limit 1;
    if v_message is null then return jsonb_build_object('status','cancelled'); end if;
    select public.ensure_inbound_ai_execution(v_message) into v_execution;
    if v_execution->>'execution_id' is not null and v_execution->>'status' in ('queued','existing') then
      return jsonb_build_object('status','run_ai','ai_execution_id',v_execution->>'execution_id');
    end if;
    return jsonb_build_object('status','completed','result',v_execution);
  end if;
  return public.execute_runtime_job_before_p0(p_job_id);
end; $$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

-- Replace the generic 3-25 second delay with the specified bands. High demand
-- is deterministic and never waits more than five seconds.
create or replace function public.complete_ai_execution(
  p_execution_id uuid,p_output_text text,p_output_structured jsonb,p_response_id text,p_model_returned text,
  p_input_tokens integer,p_output_tokens integer,p_latency_ms integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_execution public.ai_executions%rowtype;v_conversation public.conversations%rowtype;v_message_id uuid;v_delay integer;v_seed integer;v_active integer;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if nullif(trim(p_output_text),'') is null or char_length(p_output_text)>4096 then raise exception 'ai_output_invalid' using errcode='22023'; end if;
  select * into v_execution from public.ai_executions where id=p_execution_id for update;
  if not found or v_execution.status<>'running' then return jsonb_build_object('status','ignored'); end if;
  if v_execution.conversation_id is not null then
    select * into v_conversation from public.conversations where id=v_execution.conversation_id for update;
    if not found or v_conversation.version<>v_execution.expected_conversation_version then
      update public.ai_executions set status='superseded',error_code='conversation_version_conflict',error_redacted='Uma mensagem mais recente substituiu esta execucao.',completed_at=now() where id=v_execution.id;
      return jsonb_build_object('status','superseded');
    end if;
  end if;
  update public.ai_executions set status='completed',output_text=p_output_text,output_structured=coalesce(p_output_structured,'{}'),response_id=p_response_id,
    model_returned=p_model_returned,input_tokens=greatest(0,coalesce(p_input_tokens,0)),output_tokens=greatest(0,coalesce(p_output_tokens,0)),
    latency_ms=greatest(0,coalesce(p_latency_ms,0)),completed_at=now() where id=v_execution.id;
  insert into public.usage_ledger(org_id,operation_id,execution_id,usage_type,model_identifier,input_tokens,output_tokens,estimated_cost)
    select v_execution.org_id,v_execution.operation_id,v_execution.id,case when v_execution.mode in ('simulator','regression') then v_execution.mode else 'service' end,
      coalesce(p_model_returned,m.model_identifier,'unknown'),greatest(0,coalesce(p_input_tokens,0)),greatest(0,coalesce(p_output_tokens,0)),0
    from public.model_profiles m where m.id=v_execution.model_profile_id;
  if coalesce(p_output_structured->>'action','reply')<>'reply' and v_execution.conversation_id is not null then
    update public.conversations set status='paused',ownership='pending_handoff',pause_reason='ai_escalation',updated_at=now() where id=v_execution.conversation_id;
    insert into public.escalations(org_id,operation_id,conversation_id,opportunity_id,category,severity,reason)
      select v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,c.opportunity_id,coalesce(nullif(p_output_structured->>'action',''),'ai_escalation'),'immediate',
        left(coalesce(nullif(p_output_structured->>'escalation_reason',''),'Pedro solicitou revisao humana.'),1000) from public.conversations c where c.id=v_execution.conversation_id;
    return jsonb_build_object('status','escalated');
  end if;
  if v_execution.mode in ('shadow','assisted') then
    insert into public.ai_suggestions(org_id,execution_id,conversation_id,body) values(v_execution.org_id,v_execution.id,v_execution.conversation_id,p_output_text);
    return jsonb_build_object('status','suggestion_created');
  end if;
  if v_execution.mode='production' then
    if v_conversation.ai_mode<>'production' or v_conversation.ownership<>'ai' or v_conversation.status<>'active'
       or exists(select 1 from public.opt_outs o where o.operation_id=v_conversation.operation_id and o.contact_id=v_conversation.contact_id and o.revoked_at is null)
       or exists(select 1 from public.system_pauses s where s.org_id=v_conversation.org_id and s.active and s.scope_type in ('global','organization')) then
      update public.ai_executions set error_code='production_preconditions_changed',error_redacted='A resposta foi gerada, mas o envio foi bloqueado por uma regra deterministica.' where id=v_execution.id;
      return jsonb_build_object('status','blocked');
    end if;
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,reply_to_message_id,metadata)
      values(v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,'outbound','ai','text',p_output_text,'queued',v_execution.request_message_id,
        jsonb_build_object('ai_execution_id',v_execution.id)) returning id into v_message_id;
    v_seed:=abs(hashtext(v_execution.id::text));
    select coalesce(active_count,0) into v_active from public.operation_capacity where operation_id=v_execution.operation_id;
    if coalesce(v_active,0)>=25 then v_delay:=v_seed%6;
    elsif char_length(p_output_text)<=160 then v_delay:=4+(v_seed%9);
    elsif char_length(p_output_text)<=600 then v_delay:=12+(v_seed%24);
    else v_delay:=25+(v_seed%36); end if;
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message_id,'outbound-whatsapp',now()+make_interval(secs=>v_delay),
        'ai-message-send:'||v_message_id::text,jsonb_build_object('message_id',v_message_id,'planned_delay_seconds',v_delay),3);
    return jsonb_build_object('status','send_scheduled','message_id',v_message_id,'planned_delay_seconds',v_delay);
  end if;
  return jsonb_build_object('status','completed');
end; $$;
revoke all on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer) to service_role;

-- Production is a database-enforced state, not a UI convention.
create or replace function private.enforce_ai_production_readiness()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_profile jsonb;v_run public.regression_runs%rowtype;
begin
  if new.ai_global_mode<>'production' or old.ai_global_mode='production' then return new; end if;
  v_profile:=coalesce(new.institutional_profile,'{}'::jsonb);
  if nullif(trim(v_profile->>'company_name'),'') is null or nullif(trim(v_profile->>'creci'),'') is null
     or nullif(trim(v_profile->>'privacy_contact'),'') is null or nullif(trim(v_profile->>'source_name'),'') is null
     or nullif(trim(v_profile->>'valid_until'),'') is null then
    raise exception 'production_institutional_profile_incomplete' using errcode='22023';
  end if;
  if not exists(select 1 from public.persona_versions pv join public.personas p on p.id=pv.persona_id where p.org_id=new.org_id and pv.status='published')
     or not exists(select 1 from public.rule_versions rv join public.rule_sets rs on rs.id=rv.rule_set_id where rs.org_id=new.org_id and rv.status='published')
     or not exists(select 1 from public.qualification_definitions q where q.org_id=new.org_id and q.active and q.required)
     or not exists(select 1 from public.projects p where p.org_id=new.org_id and p.status='active' and p.recommendable and (p.valid_until is null or p.valid_until>=current_date)) then
    raise exception 'production_knowledge_or_rules_incomplete' using errcode='22023';
  end if;
  if not exists(select 1 from public.model_profiles m where m.org_id=new.org_id and m.status='active' and m.is_default and m.integration_account_id is not null)
     or new.fallback_model_profile_id is null
     or not exists(select 1 from public.model_profiles m where m.id=new.fallback_model_profile_id and m.org_id=new.org_id and m.integration_account_id is not null) then
    raise exception 'production_models_incomplete' using errcode='22023';
  end if;
  if not exists(select 1 from public.whatsapp_connections w where w.org_id=new.org_id and w.status='active' and w.inbound_enabled
      and w.last_health_at>=now()-interval '15 minutes' and w.last_error_redacted is null) then
    raise exception 'production_channel_unhealthy' using errcode='22023';
  end if;
  select * into v_run from public.regression_runs where org_id=new.org_id and status='passed' order by completed_at desc nulls last limit 1;
  if not found or v_run.total_cases<100 or v_run.passed_cases::numeric/greatest(v_run.total_cases,1)<0.90 or v_run.critical_failures<>0 then
    raise exception 'production_regression_gate_failed' using errcode='22023';
  end if;
  return new;
end; $$;
revoke all on function private.enforce_ai_production_readiness() from public,anon,authenticated,service_role;
create trigger organization_settings_production_gate before update of ai_global_mode on public.organization_settings
for each row execute function private.enforce_ai_production_readiness();

-- Operational screens refresh from committed database changes rather than
-- relying on manual reloads. RLS still filters every realtime row.
do $$ declare v_table text; begin
  foreach v_table in array array['messages','conversations','alerts','calls','call_offers','campaigns','campaign_waves'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end $$;

create or replace function public.list_audit_events(p_org_id uuid,p_limit integer default 200)
returns table(id uuid,operation_id uuid,actor_user_id uuid,actor_type text,action text,entity_type text,entity_id uuid,metadata jsonb,occurred_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not (private.has_org_role(p_org_id,array['owner','manager']::text[]) or private.has_org_permission(p_org_id,'reports.view')) then
    raise exception 'audit_feed_forbidden' using errcode='42501';
  end if;
  return query select e.id,e.operation_id,e.actor_user_id,e.actor_type,e.action,e.entity_type,e.entity_id,e.metadata,e.occurred_at
    from audit.events e where e.org_id=p_org_id order by e.occurred_at desc limit least(greatest(coalesce(p_limit,200),1),500);
end; $$;
revoke all on function public.list_audit_events(uuid,integer) from public,anon;
grant execute on function public.list_audit_events(uuid,integer) to authenticated,service_role;

-- Explicit grants are required for Data API exposure on new Supabase projects.
grant usage on schema public to authenticated,service_role;

commit;
