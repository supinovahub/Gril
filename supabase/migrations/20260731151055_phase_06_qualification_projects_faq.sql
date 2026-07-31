begin;

create table public.qualification_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  intent text not null,
  description text,
  answer_type text not null check (answer_type in ('text', 'money', 'number', 'boolean', 'single_choice', 'multi_choice', 'datetime_preference')),
  priority smallint not null default 50 check (priority between 1 and 100),
  required boolean not null default true,
  applicability jsonb not null default '{}'::jsonb,
  accepted_interpretations jsonb not null default '[]'::jsonb,
  natural_examples jsonb not null default '[]'::jsonb,
  clarification_rule text,
  suggested_order smallint not null,
  validity_days smallint check (validity_days is null or validity_days between 1 and 3650),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, suggested_order),
  unique (id, org_id)
);

create table public.qualification_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  definitions_snapshot jsonb not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, version),
  unique (id, org_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index qualification_versions_one_published_idx
  on public.qualification_versions (org_id) where status='published';

alter table public.conversation_context_versions
  add constraint conversation_context_qualification_version_id_fkey
  foreign key (qualification_version_id, org_id)
  references public.qualification_versions(id, org_id) on delete restrict;

create table public.qualification_values (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  definition_id uuid not null,
  value_text text,
  value_number numeric(16,2),
  value_boolean boolean,
  value_json jsonb,
  state text not null default 'valid' check (state in ('valid', 'expired', 'refused', 'conflict', 'unknown')),
  source text not null check (source in ('contact', 'manual', 'meta', 'form', 'ai', 'import')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  source_message_id uuid references public.messages(id) on delete set null,
  human_confirmed boolean not null default false,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  valid_until timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (definition_id, org_id)
    references public.qualification_definitions(id, org_id) on delete restrict,
  unique (opportunity_id, definition_id),
  unique (id, org_id),
  check (num_nonnulls(value_text, value_number, value_boolean, value_json) = 1 or state in ('refused','unknown'))
);

create index qualification_values_opportunity_idx
  on public.qualification_values (opportunity_id, state, valid_until);

create table public.qualification_value_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  definition_id uuid not null,
  qualification_value_id uuid,
  previous_value jsonb,
  new_value jsonb,
  source text not null,
  confidence numeric(4,3),
  result text not null check (result in ('created', 'updated', 'conflict', 'refused', 'expired')),
  actor_user_id uuid references auth.users(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (definition_id, org_id)
    references public.qualification_definitions(id, org_id) on delete restrict,
  foreign key (qualification_value_id, org_id)
    references public.qualification_values(id, org_id) on delete restrict
);

create index qualification_value_history_timeline_idx
  on public.qualification_value_history (opportunity_id, created_at desc);

create table public.qualification_value_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  definition_id uuid not null,
  value_text text,
  value_number numeric(16,2),
  value_boolean boolean,
  value_json jsonb,
  state text not null default 'valid' check (state in ('valid','refused','unknown')),
  source text not null check (source in ('contact','manual','meta','form','ai','import')),
  confidence numeric(4,3),
  source_message_id uuid references public.messages(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete restrict default auth.uid(),
  human_confirmed boolean not null default false,
  expected_version integer,
  qualification_value_id uuid,
  result text check (result in ('created','updated','conflict','refused')),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict,
  foreign key (definition_id, org_id)
    references public.qualification_definitions(id, org_id) on delete restrict,
  foreign key (qualification_value_id, org_id)
    references public.qualification_values(id, org_id) on delete restrict,
  check (num_nonnulls(value_text, value_number, value_boolean, value_json) = 1 or state in ('refused','unknown'))
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 160),
  region text not null,
  neighborhood text,
  summary text not null check (char_length(trim(summary)) between 20 and 4000),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  recommendable boolean not null default false,
  delivery_type text not null check (delivery_type in ('ready','under_construction','launch','mixed')),
  min_price numeric(16,2) check (min_price is null or min_price >= 0),
  max_price numeric(16,2) check (max_price is null or max_price >= min_price),
  min_down_payment numeric(16,2) check (min_down_payment is null or min_down_payment >= 0),
  comfortable_installment numeric(16,2) check (comfortable_installment is null or comfortable_installment >= 0),
  primary_objective text,
  short_stay_management boolean,
  commercial_priority smallint not null default 50 check (commercial_priority between 1 and 100),
  source_name text,
  reference_date date,
  valid_until date,
  cover_storage_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  unique (id, org_id),
  check (status <> 'active' or source_name is not null),
  check (not recommendable or status='active')
);

create index projects_catalog_idx
  on public.projects (org_id, status, recommendable, min_price, min_down_payment);

create table public.project_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  code text not null,
  value_text text,
  value_number numeric(18,4),
  unit text,
  source_name text not null,
  reference_date date not null,
  valid_until date,
  confidence numeric(4,3) check (confidence between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, org_id)
    references public.projects(id, org_id) on delete cascade,
  unique (project_id, code),
  check (num_nonnulls(value_text,value_number)=1)
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  media_type text not null check (media_type in ('cover','image','pdf','official_link')),
  storage_path text,
  external_url text,
  title text,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id)
    references public.projects(id, org_id) on delete cascade,
  check (num_nonnulls(storage_path,external_url)=1)
);

create table public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('global','project')),
  project_id uuid,
  canonical_question text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, org_id)
    references public.projects(id, org_id) on delete cascade,
  unique (id, org_id),
  check ((scope='global' and project_id is null) or (scope='project' and project_id is not null))
);

create table public.faq_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  faq_entry_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  question_variations jsonb not null default '[]'::jsonb,
  base_answer text not null,
  response_mode text not null check (response_mode in ('direct','brief_then_call','silent_escalation')),
  allowed_dynamic_fields text[] not null default '{}',
  caveats text,
  forbidden_claims jsonb not null default '[]'::jsonb,
  source_name text,
  valid_until date,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (faq_entry_id, org_id)
    references public.faq_entries(id, org_id) on delete cascade,
  unique (faq_entry_id, version),
  unique (id, org_id),
  check ((status='published' and published_at is not null) or status<>'published')
);

create unique index faq_versions_one_published_idx
  on public.faq_versions (faq_entry_id) where status='published';

create table public.project_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  project_id uuid not null,
  request_id uuid not null,
  eligible boolean not null,
  rank smallint,
  criteria jsonb not null,
  decision_reason text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (project_id, org_id)
    references public.projects(id, org_id) on delete cascade,
  unique (request_id, project_id)
);

create table public.project_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  opportunity_id uuid,
  snapshot jsonb not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (project_id, org_id)
    references public.projects(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict,
  unique (id, org_id)
);

create table public.project_match_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  result_count smallint not null default 0,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict
);

create or replace function private.seed_qualification_catalog(p_org_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_snapshot jsonb; v_checksum text; v_version_id uuid;
begin
  insert into public.qualification_definitions (
    org_id,code,name,intent,answer_type,priority,required,suggested_order,validity_days
  ) values
    (p_org_id,'purchase_objective','Objetivo da compra','Entender uso ou investimento','single_choice',95,true,1,90),
    (p_org_id,'region','Bairro ou região','Entender localização preferida','text',85,true,2,90),
    (p_org_id,'down_payment','Faixa de entrada','Entender entrada disponível','money',100,true,3,30),
    (p_org_id,'monthly_installment','Parcela confortável','Entender parcela mensal confortável','money',90,true,4,30),
    (p_org_id,'total_price','Preço total','Entender teto de preço','money',100,true,5,30),
    (p_org_id,'delivery_preference','Pronto ou na planta','Entender preferência de entrega','single_choice',75,true,6,90),
    (p_org_id,'purchase_timeline','Prazo para comprar','Entender horizonte de decisão','text',80,true,7,30),
    (p_org_id,'call_preference','Preferência de dia e horário','Preparar agendamento','datetime_preference',70,true,8,null)
  on conflict (org_id,code) do nothing;

  if not exists (select 1 from public.qualification_versions where org_id=p_org_id and status='published') then
    select jsonb_agg(jsonb_build_object(
      'id',id,'code',code,'name',name,'intent',intent,'answer_type',answer_type,
      'priority',priority,'required',required,'suggested_order',suggested_order,'validity_days',validity_days
    ) order by suggested_order) into v_snapshot
    from public.qualification_definitions where org_id=p_org_id and active;
    v_checksum:=encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');
    insert into public.qualification_versions (org_id,version,status,definitions_snapshot,checksum,published_at)
    values (p_org_id,1,'published',v_snapshot,v_checksum,now()) returning id into v_version_id;
  end if;
end; $$;
revoke all on function private.seed_qualification_catalog(uuid) from public,anon,authenticated,service_role;

create or replace function private.seed_qualification_for_org()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin perform private.seed_qualification_catalog(new.id); return new; end; $$;
revoke all on function private.seed_qualification_for_org() from public,anon,authenticated,service_role;
create trigger organizations_seed_qualification after insert on public.organizations
for each row execute function private.seed_qualification_for_org();

do $$ declare v_org uuid; begin for v_org in select id from public.organizations loop perform private.seed_qualification_catalog(v_org); end loop; end $$;

create or replace function private.set_context_qualification_version()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.qualification_version_id is null then
    select id into new.qualification_version_id
    from public.qualification_versions
    where org_id=new.org_id and status='published';
  end if;
  return new;
end; $$;
revoke all on function private.set_context_qualification_version() from public,anon,authenticated,service_role;
create trigger conversation_context_set_qualification before insert on public.conversation_context_versions
for each row execute function private.set_context_qualification_version();

update public.conversation_context_versions ccv
set qualification_version_id=qv.id
from public.qualification_versions qv
where qv.org_id=ccv.org_id and qv.status='published' and ccv.qualification_version_id is null;

create or replace function private.process_qualification_value_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_current public.qualification_values%rowtype;
  v_definition public.qualification_definitions%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_value_id uuid;
  v_result text;
  v_is_service boolean := (select auth.role())='service_role';
begin
  if not v_is_service then
    if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
       or not private.can_access_opportunity(new.opportunity_id) then
      raise exception 'qualification_write_forbidden' using errcode='42501';
    end if;
  end if;
  select * into v_definition from public.qualification_definitions
  where id=new.definition_id and org_id=new.org_id and active;
  if not found then raise exception 'qualification_definition_not_found' using errcode='22023'; end if;
  select * into v_current from public.qualification_values
  where opportunity_id=new.opportunity_id and definition_id=new.definition_id for update;
  v_new:=jsonb_strip_nulls(jsonb_build_object('text',new.value_text,'number',new.value_number,'boolean',new.value_boolean,'json',new.value_json,'state',new.state));

  if found then
    if new.expected_version is not null and new.expected_version<>v_current.version then
      raise exception 'qualification_version_conflict' using errcode='40001';
    end if;
    v_previous:=jsonb_strip_nulls(jsonb_build_object('text',v_current.value_text,'number',v_current.value_number,'boolean',v_current.value_boolean,'json',v_current.value_json,'state',v_current.state));
    if v_current.human_confirmed and new.source='ai' then
      update public.qualification_values set state='conflict',updated_at=now() where id=v_current.id;
      v_value_id:=v_current.id; v_result:='conflict';
    else
      update public.qualification_values set
        value_text=new.value_text,value_number=new.value_number,value_boolean=new.value_boolean,value_json=new.value_json,
        state=new.state,source=new.source,confidence=new.confidence,source_message_id=new.source_message_id,
        human_confirmed=new.human_confirmed or (new.source='manual'),
        confirmed_by=case when new.human_confirmed or new.source='manual' then (select auth.uid()) else confirmed_by end,
        confirmed_at=case when new.human_confirmed or new.source='manual' then now() else confirmed_at end,
        valid_until=case when v_definition.validity_days is null then null else now()+make_interval(days=>v_definition.validity_days) end,
        version=version+1,updated_at=now()
      where id=v_current.id returning id into v_value_id;
      v_result:=case when new.state='refused' then 'refused' else 'updated' end;
    end if;
  else
    insert into public.qualification_values (
      org_id,opportunity_id,definition_id,value_text,value_number,value_boolean,value_json,
      state,source,confidence,source_message_id,human_confirmed,confirmed_by,confirmed_at,valid_until
    ) values (
      new.org_id,new.opportunity_id,new.definition_id,new.value_text,new.value_number,new.value_boolean,new.value_json,
      new.state,new.source,new.confidence,new.source_message_id,new.human_confirmed or new.source='manual',
      case when new.human_confirmed or new.source='manual' then (select auth.uid()) end,
      case when new.human_confirmed or new.source='manual' then now() end,
      case when v_definition.validity_days is null then null else now()+make_interval(days=>v_definition.validity_days) end
    ) returning id into v_value_id;
    v_result:=case when new.state='refused' then 'refused' else 'created' end;
  end if;

  insert into public.qualification_value_history (
    org_id,opportunity_id,definition_id,qualification_value_id,previous_value,new_value,
    source,confidence,result,actor_user_id,source_message_id
  ) values (
    new.org_id,new.opportunity_id,new.definition_id,v_value_id,v_previous,v_new,new.source,new.confidence,
    v_result,(select auth.uid()),new.source_message_id
  );
  new.qualification_value_id:=v_value_id; new.result:=v_result; new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_qualification_value_request() from public,anon,authenticated,service_role;
create trigger qualification_value_request_process before insert on public.qualification_value_requests
for each row execute function private.process_qualification_value_request();

create or replace function private.process_project_match_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_budget numeric; v_down numeric; v_region text; v_delivery text; v_count smallint:=0; v_project public.projects%rowtype; v_rank smallint:=0; v_snapshot jsonb;
begin
  if (select auth.role())<>'service_role' and (
    (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.can_access_opportunity(new.opportunity_id)
  ) then raise exception 'project_match_forbidden' using errcode='42501'; end if;
  select q.value_number into v_budget from public.qualification_values q join public.qualification_definitions d on d.id=q.definition_id
  where q.opportunity_id=new.opportunity_id and d.code='total_price' and q.state='valid' and (q.valid_until is null or q.valid_until>now());
  select q.value_number into v_down from public.qualification_values q join public.qualification_definitions d on d.id=q.definition_id
  where q.opportunity_id=new.opportunity_id and d.code='down_payment' and q.state='valid' and (q.valid_until is null or q.valid_until>now());
  select q.value_text into v_region from public.qualification_values q join public.qualification_definitions d on d.id=q.definition_id
  where q.opportunity_id=new.opportunity_id and d.code='region' and q.state='valid' and (q.valid_until is null or q.valid_until>now());
  select q.value_text into v_delivery from public.qualification_values q join public.qualification_definitions d on d.id=q.definition_id
  where q.opportunity_id=new.opportunity_id and d.code='delivery_preference' and q.state='valid' and (q.valid_until is null or q.valid_until>now());

  if v_budget is null or v_down is null then
    new.result_count:=0; new.processed_at:=now(); return new;
  end if;
  for v_project in
    select * from public.projects p
    where p.org_id=new.org_id and p.status='active' and p.recommendable
      and p.min_price is not null and p.min_price<=v_budget
      and p.min_down_payment is not null and p.min_down_payment<=v_down
      and p.cover_storage_path is not null
      and (p.valid_until is null or p.valid_until>=current_date)
    order by
      case when v_region is not null and (p.region ilike '%'||v_region||'%' or p.neighborhood ilike '%'||v_region||'%') then 0 else 1 end,
      case when v_delivery is not null and p.delivery_type=v_delivery then 0 else 1 end,
      p.commercial_priority desc,p.min_price
    limit 2
  loop
    v_rank:=v_rank+1;
    insert into public.project_matches (org_id,opportunity_id,project_id,request_id,eligible,rank,criteria,decision_reason)
    values (new.org_id,new.opportunity_id,v_project.id,new.id,true,v_rank,
      jsonb_build_object('budget',v_budget,'down_payment',v_down,'region',v_region,'delivery',v_delivery),
      'Preço e entrada compatíveis; preferências usadas apenas para ordenação.');
    v_snapshot:=to_jsonb(v_project)-'created_by';
    insert into public.project_snapshots (org_id,project_id,opportunity_id,snapshot,checksum)
    values (new.org_id,v_project.id,new.opportunity_id,v_snapshot,
      encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'));
    v_count:=v_count+1;
  end loop;
  new.result_count:=v_count; new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_project_match_request() from public,anon,authenticated,service_role;
create trigger project_match_request_process before insert on public.project_match_requests
for each row execute function private.process_project_match_request();

create or replace function private.can_view_knowledge(p_org_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists (
    select 1 from public.memberships m where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active'
      and (m.role in ('owner','manager') or exists (
        select 1 from public.conversation_access_grants g
        where g.membership_id=m.id and g.revoked_at is null and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now())
      ))
  );
$$;
revoke all on function private.can_view_knowledge(uuid) from public,anon,service_role;
grant execute on function private.can_view_knowledge(uuid) to authenticated;

create trigger qualification_definitions_set_updated_at before update on public.qualification_definitions for each row execute function private.set_updated_at();
create trigger qualification_values_set_updated_at before update on public.qualification_values for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function private.set_updated_at();
create trigger project_facts_set_updated_at before update on public.project_facts for each row execute function private.set_updated_at();
create trigger faq_entries_set_updated_at before update on public.faq_entries for each row execute function private.set_updated_at();
create trigger faq_versions_set_updated_at before update on public.faq_versions for each row execute function private.set_updated_at();

alter table public.qualification_definitions enable row level security;
alter table public.qualification_versions enable row level security;
alter table public.qualification_values enable row level security;
alter table public.qualification_value_history enable row level security;
alter table public.qualification_value_requests enable row level security;
alter table public.projects enable row level security;
alter table public.project_facts enable row level security;
alter table public.project_media enable row level security;
alter table public.faq_entries enable row level security;
alter table public.faq_versions enable row level security;
alter table public.project_matches enable row level security;
alter table public.project_snapshots enable row level security;
alter table public.project_match_requests enable row level security;

create policy qualification_definitions_select_member on public.qualification_definitions for select to authenticated using ((select private.is_active_org_member(org_id)));
create policy qualification_definitions_manage on public.qualification_definitions for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy qualification_versions_select_member on public.qualification_versions for select to authenticated using ((select private.is_active_org_member(org_id)));
create policy qualification_values_select_visible on public.qualification_values for select to authenticated using ((select private.can_access_opportunity(opportunity_id)));
create policy qualification_value_history_select_visible on public.qualification_value_history for select to authenticated using ((select private.can_access_opportunity(opportunity_id)));
create policy qualification_value_requests_select_actor on public.qualification_value_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy qualification_value_requests_insert_visible on public.qualification_value_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.can_access_opportunity(opportunity_id)));
create policy projects_select_knowledge on public.projects for select to authenticated using ((select private.can_view_knowledge(org_id)));
create policy projects_manage on public.projects for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_facts_select_knowledge on public.project_facts for select to authenticated using ((select private.can_view_knowledge(org_id)));
create policy project_facts_manage on public.project_facts for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_media_select_knowledge on public.project_media for select to authenticated using ((select private.can_view_knowledge(org_id)));
create policy project_media_manage on public.project_media for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_entries_select_knowledge on public.faq_entries for select to authenticated using ((select private.can_view_knowledge(org_id)));
create policy faq_entries_manage on public.faq_entries for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_versions_select_knowledge on public.faq_versions for select to authenticated using ((select private.can_view_knowledge(org_id)));
create policy faq_versions_manage on public.faq_versions for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_matches_select_visible on public.project_matches for select to authenticated using ((select private.can_access_opportunity(opportunity_id)));
create policy project_snapshots_select_visible on public.project_snapshots for select to authenticated using (opportunity_id is not null and (select private.can_access_opportunity(opportunity_id)));
create policy project_match_requests_select_actor on public.project_match_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy project_match_requests_insert_visible on public.project_match_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.can_access_opportunity(opportunity_id)));

grant select,insert,update,delete on public.qualification_definitions to authenticated;
grant select on public.qualification_versions,public.qualification_values,public.qualification_value_history to authenticated;
grant select,insert on public.qualification_value_requests to authenticated;
grant select,insert,update,delete on public.projects,public.project_facts,public.project_media,public.faq_entries,public.faq_versions to authenticated;
grant select on public.project_matches,public.project_snapshots to authenticated;
grant select,insert on public.project_match_requests to authenticated;
grant all on public.qualification_definitions,public.qualification_versions,public.qualification_values,
  public.qualification_value_history,public.qualification_value_requests,public.projects,public.project_facts,
  public.project_media,public.faq_entries,public.faq_versions,public.project_matches,
  public.project_snapshots,public.project_match_requests to service_role;

comment on table public.qualification_values is 'Current explainable qualification value; human-confirmed data is never overwritten by AI.';
comment on table public.project_matches is 'Deterministic curation evidence. Price and down payment are hard eligibility criteria.';
comment on table public.faq_versions is 'Published communication guidance; numeric facts remain in structured project fields.';

commit;
