begin;

create table public.integration_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null check (provider in ('uazapi', 'meta_cloud', 'openai')),
  label text not null check (char_length(trim(label)) between 2 and 120),
  status text not null default 'verified' check (status in ('verified', 'degraded', 'error', 'revoked')),
  base_url text,
  external_account_id text,
  external_business_id text,
  external_phone_number_id text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  credential_hint text not null check (char_length(credential_hint) between 4 and 32),
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error_redacted text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check ((status = 'revoked' and revoked_at is not null) or status <> 'revoked')
);

create unique index integration_accounts_live_provider_target_idx
  on public.integration_accounts (
    org_id,
    provider,
    coalesce(external_phone_number_id, external_account_id, '')
  )
  where status <> 'revoked';

create index integration_accounts_org_status_idx
  on public.integration_accounts (org_id, provider, status, updated_at desc);

create table private.integration_secret_bindings (
  integration_account_id uuid primary key references public.integration_accounts(id) on delete cascade,
  vault_secret_id uuid not null unique,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.whatsapp_connections
  add column integration_account_id uuid,
  add constraint whatsapp_connections_integration_account_id_fkey
    foreign key (integration_account_id, org_id)
    references public.integration_accounts(id, org_id) on delete restrict;

alter table public.model_profiles
  add column integration_account_id uuid,
  add constraint model_profiles_integration_account_id_fkey
    foreign key (integration_account_id, org_id)
    references public.integration_accounts(id, org_id) on delete restrict;

create unique index whatsapp_connections_integration_account_idx
  on public.whatsapp_connections (integration_account_id)
  where integration_account_id is not null;

create index model_profiles_integration_account_idx
  on public.model_profiles (integration_account_id)
  where integration_account_id is not null;

create trigger integration_accounts_set_updated_at
before update on public.integration_accounts
for each row execute function private.set_updated_at();

alter table public.integration_accounts enable row level security;

create policy integration_accounts_select_manager
on public.integration_accounts for select to authenticated
using (
  (select private.has_org_permission(org_id, 'settings.manage'))
  or (select private.has_org_permission(org_id, 'ai.manage'))
);

grant select on public.integration_accounts to authenticated;
grant all on public.integration_accounts to service_role;
revoke all on private.integration_secret_bindings from public, anon, authenticated;
grant select, insert, update, delete on private.integration_secret_bindings to service_role;

create or replace function public.store_whatsapp_integration(
  p_org_id uuid,
  p_operation_id uuid,
  p_actor_user_id uuid,
  p_provider text,
  p_label text,
  p_base_url text,
  p_external_account_id text,
  p_external_business_id text,
  p_external_phone_number_id text,
  p_phone_e164 text,
  p_visible_profile_name text,
  p_credential_hint text,
  p_secret text,
  p_metadata jsonb,
  p_latency_ms integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account_id uuid := gen_random_uuid();
  v_connection_id uuid;
  v_vault_secret_id uuid;
  v_component text;
begin
  if p_provider not in ('uazapi', 'meta_cloud') then
    raise exception 'unsupported_whatsapp_provider' using errcode = '22023';
  end if;
  if nullif(trim(p_secret), '') is null then
    raise exception 'integration_secret_required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and m.role = 'owner'
  ) then
    raise exception 'integration_owner_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.operations o
    where o.id = p_operation_id and o.org_id = p_org_id and o.status <> 'archived'
  ) then
    raise exception 'integration_operation_invalid' using errcode = '22023';
  end if;

  insert into public.integration_accounts (
    id, org_id, provider, label, status, base_url, external_account_id,
    external_business_id, external_phone_number_id, phone_e164,
    credential_hint, metadata, connected_by, verified_at, last_checked_at
  ) values (
    v_account_id, p_org_id, p_provider, trim(p_label), 'verified', p_base_url,
    nullif(trim(p_external_account_id), ''), nullif(trim(p_external_business_id), ''),
    nullif(trim(p_external_phone_number_id), ''), p_phone_e164,
    p_credential_hint, coalesce(p_metadata, '{}'::jsonb), p_actor_user_id, now(), now()
  );

  v_vault_secret_id := vault.create_secret(
    p_secret,
    'gril_' || replace(v_account_id::text, '-', '_'),
    'Gril ' || p_provider || ' credential for integration ' || v_account_id::text
  );

  insert into private.integration_secret_bindings (integration_account_id, vault_secret_id)
  values (v_account_id, v_vault_secret_id);

  insert into public.whatsapp_connections (
    org_id, operation_id, provider, name, phone_e164, visible_profile_name,
    endpoint_url, secret_reference, integration_account_id, status,
    inbound_enabled, campaign_enabled, settings, last_health_at, created_by
  ) values (
    p_org_id, p_operation_id, p_provider, trim(p_label), p_phone_e164,
    nullif(trim(p_visible_profile_name), ''), p_base_url,
    'vault:' || v_account_id::text, v_account_id, 'draft', false, false,
    jsonb_build_object(
      'credential_verified', true,
      'webhook_configured', false,
      'external_account_id', p_external_account_id,
      'external_business_id', p_external_business_id,
      'external_phone_number_id', p_external_phone_number_id
    ) || coalesce(p_metadata, '{}'::jsonb),
    now(), p_actor_user_id
  ) returning id into v_connection_id;

  v_component := case when p_provider = 'meta_cloud' then 'meta' else 'uazapi' end;
  insert into public.integration_health_checks (
    org_id, operation_id, component, target_id, status, latency_ms,
    metadata, checked_at
  ) values (
    p_org_id, p_operation_id, v_component, v_connection_id, 'healthy',
    greatest(coalesce(p_latency_ms, 0), 0),
    jsonb_build_object('source', 'self_service_connect', 'integration_account_id', v_account_id),
    now()
  );

  insert into audit.events (
    org_id, operation_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_org_id, p_operation_id, p_actor_user_id, 'integration.connected',
    'integration_accounts', v_account_id,
    jsonb_build_object('provider', p_provider, 'connection_id', v_connection_id)
  );

  return v_connection_id;
end;
$$;

revoke all on function public.store_whatsapp_integration(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, integer
) from public, anon, authenticated;
grant execute on function public.store_whatsapp_integration(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, jsonb, integer
) to service_role;

create or replace function public.store_openai_integration(
  p_org_id uuid,
  p_actor_user_id uuid,
  p_credential_hint text,
  p_secret text,
  p_latency_ms integer,
  p_model_count integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account_id uuid;
  v_vault_secret_id uuid;
begin
  if nullif(trim(p_secret), '') is null then
    raise exception 'integration_secret_required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and m.role = 'owner'
  ) then
    raise exception 'integration_owner_required' using errcode = '42501';
  end if;

  select a.id into v_account_id
  from public.integration_accounts a
  where a.org_id = p_org_id and a.provider = 'openai' and a.status <> 'revoked'
  for update;

  if v_account_id is null then
    v_account_id := gen_random_uuid();
    insert into public.integration_accounts (
      id, org_id, provider, label, status, base_url, credential_hint,
      metadata, connected_by, verified_at, last_checked_at
    ) values (
      v_account_id, p_org_id, 'openai', 'OpenAI', 'verified',
      'https://api.openai.com/v1', p_credential_hint,
      jsonb_build_object('available_model_count', greatest(coalesce(p_model_count, 0), 0)),
      p_actor_user_id, now(), now()
    );

    v_vault_secret_id := vault.create_secret(
      p_secret,
      'gril_' || replace(v_account_id::text, '-', '_'),
      'Gril OpenAI BYOK credential for integration ' || v_account_id::text
    );
    insert into private.integration_secret_bindings (integration_account_id, vault_secret_id)
    values (v_account_id, v_vault_secret_id);
  else
    select b.vault_secret_id into v_vault_secret_id
    from private.integration_secret_bindings b
    where b.integration_account_id = v_account_id
    for update;

    if v_vault_secret_id is null then
      raise exception 'integration_secret_binding_missing' using errcode = '55000';
    end if;
    perform vault.update_secret(v_vault_secret_id, p_secret);
    update private.integration_secret_bindings
    set rotated_at = now()
    where integration_account_id = v_account_id;
    update public.integration_accounts
    set status = 'verified', credential_hint = p_credential_hint,
        metadata = jsonb_build_object('available_model_count', greatest(coalesce(p_model_count, 0), 0)),
        connected_by = p_actor_user_id, verified_at = now(), last_checked_at = now(),
        last_error_redacted = null, revoked_at = null, updated_at = now()
    where id = v_account_id;
  end if;

  update public.model_profiles
  set integration_account_id = v_account_id,
      secret_reference = 'vault:' || v_account_id::text,
      updated_at = now()
  where org_id = p_org_id and status <> 'archived';

  insert into public.integration_health_checks (
    org_id, component, target_id, status, latency_ms, metadata, checked_at
  ) values (
    p_org_id, 'openai', v_account_id, 'healthy', greatest(coalesce(p_latency_ms, 0), 0),
    jsonb_build_object('source', 'self_service_connect', 'available_model_count', greatest(coalesce(p_model_count, 0), 0)),
    now()
  );

  insert into audit.events (
    org_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_org_id, p_actor_user_id, 'integration.connected', 'integration_accounts',
    v_account_id, jsonb_build_object('provider', 'openai')
  );

  return v_account_id;
end;
$$;

revoke all on function public.store_openai_integration(uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.store_openai_integration(uuid, uuid, text, text, integer, integer)
  to service_role;

create or replace function public.get_integration_secret(p_integration_account_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select ds.decrypted_secret
  from private.integration_secret_bindings b
  join vault.decrypted_secrets ds on ds.id = b.vault_secret_id
  join public.integration_accounts a on a.id = b.integration_account_id
  where b.integration_account_id = p_integration_account_id
    and a.status <> 'revoked';
$$;

revoke all on function public.get_integration_secret(uuid) from public, anon, authenticated;
grant execute on function public.get_integration_secret(uuid) to service_role;

create or replace function public.revoke_integration_account(
  p_integration_account_id uuid,
  p_org_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_account public.integration_accounts%rowtype;
  v_vault_secret_id uuid;
begin
  if not exists (
    select 1 from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_actor_user_id
      and m.status = 'active'
      and m.role = 'owner'
  ) then
    raise exception 'integration_owner_required' using errcode = '42501';
  end if;

  select * into v_account
  from public.integration_accounts a
  where a.id = p_integration_account_id and a.org_id = p_org_id
  for update;

  if not found or v_account.status = 'revoked' then
    raise exception 'integration_not_found' using errcode = '22023';
  end if;

  select b.vault_secret_id into v_vault_secret_id
  from private.integration_secret_bindings b
  where b.integration_account_id = v_account.id
  for update;

  delete from private.integration_secret_bindings
  where integration_account_id = v_account.id;
  if v_vault_secret_id is not null then
    delete from vault.secrets where id = v_vault_secret_id;
  end if;

  update public.integration_accounts
  set status = 'revoked', revoked_at = now(), last_error_redacted = null, updated_at = now()
  where id = v_account.id;

  update public.whatsapp_connections
  set status = 'revoked', inbound_enabled = false, campaign_enabled = false,
      secret_reference = null, updated_at = now()
  where integration_account_id = v_account.id;

  update public.model_profiles
  set status = case when status = 'active' then 'paused' else status end,
      is_default = false, secret_reference = null, integration_account_id = null,
      updated_at = now()
  where integration_account_id = v_account.id;

  insert into audit.events (
    org_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_org_id, p_actor_user_id, 'integration.revoked', 'integration_accounts',
    v_account.id, jsonb_build_object('provider', v_account.provider)
  );
end;
$$;

revoke all on function public.revoke_integration_account(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_integration_account(uuid, uuid, uuid)
  to service_role;

create or replace function private.process_model_activation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.model_profiles%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid())
     or not private.has_org_role(new.org_id, array['owner']::text[]) then
    raise exception 'model_activation_forbidden' using errcode = '42501';
  end if;
  select * into v_profile from public.model_profiles where id = new.model_profile_id for update;
  if not found or v_profile.org_id <> new.org_id
     or nullif(trim(v_profile.secret_reference), '') is null
     or v_profile.integration_account_id is null
     or not exists (
       select 1 from public.integration_accounts a
       where a.id = v_profile.integration_account_id
         and a.org_id = new.org_id
         and a.provider = 'openai'
         and a.status = 'verified'
     ) then
    raise exception 'verified_openai_integration_required' using errcode = '22023';
  end if;
  update public.model_profiles
  set is_default = false,
      status = case when status = 'active' then 'paused' else status end,
      updated_at = now()
  where org_id = new.org_id and id <> v_profile.id and is_default;
  update public.model_profiles
  set status = 'active', is_default = true, updated_at = now()
  where id = v_profile.id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_model_activation_request()
  from public, anon, authenticated, service_role;

create or replace function private.process_connection_activation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_status text;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid())
     or not private.has_org_role(new.org_id, array['owner']::text[]) then
    raise exception 'connection_activation_owner_required' using errcode = '42501';
  end if;
  select * into v_connection
  from public.whatsapp_connections
  where id = new.connection_id and org_id = new.org_id
  for update;
  if not found then
    raise exception 'connection_not_found' using errcode = '22023';
  end if;
  if new.action = 'activate' then
    if v_connection.status not in ('draft', 'paused', 'error')
       or v_connection.phone_e164 is null
       or v_connection.endpoint_url is null
       or v_connection.secret_reference is null
       or v_connection.integration_account_id is null
       or not exists (
         select 1 from public.integration_accounts a
         where a.id = v_connection.integration_account_id
           and a.org_id = new.org_id
           and a.provider = v_connection.provider
           and a.status = 'verified'
       ) then
      raise exception 'verified_connection_configuration_required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.integration_health_checks h
      where h.target_id = v_connection.id
        and h.status = 'healthy'
        and h.checked_at > now() - interval '15 minutes'
    ) then
      raise exception 'recent_healthy_check_required' using errcode = '22023';
    end if;
    v_status := 'active';
  elsif new.action = 'pause' then
    if v_connection.status <> 'active' then
      raise exception 'connection_not_active' using errcode = '22023';
    end if;
    v_status := 'paused';
  else
    v_status := 'revoked';
  end if;

  update public.whatsapp_connections
  set status = v_status,
      inbound_enabled = case when v_status = 'active' then new.inbound_enabled else false end,
      campaign_enabled = case when v_status = 'active' then new.campaign_enabled else false end,
      updated_at = now()
  where id = v_connection.id;

  if v_status = 'active' then
    update public.system_pauses
    set active = false, resumed_at = now(), resumed_by = new.actor_user_id
    where scope_type = 'connection' and scope_id = v_connection.id and active;
  else
    insert into public.system_pauses (
      org_id, operation_id, scope_type, scope_id, reason, source, paused_by
    ) values (
      new.org_id, v_connection.operation_id, 'connection', v_connection.id,
      coalesce(nullif(trim(new.reason), ''), 'Conexão não ativa'), 'manual', new.actor_user_id
    ) on conflict (
      org_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where active do nothing;
  end if;

  insert into audit.events (
    org_id, operation_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.org_id, v_connection.operation_id, new.actor_user_id,
    'connection.' || new.action, 'whatsapp_connections', v_connection.id,
    jsonb_build_object('from', v_connection.status, 'to', v_status, 'reason', new.reason)
  );
  new.resulting_status := v_status;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_connection_activation_request()
  from public, anon, authenticated, service_role;

comment on table public.integration_accounts is
  'Safe per-tenant integration metadata. Provider credentials are encrypted in Supabase Vault and never returned to authenticated clients.';
comment on table private.integration_secret_bindings is
  'Service-role-only mapping from integration accounts to encrypted Supabase Vault secrets.';
comment on function public.get_integration_secret(uuid) is
  'Service-role-only credential resolver for provider adapters and workers.';

commit;
