begin;

-- One operational WhatsApp belongs to one account. Refuse to guess when
-- historical data conflicts so the operator can resolve it explicitly.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where whatsapp_e164 is not null
    group by whatsapp_e164
    having count(*) > 1
  ) then
    raise exception 'duplicate_profile_whatsapp_requires_resolution' using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists profiles_whatsapp_e164_unique_idx
  on public.profiles (whatsapp_e164)
  where whatsapp_e164 is not null;

create or replace function private.membership_has_required_whatsapp(
  p_user_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_role = 'owner' or exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_user_id
      and profile.whatsapp_e164 is not null
  );
$$;

revoke all on function private.membership_has_required_whatsapp(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.is_active_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.organizations organization on organization.id = membership.org_id
    where membership.org_id = p_org_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and organization.status = 'active'
      and private.account_is_operational(membership.user_id)
      and private.membership_has_required_whatsapp(membership.user_id, membership.role)
  ) or private.has_contractual_support(p_org_id, false);
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
    from public.memberships membership
    join public.organizations organization on organization.id = membership.org_id
    where membership.org_id = p_org_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and organization.status = 'active'
      and private.account_is_operational(membership.user_id)
      and private.membership_has_required_whatsapp(membership.user_id, membership.role)
      and membership.role = any(p_roles)
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
    from public.memberships membership
    join public.organizations organization on organization.id = membership.org_id
    where membership.org_id = p_org_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and organization.status = 'active'
      and private.account_is_operational(membership.user_id)
      and private.membership_has_required_whatsapp(membership.user_id, membership.role)
      and (
        membership.role = 'owner'
        or (
          membership.role = 'manager'
          and exists (
            select 1
            from public.membership_permissions permission
            where permission.membership_id = membership.id
              and permission.permission = p_permission
          )
        )
      )
  ) or private.has_contractual_support(p_org_id, true);
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
    from public.operations operation
    where operation.id = p_operation_id
      and operation.status <> 'archived'
      and (
        private.has_contractual_support(operation.org_id, false)
        or exists (
          select 1
          from public.memberships membership
          join public.organizations organization on organization.id = membership.org_id
          where membership.org_id = operation.org_id
            and membership.user_id = (select auth.uid())
            and membership.status = 'active'
            and organization.status = 'active'
            and private.account_is_operational(membership.user_id)
            and private.membership_has_required_whatsapp(membership.user_id, membership.role)
            and (
              membership.role in ('owner', 'manager')
              or exists (
                select 1
                from public.membership_operations scope
                where scope.membership_id = membership.id
                  and scope.operation_id = operation.id
              )
            )
        )
      )
  );
$$;

create or replace function private.current_membership_id(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select membership.id
  from public.memberships membership
  where membership.org_id = p_org_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and private.membership_has_required_whatsapp(membership.user_id, membership.role)
  limit 1;
$$;

create or replace function private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.memberships target
      where target.user_id = p_user_id
        and target.status <> 'revoked'
        and (
          private.has_contractual_support(target.org_id, false)
          or exists (
            select 1
            from public.memberships actor
            where actor.org_id = target.org_id
              and actor.user_id = (select auth.uid())
              and actor.status = 'active'
              and private.membership_has_required_whatsapp(actor.user_id, actor.role)
              and (
                actor.role = 'owner'
                or (
                  actor.role = 'manager'
                  and exists (
                    select 1
                    from public.membership_permissions permission
                    where permission.membership_id = actor.id
                      and permission.permission = 'team.manage'
                  )
                )
              )
          )
        )
    );
$$;

create or replace function private.enforce_profile_whatsapp_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.whatsapp_e164 is not null and exists (
    select 1
    from public.access_requests request
    where request.whatsapp_e164 = new.whatsapp_e164
      and request.requester_user_id <> new.user_id
      and request.status in ('pending', 'correction_requested')
  ) then
    raise exception 'whatsapp_already_in_use' using errcode = '23505';
  end if;

  if new.whatsapp_e164 is null and exists (
    select 1
    from public.memberships membership
    where membership.user_id = new.user_id
      and membership.status = 'active'
      and membership.role in ('manager', 'broker')
  ) then
    raise exception 'whatsapp_required_for_active_member' using errcode = '23502';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_profile_whatsapp_contract()
  from public, anon, authenticated, service_role;

drop trigger if exists profiles_whatsapp_contract on public.profiles;
create trigger profiles_whatsapp_contract
before insert or update of whatsapp_e164 on public.profiles
for each row execute function private.enforce_profile_whatsapp_contract();

create or replace function private.audit_profile_whatsapp_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_org_id uuid;
begin
  if old.whatsapp_e164 is not distinct from new.whatsapp_e164 then
    return new;
  end if;

  select membership.org_id
    into v_org_id
  from public.memberships membership
  where membership.user_id = new.user_id
    and membership.status in ('active', 'suspended', 'pending')
  order by case membership.status when 'active' then 0 when 'suspended' then 1 else 2 end,
    membership.created_at
  limit 1;

  insert into audit.events (
    org_id,
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_org_id,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    'profile.whatsapp_updated',
    'profile',
    new.user_id,
    jsonb_build_object(
      'previous_whatsapp', old.whatsapp_e164,
      'new_whatsapp', new.whatsapp_e164
    )
  );

  return new;
end;
$$;

revoke all on function private.audit_profile_whatsapp_change()
  from public, anon, authenticated, service_role;

drop trigger if exists profiles_whatsapp_audit on public.profiles;
create trigger profiles_whatsapp_audit
after update of whatsapp_e164 on public.profiles
for each row execute function private.audit_profile_whatsapp_change();

create or replace function public.update_member_whatsapp(
  p_membership_id uuid,
  p_whatsapp_e164 text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor public.memberships%rowtype;
  v_target public.memberships%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_whatsapp_e164 is null or p_whatsapp_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'whatsapp_invalid' using errcode = '22023';
  end if;

  select *
    into v_target
  from public.memberships membership
  where membership.id = p_membership_id
    and membership.status <> 'revoked'
  for update;

  if not found or v_target.role = 'owner' then
    raise exception 'membership_not_editable' using errcode = '22023';
  end if;

  select *
    into v_actor
  from public.memberships membership
  where membership.org_id = v_target.org_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active';

  if not found then
    raise exception 'member_whatsapp_update_forbidden' using errcode = '42501';
  end if;

  if v_target.role = 'manager' and v_actor.role <> 'owner' then
    raise exception 'only_owner_can_update_manager_whatsapp' using errcode = '42501';
  end if;

  if v_target.role = 'broker' and not (
    v_actor.role = 'owner'
    or (
      v_actor.role = 'manager'
      and exists (
        select 1
        from public.membership_permissions permission
        where permission.membership_id = v_actor.id
          and permission.permission = 'team.manage'
      )
    )
  ) then
    raise exception 'member_whatsapp_update_forbidden' using errcode = '42501';
  end if;

  update public.profiles
  set whatsapp_e164 = p_whatsapp_e164,
      updated_at = now()
  where user_id = v_target.user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.update_member_whatsapp(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_member_whatsapp(uuid, text)
  to authenticated, service_role;

create or replace function private.mask_invitation_email(p_email text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else
      left(split_part(p_email, '@', 1), 1)
      || repeat('*', greatest(2, least(6, length(split_part(p_email, '@', 1)) - 1)))
      || '@'
      || left(split_part(p_email, '@', 2), 1)
      || repeat('*', 3)
      || case
        when position('.' in split_part(p_email, '@', 2)) > 0
          then substring(split_part(p_email, '@', 2) from '\.[^.]+$')
        else ''
      end
  end;
$$;

revoke all on function private.mask_invitation_email(text)
  from public, anon, authenticated, service_role;

create or replace function public.invitation_preview(p_token_hash text)
returns table (
  invitation_status text,
  organization_name text,
  invited_role text,
  expires_at timestamptz,
  invited_email_masked text,
  email_matches boolean,
  operation_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.invitation_links%rowtype;
  v_organization_name text;
  v_operation_name text;
  v_current_email text;
  v_status text;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return query select 'invalid'::text, null::text, null::text, null::timestamptz,
      null::text, false, null::text;
    return;
  end if;

  select link.*
    into v_link
  from public.invitation_links link
  where link.token_hash = p_token_hash
    and link.kind = 'individual';

  if not found then
    return query select 'invalid'::text, null::text, null::text, null::timestamptz,
      null::text, false, null::text;
    return;
  end if;

  select organization.name into v_organization_name
  from public.organizations organization
  where organization.id = v_link.org_id;

  if v_link.operation_id is not null then
    select operation.name into v_operation_name
    from public.operations operation
    where operation.id = v_link.operation_id;
  end if;

  v_status := case
    when v_link.status = 'revoked' then 'revoked'
    when v_link.status = 'exhausted' or v_link.used_count >= v_link.max_uses then 'used'
    when v_link.expires_at <= now() then 'expired'
    else 'active'
  end;

  if (select auth.uid()) is not null then
    select lower(email) into v_current_email
    from auth.users
    where id = (select auth.uid());
  end if;

  return query
  select
    v_status,
    v_organization_name,
    v_link.role,
    v_link.expires_at,
    case when (select auth.uid()) is null then null else private.mask_invitation_email(v_link.email) end,
    coalesce(v_current_email = v_link.email, false),
    case when v_current_email = v_link.email then v_operation_name else null end;
end;
$$;

revoke all on function public.invitation_preview(text)
  from public, anon, authenticated, service_role;
grant execute on function public.invitation_preview(text)
  to anon, authenticated, service_role;

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
  v_email_confirmed timestamptz;
  v_acceptor_name text;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'invitation_claim_user_mismatch' using errcode = '42501';
  end if;

  perform private.assert_normal_account(new.user_id);

  select lower(user_account.email), user_account.email_confirmed_at, profile.full_name
    into v_user_email, v_email_confirmed, v_acceptor_name
  from auth.users user_account
  left join public.profiles profile on profile.user_id = user_account.id
  where user_account.id = new.user_id;

  select *
    into v_link
  from public.invitation_links link
  where link.token_hash = new.token_hash
  for update;

  if not found
    or v_link.kind <> 'individual'
    or v_link.status <> 'active'
    or v_link.expires_at <= now()
    or v_link.used_count >= 1
    or not exists (
      select 1 from public.organizations organization
      where organization.id = v_link.org_id and organization.status = 'active'
    ) then
    raise exception 'invitation_link_invalid_or_expired' using errcode = '22023';
  end if;

  if v_email_confirmed is null then
    raise exception 'email_must_be_confirmed_before_invitation' using errcode = '22023';
  end if;

  if v_user_email is null or v_user_email <> v_link.email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.user_id = new.user_id and profile.whatsapp_e164 is not null
  ) then
    raise exception 'whatsapp_required_before_invitation' using errcode = '23502';
  end if;

  if exists (
    select 1 from public.memberships membership
    where membership.user_id = new.user_id
      and membership.status in ('pending', 'active', 'suspended')
  ) then
    raise exception 'account_already_linked' using errcode = '22023';
  end if;

  insert into public.memberships (
    org_id, user_id, role, status, approved_at, approved_by
  ) values (
    v_link.org_id, new.user_id, v_link.role, 'active', now(), v_link.created_by
  ) returning id into v_membership_id;

  if v_link.role = 'broker' then
    if v_link.operation_id is null then
      raise exception 'broker_invitation_operation_required' using errcode = '22023';
    end if;

    insert into public.membership_operations (membership_id, operation_id, org_id)
    values (v_membership_id, v_link.operation_id, v_link.org_id);
  else
    insert into public.membership_permissions (membership_id, permission) values
      (v_membership_id, 'team.manage'),
      (v_membership_id, 'operations.manage'),
      (v_membership_id, 'operations.pause'),
      (v_membership_id, 'contacts.manage'),
      (v_membership_id, 'campaigns.manage'),
      (v_membership_id, 'pipeline.manage'),
      (v_membership_id, 'reports.view'),
      (v_membership_id, 'ai.manage')
    on conflict do nothing;
  end if;

  update public.invitation_links
  set used_count = 1,
      status = 'exhausted',
      updated_at = now()
  where id = v_link.id;

  insert into audit.events (
    org_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_link.org_id,
    new.user_id,
    'invitation.accepted',
    'invitation_link',
    v_link.id,
    jsonb_build_object(
      'membership_id', v_membership_id,
      'accepted_user_id', new.user_id,
      'role', v_link.role,
      'accepted_at', now()
    )
  );

  insert into public.notifications (
    org_id,
    recipient_membership_id,
    channel,
    title,
    body,
    status
  )
  select
    v_link.org_id,
    recipient.id,
    'app',
    'Convite aceito',
    coalesce(v_acceptor_name, v_user_email) || ' entrou como '
      || case when v_link.role = 'manager' then 'gestor' else 'corretor' end || '.',
    'pending'
  from public.memberships recipient
  left join public.profiles recipient_profile on recipient_profile.user_id = recipient.user_id
  where recipient.org_id = v_link.org_id
    and recipient.status = 'active'
    and recipient.user_id <> new.user_id
    and (recipient.role = 'owner' or recipient.user_id = v_link.created_by)
    and (recipient.role = 'owner' or recipient_profile.whatsapp_e164 is not null);

  new.invitation_link_id := v_link.id;
  new.org_id := v_link.org_id;
  new.claimed_at := now();
  return new;
end;
$$;

revoke all on function private.claim_invitation_link()
  from public, anon, authenticated, service_role;

-- Existing call distribution already checks for a WhatsApp. This guard also
-- prevents accepting an offer created before the account became blocked.
create or replace function private.guard_call_offer_accept_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from public.memberships membership
    left join public.profiles profile on profile.user_id = membership.user_id
    where membership.org_id = new.org_id
      and membership.user_id = new.actor_user_id
      and membership.status = 'active'
      and membership.role in ('manager', 'broker')
      and profile.whatsapp_e164 is null
  ) then
    raise exception 'whatsapp_required_for_call_offer' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_call_offer_accept_whatsapp()
  from public, anon, authenticated, service_role;

drop trigger if exists aa_call_offer_accept_requires_whatsapp on public.call_offer_accept_requests;
create trigger aa_call_offer_accept_requires_whatsapp
before insert on public.call_offer_accept_requests
for each row execute function private.guard_call_offer_accept_whatsapp();

update public.call_offers offer
set status = 'cancelled',
    responded_at = now()
where offer.status in ('scheduled', 'pending')
  and exists (
    select 1
    from public.memberships membership
    join public.profiles profile on profile.user_id = membership.user_id
    where membership.id = offer.recipient_membership_id
      and membership.status = 'active'
      and membership.role in ('manager', 'broker')
      and profile.whatsapp_e164 is null
  );

comment on function public.invitation_preview(text) is
  'Bounded public preview for a bearer invitation token hash; never returns the full invited email.';
comment on function public.update_member_whatsapp(uuid, text) is
  'Owner may update managers and brokers; team managers may update brokers. All changes are audited.';

commit;
