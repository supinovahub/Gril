begin;

create schema if not exists private;
create schema if not exists audit;

revoke all on schema private from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;

-- New Supabase projects include an RLS event trigger. Keep the trigger, but move
-- its SECURITY DEFINER function out of the exposed public schema and revoke RPC access.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    alter function public.rls_auto_enable() set schema private;
    revoke all on function private.rls_auto_enable() from public, anon, authenticated, service_role;
  end if;
end
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug),
  unique (id, org_id)
);

create unique index operations_one_default_per_org_idx
  on public.operations (org_id)
  where is_default;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'broker')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'revoked')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (id, org_id),
  check ((status = 'active' and approved_at is not null) or status <> 'active')
);

create index memberships_user_status_idx
  on public.memberships (user_id, status, org_id);

create index memberships_org_role_status_idx
  on public.memberships (org_id, role, status);

create table public.membership_operations (
  membership_id uuid not null,
  operation_id uuid not null,
  org_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, operation_id),
  foreign key (membership_id, org_id)
    references public.memberships(id, org_id) on delete cascade,
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create index membership_operations_operation_idx
  on public.membership_operations (operation_id, membership_id);

create table public.membership_permissions (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  permission text not null check (
    permission in (
      'settings.manage',
      'team.manage',
      'operations.manage',
      'contacts.manage',
      'campaigns.manage',
      'pipeline.manage',
      'reports.view',
      'ai.manage'
    )
  ),
  created_at timestamptz not null default now(),
  primary key (membership_id, permission)
);

create table public.invitation_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  role text not null default 'broker' check (role in ('manager', 'broker')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked', 'exhausted')),
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  expires_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  check (expires_at > created_at)
);

create index invitation_links_org_status_idx
  on public.invitation_links (org_id, status, expires_at);

create table public.invitation_claims (
  id uuid primary key default gen_random_uuid(),
  invitation_link_id uuid not null references public.invitation_links(id) on delete restrict,
  org_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null default now(),
  unique (invitation_link_id, user_id)
);

create table audit.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete restrict,
  operation_id uuid references public.operations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_events_org_occurred_idx
  on audit.events (org_id, occurred_at desc);

create index audit_events_entity_idx
  on audit.events (entity_type, entity_id, occurred_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger operations_set_updated_at
before update on public.operations
for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

create trigger invitation_links_set_updated_at
before update on public.invitation_links
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated, service_role;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles (user_id, full_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Usuário'
  )
from auth.users u
on conflict (user_id) do nothing;

create or replace function private.is_active_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create or replace function private.has_org_permission(p_org_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'owner'
        or (
          m.role = 'manager'
          and exists (
            select 1
            from public.membership_permissions mp
            where mp.membership_id = m.id
              and mp.permission = p_permission
          )
        )
      )
  );
$$;

create or replace function private.has_operation_access(p_operation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.operations o
    join public.memberships m
      on m.org_id = o.org_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
    where o.id = p_operation_id
      and o.status <> 'archived'
      and (
        m.role in ('owner', 'manager')
        or exists (
          select 1
          from public.membership_operations mo
          where mo.membership_id = m.id
            and mo.operation_id = o.id
        )
      )
  );
$$;

create or replace function private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.memberships target
      join public.memberships actor
        on actor.org_id = target.org_id
       and actor.user_id = (select auth.uid())
       and actor.status = 'active'
      where target.user_id = p_user_id
        and target.status <> 'revoked'
        and (
          actor.role = 'owner'
          or (
            actor.role = 'manager'
            and exists (
              select 1
              from public.membership_permissions mp
              where mp.membership_id = actor.id
                and mp.permission = 'team.manage'
            )
          )
        )
    );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_active_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.has_org_permission(uuid, text) to authenticated;
grant execute on function private.has_operation_access(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

create or replace function private.claim_invitation_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.invitation_links%rowtype;
  v_membership_id uuid;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'invitation_claim_user_mismatch' using errcode = '42501';
  end if;

  select *
  into v_link
  from public.invitation_links link
  where link.token_hash = new.token_hash
  for update;

  if not found
     or v_link.status <> 'active'
     or v_link.expires_at <= now()
     or v_link.used_count >= v_link.max_uses then
    raise exception 'invitation_link_invalid_or_expired' using errcode = '22023';
  end if;

  insert into public.memberships (
    org_id,
    user_id,
    role,
    status,
    approved_at,
    approved_by
  )
  values (
    v_link.org_id,
    new.user_id,
    v_link.role,
    'active',
    now(),
    v_link.created_by
  )
  on conflict (org_id, user_id) do update
  set
    role = case
      when public.memberships.status = 'pending' then excluded.role
      else public.memberships.role
    end,
    status = 'active',
    approved_at = coalesce(public.memberships.approved_at, excluded.approved_at),
    approved_by = coalesce(public.memberships.approved_by, excluded.approved_by),
    updated_at = now()
  where public.memberships.status in ('pending', 'active')
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'membership_not_eligible_for_invitation' using errcode = '42501';
  end if;

  if v_link.operation_id is not null then
    insert into public.membership_operations (membership_id, operation_id, org_id)
    values (v_membership_id, v_link.operation_id, v_link.org_id)
    on conflict (membership_id, operation_id) do nothing;
  end if;

  update public.invitation_links
  set
    used_count = used_count + 1,
    status = case
      when used_count + 1 >= max_uses then 'exhausted'
      else status
    end,
    updated_at = now()
  where id = v_link.id;

  new.invitation_link_id := v_link.id;
  new.org_id := v_link.org_id;
  new.claimed_at := now();
  return new;
end;
$$;

revoke all on function private.claim_invitation_link() from public, anon, authenticated, service_role;

create trigger invitation_claim_resolve
before insert on public.invitation_claims
for each row execute function private.claim_invitation_link();

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jsonb;
  v_org_id uuid;
  v_operation_id uuid;
  v_entity_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org_id := coalesce(
    nullif(v_row ->> 'org_id', '')::uuid,
    case when tg_table_name = 'organizations' then nullif(v_row ->> 'id', '')::uuid end
  );
  v_operation_id := coalesce(
    nullif(v_row ->> 'operation_id', '')::uuid,
    case when tg_table_name = 'operations' then nullif(v_row ->> 'id', '')::uuid end
  );
  v_entity_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'membership_id', '')::uuid
  );

  insert into audit.events (
    org_id,
    operation_id,
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_org_id,
    v_operation_id,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    tg_table_schema || '.' || tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_row_change() from public, anon, authenticated, service_role;

create trigger organizations_audit
after insert or update or delete on public.organizations
for each row execute function private.audit_row_change();

create trigger operations_audit
after insert or update or delete on public.operations
for each row execute function private.audit_row_change();

create trigger memberships_audit
after insert or update or delete on public.memberships
for each row execute function private.audit_row_change();

create trigger membership_operations_audit
after insert or update or delete on public.membership_operations
for each row execute function private.audit_row_change();

create trigger membership_permissions_audit
after insert or update or delete on public.membership_permissions
for each row execute function private.audit_row_change();

create trigger invitation_links_audit
after insert or update or delete on public.invitation_links
for each row execute function private.audit_row_change();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.operations enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_operations enable row level security;
alter table public.membership_permissions enable row level security;
alter table public.invitation_links enable row level security;
alter table public.invitation_claims enable row level security;
alter table audit.events enable row level security;

create policy profiles_select_visible
on public.profiles
for select
to authenticated
using ((select private.can_view_profile(user_id)));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy organizations_select_member
on public.organizations
for select
to authenticated
using ((select private.is_active_org_member(id)));

create policy organizations_update_settings_manager
on public.organizations
for update
to authenticated
using ((select private.has_org_permission(id, 'settings.manage')))
with check ((select private.has_org_permission(id, 'settings.manage')));

create policy operations_select_assigned
on public.operations
for select
to authenticated
using ((select private.has_operation_access(id)));

create policy operations_insert_manager
on public.operations
for insert
to authenticated
with check ((select private.has_org_permission(org_id, 'operations.manage')));

create policy operations_update_manager
on public.operations
for update
to authenticated
using ((select private.has_org_permission(org_id, 'operations.manage')))
with check ((select private.has_org_permission(org_id, 'operations.manage')));

create policy memberships_select_self_or_team_manager
on public.memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_org_permission(org_id, 'team.manage'))
);

create policy memberships_update_owner
on public.memberships
for update
to authenticated
using ((select private.has_org_role(org_id, array['owner']::text[])))
with check ((select private.has_org_role(org_id, array['owner']::text[])));

create policy membership_operations_select_self_or_team_manager
on public.membership_operations
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and m.user_id = (select auth.uid())
  )
  or (select private.has_org_permission(org_id, 'team.manage'))
);

create policy membership_operations_insert_team_manager
on public.membership_operations
for insert
to authenticated
with check ((select private.has_org_permission(org_id, 'team.manage')));

create policy membership_operations_delete_team_manager
on public.membership_operations
for delete
to authenticated
using ((select private.has_org_permission(org_id, 'team.manage')));

create policy membership_permissions_select_self_or_owner
on public.membership_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (
        m.user_id = (select auth.uid())
        or (select private.has_org_role(m.org_id, array['owner']::text[]))
      )
  )
);

create policy membership_permissions_insert_owner
on public.membership_permissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (select private.has_org_role(m.org_id, array['owner']::text[]))
  )
);

create policy membership_permissions_delete_owner
on public.membership_permissions
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_id
      and (select private.has_org_role(m.org_id, array['owner']::text[]))
  )
);

create policy invitation_links_select_team_manager
on public.invitation_links
for select
to authenticated
using ((select private.has_org_permission(org_id, 'team.manage')));

create policy invitation_links_insert_team_manager
on public.invitation_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and used_count = 0
  and (select private.has_org_permission(org_id, 'team.manage'))
);

create policy invitation_links_update_team_manager
on public.invitation_links
for update
to authenticated
using ((select private.has_org_permission(org_id, 'team.manage')))
with check ((select private.has_org_permission(org_id, 'team.manage')));

create policy invitation_links_delete_owner
on public.invitation_links
for delete
to authenticated
using ((select private.has_org_role(org_id, array['owner']::text[])));

create policy invitation_claims_select_self
on public.invitation_claims
for select
to authenticated
using (user_id = (select auth.uid()));

create policy invitation_claims_insert_self
on public.invitation_claims
for insert
to authenticated
with check (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.operations to authenticated;
grant select, update on public.memberships to authenticated;
grant select, insert, delete on public.membership_operations to authenticated;
grant select, insert, delete on public.membership_permissions to authenticated;
grant select, insert, update, delete on public.invitation_links to authenticated;
grant select, insert on public.invitation_claims to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

comment on schema private is 'Non-exposed authorization and trigger functions.';
comment on schema audit is 'Append-only operational audit trail, not exposed through the Data API.';
comment on table public.memberships is 'Database source of truth for tenant roles; never authorize from Auth user_metadata.';
comment on table public.membership_operations is 'Operation scope for brokers. Owners and managers inherit all operations in their organization.';
comment on table public.invitation_claims is 'Insert-only invitation acceptance requests resolved by a private trigger.';

commit;
