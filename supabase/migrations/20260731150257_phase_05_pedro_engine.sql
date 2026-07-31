begin;

create table public.organization_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  ai_global_mode text not null default 'off' check (ai_global_mode in ('off', 'shadow', 'assisted', 'production')),
  ai_monthly_budget numeric(12,2) check (ai_monthly_budget is null or ai_monthly_budget >= 0),
  institutional_profile jsonb not null default '{}'::jsonb,
  brand_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operation_settings (
  operation_id uuid primary key,
  org_id uuid not null,
  business_hours jsonb not null default '{"timezone":"America/Sao_Paulo","days":{}}'::jsonb,
  proactive_openings_per_minute smallint not null default 1 check (proactive_openings_per_minute between 1 and 10),
  default_persona_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  identity_name text not null check (char_length(trim(identity_name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (id, org_id)
);

alter table public.operation_settings
  add constraint operation_settings_default_persona_id_fkey
  foreign key (default_persona_id, org_id)
  references public.personas(id, org_id) on delete set null;

create table public.persona_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  persona_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  identity jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  boundaries jsonb not null default '{}'::jsonb,
  escalation_rules jsonb not null default '{}'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  compiled_prompt text not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  source_version_id uuid references public.persona_versions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (persona_id, org_id)
    references public.personas(id, org_id) on delete cascade,
  unique (persona_id, version),
  unique (id, org_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index persona_versions_one_published_idx
  on public.persona_versions (persona_id)
  where status = 'published';

create table public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code),
  unique (id, org_id)
);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_set_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rules jsonb not null,
  compiled_rules jsonb not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rule_set_id, org_id)
    references public.rule_sets(id, org_id) on delete cascade,
  unique (rule_set_id, version),
  unique (id, org_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index rule_versions_one_published_idx
  on public.rule_versions (rule_set_id)
  where status = 'published';

create table public.model_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'openai' check (provider = 'openai'),
  model_identifier text not null,
  name text not null,
  workload_role text not null check (workload_role in ('quality', 'balanced', 'extraction', 'simulation')),
  endpoint text not null default 'responses' check (endpoint = 'responses'),
  reasoning_effort text check (reasoning_effort is null or reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  text_verbosity text not null default 'low' check (text_verbosity in ('low', 'medium', 'high')),
  secret_reference text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, model_identifier, workload_role),
  unique (id, org_id),
  check (status <> 'active' or secret_reference is not null)
);

create unique index model_profiles_one_default_idx
  on public.model_profiles (org_id)
  where is_default and status = 'active';

create table public.contact_persona_bindings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  persona_id uuid not null,
  source text not null check (source in ('default', 'campaign', 'experiment', 'manual')),
  bound_at timestamptz not null default now(),
  unbound_at timestamptz,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete cascade,
  foreign key (persona_id, org_id)
    references public.personas(id, org_id) on delete restrict
);

create unique index contact_persona_bindings_active_idx
  on public.contact_persona_bindings (contact_id)
  where unbound_at is null;

create table public.conversation_context_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  version integer not null check (version > 0),
  persona_version_id uuid not null,
  rule_version_id uuid not null,
  qualification_version_id uuid,
  project_snapshot_ids uuid[] not null default '{}',
  institutional_snapshot jsonb not null default '{}'::jsonb,
  frozen boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade,
  foreign key (persona_version_id, org_id)
    references public.persona_versions(id, org_id) on delete restrict,
  foreign key (rule_version_id, org_id)
    references public.rule_versions(id, org_id) on delete restrict,
  unique (conversation_id, version),
  unique (id, org_id)
);

create table public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  conversation_id uuid,
  request_message_id uuid,
  context_version_id uuid,
  model_profile_id uuid,
  mode text not null check (mode in ('shadow', 'assisted', 'production', 'simulator', 'regression')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'superseded', 'blocked')),
  expected_conversation_version integer,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_text text,
  output_structured jsonb,
  response_id text,
  model_returned text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(14,6) check (estimated_cost is null or estimated_cost >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  error_redacted text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete restrict,
  foreign key (request_message_id, org_id)
    references public.messages(id, org_id) on delete restrict,
  foreign key (context_version_id, org_id)
    references public.conversation_context_versions(id, org_id) on delete restrict,
  foreign key (model_profile_id, org_id)
    references public.model_profiles(id, org_id) on delete restrict,
  unique (id, org_id)
);

create index ai_executions_conversation_idx
  on public.ai_executions (conversation_id, created_at desc);
create index ai_executions_queue_idx
  on public.ai_executions (status, created_at) where status in ('queued', 'running');

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  conversation_id uuid,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected', 'superseded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (execution_id, org_id)
    references public.ai_executions(id, org_id) on delete cascade,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade
);

create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  conversation_id uuid,
  opportunity_id uuid,
  category text not null,
  severity text not null check (severity in ('silent', 'normal', 'immediate', 'critical')),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'claimed', 'resolved')),
  claimed_by uuid references public.memberships(id) on delete set null,
  claimed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete cascade
);

create index escalations_open_idx on public.escalations (org_id, operation_id, severity, created_at)
where status <> 'resolved';

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  execution_id uuid,
  usage_type text not null check (usage_type in ('service', 'campaign', 'simulator', 'regression')),
  model_identifier text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost numeric(14,6) not null default 0 check (estimated_cost >= 0),
  recorded_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (execution_id, org_id)
    references public.ai_executions(id, org_id) on delete restrict
);

create index usage_ledger_org_month_idx on public.usage_ledger (org_id, recorded_at desc);

create table public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  threshold_percent smallint not null check (threshold_percent in (50, 80, 100, 120)),
  period_start date not null,
  status text not null default 'open' check (status in ('open', 'acknowledged')),
  current_cost numeric(14,2) not null,
  budget numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (org_id, threshold_percent, period_start)
);

create table public.persona_publish_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  persona_version_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (persona_version_id, org_id)
    references public.persona_versions(id, org_id) on delete restrict
);

create table public.model_activation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  model_profile_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (model_profile_id, org_id)
    references public.model_profiles(id, org_id) on delete restrict
);

create table public.ai_execution_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  conversation_id uuid,
  request_message_id uuid,
  mode text not null check (mode in ('shadow', 'assisted', 'production', 'simulator', 'regression')),
  expected_conversation_version integer,
  input_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  actor_user_id uuid references auth.users(id) on delete restrict default auth.uid(),
  execution_id uuid,
  result text check (result in ('queued', 'blocked')),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete restrict,
  foreign key (request_message_id, org_id)
    references public.messages(id, org_id) on delete restrict,
  foreign key (execution_id, org_id)
    references public.ai_executions(id, org_id) on delete restrict,
  unique (org_id, idempotency_key)
);

create or replace function private.seed_pedro_package(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_persona_id uuid;
  v_rule_set_id uuid;
  v_persona_version_id uuid;
  v_rule_version_id uuid;
  v_prompt text;
begin
  insert into public.organization_settings (org_id) values (p_org_id)
  on conflict (org_id) do nothing;

  insert into public.personas (org_id, code, name, identity_name)
  values (p_org_id, 'pedro', 'Pedro — SDR imobiliário', 'Pedro')
  on conflict (org_id, code) do update set name = excluded.name
  returning id into v_persona_id;

  v_prompt := 'Você é Pedro, SDR imobiliário em português brasileiro. ' ||
    'Conduza o lead com naturalidade até uma call qualificada. ' ||
    'Use somente fatos aprovados no contexto. Nunca invente preço, disponibilidade, rentabilidade, experiência pessoal ou características. ' ||
    'Não negocie desconto, não reserve unidade, não prometa crédito, não envie instruções de pagamento, não peça documentos sensíveis e não revele ser IA. ' ||
    'Pedidos de opt-out bloqueiam mensagens; privacidade, ameaça, fraude, questão jurídica, imprensa, discriminação ou idioma não suportado exigem escalada sem continuar automaticamente. ' ||
    'Responda de forma humana, curta e variada. Preserve nomes, valores, datas e horários exatamente. ' ||
    'Quando faltar fato aprovado, sinalize a necessidade de um responsável em vez de adivinhar.';

  select id into v_persona_version_id from public.persona_versions
  where persona_id = v_persona_id and status = 'published';
  if v_persona_version_id is null then
    insert into public.persona_versions (
      org_id, persona_id, version, status, identity, style, boundaries,
      escalation_rules, examples, compiled_prompt, checksum, published_at
    ) values (
      p_org_id, v_persona_id, 1, 'published',
      '{"name":"Pedro","role":"SDR imobiliário","language":"pt-BR"}',
      '{"tone":"natural, informal e humano","short_bubbles":true,"humor":"adaptive"}',
      '{"no_invention":true,"no_sensitive_documents":true,"no_payment_instructions":true,"no_discrimination":true}',
      '{"privacy":"immediate_silent","fraud":"immediate","legal":"immediate","unsupported_language":"pause"}',
      '[]', v_prompt, encode(extensions.digest(convert_to(v_prompt, 'UTF8'), 'sha256'), 'hex'), now()
    ) returning id into v_persona_version_id;
  end if;

  insert into public.rule_sets (org_id, code, name)
  values (p_org_id, 'core', 'Regras operacionais do Pedro')
  on conflict (org_id, code) do update set name = excluded.name
  returning id into v_rule_set_id;

  select id into v_rule_version_id from public.rule_versions
  where rule_set_id = v_rule_set_id and status = 'published';
  if v_rule_version_id is null then
    insert into public.rule_versions (
      org_id, rule_set_id, version, status, rules, compiled_rules, checksum, published_at
    ) values (
      p_org_id, v_rule_set_id, 1, 'published',
      '{"language":"pt-BR","capacity":{"proactive_pause":25,"absolute":30},"opt_out":"immediate","human_ownership":"no_auto_send"}',
      '{"language":"pt-BR","capacity":{"proactive_pause":25,"absolute":30},"opt_out":"immediate","human_ownership":"no_auto_send"}',
      encode(extensions.digest(convert_to('{"language":"pt-BR","capacity":{"proactive_pause":25,"absolute":30},"opt_out":"immediate","human_ownership":"no_auto_send"}', 'UTF8'), 'sha256'), 'hex'),
      now()
    ) returning id into v_rule_version_id;
  end if;

  insert into public.model_profiles (
    org_id, model_identifier, name, workload_role, reasoning_effort, text_verbosity, status, is_default
  ) values
    (p_org_id, 'gpt-5.6-sol', 'OpenAI GPT-5.6 Sol', 'quality', 'medium', 'low', 'draft', true),
    (p_org_id, 'gpt-5.6-terra', 'OpenAI GPT-5.6 Terra', 'balanced', 'low', 'low', 'draft', false),
    (p_org_id, 'gpt-5.6-luna', 'OpenAI GPT-5.6 Luna', 'extraction', 'none', 'low', 'draft', false)
  on conflict (org_id, model_identifier, workload_role) do nothing;
end;
$$;
revoke all on function private.seed_pedro_package(uuid) from public, anon, authenticated, service_role;

create or replace function private.seed_pedro_for_org()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin perform private.seed_pedro_package(new.id); return new; end; $$;
revoke all on function private.seed_pedro_for_org() from public, anon, authenticated, service_role;
create trigger organizations_seed_pedro after insert on public.organizations
for each row execute function private.seed_pedro_for_org();

create or replace function private.seed_operation_ai_settings()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_persona_id uuid;
begin
  select id into v_persona_id from public.personas where org_id = new.org_id and code = 'pedro';
  insert into public.operation_settings (operation_id, org_id, default_persona_id)
  values (new.id, new.org_id, v_persona_id) on conflict (operation_id) do nothing;
  return new;
end; $$;
revoke all on function private.seed_operation_ai_settings() from public, anon, authenticated, service_role;
create trigger operations_seed_ai_settings after insert on public.operations
for each row execute function private.seed_operation_ai_settings();

do $$ declare v_org_id uuid; begin
  for v_org_id in select id from public.organizations loop perform private.seed_pedro_package(v_org_id); end loop;
end $$;

insert into public.operation_settings (operation_id, org_id, default_persona_id)
select o.id, o.org_id, p.id from public.operations o
join public.personas p on p.org_id=o.org_id and p.code='pedro'
on conflict (operation_id) do nothing;

create or replace function private.bind_conversation_context()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_persona_version_id uuid; v_rule_version_id uuid; v_profile jsonb;
begin
  select pv.id into v_persona_version_id
  from public.operation_settings os
  join public.persona_versions pv on pv.persona_id=os.default_persona_id and pv.status='published'
  where os.operation_id=new.operation_id;
  select rv.id into v_rule_version_id
  from public.rule_sets rs join public.rule_versions rv on rv.rule_set_id=rs.id and rv.status='published'
  where rs.org_id=new.org_id and rs.code='core';
  select institutional_profile into v_profile from public.organization_settings where org_id=new.org_id;
  if v_persona_version_id is not null and v_rule_version_id is not null then
    insert into public.conversation_context_versions (
      org_id, conversation_id, version, persona_version_id, rule_version_id, institutional_snapshot
    ) values (new.org_id, new.id, 1, v_persona_version_id, v_rule_version_id, coalesce(v_profile,'{}'));
  end if;
  return new;
end; $$;
revoke all on function private.bind_conversation_context() from public, anon, authenticated, service_role;
create trigger conversations_bind_context after insert on public.conversations
for each row execute function private.bind_conversation_context();

insert into public.conversation_context_versions (
  org_id, conversation_id, version, persona_version_id, rule_version_id, institutional_snapshot
)
select c.org_id, c.id, 1, pv.id, rv.id, s.institutional_profile
from public.conversations c
join public.operation_settings os on os.operation_id=c.operation_id
join public.persona_versions pv on pv.persona_id=os.default_persona_id and pv.status='published'
join public.rule_sets rs on rs.org_id=c.org_id and rs.code='core'
join public.rule_versions rv on rv.rule_set_id=rs.id and rv.status='published'
join public.organization_settings s on s.org_id=c.org_id
where not exists (select 1 from public.conversation_context_versions cv where cv.conversation_id=c.id);

create or replace function private.process_persona_publish_request()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_version public.persona_versions%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid())
     or not private.has_org_role(new.org_id, array['owner']::text[]) then
    raise exception 'persona_publish_forbidden' using errcode='42501';
  end if;
  select * into v_version from public.persona_versions where id=new.persona_version_id for update;
  if not found or v_version.org_id<>new.org_id or v_version.status<>'draft' then
    raise exception 'persona_draft_required' using errcode='22023';
  end if;
  update public.persona_versions set status='archived', updated_at=now()
  where persona_id=v_version.persona_id and status='published';
  update public.persona_versions set status='published', published_at=now(), published_by=(select auth.uid()), updated_at=now()
  where id=v_version.id;
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,(select auth.uid()),'persona.version_published','persona_versions',v_version.id,jsonb_build_object('version',v_version.version));
  new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_persona_publish_request() from public, anon, authenticated, service_role;
create trigger persona_publish_request_process before insert on public.persona_publish_requests
for each row execute function private.process_persona_publish_request();

create or replace function private.process_model_activation_request()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_profile public.model_profiles%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.has_org_role(new.org_id,array['owner']::text[]) then
    raise exception 'model_activation_forbidden' using errcode='42501';
  end if;
  select * into v_profile from public.model_profiles where id=new.model_profile_id for update;
  if not found or v_profile.org_id<>new.org_id or nullif(trim(v_profile.secret_reference),'') is null then
    raise exception 'model_secret_reference_required' using errcode='22023';
  end if;
  update public.model_profiles set is_default=false, status=case when status='active' then 'paused' else status end, updated_at=now()
  where org_id=new.org_id and id<>v_profile.id and is_default;
  update public.model_profiles set status='active',is_default=true,updated_at=now() where id=v_profile.id;
  new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_model_activation_request() from public, anon, authenticated, service_role;
create trigger model_activation_request_process before insert on public.model_activation_requests
for each row execute function private.process_model_activation_request();

create or replace function private.process_ai_execution_request()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_conversation public.conversations%rowtype;
  v_model public.model_profiles%rowtype;
  v_context_id uuid;
  v_execution_id uuid;
  v_block_reason text;
  v_is_service boolean := (select auth.role())='service_role';
begin
  if not v_is_service then
    if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
       or new.mode not in ('simulator','regression')
       or not private.has_org_permission(new.org_id,'ai.manage') then
      raise exception 'ai_execution_forbidden' using errcode='42501';
    end if;
  end if;

  select * into v_model from public.model_profiles
  where org_id=new.org_id and status='active' and is_default limit 1;
  if not found then v_block_reason:='active_model_and_secret_required'; end if;

  if new.conversation_id is not null then
    select * into v_conversation from public.conversations c where c.id=new.conversation_id for update;
    if not found or v_conversation.org_id<>new.org_id then raise exception 'conversation_not_found' using errcode='22023'; end if;
    select id into v_context_id from public.conversation_context_versions
    where conversation_id=v_conversation.id order by version desc limit 1;
    if new.expected_conversation_version is not null and new.expected_conversation_version<>v_conversation.version then
      v_block_reason:='conversation_version_conflict';
    end if;
    if new.mode='production' and (
      v_conversation.ai_mode<>'production' or v_conversation.ownership<>'ai' or v_conversation.status<>'active'
      or not exists (select 1 from private.capacity_reservations r where r.conversation_id=v_conversation.id and r.status='active')
      or exists (select 1 from public.opt_outs o where o.contact_id=v_conversation.contact_id and o.operation_id=v_conversation.operation_id and o.revoked_at is null)
      or exists (select 1 from public.system_pauses p where p.org_id=new.org_id and p.active and p.scope_type in ('global','organization'))
    ) then v_block_reason:='production_preconditions_failed'; end if;
  end if;

  insert into public.ai_executions (
    org_id,operation_id,conversation_id,request_message_id,context_version_id,model_profile_id,
    mode,status,expected_conversation_version,input_snapshot,error_code,error_redacted
  ) values (
    new.org_id,new.operation_id,new.conversation_id,new.request_message_id,v_context_id,v_model.id,
    new.mode,case when v_block_reason is null then 'queued' else 'blocked' end,
    new.expected_conversation_version,new.input_snapshot,v_block_reason,v_block_reason
  ) returning id into v_execution_id;

  if v_block_reason is null then
    insert into private.outbox_events (org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values (new.org_id,new.operation_id,'ai.execution_requested.v1','ai_execution',v_execution_id,
            jsonb_build_object('execution_id',v_execution_id,'mode',new.mode),new.idempotency_key);
  end if;
  new.execution_id:=v_execution_id;
  new.result:=case when v_block_reason is null then 'queued' else 'blocked' end;
  new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_ai_execution_request() from public, anon, authenticated, service_role;
create trigger ai_execution_request_process before insert on public.ai_execution_requests
for each row execute function private.process_ai_execution_request();

create trigger organization_settings_set_updated_at before update on public.organization_settings for each row execute function private.set_updated_at();
create trigger operation_settings_set_updated_at before update on public.operation_settings for each row execute function private.set_updated_at();
create trigger personas_set_updated_at before update on public.personas for each row execute function private.set_updated_at();
create trigger persona_versions_set_updated_at before update on public.persona_versions for each row execute function private.set_updated_at();
create trigger rule_sets_set_updated_at before update on public.rule_sets for each row execute function private.set_updated_at();
create trigger rule_versions_set_updated_at before update on public.rule_versions for each row execute function private.set_updated_at();
create trigger model_profiles_set_updated_at before update on public.model_profiles for each row execute function private.set_updated_at();

alter table public.organization_settings enable row level security;
alter table public.operation_settings enable row level security;
alter table public.personas enable row level security;
alter table public.persona_versions enable row level security;
alter table public.rule_sets enable row level security;
alter table public.rule_versions enable row level security;
alter table public.model_profiles enable row level security;
alter table public.contact_persona_bindings enable row level security;
alter table public.conversation_context_versions enable row level security;
alter table public.ai_executions enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.escalations enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.budget_alerts enable row level security;
alter table public.persona_publish_requests enable row level security;
alter table public.model_activation_requests enable row level security;
alter table public.ai_execution_requests enable row level security;

create policy organization_settings_select_member on public.organization_settings for select to authenticated using ((select private.is_active_org_member(org_id)));
create policy organization_settings_update_owner on public.organization_settings for update to authenticated using ((select private.has_org_role(org_id,array['owner']::text[]))) with check ((select private.has_org_role(org_id,array['owner']::text[])));
create policy operation_settings_select_member on public.operation_settings for select to authenticated using ((select private.has_operation_access(operation_id)));
create policy operation_settings_update_manager on public.operation_settings for update to authenticated using ((select private.has_org_permission(org_id,'settings.manage'))) with check ((select private.has_org_permission(org_id,'settings.manage')));
create policy personas_select_manager on public.personas for select to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));
create policy personas_manage_manager on public.personas for all to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy persona_versions_select_manager on public.persona_versions for select to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));
create policy persona_versions_insert_manager on public.persona_versions for insert to authenticated with check (status='draft' and (select private.has_org_permission(org_id,'ai.manage')));
create policy persona_versions_update_draft on public.persona_versions for update to authenticated using (status='draft' and (select private.has_org_permission(org_id,'ai.manage'))) with check (status='draft' and (select private.has_org_permission(org_id,'ai.manage')));
create policy rule_sets_select_manager on public.rule_sets for select to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));
create policy rule_versions_select_manager on public.rule_versions for select to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));
create policy model_profiles_select_manager on public.model_profiles for select to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));
create policy model_profiles_update_owner on public.model_profiles for update to authenticated
using (status='draft' and (select private.has_org_role(org_id,array['owner']::text[])))
with check (status='draft' and (select private.has_org_role(org_id,array['owner']::text[])));
create policy conversation_context_versions_select_visible on public.conversation_context_versions for select to authenticated using ((select private.can_access_conversation(conversation_id)));
create policy ai_executions_select_visible on public.ai_executions for select to authenticated using ((conversation_id is not null and (select private.can_access_conversation(conversation_id))) or (select private.has_org_permission(org_id,'ai.manage')));
create policy ai_suggestions_select_visible on public.ai_suggestions for select to authenticated using ((conversation_id is not null and (select private.can_access_conversation(conversation_id))) or (select private.has_org_permission(org_id,'ai.manage')));
create policy ai_suggestions_update_visible on public.ai_suggestions for update to authenticated using (conversation_id is not null and (select private.can_access_conversation(conversation_id))) with check (conversation_id is not null and (select private.can_access_conversation(conversation_id)));
create policy escalations_select_member on public.escalations for select to authenticated using ((select private.has_operation_access(operation_id)));
create policy escalations_update_manager on public.escalations for update to authenticated using ((select private.has_org_role(org_id,array['owner','manager']::text[]))) with check ((select private.has_org_role(org_id,array['owner','manager']::text[])));
create policy usage_ledger_select_owner on public.usage_ledger for select to authenticated using ((select private.has_org_role(org_id,array['owner']::text[])));
create policy budget_alerts_select_owner on public.budget_alerts for select to authenticated using ((select private.has_org_role(org_id,array['owner']::text[])));
create policy persona_publish_requests_select_actor on public.persona_publish_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy persona_publish_requests_insert_owner on public.persona_publish_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_role(org_id,array['owner']::text[])));
create policy model_activation_requests_select_actor on public.model_activation_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy model_activation_requests_insert_owner on public.model_activation_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_role(org_id,array['owner']::text[])));
create policy ai_execution_requests_select_actor on public.ai_execution_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy ai_execution_requests_insert_simulator on public.ai_execution_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and mode in ('simulator','regression') and (select private.has_org_permission(org_id,'ai.manage')));

grant select,update on public.organization_settings,public.operation_settings to authenticated;
grant select,insert,update,delete on public.personas to authenticated;
grant select,insert,update on public.persona_versions to authenticated;
grant select on public.rule_sets,public.rule_versions,public.model_profiles to authenticated;
grant update on public.model_profiles to authenticated;
grant select on public.contact_persona_bindings,public.conversation_context_versions,public.ai_executions to authenticated;
grant select,update on public.ai_suggestions,public.escalations to authenticated;
grant select on public.usage_ledger,public.budget_alerts to authenticated;
grant select,insert on public.persona_publish_requests,public.model_activation_requests,public.ai_execution_requests to authenticated;
grant all on public.organization_settings,public.operation_settings,public.personas,public.persona_versions,
  public.rule_sets,public.rule_versions,public.model_profiles,public.contact_persona_bindings,
  public.conversation_context_versions,public.ai_executions,public.ai_suggestions,public.escalations,
  public.usage_ledger,public.budget_alerts,public.persona_publish_requests,
  public.model_activation_requests,public.ai_execution_requests to service_role;

comment on table public.conversation_context_versions is 'Frozen persona/rules/institutional snapshot used to reproduce each AI decision.';
comment on table public.model_profiles is 'Provider configuration only. API keys live in Supabase secrets and are referenced by name.';
comment on table public.ai_execution_requests is 'Validated execution command; model calls are performed by a worker, never by the browser.';

commit;
