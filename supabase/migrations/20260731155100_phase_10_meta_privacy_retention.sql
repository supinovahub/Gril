begin;

create table public.meta_lead_forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  connection_id uuid not null,
  external_form_id text not null,
  name text not null,
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  field_mapping jsonb not null,
  consent_text text not null,
  consent_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete restrict,
  unique (connection_id,external_form_id),
  unique (id,org_id),
  check (field_mapping ? 'phone')
);

create table public.meta_form_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  form_id uuid not null,
  version integer not null,
  snapshot jsonb not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  foreign key (form_id,org_id) references public.meta_lead_forms(id,org_id) on delete cascade,
  unique (form_id,version)
);

create table public.meta_lead_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  form_id uuid not null,
  external_submission_id text not null,
  submitted_at timestamptz,
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'received' check (status in ('received','matched','unmatched','invalid','duplicate')),
  received_at timestamptz not null default now(),
  foreign key (form_id,org_id) references public.meta_lead_forms(id,org_id) on delete restrict,
  unique (form_id,external_submission_id),
  unique (id,org_id)
);

create table public.preleads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  submission_id uuid not null,
  name text,
  phone_e164 text,
  fields jsonb not null default '{}'::jsonb,
  consent_snapshot jsonb not null,
  status text not null check (status in ('matched','unmatched','invalid')),
  contact_id uuid,
  opportunity_id uuid,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (submission_id,org_id) references public.meta_lead_submissions(id,org_id) on delete cascade,
  foreign key (contact_id,org_id) references public.contacts(id,org_id) on delete set null,
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete set null,
  unique (submission_id)
);

create table public.meta_form_creation_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,connection_id uuid not null,external_form_id text not null,name text not null,field_mapping jsonb not null,
  consent_text text not null,actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),form_id uuid,
  processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.meta_form_ingest_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  form_id uuid not null,external_submission_id text not null,submitted_at timestamptz,payload jsonb not null,payload_sha256 text not null,
  submission_id uuid,prelead_id uuid,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data_class text not null check (data_class in ('contact','sensitive_attachment','ai_sample','audit')),
  retention_days integer not null check (retention_days between 1 and 3650),
  action text not null check (action in ('anonymize','delete','archive')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,data_class)
);

alter table public.attachments add column sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','identity','financial'));
alter table public.attachments add column purge_after timestamptz;

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null,
  request_type text not null check (request_type in ('access','export','correction','restriction','deletion','anonymization')),
  status text not null default 'open' check (status in ('open','reviewing','blocked_legal_hold','completed','rejected')),
  legal_hold_reason text,
  requested_by uuid references auth.users(id) on delete set null,
  due_at timestamptz not null default now()+interval '15 days',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id,org_id) references public.contacts(id,org_id) on delete restrict,
  unique (id,org_id)
);

create table private.retention_purge_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  storage_bucket text,
  storage_path text,
  action text not null check (action in ('anonymize','delete','archive')),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','held')),
  attempts integer not null default 0,
  last_error_redacted text,
  created_at timestamptz not null default now(),
  unique (entity_type,entity_id,action)
);

create or replace function private.process_meta_form_creation_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype; v_form uuid; v_snapshot jsonb; v_checksum text;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'settings.manage') then raise exception 'meta_form_creation_forbidden' using errcode='42501'; end if;
  select * into v_connection from public.whatsapp_connections where id=new.connection_id and org_id=new.org_id;
  if not found or v_connection.provider<>'meta_cloud' or v_connection.status<>'active' or not v_connection.inbound_enabled then raise exception 'active_meta_connection_required' using errcode='22023'; end if;
  if not new.field_mapping ? 'phone' then raise exception 'phone_mapping_required' using errcode='22023'; end if;
  insert into public.meta_lead_forms(org_id,operation_id,connection_id,external_form_id,name,status,field_mapping,consent_text,created_by)
  values(new.org_id,new.operation_id,new.connection_id,new.external_form_id,new.name,'active',new.field_mapping,new.consent_text,new.actor_user_id) returning id into v_form;
  v_snapshot:=jsonb_build_object('external_form_id',new.external_form_id,'name',new.name,'mapping',new.field_mapping,'consent_text',new.consent_text,'consent_version',1);
  v_checksum:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');
  insert into public.meta_form_versions(org_id,form_id,version,snapshot,checksum,published_by) values(new.org_id,v_form,1,v_snapshot,v_checksum,new.actor_user_id);
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.actor_user_id,'meta.form_created','meta_lead_forms',v_form,jsonb_build_object('external_form_id',new.external_form_id));
  new.form_id:=v_form;new.processed_at:=now();return new;
end; $$;

create or replace function private.process_meta_form_ingest_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_form public.meta_lead_forms%rowtype;v_submission uuid;v_prelead uuid;v_name text;v_phone text;v_contact uuid;v_opportunity uuid;v_status text;
begin
  if (select auth.role())<>'service_role' then raise exception 'meta_ingest_service_role_required' using errcode='42501'; end if;
  select * into v_form from public.meta_lead_forms where id=new.form_id and org_id=new.org_id and status='active';
  if not found then raise exception 'meta_form_not_active' using errcode='22023';end if;
  insert into public.meta_lead_submissions(org_id,form_id,external_submission_id,submitted_at,payload,payload_sha256)
  values(new.org_id,new.form_id,new.external_submission_id,new.submitted_at,new.payload,new.payload_sha256)
  on conflict(form_id,external_submission_id) do nothing returning id into v_submission;
  if v_submission is null then new.result:='duplicate';new.processed_at:=now();return new;end if;
  v_name:=nullif(trim(new.payload->>(v_form.field_mapping->>'name')),'');
  v_phone:=nullif(regexp_replace(new.payload->>(v_form.field_mapping->>'phone'),'[[:space:]()-]','','g'),'');
  if v_phone is null or v_phone!~ '^\+[1-9][0-9]{7,14}$' then v_status:='invalid';
  else
    select cp.contact_id into v_contact from public.contact_phones cp where cp.org_id=new.org_id and cp.e164=v_phone and cp.status='active';
    if v_contact is not null then
      select id into v_opportunity from public.opportunities where org_id=new.org_id and operation_id=v_form.operation_id and contact_id=v_contact and status='open' order by created_at desc limit 1;
      v_status:='matched';
      if v_name is not null then update public.contacts set name=case when name='Contato sem nome' then v_name else name end,updated_at=now() where id=v_contact;end if;
    else v_status:='unmatched';end if;
  end if;
  insert into public.preleads(org_id,operation_id,submission_id,name,phone_e164,fields,consent_snapshot,status,contact_id,opportunity_id,matched_at)
  values(new.org_id,v_form.operation_id,v_submission,v_name,v_phone,new.payload,jsonb_build_object('text',v_form.consent_text,'version',v_form.consent_version),v_status,v_contact,v_opportunity,case when v_status='matched' then now() end) returning id into v_prelead;
  update public.meta_lead_submissions set status=v_status where id=v_submission;
  new.submission_id:=v_submission;new.prelead_id:=v_prelead;new.result:=v_status;new.processed_at:=now();return new;
end; $$;

create or replace function private.seed_retention_policies(p_org uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
begin insert into public.retention_policies(org_id,data_class,retention_days,action) values
  (p_org,'contact',730,'anonymize'),(p_org,'sensitive_attachment',30,'delete'),(p_org,'ai_sample',180,'anonymize'),(p_org,'audit',1825,'archive') on conflict(org_id,data_class) do nothing;end;$$;
revoke all on function private.seed_retention_policies(uuid) from public,anon,authenticated,service_role;
do $$declare v uuid;begin for v in select id from public.organizations loop perform private.seed_retention_policies(v);end loop;end$$;

create or replace function private.queue_sensitive_attachment_retention()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.sensitivity<>'normal' then
    new.purge_after:=coalesce(new.purge_after,now()+interval '30 days');
    insert into private.retention_purge_queue(org_id,entity_type,entity_id,storage_bucket,storage_path,action,due_at)
    values(new.org_id,'attachment',new.id,new.storage_bucket,new.storage_path,'delete',new.purge_after) on conflict(entity_type,entity_id,action) do update set due_at=excluded.due_at;
  end if;return new;
end;$$;
revoke all on function private.queue_sensitive_attachment_retention() from public,anon,authenticated,service_role;
create trigger attachments_queue_retention before insert or update of sensitivity,purge_after on public.attachments for each row execute function private.queue_sensitive_attachment_retention();

revoke all on function private.process_meta_form_creation_request() from public,anon,authenticated,service_role;
revoke all on function private.process_meta_form_ingest_request() from public,anon,authenticated,service_role;
create trigger meta_form_creation_process before insert on public.meta_form_creation_requests for each row execute function private.process_meta_form_creation_request();
create trigger meta_form_ingest_process before insert on public.meta_form_ingest_requests for each row execute function private.process_meta_form_ingest_request();
create trigger meta_lead_forms_updated_at before update on public.meta_lead_forms for each row execute function private.set_updated_at();
create trigger retention_policies_updated_at before update on public.retention_policies for each row execute function private.set_updated_at();
create trigger privacy_requests_updated_at before update on public.privacy_requests for each row execute function private.set_updated_at();

alter table public.meta_lead_forms enable row level security;alter table public.meta_form_versions enable row level security;alter table public.meta_lead_submissions enable row level security;alter table public.preleads enable row level security;alter table public.meta_form_creation_requests enable row level security;alter table public.meta_form_ingest_requests enable row level security;alter table public.retention_policies enable row level security;alter table public.privacy_requests enable row level security;
create policy meta_forms_manager_select on public.meta_lead_forms for select to authenticated using((select private.has_org_permission(org_id,'settings.manage')));
create policy meta_form_versions_manager_select on public.meta_form_versions for select to authenticated using((select private.has_org_permission(org_id,'settings.manage')));
create policy meta_submissions_manager_select on public.meta_lead_submissions for select to authenticated using((select private.has_org_permission(org_id,'contacts.manage')));
create policy preleads_manager_select on public.preleads for select to authenticated using((select private.has_org_permission(org_id,'contacts.manage')));
create policy meta_form_creation_actor_select on public.meta_form_creation_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy meta_form_creation_owner_insert on public.meta_form_creation_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'settings.manage')));
create policy retention_policies_owner_select on public.retention_policies for select to authenticated using((select private.has_org_role(org_id,array['owner']::text[])));
create policy retention_policies_owner_update on public.retention_policies for update to authenticated using((select private.has_org_role(org_id,array['owner']::text[]))) with check((select private.has_org_role(org_id,array['owner']::text[])));
create policy privacy_requests_manager_all on public.privacy_requests for all to authenticated using((select private.has_org_permission(org_id,'contacts.manage'))) with check((select private.has_org_permission(org_id,'contacts.manage')));
grant select on public.meta_lead_forms,public.meta_form_versions,public.meta_lead_submissions,public.preleads to authenticated;grant select,insert on public.meta_form_creation_requests to authenticated;grant select,update on public.retention_policies to authenticated;grant select,insert,update on public.privacy_requests to authenticated;
grant all on public.meta_lead_forms,public.meta_form_versions,public.meta_lead_submissions,public.preleads,public.meta_form_creation_requests,public.meta_form_ingest_requests,public.retention_policies,public.privacy_requests to service_role;

comment on table public.preleads is 'Meta submission staging. Late form data links to an existing WhatsApp lead and only fills explicit blanks.';
comment on table private.retention_purge_queue is 'Storage/database purge must be completed by a service worker; deleting a database row alone is not proof that the object was erased.';

commit;
