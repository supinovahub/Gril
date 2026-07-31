begin;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'merged', 'archived')),
  preferences jsonb not null default '{}'::jsonb,
  merged_into_contact_id uuid references public.contacts(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (
    (status = 'merged' and merged_into_contact_id is not null and merged_into_contact_id <> id)
    or (status <> 'merged' and merged_into_contact_id is null)
  )
);

create index contacts_org_status_name_idx
  on public.contacts (org_id, status, name);

create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null,
  e164 text not null check (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  original text not null check (char_length(trim(original)) between 8 and 40),
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete cascade,
  unique (id, org_id)
);

create unique index contact_phones_active_e164_org_idx
  on public.contact_phones (org_id, e164)
  where status = 'active';

create unique index contact_phones_primary_contact_idx
  on public.contact_phones (contact_id)
  where is_primary and status = 'active';

create index contact_phones_contact_idx
  on public.contact_phones (contact_id, status);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  position smallint not null check (position between 1 and 9),
  category text not null check (category in ('ai', 'human', 'terminal')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, position),
  unique (id, org_id)
);

create table public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  parent_code text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (id, org_id)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  contact_id uuid not null,
  pipeline_stage_id uuid not null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  title text not null default 'Decisão de compra' check (char_length(trim(title)) between 2 and 160),
  source text not null default 'manual' check (char_length(trim(source)) between 2 and 80),
  persona_code text,
  assigned_membership_id uuid,
  current_conversation_id uuid,
  ai_context text check (ai_context is null or char_length(ai_context) <= 4000),
  internal_note text check (internal_note is null or char_length(internal_note) <= 4000),
  share_context_with_broker boolean not null default false,
  last_activity_at timestamptz not null default now(),
  stage_entered_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict,
  foreign key (pipeline_stage_id, org_id)
    references public.pipeline_stages(id, org_id) on delete restrict,
  foreign key (assigned_membership_id, org_id)
    references public.memberships(id, org_id) on delete restrict,
  unique (id, org_id)
);

create index opportunities_org_operation_stage_idx
  on public.opportunities (org_id, operation_id, pipeline_stage_id, status);

create index opportunities_assignee_activity_idx
  on public.opportunities (assigned_membership_id, last_activity_at desc)
  where assigned_membership_id is not null;

create index opportunities_contact_status_idx
  on public.opportunities (contact_id, status, created_at desc);

create table public.opportunity_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  contact_id uuid not null,
  role text not null default 'co_buyer' check (role in ('primary', 'co_buyer', 'influencer', 'other')),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict,
  unique (opportunity_id, contact_id)
);

create table public.source_attributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid,
  attribution_type text not null check (attribution_type in ('first', 'intermediate', 'last')),
  source text not null,
  medium text,
  campaign text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  attributed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict
);

create index source_attributions_opportunity_idx
  on public.source_attributions (opportunity_id, attributed_at);

create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  score numeric(5,2) not null check (score between 0 and 100),
  explanation jsonb not null default '{}'::jsonb,
  source text not null check (source in ('rule', 'ai', 'human')),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade
);

create index opportunity_scores_latest_idx
  on public.opportunity_scores (opportunity_id, created_at desc);

create table public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  opportunity_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'system', 'ai')),
  reason text,
  call_id uuid,
  opportunity_version integer not null check (opportunity_version > 0),
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (from_stage_id, org_id)
    references public.pipeline_stages(id, org_id) on delete restrict,
  foreign key (to_stage_id, org_id)
    references public.pipeline_stages(id, org_id) on delete restrict
);

create index opportunity_stage_history_timeline_idx
  on public.opportunity_stage_history (opportunity_id, created_at desc);

create table public.next_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  opportunity_id uuid not null,
  owner_membership_id uuid not null,
  description text not null check (char_length(trim(description)) between 2 and 500),
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade,
  foreign key (owner_membership_id, org_id)
    references public.memberships(id, org_id) on delete restrict,
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create index next_actions_owner_due_idx
  on public.next_actions (owner_membership_id, status, due_at);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  opportunity_id uuid not null,
  project_name text,
  value numeric(14,2) check (value is null or value >= 0),
  sale_month smallint not null check (sale_month between 1 and 12),
  sale_year smallint not null check (sale_year between 2020 and 2200),
  responsible_membership_id uuid,
  status text not null default 'confirmed' check (status in ('recorded', 'confirmed', 'cancelled')),
  confirmed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict,
  foreign key (responsible_membership_id, org_id)
    references public.memberships(id, org_id) on delete restrict
);

create unique index sales_one_active_per_opportunity_idx
  on public.sales (opportunity_id)
  where status <> 'cancelled';

create table private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete restrict,
  operation_id uuid references public.operations(id) on delete restrict,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now()
);

create index outbox_events_pending_idx
  on private.outbox_events (available_at, created_at)
  where processed_at is null;

create table public.lead_creation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 160),
  phone_original text not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  source text not null default 'manual',
  assigned_membership_id uuid,
  ai_context text,
  internal_note text,
  share_context_with_broker boolean not null default false,
  desired_action text not null default 'register' check (desired_action in ('register', 'assume', 'request_pedro')),
  authorization_confirmed boolean not null default false,
  contact_id uuid,
  opportunity_id uuid,
  reused_contact boolean not null default false,
  reused_opportunity boolean not null default false,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (assigned_membership_id, org_id)
    references public.memberships(id, org_id) on delete restrict,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict
);

create table public.opportunity_stage_change_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  target_stage_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  expected_version integer not null check (expected_version > 0),
  reason text,
  loss_reason_id uuid,
  sale_project_name text,
  sale_value numeric(14,2) check (sale_value is null or sale_value >= 0),
  sale_month smallint check (sale_month is null or sale_month between 1 and 12),
  sale_year smallint check (sale_year is null or sale_year between 2020 and 2200),
  next_action_description text,
  next_action_due_at timestamptz,
  resulting_version integer,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict,
  foreign key (target_stage_id, org_id)
    references public.pipeline_stages(id, org_id) on delete restrict,
  foreign key (loss_reason_id, org_id)
    references public.loss_reasons(id, org_id) on delete restrict,
  check (
    (next_action_description is null and next_action_due_at is null)
    or (next_action_description is not null and next_action_due_at is not null)
  )
);

create or replace function private.seed_crm_catalogs(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.pipeline_stages (org_id, code, name, position, category)
  values
    (p_org_id, 'new', 'Novo lead', 1, 'ai'),
    (p_org_id, 'in_service', 'Em atendimento', 2, 'ai'),
    (p_org_id, 'call_scheduled', 'Call agendada', 3, 'ai'),
    (p_org_id, 'negotiation', 'Em negociação', 4, 'human'),
    (p_org_id, 'proposal', 'Proposta / Reserva', 5, 'human'),
    (p_org_id, 'documentation', 'Documentação', 6, 'human'),
    (p_org_id, 'payment', 'Pagamento', 7, 'human'),
    (p_org_id, 'won', 'Venda concluída', 8, 'terminal'),
    (p_org_id, 'lost', 'Perdido', 9, 'terminal')
  on conflict (org_id, code) do nothing;

  insert into public.loss_reasons (org_id, code, name, is_system)
  values
    (p_org_id, 'no_response', 'Sem resposta', true),
    (p_org_id, 'no_interest', 'Sem interesse', true),
    (p_org_id, 'budget', 'Orçamento incompatível', true),
    (p_org_id, 'location', 'Localização incompatível', true),
    (p_org_id, 'timing', 'Momento de compra incompatível', true),
    (p_org_id, 'financing', 'Financiamento não aprovado', true),
    (p_org_id, 'competitor', 'Comprou com concorrente', true),
    (p_org_id, 'invalid_contact', 'Contato inválido', true),
    (p_org_id, 'call_no_show', 'Call não aconteceu e o lead não retomou', true),
    (p_org_id, 'other', 'Outro', true)
  on conflict (org_id, code) do nothing;
end;
$$;

revoke all on function private.seed_crm_catalogs(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.seed_crm_catalogs_for_org()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.seed_crm_catalogs(new.id);
  return new;
end;
$$;

revoke all on function private.seed_crm_catalogs_for_org()
  from public, anon, authenticated, service_role;

create trigger organizations_seed_crm_catalogs
after insert on public.organizations
for each row execute function private.seed_crm_catalogs_for_org();

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    perform private.seed_crm_catalogs(v_org_id);
  end loop;
end
$$;

create or replace function private.current_membership_id(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select m.id
  from public.memberships m
  where m.org_id = p_org_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.can_manage_crm(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    private.has_org_role(p_org_id, array['owner']::text[])
    or private.has_org_permission(p_org_id, 'contacts.manage')
    or private.has_org_permission(p_org_id, 'pipeline.manage');
$$;

create or replace function private.can_access_opportunity(p_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.opportunities o
    join public.memberships m
      on m.org_id = o.org_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
    where o.id = p_opportunity_id
      and private.has_operation_access(o.operation_id)
      and (
        m.role in ('owner', 'manager')
        or o.assigned_membership_id = m.id
      )
  );
$$;

create or replace function private.can_access_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.contact_id = p_contact_id
      and private.can_access_opportunity(o.id)
  );
$$;

revoke all on function private.current_membership_id(uuid) from public, anon, service_role;
revoke all on function private.can_manage_crm(uuid) from public, anon, service_role;
revoke all on function private.can_access_opportunity(uuid) from public, anon, service_role;
revoke all on function private.can_access_contact(uuid) from public, anon, service_role;

grant execute on function private.current_membership_id(uuid) to authenticated;
grant execute on function private.can_manage_crm(uuid) to authenticated;
grant execute on function private.can_access_opportunity(uuid) to authenticated;
grant execute on function private.can_access_contact(uuid) to authenticated;

create or replace function private.process_lead_creation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.memberships%rowtype;
  v_contact_id uuid;
  v_opportunity_id uuid;
  v_stage_id uuid;
  v_assignee_id uuid;
  v_contact_reused boolean := false;
  v_opportunity_reused boolean := false;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'lead_creation_actor_mismatch' using errcode = '42501';
  end if;

  select * into v_actor
  from public.memberships m
  where m.org_id = new.org_id
    and m.user_id = (select auth.uid())
    and m.status = 'active';

  if not found or not private.has_operation_access(new.operation_id) then
    raise exception 'lead_creation_forbidden' using errcode = '42501';
  end if;

  if v_actor.role not in ('owner', 'manager', 'broker') then
    raise exception 'lead_creation_forbidden' using errcode = '42501';
  end if;

  if v_actor.role = 'broker' then
    if new.assigned_membership_id is not null and new.assigned_membership_id <> v_actor.id then
      raise exception 'broker_cannot_assign_other_member' using errcode = '42501';
    end if;
    v_assignee_id := v_actor.id;
  else
    v_assignee_id := new.assigned_membership_id;
  end if;

  if v_assignee_id is not null and not exists (
    select 1
    from public.memberships m
    join public.membership_operations mo
      on mo.membership_id = m.id
     and mo.operation_id = new.operation_id
    where m.id = v_assignee_id
      and m.org_id = new.org_id
      and m.status = 'active'
  ) and not exists (
    select 1 from public.memberships m
    where m.id = v_assignee_id
      and m.org_id = new.org_id
      and m.status = 'active'
      and m.role in ('owner', 'manager')
  ) then
    raise exception 'assignee_has_no_operation_access' using errcode = '22023';
  end if;

  if new.desired_action = 'request_pedro' and not new.authorization_confirmed then
    raise exception 'pedro_authorization_required' using errcode = '22023';
  end if;

  select cp.contact_id into v_contact_id
  from public.contact_phones cp
  join public.contacts c on c.id = cp.contact_id
  where cp.org_id = new.org_id
    and cp.e164 = new.phone_e164
    and cp.status = 'active'
    and c.status = 'active'
  for update of cp;

  if found then
    v_contact_reused := true;
    update public.contacts
    set name = case when name = 'Contato sem nome' then trim(new.name) else name end,
        updated_at = now()
    where id = v_contact_id;
  else
    insert into public.contacts (org_id, name, created_by)
    values (new.org_id, trim(new.name), (select auth.uid()))
    returning id into v_contact_id;

    insert into public.contact_phones (
      org_id, contact_id, e164, original, is_primary, created_at, updated_at
    ) values (
      new.org_id, v_contact_id, new.phone_e164, trim(new.phone_original), true, now(), now()
    );
  end if;

  select o.id into v_opportunity_id
  from public.opportunities o
  where o.org_id = new.org_id
    and o.operation_id = new.operation_id
    and o.contact_id = v_contact_id
    and o.status = 'open'
  order by o.created_at desc
  limit 1
  for update;

  if found then
    v_opportunity_reused := true;
    update public.opportunities
    set assigned_membership_id = coalesce(v_assignee_id, assigned_membership_id),
        ai_context = coalesce(nullif(trim(new.ai_context), ''), ai_context),
        internal_note = coalesce(nullif(trim(new.internal_note), ''), internal_note),
        share_context_with_broker = new.share_context_with_broker or share_context_with_broker,
        last_activity_at = now(),
        updated_at = now(),
        version = version + 1
    where id = v_opportunity_id;
  else
    select ps.id into v_stage_id
    from public.pipeline_stages ps
    where ps.org_id = new.org_id and ps.code = 'new';

    insert into public.opportunities (
      org_id, operation_id, contact_id, pipeline_stage_id, source,
      assigned_membership_id, ai_context, internal_note,
      share_context_with_broker, created_by
    ) values (
      new.org_id, new.operation_id, v_contact_id, v_stage_id, trim(new.source),
      v_assignee_id, nullif(trim(new.ai_context), ''), nullif(trim(new.internal_note), ''),
      new.share_context_with_broker, (select auth.uid())
    ) returning id into v_opportunity_id;

    insert into public.opportunity_stage_history (
      org_id, operation_id, opportunity_id, to_stage_id,
      actor_user_id, reason, opportunity_version
    ) values (
      new.org_id, new.operation_id, v_opportunity_id, v_stage_id,
      (select auth.uid()), 'Oportunidade criada', 1
    );
  end if;

  insert into public.source_attributions (
    org_id, operation_id, contact_id, opportunity_id,
    attribution_type, source, created_by
  ) values (
    new.org_id, new.operation_id, v_contact_id, v_opportunity_id,
    case when v_contact_reused then 'last' else 'first' end,
    trim(new.source), (select auth.uid())
  );

  insert into private.outbox_events (
    org_id, operation_id, event_type, aggregate_type,
    aggregate_id, payload, idempotency_key
  ) values (
    new.org_id,
    new.operation_id,
    case when new.desired_action = 'request_pedro'
      then 'conversation.start_requested.v1'
      else 'opportunity.created_or_reused.v1'
    end,
    'opportunity',
    v_opportunity_id,
    jsonb_build_object(
      'contact_id', v_contact_id,
      'desired_action', new.desired_action,
      'reused_contact', v_contact_reused,
      'reused_opportunity', v_opportunity_reused
    ),
    'lead-create:' || new.id::text
  );

  insert into audit.events (
    org_id, operation_id, actor_user_id, action,
    entity_type, entity_id, metadata
  ) values (
    new.org_id, new.operation_id, (select auth.uid()), 'lead.created_or_reused',
    'opportunities', v_opportunity_id,
    jsonb_build_object('contact_id', v_contact_id, 'request_id', new.id)
  );

  new.contact_id := v_contact_id;
  new.opportunity_id := v_opportunity_id;
  new.reused_contact := v_contact_reused;
  new.reused_opportunity := v_opportunity_reused;
  new.assigned_membership_id := v_assignee_id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_lead_creation_request()
  from public, anon, authenticated, service_role;

create trigger lead_creation_request_process
before insert on public.lead_creation_requests
for each row execute function private.process_lead_creation_request();

create or replace function private.process_stage_change_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_actor public.memberships%rowtype;
  v_from public.pipeline_stages%rowtype;
  v_to public.pipeline_stages%rowtype;
  v_allowed boolean := false;
  v_new_status text := 'open';
  v_new_version integer;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'stage_change_actor_mismatch' using errcode = '42501';
  end if;

  select * into v_opportunity
  from public.opportunities o
  where o.id = new.opportunity_id
  for update;

  if not found or v_opportunity.org_id <> new.org_id then
    raise exception 'opportunity_not_found' using errcode = '22023';
  end if;

  if not private.can_access_opportunity(v_opportunity.id) then
    raise exception 'stage_change_forbidden' using errcode = '42501';
  end if;

  if v_opportunity.version <> new.expected_version then
    raise exception 'opportunity_version_conflict' using errcode = '40001';
  end if;

  if v_opportunity.status = 'won' then
    raise exception 'won_opportunity_is_immutable' using errcode = '22023';
  end if;

  select * into v_actor
  from public.memberships m
  where m.org_id = new.org_id
    and m.user_id = (select auth.uid())
    and m.status = 'active';

  select * into v_from from public.pipeline_stages where id = v_opportunity.pipeline_stage_id;
  select * into v_to from public.pipeline_stages where id = new.target_stage_id;

  if not found or v_to.org_id <> new.org_id then
    raise exception 'target_stage_not_found' using errcode = '22023';
  end if;

  if v_from.id = v_to.id then
    raise exception 'opportunity_already_in_stage' using errcode = '22023';
  end if;

  v_allowed :=
    (v_from.code = 'new' and v_to.code in ('in_service', 'lost'))
    or (v_from.code = 'in_service' and v_to.code in ('call_scheduled', 'lost'))
    or (v_from.code = 'call_scheduled' and v_to.code in ('negotiation', 'lost'))
    or (v_from.code = 'negotiation' and v_to.code in ('proposal', 'lost'))
    or (v_from.code = 'proposal' and v_to.code in ('documentation', 'lost'))
    or (v_from.code = 'documentation' and v_to.code in ('payment', 'lost'))
    or (v_from.code = 'payment' and v_to.code in ('won', 'lost'))
    or (v_from.code = 'lost' and v_to.code = 'in_service' and v_actor.role in ('owner', 'manager'))
    or (
      v_actor.role in ('owner', 'manager')
      and v_to.position = v_from.position - 1
      and new.reason is not null
      and char_length(trim(new.reason)) >= 5
    );

  if not v_allowed then
    raise exception 'invalid_stage_transition:%->%', v_from.code, v_to.code using errcode = '22023';
  end if;

  if v_actor.role = 'broker' and v_to.position < 3 then
    raise exception 'broker_cannot_move_to_ai_stage' using errcode = '42501';
  end if;

  if v_to.code = 'lost' then
    if new.loss_reason_id is null or not exists (
      select 1 from public.loss_reasons lr
      where lr.id = new.loss_reason_id and lr.org_id = new.org_id and lr.is_active
    ) then
      raise exception 'active_loss_reason_required' using errcode = '22023';
    end if;
    v_new_status := 'lost';
  elsif v_to.code = 'won' then
    if new.sale_month is null or new.sale_year is null then
      raise exception 'sale_month_and_year_required' using errcode = '22023';
    end if;
    v_new_status := 'won';
  else
    v_new_status := 'open';
  end if;

  v_new_version := v_opportunity.version + 1;

  update public.opportunities
  set pipeline_stage_id = v_to.id,
      status = v_new_status,
      stage_entered_at = now(),
      last_activity_at = now(),
      version = v_new_version,
      updated_at = now()
  where id = v_opportunity.id;

  insert into public.opportunity_stage_history (
    org_id, operation_id, opportunity_id, from_stage_id, to_stage_id,
    actor_user_id, reason, opportunity_version
  ) values (
    v_opportunity.org_id, v_opportunity.operation_id, v_opportunity.id,
    v_from.id, v_to.id, (select auth.uid()),
    coalesce(nullif(trim(new.reason), ''), case when v_to.code = 'lost' then 'Oportunidade perdida' else null end),
    v_new_version
  );

  if v_to.code = 'won' then
    insert into public.sales (
      org_id, operation_id, opportunity_id, project_name, value,
      sale_month, sale_year, responsible_membership_id, created_by
    ) values (
      v_opportunity.org_id, v_opportunity.operation_id, v_opportunity.id,
      nullif(trim(new.sale_project_name), ''), new.sale_value,
      new.sale_month, new.sale_year,
      v_opportunity.assigned_membership_id, (select auth.uid())
    );
  end if;

  if new.next_action_description is not null then
    insert into public.next_actions (
      org_id, operation_id, opportunity_id, owner_membership_id,
      description, due_at, created_by
    ) values (
      v_opportunity.org_id, v_opportunity.operation_id, v_opportunity.id,
      coalesce(v_opportunity.assigned_membership_id, v_actor.id),
      trim(new.next_action_description), new.next_action_due_at, (select auth.uid())
    );
  end if;

  if v_new_status in ('won', 'lost') then
    update public.next_actions
    set status = 'cancelled', updated_at = now()
    where opportunity_id = v_opportunity.id and status = 'open';
  end if;

  insert into private.outbox_events (
    org_id, operation_id, event_type, aggregate_type,
    aggregate_id, payload, idempotency_key
  ) values (
    v_opportunity.org_id, v_opportunity.operation_id,
    'opportunity.stage_changed.v1', 'opportunity', v_opportunity.id,
    jsonb_build_object(
      'from', v_from.code, 'to', v_to.code,
      'version', v_new_version, 'loss_reason_id', new.loss_reason_id
    ),
    'stage-change:' || new.id::text
  );

  insert into audit.events (
    org_id, operation_id, actor_user_id, action,
    entity_type, entity_id, metadata
  ) values (
    v_opportunity.org_id, v_opportunity.operation_id, (select auth.uid()),
    'opportunity.stage_changed', 'opportunities', v_opportunity.id,
    jsonb_build_object('from', v_from.code, 'to', v_to.code, 'version', v_new_version)
  );

  new.resulting_version := v_new_version;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_stage_change_request()
  from public, anon, authenticated, service_role;

create trigger opportunity_stage_change_request_process
before insert on public.opportunity_stage_change_requests
for each row execute function private.process_stage_change_request();

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function private.set_updated_at();

create trigger contact_phones_set_updated_at
before update on public.contact_phones
for each row execute function private.set_updated_at();

create trigger loss_reasons_set_updated_at
before update on public.loss_reasons
for each row execute function private.set_updated_at();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function private.set_updated_at();

create trigger next_actions_set_updated_at
before update on public.next_actions
for each row execute function private.set_updated_at();

create trigger sales_set_updated_at
before update on public.sales
for each row execute function private.set_updated_at();

alter table public.contacts enable row level security;
alter table public.contact_phones enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.loss_reasons enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_participants enable row level security;
alter table public.source_attributions enable row level security;
alter table public.opportunity_scores enable row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.next_actions enable row level security;
alter table public.sales enable row level security;
alter table public.lead_creation_requests enable row level security;
alter table public.opportunity_stage_change_requests enable row level security;

create policy contacts_select_visible
on public.contacts for select to authenticated
using ((select private.can_access_contact(id)));

create policy contact_phones_select_visible
on public.contact_phones for select to authenticated
using ((select private.can_access_contact(contact_id)));

create policy pipeline_stages_select_member
on public.pipeline_stages for select to authenticated
using ((select private.is_active_org_member(org_id)));

create policy loss_reasons_select_member
on public.loss_reasons for select to authenticated
using ((select private.is_active_org_member(org_id)));

create policy loss_reasons_manage
on public.loss_reasons for all to authenticated
using ((select private.can_manage_crm(org_id)) and not is_system)
with check ((select private.can_manage_crm(org_id)) and not is_system);

create policy opportunities_select_visible
on public.opportunities for select to authenticated
using ((select private.can_access_opportunity(id)));

create policy opportunity_participants_select_visible
on public.opportunity_participants for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy source_attributions_select_visible
on public.source_attributions for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy opportunity_scores_select_visible
on public.opportunity_scores for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy opportunity_stage_history_select_visible
on public.opportunity_stage_history for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy next_actions_select_visible
on public.next_actions for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy next_actions_update_owner
on public.next_actions for update to authenticated
using (
  (select private.can_access_opportunity(opportunity_id))
  and (
    owner_membership_id = (select private.current_membership_id(org_id))
    or (select private.can_manage_crm(org_id))
  )
)
with check ((select private.can_access_opportunity(opportunity_id)));

create policy sales_select_visible
on public.sales for select to authenticated
using ((select private.can_access_opportunity(opportunity_id)));

create policy lead_creation_requests_select_actor
on public.lead_creation_requests for select to authenticated
using (actor_user_id = (select auth.uid()) or (select private.can_manage_crm(org_id)));

create policy lead_creation_requests_insert_actor
on public.lead_creation_requests for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select private.has_operation_access(operation_id))
);

create policy opportunity_stage_change_requests_select_actor
on public.opportunity_stage_change_requests for select to authenticated
using (actor_user_id = (select auth.uid()) or (select private.can_manage_crm(org_id)));

create policy opportunity_stage_change_requests_insert_actor
on public.opportunity_stage_change_requests for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select private.can_access_opportunity(opportunity_id))
);

grant select on public.contacts to authenticated;
grant select on public.contact_phones to authenticated;
grant select on public.pipeline_stages to authenticated;
grant select, insert, update, delete on public.loss_reasons to authenticated;
grant select on public.opportunities to authenticated;
grant select on public.opportunity_participants to authenticated;
grant select on public.source_attributions to authenticated;
grant select on public.opportunity_scores to authenticated;
grant select on public.opportunity_stage_history to authenticated;
grant select, update on public.next_actions to authenticated;
grant select on public.sales to authenticated;
grant select, insert on public.lead_creation_requests to authenticated;
grant select, insert on public.opportunity_stage_change_requests to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;

comment on table public.contacts is
  'Canonical people. A contact may own multiple independent purchase opportunities.';
comment on table public.lead_creation_requests is
  'Insert-only atomic command that normalizes reuse, attribution, opportunity creation, audit and outbox.';
comment on table public.opportunity_stage_change_requests is
  'Insert-only optimistic command. Direct opportunity stage updates are intentionally not granted.';
comment on table private.outbox_events is
  'Transactional event outbox outside the Data API; consumers must be idempotent.';

commit;
