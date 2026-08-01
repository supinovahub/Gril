begin;

-- Platform governance and public access requests. This migration intentionally
-- keeps tenant data in the existing RLS model and exposes platform operations
-- only through narrowly-scoped, audited functions.

alter table public.organizations drop constraint organizations_status_check;
alter table public.organizations add constraint organizations_status_check
  check(status in ('active','suspended','archived'));
alter table public.organizations
  add column city text check(city is null or char_length(trim(city)) between 2 and 100),
  add column state text check(state is null or state ~ '^[A-Z]{2}$'),
  add column suspension_public_message text check(suspension_public_message is null or char_length(trim(suspension_public_message)) between 3 and 500),
  add column suspended_at timestamptz,
  add column suspended_by uuid references auth.users(id) on delete set null,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null;

alter table public.membership_permissions drop constraint membership_permissions_permission_check;
alter table public.membership_permissions add constraint membership_permissions_permission_check check(permission in(
  'settings.manage','team.manage','operations.manage','operations.pause','contacts.manage','campaigns.manage',
  'pipeline.manage','reports.view','ai.manage','finance.view','privacy.manage','ownership.transfer','managers.create',
  'exports.create','checklists.manage'
));

create table private.organization_join_codes(
  org_id uuid primary key references public.organizations(id) on delete cascade,
  code text not null unique check(code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  enabled boolean not null default true,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null
);

create or replace function private.new_organization_join_code()
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';v_code text;v_i integer;
begin
  loop
    v_code:='';
    for v_i in 1..8 loop
      v_code:=v_code||substr(v_alphabet,(get_byte(extensions.gen_random_bytes(1),0)%length(v_alphabet))+1,1);
    end loop;
    exit when not exists(select 1 from private.organization_join_codes c where c.code=v_code);
  end loop;
  return v_code;
end;$$;
revoke all on function private.new_organization_join_code() from public,anon,authenticated,service_role;

insert into private.organization_join_codes(org_id,code)
select o.id,private.new_organization_join_code() from public.organizations o
on conflict(org_id) do nothing;

create or replace function private.seed_organization_join_code()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into private.organization_join_codes(org_id,code) values(new.id,private.new_organization_join_code());
  return new;
end;$$;
revoke all on function private.seed_organization_join_code() from public,anon,authenticated,service_role;
create trigger organization_join_code_seed after insert on public.organizations
for each row execute function private.seed_organization_join_code();

create table private.account_controls(
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended boolean not null default false,
  requests_blocked boolean not null default false,
  public_message text check(public_message is null or char_length(trim(public_message)) between 3 and 500),
  internal_note text check(internal_note is null or char_length(trim(internal_note)) between 3 and 2000),
  previous_membership_id uuid references public.memberships(id) on delete set null,
  previous_membership_status text check(previous_membership_status is null or previous_membership_status in('pending','active','suspended','revoked')),
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  reactivated_at timestamptz,
  reactivated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function private.account_is_operational(p_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select p_user_id is not null and not coalesce((select c.suspended from private.account_controls c where c.user_id=p_user_id),false);
$$;
revoke all on function private.account_is_operational(uuid) from public,anon,authenticated,service_role;

alter table private.platform_principals
  add column disabled_at timestamptz,
  add column disabled_by uuid references auth.users(id) on delete set null;

create table private.platform_account_invitations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check(email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null check(role in('platform_admin','support')),
  status text not null default 'pending' check(status in('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check(expires_at>created_at)
);
create index platform_account_invitations_email_idx on private.platform_account_invitations(email,status,expires_at);
create unique index platform_account_one_pending_user_idx on private.platform_account_invitations(user_id) where status='pending';

create table private.organization_creation_preauthorizations(
  id uuid primary key default gen_random_uuid(),
  email text not null check(email=lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  status text not null default 'active' check(status in('active','used','revoked','expired')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);
create unique index organization_creation_one_active_email_idx
  on private.organization_creation_preauthorizations(email) where status='active';

create table private.access_request_rate_events(
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
  event_type text not null check(event_type in('organization_request','invalid_code')),
  created_at timestamptz not null default now()
);
create index access_request_rate_ip_idx on private.access_request_rate_events(ip_hash,event_type,created_at desc);
create index access_request_rate_user_idx on private.access_request_rate_events(user_id,event_type,created_at desc);

create table public.access_requests(
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check(request_type in('create_organization','join_manager','join_broker')),
  org_id uuid references public.organizations(id) on delete restrict,
  requested_role text check(requested_role is null or requested_role in('manager','broker')),
  approved_role text check(approved_role is null or approved_role in('manager','broker')),
  status text not null default 'pending' check(status in(
    'pending','correction_requested','approved','rejected','cancelled','revoked','expired','consumed','closed'
  )),
  full_name text not null check(char_length(trim(full_name)) between 2 and 160),
  email text not null check(email=lower(email)),
  whatsapp_e164 text not null check(whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  introduction text check(introduction is null or char_length(trim(introduction))<=1000),
  organization_name text check(organization_name is null or char_length(trim(organization_name)) between 2 and 120),
  city text check(city is null or char_length(trim(city)) between 2 and 100),
  state text check(state is null or state ~ '^[A-Z]{2}$'),
  cnpj text check(cnpj is null or char_length(trim(cnpj)) between 11 and 30),
  creci text check(creci is null or char_length(trim(creci)) between 2 and 60),
  approximate_brokers integer check(approximate_brokers is null or approximate_brokers between 0 and 100000),
  operation_description text check(operation_description is null or char_length(trim(operation_description))<=2000),
  public_reason text check(public_reason is null or char_length(trim(public_reason)) between 3 and 1000),
  approval_expires_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  version integer not null default 1 check(version>0),
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((request_type='create_organization' and org_id is null and requested_role is null)
    or(request_type='join_manager' and org_id is not null and requested_role='manager')
    or(request_type='join_broker' and org_id is not null and requested_role='broker'))
);
create unique index access_requests_one_open_per_user_idx on public.access_requests(requester_user_id)
  where status in('pending','correction_requested','approved');
create index access_requests_org_queue_idx on public.access_requests(org_id,status,created_at desc) where org_id is not null;
create index access_requests_platform_queue_idx on public.access_requests(status,created_at desc) where request_type='create_organization';

create table private.access_request_events(
  id bigint generated always as identity primary key,
  request_id uuid not null references public.access_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  public_reason text,
  internal_note text,
  snapshot jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index access_request_events_request_idx on private.access_request_events(request_id,occurred_at desc);

create table private.platform_notifications(
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/platform',
  status text not null default 'pending' check(status in('pending','sent','failed','cancelled')),
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index platform_notifications_recipient_idx on private.platform_notifications(recipient_user_id,read_at,created_at desc);

create table private.platform_push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  revoked_at timestamptz,
  last_success_at timestamptz,
  last_error_redacted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.is_platform_principal(p_user_id uuid,p_roles text[] default array['platform_admin','support']::text[])
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from private.platform_principals p where p.user_id=p_user_id and p.active and p.role=any(p_roles))
    and private.account_is_operational(p_user_id);
$$;
revoke all on function private.is_platform_principal(uuid,text[]) from public,anon,authenticated,service_role;

create or replace function public.current_platform_context()
returns table(role text,status text) language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_user uuid:=(select auth.uid());v_email text;v_invitation private.platform_account_invitations%rowtype;
begin
  if v_user is null or not private.account_is_operational(v_user) then return;end if;
  if exists(select 1 from private.platform_principals p where p.user_id=v_user and p.active) then
    return query select p.role,'active'::text from private.platform_principals p where p.user_id=v_user and p.active;return;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id=v_user and u.email_confirmed_at is not null;
  if v_email is null then return;end if;
  select i.* into v_invitation from private.platform_account_invitations i
    where i.user_id=v_user and i.status='pending' order by i.created_at desc limit 1 for update;
  if not found then return;end if;
  if v_invitation.expires_at<=now() then
    update private.platform_account_invitations set status='expired' where id=v_invitation.id;return;
  end if;
  if v_email<>v_invitation.email then return;end if;
  update private.platform_principals set role=v_invitation.role,active=true,disabled_at=null,disabled_by=null where user_id=v_user;
  update private.platform_account_invitations set status='accepted',accepted_at=now() where id=v_invitation.id;
  return query select v_invitation.role,'active'::text;
end;$$;
revoke all on function public.current_platform_context() from public,anon;
grant execute on function public.current_platform_context() to authenticated,service_role;

create or replace function private.current_platform_role()
returns text language sql stable security definer set search_path=pg_catalog as $$
  select p.role from private.platform_principals p where p.user_id=(select auth.uid()) and p.active
    and private.account_is_operational(p.user_id);
$$;
revoke all on function private.current_platform_role() from public,anon,authenticated,service_role;

create or replace function public.current_access_block()
returns table(block_type text,public_message text) language sql stable security definer set search_path=pg_catalog as $$
  select 'account'::text,c.public_message from private.account_controls c
    where c.user_id=(select auth.uid()) and c.suspended
  union all
  select o.status,o.suspension_public_message from public.memberships m join public.organizations o on o.id=m.org_id
    where m.user_id=(select auth.uid()) and o.status in('suspended','archived')
  limit 1;
$$;
revoke all on function public.current_access_block() from public,anon;
grant execute on function public.current_access_block() to authenticated,service_role;

-- Central authorization helpers now reject suspended accounts and inactive
-- tenants. Explicit support grants remain usable for diagnostics on a suspended
-- tenant, but never confer an owner role.
create or replace function private.has_contractual_support(p_org_id uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.platform_principals pp join private.contractual_support_grants g on g.org_id=p_org_id
   where pp.user_id=(select auth.uid()) and pp.active and private.account_is_operational(pp.user_id)
     and g.active and g.revoked_at is null and(g.expires_at is null or g.expires_at>now())
     and(not p_write or g.access_level='full'));
$$;
revoke all on function private.has_contractual_support(uuid,boolean) from public,anon,service_role;
grant execute on function private.has_contractual_support(uuid,boolean) to authenticated;

create or replace function private.is_active_org_member(p_org_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m join public.organizations o on o.id=m.org_id
   where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active' and o.status='active'
     and private.account_is_operational(m.user_id)) or private.has_contractual_support(p_org_id,false);$$;
create or replace function private.has_org_role(p_org_id uuid,p_roles text[]) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m join public.organizations o on o.id=m.org_id
   where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active' and o.status='active'
     and private.account_is_operational(m.user_id) and m.role=any(p_roles));$$;
create or replace function private.has_org_permission(p_org_id uuid,p_permission text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m join public.organizations o on o.id=m.org_id
   where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active' and o.status='active'
     and private.account_is_operational(m.user_id) and(m.role='owner' or(m.role='manager' and exists(
       select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission=p_permission))))
   or private.has_contractual_support(p_org_id,true);$$;
create or replace function private.has_operation_access(p_operation_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.operations o where o.id=p_operation_id and o.status<>'archived' and(
   private.has_contractual_support(o.org_id,false) or exists(select 1 from public.memberships m join public.organizations org on org.id=m.org_id
     where m.org_id=o.org_id and m.user_id=(select auth.uid()) and m.status='active' and org.status='active'
       and private.account_is_operational(m.user_id) and(m.role in('owner','manager') or exists(
         select 1 from public.membership_operations mo where mo.membership_id=m.id and mo.operation_id=o.id)))));$$;

create or replace function public.lookup_organization_join_code(p_code text)
returns table(org_id uuid,organization_name text,city text,state text)
language sql stable security definer set search_path=pg_catalog as $$
  select o.id,o.name,o.city,o.state from private.organization_join_codes c join public.organizations o on o.id=c.org_id
  where (select auth.uid()) is not null and private.account_is_operational((select auth.uid()))
    and c.enabled and o.status='active' and c.code=upper(trim(p_code)) and upper(trim(p_code)) ~ '^[A-HJ-NP-Z2-9]{8}$';
$$;
revoke all on function public.lookup_organization_join_code(text) from public,anon;
grant execute on function public.lookup_organization_join_code(text) to authenticated,service_role;

create or replace function public.organization_join_code()
returns table(code text,enabled boolean,generated_at timestamptz) language sql stable security definer set search_path=pg_catalog as $$
  select c.code,c.enabled,c.generated_at from private.organization_join_codes c
  where(private.has_org_role(c.org_id,array['owner']::text[]) or private.has_org_permission(c.org_id,'team.manage'));
$$;
revoke all on function public.organization_join_code() from public,anon;
grant execute on function public.organization_join_code() to authenticated,service_role;

create or replace function public.record_access_rate_event(p_user_id uuid,p_ip_hash text,p_event_type text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user<>all(array['postgres','service_role']::name[]) then
    raise exception 'service_role_required' using errcode='42501';end if;
  if p_ip_hash !~ '^[a-f0-9]{64}$' or not(p_event_type=any(array['organization_request','invalid_code']::text[])) then
    raise exception 'rate_event_invalid' using errcode='22023';end if;
  if p_event_type='organization_request' and(select count(*) from private.access_request_rate_events
      where ip_hash=p_ip_hash and event_type=p_event_type and created_at>now()-interval '1 day')>=5 then
    raise exception 'organization_request_rate_limited' using errcode='54000';end if;
  if p_event_type='invalid_code' and((select count(*) from private.access_request_rate_events
      where user_id=p_user_id and event_type=p_event_type and created_at>now()-interval '15 minutes')>=5
    or(select count(*) from private.access_request_rate_events where ip_hash=p_ip_hash and event_type=p_event_type
      and created_at>now()-interval '1 hour')>=20) then
    raise exception 'join_code_rate_limited' using errcode='54000';end if;
  insert into private.access_request_rate_events(user_id,ip_hash,event_type) values(p_user_id,p_ip_hash,p_event_type);
end;$$;
revoke all on function public.record_access_rate_event(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_access_rate_event(uuid,text,text) to service_role;

create or replace function private.assert_normal_account(p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if exists(select 1 from private.platform_principals where user_id=p_user_id)
    or exists(select 1 from private.platform_account_invitations where user_id=p_user_id and status='pending') then
    raise exception 'platform_account_cannot_join_tenant' using errcode='42501';end if;
end;$$;
revoke all on function private.assert_normal_account(uuid) from public,anon,authenticated,service_role;

create or replace function public.submit_access_request(
  p_request_type text,p_whatsapp_e164 text,p_join_code text default null,p_introduction text default null,
  p_organization_name text default null,p_city text default null,p_state text default null,p_cnpj text default null,
  p_creci text default null,p_approximate_brokers integer default null,p_operation_description text default null
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid:=(select auth.uid());v_email text;v_confirmed timestamptz;v_name text;v_org uuid;v_id uuid;
  v_preauth private.organization_creation_preauthorizations%rowtype;v_status text:='pending';v_approval_expires timestamptz;
begin
  if v_user is null or not(p_request_type=any(array['create_organization','join_manager','join_broker']::text[])) then
    raise exception 'access_request_invalid' using errcode='22023';end if;
  perform private.assert_normal_account(v_user);
  select lower(u.email),u.email_confirmed_at,coalesce(nullif(trim(p.full_name),''),split_part(u.email,'@',1))
    into v_email,v_confirmed,v_name from auth.users u left join public.profiles p on p.user_id=u.id where u.id=v_user;
  if v_confirmed is null then raise exception 'email_confirmation_required' using errcode='42501';end if;
  if not private.account_is_operational(v_user) or coalesce((select requests_blocked from private.account_controls where user_id=v_user),false) then
    raise exception 'account_requests_blocked' using errcode='42501';end if;
  update public.access_requests set status='expired',updated_at=now()
    where requester_user_id=v_user and request_type='create_organization' and status='approved' and approval_expires_at<=now();
  if exists(select 1 from public.memberships where user_id=v_user and status in('pending','active','suspended'))
    or exists(select 1 from public.access_requests where requester_user_id=v_user and status in('pending','correction_requested','approved')) then
    raise exception 'account_already_linked_or_request_open' using errcode='22023';end if;
  if p_whatsapp_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'whatsapp_invalid' using errcode='22023';end if;
  if exists(select 1 from public.profiles p where p.whatsapp_e164=p_whatsapp_e164 and p.user_id<>v_user)
    or exists(select 1 from public.access_requests r where r.whatsapp_e164=p_whatsapp_e164 and r.requester_user_id<>v_user
      and r.status in('pending','correction_requested','approved')) then
    raise exception 'whatsapp_already_in_use' using errcode='23505';end if;

  if p_request_type='create_organization' then
    if nullif(trim(p_organization_name),'') is null or nullif(trim(p_city),'') is null or upper(trim(p_state)) !~ '^[A-Z]{2}$' then
      raise exception 'organization_request_fields_required' using errcode='22023';end if;
    if exists(select 1 from public.access_requests where requester_user_id=v_user and request_type='create_organization'
      and status='rejected' and updated_at>now()-interval '7 days') then raise exception 'organization_request_cooldown' using errcode='54000';end if;
    select * into v_preauth from private.organization_creation_preauthorizations
      where email=v_email and status='active' and expires_at>now() order by created_at desc limit 1 for update;
    if found then v_status:='approved';v_approval_expires:=least(v_preauth.expires_at,now()+interval '30 days');
      update private.organization_creation_preauthorizations set status='used',used_at=now() where id=v_preauth.id;end if;
  else
    select c.org_id into v_org from private.organization_join_codes c join public.organizations o on o.id=c.org_id
      where c.code=upper(trim(p_join_code)) and c.enabled and o.status='active';
    if v_org is null then raise exception 'organization_code_not_found' using errcode='22023';end if;
    if exists(select 1 from public.access_requests where requester_user_id=v_user and org_id=v_org
      and request_type in('join_manager','join_broker') and status='rejected' and updated_at>now()-interval '7 days') then
      raise exception 'organization_membership_request_cooldown' using errcode='54000';end if;
  end if;

  insert into public.access_requests(requester_user_id,request_type,org_id,requested_role,status,full_name,email,
    whatsapp_e164,introduction,organization_name,city,state,cnpj,creci,approximate_brokers,operation_description,
    approval_expires_at,approved_at)
  values(v_user,p_request_type,v_org,case when p_request_type='join_manager' then 'manager' when p_request_type='join_broker' then 'broker' end,
    v_status,v_name,v_email,p_whatsapp_e164,nullif(trim(p_introduction),''),nullif(trim(p_organization_name),''),
    nullif(trim(p_city),''),upper(nullif(trim(p_state),'')),nullif(trim(p_cnpj),''),nullif(trim(p_creci),''),
    p_approximate_brokers,nullif(trim(p_operation_description),''),v_approval_expires,case when v_status='approved' then now() end)
  returning id into v_id;
  insert into private.access_request_events(request_id,actor_user_id,action,snapshot)
    select v_id,v_user,'submitted',to_jsonb(r) from public.access_requests r where r.id=v_id;
  if p_request_type='create_organization' then
    insert into private.platform_notifications(recipient_user_id,title,body,url)
      select pp.user_id,'Nova imobiliária aguardando análise',v_name||' solicitou a criação de '||trim(p_organization_name),'/platform'
      from private.platform_principals pp where pp.active and pp.role='platform_admin';
  else
    insert into public.notifications(org_id,recipient_membership_id,channel,title,body,status)
      select v_org,m.id,channel.value,'Nova solicitação de acesso',v_name||' pediu acesso como '||
        case when p_request_type='join_manager' then 'gestor' else 'corretor' end,'pending'
      from public.memberships m cross join(values('in_app'),('push')) channel(value)
      where m.org_id=v_org and m.status='active' and(m.role='owner' or(p_request_type='join_broker' and m.role='manager'
        and exists(select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission='team.manage')));
  end if;
  return v_id;
end;$$;
revoke all on function public.submit_access_request(text,text,text,text,text,text,text,text,text,integer,text) from public,anon;
grant execute on function public.submit_access_request(text,text,text,text,text,text,text,text,text,integer,text) to authenticated,service_role;

create or replace function public.resubmit_access_request(
  p_request_id uuid,p_whatsapp_e164 text,p_introduction text default null,p_organization_name text default null,
  p_city text default null,p_state text default null,p_cnpj text default null,p_creci text default null,
  p_approximate_brokers integer default null,p_operation_description text default null
) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid:=(select auth.uid());v_request public.access_requests%rowtype;
begin
  select * into v_request from public.access_requests where id=p_request_id and requester_user_id=v_user for update;
  if not found or v_request.status<>'correction_requested' then raise exception 'request_not_editable' using errcode='22023';end if;
  if p_whatsapp_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'whatsapp_invalid' using errcode='22023';end if;
  if v_request.request_type='create_organization' and(nullif(trim(p_organization_name),'') is null
    or nullif(trim(p_city),'') is null or upper(trim(p_state)) !~ '^[A-Z]{2}$') then
    raise exception 'organization_request_fields_required' using errcode='22023';end if;
  update public.access_requests set whatsapp_e164=p_whatsapp_e164,introduction=nullif(trim(p_introduction),''),
    organization_name=case when request_type='create_organization' then trim(p_organization_name) else organization_name end,
    city=case when request_type='create_organization' then trim(p_city) else city end,
    state=case when request_type='create_organization' then upper(trim(p_state)) else state end,
    cnpj=case when request_type='create_organization' then nullif(trim(p_cnpj),'') else cnpj end,
    creci=case when request_type='create_organization' then nullif(trim(p_creci),'') else creci end,
    approximate_brokers=case when request_type='create_organization' then p_approximate_brokers else approximate_brokers end,
    operation_description=case when request_type='create_organization' then nullif(trim(p_operation_description),'') else operation_description end,
    status='pending',public_reason=null,version=version+1,last_submitted_at=now(),updated_at=now() where id=p_request_id;
  insert into private.access_request_events(request_id,actor_user_id,action,snapshot)
    select p_request_id,v_user,'resubmitted',to_jsonb(r) from public.access_requests r where r.id=p_request_id;
end;$$;
revoke all on function public.resubmit_access_request(uuid,text,text,text,text,text,text,text,integer,text) from public,anon;
grant execute on function public.resubmit_access_request(uuid,text,text,text,text,text,text,text,integer,text) to authenticated,service_role;

create or replace function public.cancel_access_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid:=(select auth.uid());
begin
  update public.access_requests set status='cancelled',updated_at=now() where id=p_request_id and requester_user_id=v_user
    and status in('pending','correction_requested','approved');
  if not found then raise exception 'request_not_cancellable' using errcode='22023';end if;
  insert into private.access_request_events(request_id,actor_user_id,action) values(p_request_id,v_user,'cancelled');
end;$$;
revoke all on function public.cancel_access_request(uuid) from public,anon;
grant execute on function public.cancel_access_request(uuid) to authenticated,service_role;

create or replace function public.decide_access_request(
  p_request_id uuid,p_decision text,p_approved_role text default null,p_operation_ids uuid[] default array[]::uuid[],
  p_public_reason text default null,p_internal_note text default null,p_confirmation text default null
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=(select auth.uid());v_request public.access_requests%rowtype;v_actor_membership public.memberships%rowtype;
  v_membership uuid;v_operation uuid;v_platform_role text;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or not(p_decision=any(array['approve','reject','request_correction','revoke_approval']::text[])) then
    raise exception 'confirmation_or_decision_invalid' using errcode='22023';end if;
  select * into v_request from public.access_requests where id=p_request_id for update;
  if not found then raise exception 'access_request_not_found' using errcode='22023';end if;
  v_platform_role:=private.current_platform_role();
  if v_request.request_type='create_organization' then
    if v_platform_role<>'platform_admin' then raise exception 'platform_admin_required' using errcode='42501';end if;
  else
    select * into v_actor_membership from public.memberships where org_id=v_request.org_id and user_id=v_actor and status='active';
    if not found then raise exception 'request_decision_forbidden' using errcode='42501';end if;
    if v_request.requested_role='manager' and v_actor_membership.role<>'owner' then
      raise exception 'owner_required_for_manager_request' using errcode='42501';end if;
    if v_request.requested_role='broker' and not(v_actor_membership.role='owner' or(v_actor_membership.role='manager' and exists(
      select 1 from public.membership_permissions mp where mp.membership_id=v_actor_membership.id and mp.permission='team.manage'))) then
      raise exception 'team_manager_required' using errcode='42501';end if;
    if not exists(select 1 from public.organizations where id=v_request.org_id and status='active') then
      raise exception 'organization_not_active' using errcode='55000';end if;
  end if;
  if p_decision='revoke_approval' then
    if v_request.request_type<>'create_organization' or v_request.status<>'approved' or v_request.consumed_at is not null then
      raise exception 'approval_not_revocable' using errcode='22023';end if;
    update public.access_requests set status='revoked',public_reason=coalesce(nullif(trim(p_public_reason),''),'Autorização revogada.'),updated_at=now() where id=v_request.id;
  elsif p_decision='request_correction' then
    if v_request.status<>'pending' or nullif(trim(p_public_reason),'') is null then raise exception 'correction_reason_required' using errcode='22023';end if;
    update public.access_requests set status='correction_requested',public_reason=trim(p_public_reason),updated_at=now() where id=v_request.id;
  elsif p_decision='reject' then
    if not(v_request.status=any(array['pending','correction_requested']::text[])) or nullif(trim(p_public_reason),'') is null then
      raise exception 'rejection_reason_required' using errcode='22023';end if;
    update public.access_requests set status='rejected',public_reason=trim(p_public_reason),updated_at=now() where id=v_request.id;
  else
    if v_request.status<>'pending' then raise exception 'request_not_pending' using errcode='22023';end if;
    if not exists(select 1 from auth.users where id=v_request.requester_user_id and email_confirmed_at is not null) then
      raise exception 'email_confirmation_required' using errcode='42501';end if;
    perform private.assert_normal_account(v_request.requester_user_id);
    if exists(select 1 from public.memberships where user_id=v_request.requester_user_id and status in('pending','active','suspended')) then
      raise exception 'account_already_linked' using errcode='22023';end if;
    if v_request.request_type='create_organization' then
      update public.access_requests set status='approved',approved_at=now(),approved_by=v_actor,
        approval_expires_at=now()+interval '30 days',public_reason=null,updated_at=now() where id=v_request.id;
    else
      if not(p_approved_role=any(array['manager','broker']::text[])) then raise exception 'approved_role_required' using errcode='22023';end if;
      if v_actor_membership.role='manager' and p_approved_role<>'broker' then raise exception 'manager_cannot_create_manager' using errcode='42501';end if;
      if p_approved_role='broker' and coalesce(array_length(p_operation_ids,1),0)=0 then
        raise exception 'broker_operation_required' using errcode='22023';end if;
      if exists(select 1 from unnest(p_operation_ids) x where not exists(select 1 from public.operations o
        where o.id=x and o.org_id=v_request.org_id and o.status<>'archived')) then raise exception 'operation_invalid' using errcode='22023';end if;
      insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
        values(v_request.org_id,v_request.requester_user_id,p_approved_role,'active',now(),v_actor) returning id into v_membership;
      if p_approved_role='broker' then
        foreach v_operation in array p_operation_ids loop
          insert into public.membership_operations(membership_id,operation_id,org_id) values(v_membership,v_operation,v_request.org_id);
        end loop;
      else
        insert into public.membership_permissions(membership_id,permission) values
          (v_membership,'team.manage'),(v_membership,'operations.manage'),(v_membership,'operations.pause'),
          (v_membership,'contacts.manage'),(v_membership,'campaigns.manage'),(v_membership,'pipeline.manage'),
          (v_membership,'reports.view'),(v_membership,'ai.manage') on conflict do nothing;
      end if;
      update public.profiles set whatsapp_e164=v_request.whatsapp_e164,updated_at=now() where user_id=v_request.requester_user_id;
      update public.access_requests set status='consumed',approved_role=p_approved_role,approved_at=now(),approved_by=v_actor,
        consumed_at=now(),public_reason=null,updated_at=now() where id=v_request.id;
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,status)
        values(v_request.org_id,v_membership,'in_app','Acesso aprovado','Seu acesso foi liberado como '||
          case when p_approved_role='manager' then 'gestor' else 'corretor' end||'.','pending');
    end if;
  end if;
  insert into private.access_request_events(request_id,actor_user_id,action,public_reason,internal_note,snapshot)
    select v_request.id,v_actor,p_decision,nullif(trim(p_public_reason),''),nullif(trim(p_internal_note),''),to_jsonb(r)
      from public.access_requests r where r.id=v_request.id;
  return(select status from public.access_requests where id=v_request.id);
end;$$;
revoke all on function public.decide_access_request(uuid,text,text,uuid[],text,text,text) from public,anon;
grant execute on function public.decide_access_request(uuid,text,text,uuid[],text,text,text) to authenticated,service_role;

alter table public.organization_bootstrap_requests
  add column access_request_id uuid references public.access_requests(id) on delete restrict,
  add column city text,
  add column state text;

create or replace function private.process_organization_bootstrap_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_operation uuid;v_membership uuid;v_org_slug text;v_operation_slug text;v_access public.access_requests%rowtype;
begin
  if(select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'bootstrap_forbidden' using errcode='42501';end if;
  perform private.assert_normal_account(new.actor_user_id);
  if exists(select 1 from public.memberships where user_id=new.actor_user_id and status in('pending','active','suspended')) then
    raise exception 'bootstrap_membership_exists' using errcode='22023';end if;
  select * into v_access from public.access_requests where requester_user_id=new.actor_user_id and request_type='create_organization'
    and status='approved' and approval_expires_at>now() and(new.access_request_id is null or id=new.access_request_id)
    order by approved_at desc limit 1 for update;
  if not found then raise exception 'approved_organization_request_required' using errcode='42501';end if;
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'bootstrap_timezone_invalid' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(new.actor_user_id::text,0));
  v_org_slug:=coalesce(nullif(private.safe_slug(new.organization_name),''),'organizacao');
  while exists(select 1 from public.organizations where slug=v_org_slug) loop
    v_org_slug:=left(v_org_slug,52)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,7);end loop;
  v_operation_slug:=coalesce(nullif(private.safe_slug(new.operation_name),''),'operacao');
  insert into public.organizations(name,slug,timezone,city,state)
    values(trim(new.organization_name),v_org_slug,new.timezone,coalesce(nullif(trim(new.city),''),v_access.city),
      coalesce(upper(nullif(trim(new.state),'')),v_access.state)) returning id into v_org;
  insert into public.operations(org_id,name,slug,timezone,is_default)
    values(v_org,trim(new.operation_name),v_operation_slug,new.timezone,true) returning id into v_operation;
  insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
    values(v_org,new.actor_user_id,'owner','active',now(),v_access.approved_by) returning id into v_membership;
  insert into public.membership_operations(membership_id,operation_id,org_id) values(v_membership,v_operation,v_org);
  update public.profiles set whatsapp_e164=v_access.whatsapp_e164,updated_at=now() where user_id=new.actor_user_id;
  update public.organization_settings set institutional_profile=institutional_profile||jsonb_strip_nulls(jsonb_build_object(
    'company_name',v_access.organization_name,'cnpj',v_access.cnpj,'creci',v_access.creci,'city',v_access.city,'state',v_access.state,
    'operation_description',v_access.operation_description,'approximate_brokers',v_access.approximate_brokers)) where org_id=v_org;
  update public.access_requests set status='consumed',consumed_at=now(),updated_at=now() where id=v_access.id;
  insert into private.access_request_events(request_id,actor_user_id,action,snapshot)
    values(v_access.id,new.actor_user_id,'organization_created',jsonb_build_object('org_id',v_org,'operation_id',v_operation));
  new.organization_id:=v_org;new.operation_id:=v_operation;new.membership_id:=v_membership;new.access_request_id:=v_access.id;
  new.city:=coalesce(new.city,v_access.city);new.state:=coalesce(new.state,v_access.state);new.result:='created';new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(v_org,new.actor_user_id,'organization.bootstrapped','organizations',v_org,jsonb_build_object(
      'operation_id',v_operation,'membership_id',v_membership,'access_request_id',v_access.id));
  return new;
end;$$;
revoke all on function private.process_organization_bootstrap_request() from public,anon,authenticated,service_role;

create or replace function public.rotate_organization_join_code(p_action text,p_reason text,p_confirmation text)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_code text;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or nullif(trim(p_reason),'') is null or not(p_action=any(array['rotate','disable']::text[])) then
    raise exception 'confirmation_reason_or_action_invalid' using errcode='22023';end if;
  select m.org_id into v_org from public.memberships m where m.user_id=(select auth.uid()) and m.status='active' and m.role='owner';
  if v_org is null then raise exception 'owner_required' using errcode='42501';end if;
  if p_action='rotate' then v_code:=private.new_organization_join_code();
    update private.organization_join_codes set code=v_code,enabled=true,generated_at=now(),generated_by=(select auth.uid()) where org_id=v_org;
  else update private.organization_join_codes set enabled=false,generated_at=now(),generated_by=(select auth.uid()) where org_id=v_org;
    select code into v_code from private.organization_join_codes where org_id=v_org;end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(v_org,(select auth.uid()),'organization.join_code_'||p_action,'organization_join_code',v_org,jsonb_build_object('reason',trim(p_reason)));
  return v_code;
end;$$;
revoke all on function public.rotate_organization_join_code(text,text,text) from public,anon;
grant execute on function public.rotate_organization_join_code(text,text,text) to authenticated,service_role;

-- General links are retired. Individual links are email-bound, one-use and
-- expire in at most seven days.
update public.invitation_links set status='revoked',updated_at=now() where kind='general' and status='active';
drop policy invitation_links_insert_team_manager on public.invitation_links;
drop policy invitation_links_update_team_manager on public.invitation_links;
create policy invitation_links_insert_team_manager on public.invitation_links for insert to authenticated with check(
  created_by=(select auth.uid()) and kind='individual' and email is not null and max_uses=1 and used_count=0 and status='active'
  and expires_at is not null and expires_at<=created_at+interval '7 days' and private.has_org_permission(org_id,'team.manage')
  and(role='broker' or private.has_org_role(org_id,array['owner']::text[]))
);
create policy invitation_links_update_team_manager on public.invitation_links for update to authenticated
  using(private.has_org_permission(org_id,'team.manage')) with check(
    kind='individual' and email is not null and max_uses=1 and expires_at is not null and expires_at<=created_at+interval '7 days'
    and(role='broker' or private.has_org_role(org_id,array['owner']::text[]))
  );

create or replace function private.claim_invitation_link()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_link public.invitation_links%rowtype;v_membership_id uuid;v_user_email text;v_email_confirmed timestamptz;
begin
  if(select auth.uid()) is null or new.user_id<>(select auth.uid()) then raise exception 'invitation_claim_user_mismatch' using errcode='42501';end if;
  perform private.assert_normal_account(new.user_id);
  select lower(email),email_confirmed_at into v_user_email,v_email_confirmed from auth.users where id=new.user_id;
  select * into v_link from public.invitation_links where token_hash=new.token_hash for update;
  if not found or v_link.kind<>'individual' or v_link.status<>'active' or v_link.expires_at<=now() or v_link.used_count>=1
    or not exists(select 1 from public.organizations where id=v_link.org_id and status='active') then
    raise exception 'invitation_link_invalid_or_expired' using errcode='22023';end if;
  if v_email_confirmed is null then raise exception 'email_must_be_confirmed_before_invitation' using errcode='22023';end if;
  if v_user_email is null or v_user_email<>v_link.email then raise exception 'invitation_email_mismatch' using errcode='42501';end if;
  if exists(select 1 from public.memberships where user_id=new.user_id and status in('pending','active','suspended')) then
    raise exception 'account_already_linked' using errcode='22023';end if;
  insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
    values(v_link.org_id,new.user_id,v_link.role,'active',now(),v_link.created_by) returning id into v_membership_id;
  if v_link.role='broker' then
    if v_link.operation_id is null then raise exception 'broker_invitation_operation_required' using errcode='22023';end if;
    insert into public.membership_operations(membership_id,operation_id,org_id) values(v_membership_id,v_link.operation_id,v_link.org_id);
  else
    insert into public.membership_permissions(membership_id,permission) values
      (v_membership_id,'team.manage'),(v_membership_id,'operations.manage'),(v_membership_id,'operations.pause'),
      (v_membership_id,'contacts.manage'),(v_membership_id,'campaigns.manage'),(v_membership_id,'pipeline.manage'),
      (v_membership_id,'reports.view'),(v_membership_id,'ai.manage') on conflict do nothing;
  end if;
  update public.invitation_links set used_count=1,status='exhausted',updated_at=now() where id=v_link.id;
  new.invitation_link_id:=v_link.id;new.org_id:=v_link.org_id;new.claimed_at:=now();return new;
end;$$;
revoke all on function private.claim_invitation_link() from public,anon,authenticated,service_role;

create or replace function private.platform_admin_required()
returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=(select auth.uid());
begin
  if not private.is_platform_principal(v_actor,array['platform_admin']::text[]) then
    raise exception 'platform_admin_required' using errcode='42501';end if;return v_actor;
end;$$;
revoke all on function private.platform_admin_required() from public,anon,authenticated,service_role;

create or replace function public.platform_control_organization(
  p_org_id uuid,p_action text,p_public_message text,p_internal_note text,p_confirmation text
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();v_status text;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or nullif(trim(p_internal_note),'') is null
    or not(p_action=any(array['suspend','reactivate','archive','restore']::text[])) then raise exception 'platform_action_invalid' using errcode='22023';end if;
  select status into v_status from public.organizations where id=p_org_id for update;
  if not found then raise exception 'organization_not_found' using errcode='22023';end if;
  if p_action='suspend' then
    if v_status<>'active' or nullif(trim(p_public_message),'') is null then raise exception 'active_org_and_public_message_required' using errcode='22023';end if;
    update public.organizations set status='suspended',suspension_public_message=trim(p_public_message),suspended_at=now(),suspended_by=v_actor,updated_at=now() where id=p_org_id;
    insert into public.system_pauses(org_id,scope_type,reason,source,paused_by,metadata)
      select p_org_id,'organization',trim(p_internal_note),'platform',v_actor,jsonb_build_object('resume_requires_owner',true)
      where not exists(select 1 from public.system_pauses where org_id=p_org_id and scope_type='organization' and active);
  elsif p_action='reactivate' then
    if v_status<>'suspended' then raise exception 'suspended_org_required' using errcode='22023';end if;
    update public.organizations set status='active',suspension_public_message=null,suspended_at=null,suspended_by=null,updated_at=now() where id=p_org_id;
  elsif p_action='archive' then
    if v_status<>'suspended' then raise exception 'suspend_before_archive' using errcode='22023';end if;
    update public.organizations set status='archived',archived_at=now(),archived_by=v_actor,updated_at=now() where id=p_org_id;
    update private.organization_join_codes set enabled=false where org_id=p_org_id;
    update public.invitation_links set status='revoked',updated_at=now() where org_id=p_org_id and status='active';
    update public.access_requests set status='closed',public_reason='A organização não está disponível.',updated_at=now()
      where org_id=p_org_id and status in('pending','correction_requested');
  else
    if v_status<>'archived' then raise exception 'archived_org_required' using errcode='22023';end if;
    update public.organizations set status='suspended',archived_at=null,archived_by=null,suspension_public_message=coalesce(nullif(trim(p_public_message),''),'Organização temporariamente suspensa.'),updated_at=now() where id=p_org_id;
    update private.organization_join_codes set enabled=true where org_id=p_org_id;
  end if;
  insert into private.support_audit_events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(p_org_id,v_actor,'platform.organization_'||p_action,'organizations',p_org_id,jsonb_build_object(
      'public_message',nullif(trim(p_public_message),''),'internal_note',trim(p_internal_note)));
  return(select status from public.organizations where id=p_org_id);
end;$$;
revoke all on function public.platform_control_organization(uuid,text,text,text,text) from public,anon;
grant execute on function public.platform_control_organization(uuid,text,text,text,text) to authenticated,service_role;

create or replace function public.platform_control_user(
  p_user_id uuid,p_action text,p_public_message text,p_internal_note text,p_confirmation text
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();v_membership public.memberships%rowtype;v_is_admin boolean;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or nullif(trim(p_internal_note),'') is null
    or not(p_action=any(array['suspend','reactivate','block_requests','unblock_requests']::text[])) then raise exception 'platform_user_action_invalid' using errcode='22023';end if;
  if p_user_id=v_actor then raise exception 'cannot_control_self' using errcode='42501';end if;
  select role='platform_admin' into v_is_admin from private.platform_principals where user_id=p_user_id and active;
  if coalesce(v_is_admin,false) and p_action='suspend' and(select count(*) from private.platform_principals where role='platform_admin' and active)<=1 then
    raise exception 'last_platform_admin_cannot_be_disabled' using errcode='42501';end if;
  insert into private.account_controls(user_id) values(p_user_id) on conflict(user_id) do nothing;
  if p_action='suspend' then
    if nullif(trim(p_public_message),'') is null then raise exception 'public_message_required' using errcode='22023';end if;
    select * into v_membership from public.memberships where user_id=p_user_id and status in('pending','active') order by created_at limit 1;
    update private.account_controls set suspended=true,public_message=trim(p_public_message),internal_note=trim(p_internal_note),
      previous_membership_id=v_membership.id,previous_membership_status=v_membership.status,suspended_at=now(),suspended_by=v_actor,updated_at=now() where user_id=p_user_id;
    update public.memberships set status='suspended',updated_at=now() where user_id=p_user_id and status in('pending','active');
    update private.platform_principals set active=false,disabled_at=now(),disabled_by=v_actor where user_id=p_user_id;
    delete from auth.sessions where user_id=p_user_id;
  elsif p_action='reactivate' then
    update private.account_controls set suspended=false,public_message=null,internal_note=trim(p_internal_note),reactivated_at=now(),reactivated_by=v_actor,updated_at=now() where user_id=p_user_id;
    update public.memberships m set status=case when c.previous_membership_status='pending' then 'pending' else 'active' end,updated_at=now()
      from private.account_controls c where c.user_id=p_user_id and m.id=c.previous_membership_id and m.status='suspended';
    update private.platform_principals set active=true,disabled_at=null,disabled_by=null where user_id=p_user_id;
  elsif p_action='block_requests' then
    update private.account_controls set requests_blocked=true,internal_note=trim(p_internal_note),updated_at=now() where user_id=p_user_id;
  else update private.account_controls set requests_blocked=false,internal_note=trim(p_internal_note),updated_at=now() where user_id=p_user_id;end if;
  insert into private.support_audit_events(actor_user_id,action,entity_type,entity_id,metadata)
    values(v_actor,'platform.user_'||p_action,'auth.users',p_user_id,jsonb_build_object('public_message',nullif(trim(p_public_message),''),'internal_note',trim(p_internal_note)));
  return p_action;
end;$$;
revoke all on function public.platform_control_user(uuid,text,text,text,text) from public,anon;
grant execute on function public.platform_control_user(uuid,text,text,text,text) to authenticated,service_role;

create or replace function public.platform_manage_support_grant(
  p_org_id uuid,p_action text,p_access_level text,p_contract_reference text,p_expires_at timestamptz,p_confirmation text
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();v_id uuid;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or not(p_action=any(array['grant','revoke']::text[])) then raise exception 'support_grant_action_invalid' using errcode='22023';end if;
  if p_action='grant' then
    if not(p_access_level=any(array['read_only','full']::text[])) or nullif(trim(p_contract_reference),'') is null
      or(p_expires_at is not null and p_expires_at<=now()) then raise exception 'support_grant_fields_invalid' using errcode='22023';end if;
    update private.contractual_support_grants set active=false,revoked_at=now(),revoked_by=v_actor where org_id=p_org_id and active and revoked_at is null;
    insert into private.contractual_support_grants(org_id,access_level,expires_at,contract_reference,granted_by)
      values(p_org_id,p_access_level,p_expires_at,trim(p_contract_reference),v_actor) returning id into v_id;
  else
    update private.contractual_support_grants set active=false,revoked_at=now(),revoked_by=v_actor
      where org_id=p_org_id and active and revoked_at is null returning id into v_id;
    if v_id is null then raise exception 'active_support_grant_not_found' using errcode='22023';end if;
  end if;
  insert into private.support_audit_events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(p_org_id,v_actor,'platform.support_'||p_action,'contractual_support_grants',v_id,jsonb_build_object(
      'access_level',p_access_level,'contract_reference',nullif(trim(p_contract_reference),''),'expires_at',p_expires_at));
  return v_id;
end;$$;
revoke all on function public.platform_manage_support_grant(uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.platform_manage_support_grant(uuid,text,text,text,timestamptz,text) to authenticated,service_role;

create or replace function public.revoke_external_support_access(p_confirmation text)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_count integer;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' then raise exception 'confirmation_required' using errcode='22023';end if;
  select org_id into v_org from public.memberships where user_id=(select auth.uid()) and status='active' and role='owner';
  if v_org is null then raise exception 'owner_required' using errcode='42501';end if;
  update private.contractual_support_grants set active=false,revoked_at=now(),revoked_by=(select auth.uid())
    where org_id=v_org and active and revoked_at is null;get diagnostics v_count=row_count;
  insert into private.support_audit_events(org_id,actor_user_id,action,entity_type,metadata)
    values(v_org,(select auth.uid()),'tenant.support_revoked','contractual_support_grants',jsonb_build_object('count',v_count));
  return v_count;
end;$$;
revoke all on function public.revoke_external_support_access(text) from public,anon;
grant execute on function public.revoke_external_support_access(text) to authenticated,service_role;

create or replace function public.register_platform_invitation(
  p_user_id uuid,p_email text,p_role text,p_created_by uuid,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user<>all(array['postgres','service_role']::name[]) then
    raise exception 'service_role_required' using errcode='42501';end if;
  if not(p_role=any(array['platform_admin','support']::text[])) or p_expires_at<=now() or lower(trim(p_email))<>(select lower(email) from auth.users where id=p_user_id) then
    raise exception 'platform_invitation_invalid' using errcode='22023';end if;
  if exists(select 1 from public.memberships where user_id=p_user_id and status<>'revoked') then raise exception 'tenant_account_cannot_be_platform' using errcode='42501';end if;
  insert into private.platform_principals(user_id,role,active,created_by) values(p_user_id,p_role,false,p_created_by)
    on conflict(user_id) do update set role=excluded.role,active=false,created_by=excluded.created_by;
  update private.platform_account_invitations set status='revoked',revoked_at=now() where user_id=p_user_id and status='pending';
  insert into private.platform_account_invitations(user_id,email,role,expires_at,created_by)
    values(p_user_id,lower(trim(p_email)),p_role,p_expires_at,p_created_by) returning id into v_id;
  return v_id;
end;$$;
revoke all on function public.register_platform_invitation(uuid,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.register_platform_invitation(uuid,text,text,uuid,timestamptz) to service_role;

create or replace function public.platform_manage_principal(
  p_user_id uuid,p_action text,p_role text,p_confirmation text
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();v_current text;
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or not(p_action=any(array['activate','deactivate','change_role','revoke_invitation']::text[])) then
    raise exception 'principal_action_invalid' using errcode='22023';end if;
  if p_action='deactivate' and p_user_id=v_actor then raise exception 'cannot_deactivate_self' using errcode='42501';end if;
  select role into v_current from private.platform_principals where user_id=p_user_id;
  if v_current='platform_admin' and p_action in('deactivate','change_role') and coalesce(p_role,'support')<>'platform_admin'
    and(select count(*) from private.platform_principals where role='platform_admin' and active)<=1 then
    raise exception 'last_platform_admin_cannot_be_removed' using errcode='42501';end if;
  if p_action='activate' then update private.platform_principals set active=true,disabled_at=null,disabled_by=null where user_id=p_user_id;
  elsif p_action='deactivate' then update private.platform_principals set active=false,disabled_at=now(),disabled_by=v_actor where user_id=p_user_id;delete from auth.sessions where user_id=p_user_id;
  elsif p_action='change_role' then if not(p_role=any(array['platform_admin','support']::text[])) then raise exception 'platform_role_invalid' using errcode='22023';end if;
    update private.platform_principals set role=p_role where user_id=p_user_id;
  else update private.platform_account_invitations set status='revoked',revoked_at=now() where user_id=p_user_id and status='pending';
    update private.platform_principals set active=false,disabled_at=now(),disabled_by=v_actor where user_id=p_user_id;end if;
  insert into private.support_audit_events(actor_user_id,action,entity_type,entity_id,metadata)
    values(v_actor,'platform.principal_'||p_action,'platform_principals',p_user_id,jsonb_build_object('role',p_role));
  return p_action;
end;$$;
revoke all on function public.platform_manage_principal(uuid,text,text,text) from public,anon;
grant execute on function public.platform_manage_principal(uuid,text,text,text) to authenticated,service_role;

create or replace function public.platform_preauthorize_organization(p_email text,p_action text,p_confirmation text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();v_id uuid;v_email text:=lower(trim(p_email));
begin
  if p_confirmation<>'CONFIRMAR AÇÃO' or not(p_action=any(array['create','revoke']::text[])) or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'preauthorization_action_invalid' using errcode='22023';end if;
  if p_action='create' then
    update private.organization_creation_preauthorizations set status='revoked',revoked_at=now(),revoked_by=v_actor where email=v_email and status='active';
    insert into private.organization_creation_preauthorizations(email,expires_at,created_by)
      values(v_email,now()+interval '30 days',v_actor) returning id into v_id;
  else update private.organization_creation_preauthorizations set status='revoked',revoked_at=now(),revoked_by=v_actor
      where email=v_email and status='active' returning id into v_id;
    if v_id is null then raise exception 'preauthorization_not_found' using errcode='22023';end if;end if;
  return v_id;
end;$$;
revoke all on function public.platform_preauthorize_organization(text,text,text) from public,anon;
grant execute on function public.platform_preauthorize_organization(text,text,text) to authenticated,service_role;

create or replace function public.support_access_context(p_org_id uuid)
returns table(org_id uuid,organization_name text,access_level text,organization_status text)
language sql stable security definer set search_path=pg_catalog as $$
  select o.id,o.name,g.access_level,o.status from public.organizations o join private.contractual_support_grants g on g.org_id=o.id
    join private.platform_principals p on p.user_id=(select auth.uid())
  where o.id=p_org_id and p.active and private.account_is_operational(p.user_id) and g.active and g.revoked_at is null
    and(g.expires_at is null or g.expires_at>now());
$$;
revoke all on function public.support_access_context(uuid) from public,anon;
grant execute on function public.support_access_context(uuid) to authenticated,service_role;

create or replace function public.platform_control_snapshot()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_role text:=private.current_platform_role();
begin
  if v_role is null then raise exception 'platform_access_forbidden' using errcode='42501';end if;
  return jsonb_build_object(
    'role',v_role,
    'unread_notifications',(select count(*) from private.platform_notifications n where n.recipient_user_id=(select auth.uid()) and n.read_at is null),
    'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'status',o.status,'city',o.city,'state',o.state,
      'active_members',(select count(*) from public.memberships m where m.org_id=o.id and m.status='active'),
      'open_opportunities',(select count(*) from public.opportunities op where op.org_id=o.id and op.status='open'),
      'support_grant',(select jsonb_build_object('id',g.id,'access_level',g.access_level,'contract_reference',g.contract_reference,'expires_at',g.expires_at)
        from private.contractual_support_grants g where g.org_id=o.id and g.active and g.revoked_at is null and(g.expires_at is null or g.expires_at>now()) limit 1)) order by o.name)
      from public.organizations o),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'requester_user_id',r.requester_user_id,'request_type',r.request_type,
      'org_id',r.org_id,'organization_target',(select o.name from public.organizations o where o.id=r.org_id),'status',r.status,'full_name',r.full_name,
      'email',r.email,'whatsapp_e164',r.whatsapp_e164,'introduction',r.introduction,'organization_name',r.organization_name,'city',r.city,'state',r.state,
      'cnpj',r.cnpj,'creci',r.creci,'approximate_brokers',r.approximate_brokers,'operation_description',r.operation_description,
      'public_reason',r.public_reason,'version',r.version,'created_at',r.created_at,'updated_at',r.updated_at,
      'internal_notes',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'note',e.internal_note,'occurred_at',e.occurred_at)
        order by e.occurred_at desc) filter(where e.internal_note is not null),'[]'::jsonb) from private.access_request_events e where e.request_id=r.id))
      order by r.created_at desc) from public.access_requests r where r.status in('pending','correction_requested','approved')),'[]'::jsonb),
    'principals',case when v_role='platform_admin' then coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'email',u.email,
      'role',p.role,'active',p.active,'created_at',p.created_at) order by p.created_at) from private.platform_principals p join auth.users u on u.id=p.user_id),'[]'::jsonb) else '[]'::jsonb end,
    'preauthorizations',case when v_role='platform_admin' then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'email',a.email,'status',a.status,
      'expires_at',a.expires_at,'created_at',a.created_at) order by a.created_at desc) from private.organization_creation_preauthorizations a
      where a.status='active' and a.expires_at>now()),'[]'::jsonb) else '[]'::jsonb end
  );
end;$$;
revoke all on function public.platform_control_snapshot() from public,anon;
grant execute on function public.platform_control_snapshot() to authenticated,service_role;

create or replace function public.upsert_platform_push_subscription(p_endpoint text,p_p256dh text,p_auth_key text,p_user_agent text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid:=(select auth.uid());v_id uuid;
begin
  if not private.is_platform_principal(v_user) or length(p_endpoint)>2000 or length(p_p256dh)>500 or length(p_auth_key)>500 then
    raise exception 'platform_push_forbidden' using errcode='42501';end if;
  insert into private.platform_push_subscriptions(user_id,endpoint,p256dh,auth_key,user_agent)
    values(v_user,p_endpoint,p_p256dh,p_auth_key,left(p_user_agent,500))
    on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key,
      user_agent=excluded.user_agent,revoked_at=null,updated_at=now() returning id into v_id;return v_id;
end;$$;
revoke all on function public.upsert_platform_push_subscription(text,text,text,text) from public,anon;
grant execute on function public.upsert_platform_push_subscription(text,text,text,text) to authenticated,service_role;

create or replace function public.claim_platform_push_notifications(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_result jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user<>all(array['postgres','service_role']::name[]) then
    raise exception 'service_role_required' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'recipient_user_id',n.recipient_user_id,'title',n.title,'body',n.body,'url',n.url,
    'subscriptions',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth_key',s.auth_key)),'[]'::jsonb)
      from private.platform_push_subscriptions s where s.user_id=n.recipient_user_id and s.revoked_at is null))),'[]'::jsonb)
    into v_result from(select * from private.platform_notifications where status='pending' order by created_at limit least(greatest(p_limit,1),100) for update skip locked)n;
  return v_result;
end;$$;
revoke all on function public.claim_platform_push_notifications(integer) from public,anon,authenticated;
grant execute on function public.claim_platform_push_notifications(integer) to service_role;

create or replace function public.finish_platform_push_notification(p_notification_id uuid,p_delivered boolean,p_subscription_id uuid default null,p_revoke_subscription boolean default false)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user<>all(array['postgres','service_role']::name[]) then
    raise exception 'service_role_required' using errcode='42501';end if;
  update private.platform_notifications set status=case when p_delivered then 'sent' else 'failed' end,
    sent_at=case when p_delivered then now() else sent_at end where id=p_notification_id and status='pending';
  if p_subscription_id is not null then update private.platform_push_subscriptions set last_success_at=case when p_delivered then now() else last_success_at end,
    last_error_redacted=case when p_delivered then null else 'push_delivery_failed' end,
    revoked_at=case when p_revoke_subscription then now() else revoked_at end,updated_at=now() where id=p_subscription_id;end if;
end;$$;
revoke all on function public.finish_platform_push_notification(uuid,boolean,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_platform_push_notification(uuid,boolean,uuid,boolean) to service_role;

alter table public.access_requests enable row level security;
create policy access_requests_select_own_or_approver on public.access_requests for select to authenticated using(
  requester_user_id=(select auth.uid()) or(org_id is not null and(
    (requested_role='manager' and private.has_org_role(org_id,array['owner']::text[]))
    or(requested_role='broker' and private.has_org_permission(org_id,'team.manage'))
  ))
);
grant select on public.access_requests to authenticated;
grant all on public.access_requests to service_role;

-- Only an owner can resume a platform pause; managers can still create a pause
-- through the dedicated operations.pause permission.
drop policy if exists system_pauses_insert_manager on public.system_pauses;
create policy system_pauses_insert_manager on public.system_pauses for insert to authenticated with check(
  paused_by=(select auth.uid()) and(private.has_org_role(org_id,array['owner']::text[]) or private.has_org_permission(org_id,'operations.pause'))
);

comment on table public.access_requests is 'Audited, one-open-at-a-time requests for a new organization or membership in an existing tenant.';
comment on table private.organization_join_codes is 'Eight-character locator; authorization always requires an approved request.';
comment on function public.platform_control_snapshot() is 'Platform queue and aggregate controls. It does not return tenant conversation content.';

commit;
