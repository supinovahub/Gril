begin;

create table public.consent_declarations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  statement_text text not null check (char_length(trim(statement_text)) between 20 and 4000),
  statement_version integer not null default 1 check (statement_version > 0),
  source_description text not null check (char_length(trim(source_description)) between 5 and 1000),
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id) references public.operations(id, org_id) on delete restrict,
  unique (id, org_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  connection_id uuid not null,
  consent_declaration_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  campaign_type text not null default 'reactivation' check (campaign_type in ('reactivation','inbound_recovery','manual')),
  ai_mode text not null default 'off' check (ai_mode in ('off','shadow','assisted','production')),
  status text not null default 'draft' check (status in ('draft','importing','review','approved','running','paused','completed','cancelled','failed')),
  send_window_start time not null default '09:00',
  send_window_end time not null default '18:00',
  timezone text not null default 'America/Sao_Paulo',
  max_contacts smallint not null default 500 check (max_contacts between 1 and 500),
  priority smallint not null default 50 check (priority between 1 and 100),
  opening_template text not null check (char_length(trim(opening_template)) between 10 and 2000),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paused_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id) references public.operations(id, org_id) on delete restrict,
  foreign key (connection_id, org_id) references public.whatsapp_connections(id, org_id) on delete restrict,
  foreign key (consent_declaration_id, org_id) references public.consent_declarations(id, org_id) on delete restrict,
  unique (id, org_id),
  check (send_window_end > send_window_start),
  check ((status in ('approved','running','paused','completed') and approved_at is not null) or status not in ('approved','running','paused','completed'))
);

create index campaigns_operation_status_idx on public.campaigns (operation_id, status, updated_at desc);

create table public.campaign_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  filename text not null,
  mapping jsonb not null default '{}'::jsonb,
  status text not null default 'processing' check (status in ('processing','review','failed','completed')),
  total_rows smallint not null default 0 check (total_rows between 0 and 500),
  valid_rows smallint not null default 0,
  duplicate_rows smallint not null default 0,
  error_rows smallint not null default 0,
  imported_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete cascade,
  unique (id, org_id)
);

create table public.campaign_import_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  import_id uuid not null,
  row_number smallint not null check (row_number > 0),
  raw_data jsonb not null,
  normalized_name text,
  normalized_phone text,
  status text not null check (status in ('valid','duplicate','error')),
  error_code text,
  contact_id uuid,
  opportunity_id uuid,
  created_at timestamptz not null default now(),
  foreign key (import_id, org_id) references public.campaign_imports(id, org_id) on delete cascade,
  foreign key (contact_id, org_id) references public.contacts(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id) references public.opportunities(id, org_id) on delete restrict,
  unique (import_id, row_number),
  unique (id, org_id)
);

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid not null,
  import_row_id uuid,
  status text not null default 'ready' check (status in ('ready','queued','contacted','replied','scheduled','followup','opted_out','suppressed','failed','completed','excluded')),
  priority smallint not null default 50 check (priority between 1 and 100),
  variant text,
  next_send_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 20),
  suppression_reason text,
  last_revalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete cascade,
  foreign key (contact_id, org_id) references public.contacts(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id) references public.opportunities(id, org_id) on delete restrict,
  foreign key (import_row_id, org_id) references public.campaign_import_rows(id, org_id) on delete restrict,
  unique (id, org_id),
  unique (campaign_id, contact_id)
);

create index campaign_contacts_dispatch_idx on public.campaign_contacts (campaign_id, status, priority desc, created_at);

create table public.campaign_waves (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  wave_number smallint not null check (wave_number > 0),
  requested_count smallint not null check (requested_count between 1 and 500),
  released_count smallint not null default 0,
  suppressed_count smallint not null default 0,
  status text not null default 'draft' check (status in ('draft','released','completed','paused','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  released_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete cascade,
  unique (campaign_id, wave_number),
  unique (id, org_id)
);

create table public.followup_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  name text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  max_attempts smallint not null default 20 check (max_attempts between 1 and 20),
  horizon_days smallint not null default 180 check (horizon_days between 1 and 180),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id) references public.operations(id, org_id) on delete cascade,
  unique (operation_id, name, version),
  unique (id, org_id)
);

create table public.followup_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid not null,
  step_number smallint not null check (step_number between 1 and 20),
  delay_minutes integer not null check (delay_minutes between 5 and 259200),
  channel text not null default 'whatsapp' check (channel='whatsapp'),
  instruction text not null check (char_length(trim(instruction)) between 5 and 1000),
  created_at timestamptz not null default now(),
  foreign key (plan_id, org_id) references public.followup_plans(id, org_id) on delete cascade,
  unique (plan_id, step_number)
);

create table public.campaign_creation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  connection_id uuid not null,
  name text not null,
  ai_mode text not null,
  opening_template text not null,
  consent_statement text not null,
  consent_source text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  campaign_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.campaign_import_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  filename text not null,
  rows jsonb not null check (jsonb_typeof(rows)='array'),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  import_id uuid,
  valid_rows smallint not null default 0,
  duplicate_rows smallint not null default 0,
  error_rows smallint not null default 0,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete restrict
);

create table public.campaign_transition_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  requested_action text not null check (requested_action in ('approve','start','pause','resume','cancel','complete')),
  reason text,
  expected_version integer not null check (expected_version > 0),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  resulting_status text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete restrict
);

create table public.campaign_wave_release_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  requested_count smallint not null check (requested_count between 1 and 500),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  wave_id uuid,
  released_count smallint not null default 0,
  suppressed_count smallint not null default 0,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete restrict
);

create or replace function private.process_campaign_creation_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype; v_consent uuid; v_campaign uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_creation_forbidden' using errcode='42501';
  end if;
  select * into v_connection from public.whatsapp_connections where id=new.connection_id and org_id=new.org_id;
  if not found or v_connection.operation_id<>new.operation_id or v_connection.status<>'active' or not v_connection.campaign_enabled then
    raise exception 'active_campaign_connection_required' using errcode='22023';
  end if;
  if new.ai_mode not in ('off','shadow','assisted','production') then raise exception 'invalid_ai_mode' using errcode='22023'; end if;
  insert into public.consent_declarations (org_id,operation_id,statement_text,source_description,confirmed_by)
  values (new.org_id,new.operation_id,trim(new.consent_statement),trim(new.consent_source),new.actor_user_id) returning id into v_consent;
  insert into public.campaigns (org_id,operation_id,connection_id,consent_declaration_id,name,ai_mode,opening_template,created_by)
  values (new.org_id,new.operation_id,new.connection_id,v_consent,trim(new.name),new.ai_mode,trim(new.opening_template),new.actor_user_id)
  returning id into v_campaign;
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'campaign.created','campaigns',v_campaign,jsonb_build_object('consent_id',v_consent,'ai_mode',new.ai_mode));
  new.campaign_id:=v_campaign; new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_campaign_import_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype; v_import uuid; v_row jsonb; v_num int:=0; v_name text; v_phone text;
  v_contact uuid; v_opportunity uuid; v_import_row uuid; v_stage uuid; v_valid int:=0; v_dup int:=0; v_error int:=0;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then
    raise exception 'campaign_import_forbidden' using errcode='42501';
  end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.status not in ('draft','importing','review') then raise exception 'campaign_not_importable' using errcode='22023'; end if;
  if jsonb_array_length(new.rows)=0 or jsonb_array_length(new.rows)>v_campaign.max_contacts then raise exception 'campaign_row_limit' using errcode='22023'; end if;
  select id into v_stage from public.pipeline_stages where org_id=new.org_id and code='new';
  insert into public.campaign_imports (org_id,campaign_id,filename,mapping,status,total_rows,imported_by)
  values (new.org_id,new.campaign_id,new.filename,jsonb_build_object('name','name','phone','phone'),'processing',jsonb_array_length(new.rows),new.actor_user_id)
  returning id into v_import;
  update public.campaigns set status='importing',version=version+1,updated_at=now() where id=new.campaign_id;
  for v_row in select value from jsonb_array_elements(new.rows) loop
    v_num:=v_num+1; v_name:=nullif(trim(v_row->>'name'),''); v_phone:=nullif(regexp_replace(v_row->>'phone','[[:space:]()-]','','g'),'');
    v_contact:=null; v_opportunity:=null;
    if v_name is null or char_length(v_name)<2 or v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
      insert into public.campaign_import_rows (org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,error_code)
      values (new.org_id,v_import,v_num,v_row,v_name,v_phone,'error','invalid_name_or_e164'); v_error:=v_error+1; continue;
    end if;
    select cp.contact_id into v_contact from public.contact_phones cp where cp.org_id=new.org_id and cp.e164=v_phone and cp.status='active';
    if v_contact is null then
      insert into public.contacts (org_id,name,created_by) values (new.org_id,v_name,new.actor_user_id) returning id into v_contact;
      insert into public.contact_phones (org_id,contact_id,e164,original,is_primary) values (new.org_id,v_contact,v_phone,v_phone,true);
    end if;
    if exists (select 1 from public.campaign_contacts cc where cc.campaign_id=new.campaign_id and cc.contact_id=v_contact) then
      insert into public.campaign_import_rows (org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,error_code,contact_id)
      values (new.org_id,v_import,v_num,v_row,v_name,v_phone,'duplicate','already_in_campaign',v_contact); v_dup:=v_dup+1; continue;
    end if;
    select id into v_opportunity from public.opportunities where org_id=new.org_id and operation_id=v_campaign.operation_id and contact_id=v_contact and status='open' order by created_at desc limit 1;
    if v_opportunity is null then
      insert into public.opportunities (org_id,operation_id,contact_id,pipeline_stage_id,source,created_by)
      values (new.org_id,v_campaign.operation_id,v_contact,v_stage,'campaign',new.actor_user_id) returning id into v_opportunity;
    end if;
    insert into public.campaign_import_rows (org_id,import_id,row_number,raw_data,normalized_name,normalized_phone,status,contact_id,opportunity_id)
    values (new.org_id,v_import,v_num,v_row,v_name,v_phone,'valid',v_contact,v_opportunity) returning id into v_import_row;
    insert into public.campaign_contacts (org_id,campaign_id,contact_id,opportunity_id,import_row_id)
    values (new.org_id,new.campaign_id,v_contact,v_opportunity,v_import_row);
    v_valid:=v_valid+1;
  end loop;
  update public.campaign_imports set status='review',valid_rows=v_valid,duplicate_rows=v_dup,error_rows=v_error,completed_at=now() where id=v_import;
  update public.campaigns set status='review',version=version+1,updated_at=now() where id=new.campaign_id;
  new.import_id:=v_import; new.valid_rows:=v_valid; new.duplicate_rows:=v_dup; new.error_rows:=v_error; new.processed_at:=now();
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'campaign.import_reviewed','campaign_imports',v_import,jsonb_build_object('valid',v_valid,'duplicates',v_dup,'errors',v_error));
  return new;
end; $$;

create or replace function private.process_campaign_transition_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype; v_status text;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_transition_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.version<>new.expected_version then raise exception 'campaign_version_conflict' using errcode='40001'; end if;
  if new.requested_action='approve' then
    if v_campaign.status<>'review' or not exists(select 1 from public.campaign_contacts where campaign_id=v_campaign.id and status='ready') then raise exception 'campaign_review_with_contacts_required' using errcode='22023'; end if;
    if not exists(select 1 from public.whatsapp_connections where id=v_campaign.connection_id and status='active' and campaign_enabled) then raise exception 'active_campaign_connection_required' using errcode='22023'; end if;
    v_status:='approved'; update public.campaigns set status=v_status,approved_by=new.actor_user_id,approved_at=now(),version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action='pause' then
    if v_campaign.status<>'running' then raise exception 'campaign_not_running' using errcode='22023'; end if;
    v_status:='paused'; update public.campaigns set status=v_status,paused_reason=coalesce(nullif(trim(new.reason),''),'manual'),version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action in ('start','resume') then
    if (new.requested_action='start' and v_campaign.status<>'approved') or (new.requested_action='resume' and v_campaign.status<>'paused') then raise exception 'campaign_not_startable' using errcode='22023'; end if;
    if exists(select 1 from public.system_pauses where org_id=new.org_id and active and (scope_type in ('global','organization','proactive') or (scope_type='campaign' and scope_id=v_campaign.id))) then raise exception 'campaign_pause_active' using errcode='55000'; end if;
    v_status:='running'; update public.campaigns set status=v_status,paused_reason=null,version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action='cancel' then
    if v_campaign.status in ('completed','cancelled') then raise exception 'campaign_terminal' using errcode='22023'; end if;
    v_status:='cancelled'; update public.campaigns set status=v_status,version=version+1,updated_at=now() where id=v_campaign.id;
    update public.scheduled_jobs set status='cancelled',updated_at=now() where org_id=new.org_id and status in ('pending','leased') and payload->>'campaign_id'=v_campaign.id::text;
  elsif new.requested_action='complete' then
    if exists(select 1 from public.campaign_contacts where campaign_id=v_campaign.id and status in ('ready','queued','followup')) then raise exception 'campaign_contacts_not_terminal' using errcode='22023'; end if;
    v_status:='completed'; update public.campaigns set status=v_status,completed_at=now(),version=version+1,updated_at=now() where id=v_campaign.id;
  else raise exception 'unsupported_campaign_action' using errcode='22023'; end if;
  new.resulting_status:=v_status; new.processed_at:=now();
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'campaign.'||new.requested_action,'campaigns',v_campaign.id,jsonb_build_object('from',v_campaign.status,'to',v_status,'reason',new.reason));
  return new;
end; $$;

create or replace function private.process_campaign_wave_release_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_campaign public.campaigns%rowtype; v_wave_no int; v_wave uuid; v_contact public.campaign_contacts%rowtype; v_phone text; v_released int:=0; v_suppressed int:=0; v_limit int;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_wave_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.status not in ('approved','running') then raise exception 'campaign_not_releasable' using errcode='22023'; end if;
  if not exists(select 1 from public.whatsapp_connections where id=v_campaign.connection_id and status='active' and campaign_enabled) then raise exception 'active_campaign_connection_required' using errcode='22023'; end if;
  if exists(select 1 from public.system_pauses where org_id=new.org_id and active and (scope_type in ('global','organization','proactive') or (scope_type='campaign' and scope_id=v_campaign.id))) then raise exception 'campaign_pause_active' using errcode='55000'; end if;
  select coalesce(max(wave_number),0)+1 into v_wave_no from public.campaign_waves where campaign_id=v_campaign.id;
  v_limit:=case when v_wave_no=1 then 20 when v_wave_no=2 then 50 else 500 end;
  if new.requested_count>v_limit then raise exception 'campaign_wave_limit_%',v_limit using errcode='22023'; end if;
  insert into public.campaign_waves (org_id,campaign_id,wave_number,requested_count,status,approved_by,approved_at)
  values (new.org_id,v_campaign.id,v_wave_no,new.requested_count,'draft',new.actor_user_id,now()) returning id into v_wave;
  for v_contact in select * from public.campaign_contacts where campaign_id=v_campaign.id and status='ready' order by priority desc,created_at for update skip locked limit new.requested_count loop
    select e164 into v_phone from public.contact_phones where contact_id=v_contact.contact_id and status='active' order by is_primary desc limit 1;
    if exists(select 1 from public.opt_outs where operation_id=v_campaign.operation_id and contact_id=v_contact.contact_id and revoked_at is null)
       or exists(select 1 from public.suppression_entries where operation_id=v_campaign.operation_id and phone_e164=v_phone and revoked_at is null and (expires_at is null or expires_at>now())) then
      update public.campaign_contacts set status='suppressed',suppression_reason='opt_out_or_suppression',last_revalidated_at=now(),updated_at=now() where id=v_contact.id; v_suppressed:=v_suppressed+1;
    else
      insert into public.scheduled_jobs (org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
      values (new.org_id,v_campaign.operation_id,'campaign.contact.dispatch','campaign_contact',v_contact.id,'campaign-dispatch',now(),
        'campaign-contact:'||v_contact.id::text||':attempt:1',jsonb_build_object('campaign_id',v_campaign.id,'campaign_contact_id',v_contact.id,'wave_id',v_wave,'connection_id',v_campaign.connection_id,'phone',v_phone),new.actor_user_id);
      update public.campaign_contacts set status='queued',next_send_at=now(),last_revalidated_at=now(),updated_at=now() where id=v_contact.id; v_released:=v_released+1;
    end if;
  end loop;
  update public.campaign_waves set status='released',released_count=v_released,suppressed_count=v_suppressed,released_at=now() where id=v_wave;
  update public.campaigns set status='running',version=version+1,updated_at=now() where id=v_campaign.id;
  new.wave_id:=v_wave; new.released_count:=v_released; new.suppressed_count:=v_suppressed; new.processed_at:=now();
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'campaign.wave_released','campaign_waves',v_wave,jsonb_build_object('released',v_released,'suppressed',v_suppressed,'wave',v_wave_no));
  return new;
end; $$;

revoke all on function private.process_campaign_creation_request() from public,anon,authenticated,service_role;
revoke all on function private.process_campaign_import_request() from public,anon,authenticated,service_role;
revoke all on function private.process_campaign_transition_request() from public,anon,authenticated,service_role;
revoke all on function private.process_campaign_wave_release_request() from public,anon,authenticated,service_role;
create trigger campaign_creation_process before insert on public.campaign_creation_requests for each row execute function private.process_campaign_creation_request();
create trigger campaign_import_process before insert on public.campaign_import_requests for each row execute function private.process_campaign_import_request();
create trigger campaign_transition_process before insert on public.campaign_transition_requests for each row execute function private.process_campaign_transition_request();
create trigger campaign_wave_release_process before insert on public.campaign_wave_release_requests for each row execute function private.process_campaign_wave_release_request();

create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function private.set_updated_at();
create trigger campaign_contacts_set_updated_at before update on public.campaign_contacts for each row execute function private.set_updated_at();

alter table public.consent_declarations enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_imports enable row level security;
alter table public.campaign_import_rows enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.campaign_waves enable row level security;
alter table public.followup_plans enable row level security;
alter table public.followup_steps enable row level security;
alter table public.campaign_creation_requests enable row level security;
alter table public.campaign_import_requests enable row level security;
alter table public.campaign_transition_requests enable row level security;
alter table public.campaign_wave_release_requests enable row level security;

create policy campaigns_manager_select on public.campaigns for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy consent_manager_select on public.consent_declarations for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_imports_manager_select on public.campaign_imports for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_import_rows_manager_select on public.campaign_import_rows for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_contacts_manager_select on public.campaign_contacts for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_waves_manager_select on public.campaign_waves for select to authenticated using ((select private.has_org_permission(org_id,'campaigns.manage')));
create policy followup_plans_member_select on public.followup_plans for select to authenticated using ((select private.has_operation_access(operation_id)));
create policy followup_steps_member_select on public.followup_steps for select to authenticated using (exists(select 1 from public.followup_plans p where p.id=plan_id and (select private.has_operation_access(p.operation_id))));

create policy campaign_creation_actor_select on public.campaign_creation_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy campaign_creation_manager_insert on public.campaign_creation_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_import_actor_select on public.campaign_import_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy campaign_import_manager_insert on public.campaign_import_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_transition_actor_select on public.campaign_transition_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy campaign_transition_manager_insert on public.campaign_transition_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));
create policy campaign_wave_actor_select on public.campaign_wave_release_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy campaign_wave_manager_insert on public.campaign_wave_release_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));

grant select on public.consent_declarations,public.campaigns,public.campaign_imports,public.campaign_import_rows,public.campaign_contacts,public.campaign_waves,public.followup_plans,public.followup_steps to authenticated;
grant select,insert on public.campaign_creation_requests,public.campaign_import_requests,public.campaign_transition_requests,public.campaign_wave_release_requests to authenticated;
grant all on public.consent_declarations,public.campaigns,public.campaign_imports,public.campaign_import_rows,public.campaign_contacts,public.campaign_waves,public.followup_plans,public.followup_steps,public.campaign_creation_requests,public.campaign_import_requests,public.campaign_transition_requests,public.campaign_wave_release_requests to service_role;

comment on table public.campaign_import_requests is 'Atomic import command; the browser sends normalized rows, never creates leads directly.';
comment on table public.campaign_wave_release_requests is 'Explicit wave approval; every contact is revalidated for opt-out and suppression at release time.';

commit;
