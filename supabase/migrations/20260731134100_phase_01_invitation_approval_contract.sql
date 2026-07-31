begin;

alter table public.invitation_links
  add column kind text not null default 'general'
    check (kind in ('general', 'individual')),
  add column email text;

alter table public.invitation_links
  add constraint invitation_links_email_normalized_check
    check (
      email is null
      or (
        email = lower(email)
        and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      )
    ),
  add constraint invitation_links_kind_contract_check
    check (
      (kind = 'general' and email is null and role = 'broker')
      or (kind = 'individual' and email is not null)
    );

create index invitation_links_email_idx
  on public.invitation_links (email)
  where email is not null;

drop policy memberships_update_owner on public.memberships;
revoke update on public.memberships from authenticated;

drop policy invitation_links_insert_team_manager on public.invitation_links;
drop policy invitation_links_update_team_manager on public.invitation_links;

create policy invitation_links_insert_team_manager
on public.invitation_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and used_count = 0
  and (select private.has_org_permission(org_id, 'team.manage'))
  and (
    (kind = 'general' and role = 'broker' and email is null)
    or (
      kind = 'individual'
      and email is not null
      and (
        role = 'broker'
        or (select private.has_org_role(org_id, array['owner']::text[]))
      )
    )
  )
);

create policy invitation_links_update_team_manager
on public.invitation_links
for update
to authenticated
using ((select private.has_org_permission(org_id, 'team.manage')))
with check (
  (select private.has_org_permission(org_id, 'team.manage'))
  and (
    (kind = 'general' and role = 'broker' and email is null)
    or (
      kind = 'individual'
      and email is not null
      and (
        role = 'broker'
        or (select private.has_org_role(org_id, array['owner']::text[]))
      )
    )
  )
);

create table public.membership_change_requests (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete restrict,
  org_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  requested_action text not null check (
    requested_action in ('approve', 'suspend', 'reactivate', 'revoke')
  ),
  requested_role text check (requested_role is null or requested_role in ('manager', 'broker')),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index membership_change_requests_membership_idx
  on public.membership_change_requests (membership_id, created_at desc);

create index membership_change_requests_org_idx
  on public.membership_change_requests (org_id, created_at desc);

create index membership_change_requests_actor_idx
  on public.membership_change_requests (actor_user_id, created_at desc);

create or replace function private.process_membership_change_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_target public.memberships%rowtype;
  v_actor public.memberships%rowtype;
  v_requested_role text;
  v_email_confirmed_at timestamptz;
  v_can_manage boolean;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'membership_change_actor_mismatch' using errcode = '42501';
  end if;

  select *
  into v_target
  from public.memberships m
  where m.id = new.membership_id
  for update;

  if not found then
    raise exception 'membership_not_found' using errcode = '22023';
  end if;

  select *
  into v_actor
  from public.memberships m
  where m.org_id = v_target.org_id
    and m.user_id = (select auth.uid())
    and m.status = 'active';

  if not found then
    raise exception 'membership_change_forbidden' using errcode = '42501';
  end if;

  v_can_manage :=
    v_actor.role = 'owner'
    or (
      v_actor.role = 'manager'
      and exists (
        select 1
        from public.membership_permissions mp
        where mp.membership_id = v_actor.id
          and mp.permission = 'team.manage'
      )
    );

  if not v_can_manage then
    raise exception 'membership_change_forbidden' using errcode = '42501';
  end if;

  if v_actor.role = 'manager' and v_target.role <> 'broker' then
    raise exception 'manager_can_only_manage_brokers' using errcode = '42501';
  end if;

  if new.requested_action = 'approve' then
    if v_target.status <> 'pending' then
      raise exception 'membership_is_not_pending' using errcode = '22023';
    end if;

    select u.email_confirmed_at
    into v_email_confirmed_at
    from auth.users u
    where u.id = v_target.user_id;

    if v_email_confirmed_at is null then
      raise exception 'email_must_be_confirmed_before_approval' using errcode = '22023';
    end if;

    v_requested_role := coalesce(new.requested_role, v_target.role);

    if v_actor.role = 'manager' and v_requested_role <> 'broker' then
      raise exception 'manager_cannot_promote_roles' using errcode = '42501';
    end if;

    update public.memberships
    set
      role = v_requested_role,
      status = 'active',
      approved_at = now(),
      approved_by = (select auth.uid()),
      updated_at = now()
    where id = v_target.id;
  elsif new.requested_action = 'suspend' then
    if v_target.role = 'owner' or v_target.status <> 'active' then
      raise exception 'membership_cannot_be_suspended' using errcode = '22023';
    end if;

    update public.memberships
    set status = 'suspended', updated_at = now()
    where id = v_target.id;
  elsif new.requested_action = 'reactivate' then
    if v_target.role = 'owner' or v_target.status <> 'suspended' then
      raise exception 'membership_cannot_be_reactivated' using errcode = '22023';
    end if;

    update public.memberships
    set status = 'active', updated_at = now()
    where id = v_target.id;
  elsif new.requested_action = 'revoke' then
    if v_target.role = 'owner' or v_target.status = 'revoked' then
      raise exception 'membership_cannot_be_revoked' using errcode = '22023';
    end if;

    update public.memberships
    set status = 'revoked', updated_at = now()
    where id = v_target.id;
  end if;

  new.org_id := v_target.org_id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_membership_change_request()
  from public, anon, authenticated, service_role;

create trigger membership_change_request_process
before insert on public.membership_change_requests
for each row execute function private.process_membership_change_request();

alter table public.membership_change_requests enable row level security;

create policy membership_change_requests_select_actor_or_team_manager
on public.membership_change_requests
for select
to authenticated
using (
  actor_user_id = (select auth.uid())
  or (select private.has_org_permission(org_id, 'team.manage'))
);

create policy membership_change_requests_insert_actor
on public.membership_change_requests
for insert
to authenticated
with check (actor_user_id = (select auth.uid()));

grant select, insert on public.membership_change_requests to authenticated;
grant all on public.membership_change_requests to service_role;

create or replace function private.claim_invitation_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.invitation_links%rowtype;
  v_membership_id uuid;
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_target_status text;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'invitation_claim_user_mismatch' using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at
  into v_user_email, v_email_confirmed_at
  from auth.users u
  where u.id = new.user_id;

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

  if v_link.kind = 'individual' then
    if v_email_confirmed_at is null then
      raise exception 'email_must_be_confirmed_before_invitation' using errcode = '22023';
    end if;

    if v_user_email is null or v_user_email <> v_link.email then
      raise exception 'invitation_email_mismatch' using errcode = '42501';
    end if;
  end if;

  v_target_status := case when v_link.kind = 'general' then 'pending' else 'active' end;

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
    v_target_status,
    case when v_target_status = 'active' then now() end,
    case when v_target_status = 'active' then v_link.created_by end
  )
  on conflict (org_id, user_id) do update
  set
    role = case
      when public.memberships.status = 'pending' then excluded.role
      else public.memberships.role
    end,
    status = case
      when excluded.status = 'active' then 'active'
      else public.memberships.status
    end,
    approved_at = coalesce(public.memberships.approved_at, excluded.approved_at),
    approved_by = coalesce(public.memberships.approved_by, excluded.approved_by),
    updated_at = now()
  where public.memberships.status in ('pending', 'active')
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'membership_not_eligible_for_invitation' using errcode = '42501';
  end if;

  if v_link.kind = 'individual' and v_link.operation_id is not null then
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

revoke all on function private.claim_invitation_link()
  from public, anon, authenticated, service_role;

comment on column public.invitation_links.kind is
  'general creates a pending broker membership; individual may activate the confirmed matching email.';
comment on table public.membership_change_requests is
  'Insert-only command table for audited membership state changes; the client never updates memberships directly.';

commit;
