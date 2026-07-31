begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gate-owner@invalid.test', '', now(), '{}', '{"full_name":"Gate Owner"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gate-broker@invalid.test', '', now(), '{}', '{"full_name":"Gate Broker"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gate-outsider@invalid.test', '', now(), '{}', '{"full_name":"Gate Outsider"}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gate-pending@invalid.test', '', now(), '{}', '{"full_name":"Gate Pending"}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'gate-no-membership@invalid.test', '', now(), '{}', '{"full_name":"Gate No Membership"}', now(), now());

insert into public.organizations (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Gate Org A', 'gate-org-a'),
  ('20000000-0000-0000-0000-000000000002', 'Gate Org B', 'gate-org-b');

insert into public.operations (id, org_id, name, slug, is_default)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Gate Operation A1', 'gate-op-a1', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Gate Operation A2', 'gate-op-a2', false),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Gate Operation B', 'gate-op-b', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'broker', 'active', now()),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'owner', 'active', now()),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'broker', 'pending', null);

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into _tap_results (n, tap)
select *
from (
  select 1 as n, extensions.is(
    (select count(*)::bigint from public.organizations), 1::bigint,
    'owner sees only their organization'
  ) as tap
  union all
  select 2, extensions.is(
    (select count(*)::bigint from public.operations), 2::bigint,
    'owner sees every operation in their organization'
  )

  union all
  select 3, extensions.is(
    (select count(*)::bigint from public.memberships), 3::bigint,
    'owner sees the complete non-revoked team in their organization'
  )

  union all
  select 4, extensions.ok(
    not has_table_privilege('anon', 'public.organizations', 'select'),
    'anon has no organization select grant'
  )

  union all
  select 5, extensions.ok(
    not has_table_privilege('anon', 'public.operations', 'select'),
    'anon has no operation select grant'
  )
) owner_assertions
order by n;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into _tap_results (n, tap)
select *
from (
  select 6 as n, extensions.is(
    (select count(*)::bigint from public.organizations), 1::bigint,
    'broker sees their organization'
  ) as tap
  union all
  select 7, extensions.is(
    (select count(*)::bigint from public.operations), 1::bigint,
    'broker sees only assigned operations'
  )
  union all
  select 8, extensions.is(
    (select count(*)::bigint from public.memberships), 1::bigint,
    'broker sees only their membership'
  )
) broker_assertions
order by n;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

insert into _tap_results (n, tap)
select *
from (
  select 9 as n, extensions.is(
    (select count(*)::bigint from public.organizations), 0::bigint,
    'pending member sees no organization'
  ) as tap
  union all
  select 10, extensions.is(
    (select count(*)::bigint from public.operations), 0::bigint,
    'pending member sees no operation'
  )
) pending_assertions
order by n;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);

insert into _tap_results (n, tap)
select *
from (
  select 11 as n, extensions.is(
    (select count(*)::bigint from public.organizations), 0::bigint,
    'user without membership sees no organization'
  ) as tap
  union all
  select 12, extensions.is(
    (select count(*)::bigint from public.operations), 0::bigint,
    'user without membership sees no operation'
  )
) final_assertions
order by n;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
