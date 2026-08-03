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
  ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'crm-owner@invalid.test', '', now(), '{}', '{"full_name":"CRM Owner"}', now(), now()),
  ('11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'crm-broker@invalid.test', '', now(), '{}', '{"full_name":"CRM Broker"}', now(), now()),
  ('11000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'crm-outsider@invalid.test', '', now(), '{}', '{"full_name":"CRM Outsider"}', now(), now());

update public.profiles set whatsapp_e164 = '+5511988000012'
where user_id = '11000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values
  ('21000000-0000-0000-0000-000000000001', 'CRM Gate Org A', 'crm-gate-org-a'),
  ('21000000-0000-0000-0000-000000000002', 'CRM Gate Org B', 'crm-gate-org-b');

insert into public.operations (id, org_id, name, slug, is_default)
values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'CRM Operation A', 'crm-op-a', true),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'CRM Operation B', 'crm-op-b', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('41000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'broker', 'active', now()),
  ('41000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000003', 'owner', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('41000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001');

insert into public.contacts (id, org_id, name)
values ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Assigned Contact');

insert into public.contact_phones (org_id, contact_id, e164, original, is_primary)
values ('21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '+5511999990001', '11 99999-0001', true);

insert into public.opportunities (
  id, org_id, operation_id, contact_id, pipeline_stage_id, assigned_membership_id, source
)
select
  '61000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  ps.id,
  '41000000-0000-0000-0000-000000000002',
  'gate'
from public.pipeline_stages ps
where ps.org_id = '21000000-0000-0000-0000-000000000001' and ps.code = 'new';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.lead_creation_requests (
  id, org_id, operation_id, actor_user_id, name, phone_original, phone_e164, source
)
values
  ('71000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Repeated Lead', '11 98888-0001', '+5511988880001', 'gate'),
  ('71000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Repeated Lead', '11 98888-0001', '+5511988880001', 'gate');

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(distinct contact_id)::bigint from public.lead_creation_requests where id in ('71000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002')),
    1::bigint,
    'same E.164 reuses one contact'
  )
  union all
  select 2, extensions.is(
    (select count(distinct opportunity_id)::bigint from public.lead_creation_requests where id in ('71000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002')),
    1::bigint,
    'same E.164 reuses one open opportunity'
  )
  union all
  select 3, extensions.ok(
    (select reused_contact from public.lead_creation_requests where id = '71000000-0000-0000-0000-000000000002'),
    'second request reports reused contact'
  )
  union all
  select 4, extensions.ok(
    (select reused_opportunity from public.lead_creation_requests where id = '71000000-0000-0000-0000-000000000002'),
    'second request reports reused opportunity'
  )
  union all
  select 5, extensions.is(
    (select count(*)::bigint from public.opportunities),
    2::bigint,
    'owner sees both opportunities in their tenant'
  )
  union all
  select 6, extensions.throws_ok(
    $$insert into public.opportunity_stage_change_requests (
      org_id, opportunity_id, target_stage_id, actor_user_id, expected_version
    )
    select
      '21000000-0000-0000-0000-000000000001',
      opportunity_id,
      (select id from public.pipeline_stages where org_id='21000000-0000-0000-0000-000000000001' and code='negotiation'),
      '11000000-0000-0000-0000-000000000001',
      2
    from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002'$$,
    '22023',
    'invalid_stage_transition:new->negotiation',
    'invalid stage jump is rejected'
  )
) owner_assertions
order by 1;

insert into public.opportunity_stage_change_requests (
  org_id, opportunity_id, target_stage_id, actor_user_id, expected_version
)
select
  '21000000-0000-0000-0000-000000000001',
  opportunity_id,
  (select id from public.pipeline_stages where org_id='21000000-0000-0000-0000-000000000001' and code='in_service'),
  '11000000-0000-0000-0000-000000000001',
  2
from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002';

insert into _tap_results (n, tap)
select * from (
  select 7, extensions.is(
    (select ps.code from public.opportunities o join public.pipeline_stages ps on ps.id=o.pipeline_stage_id where o.id=(select opportunity_id from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002')),
    'in_service'::text,
    'valid transition updates the stage'
  )
  union all
  select 8, extensions.throws_ok(
    $$insert into public.opportunity_stage_change_requests (
      org_id, opportunity_id, target_stage_id, actor_user_id, expected_version
    )
    select
      '21000000-0000-0000-0000-000000000001',
      opportunity_id,
      (select id from public.pipeline_stages where org_id='21000000-0000-0000-0000-000000000001' and code='call_scheduled'),
      '11000000-0000-0000-0000-000000000001',
      2
    from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002'$$,
    '40001',
    'opportunity_version_conflict',
    'stale expected version is rejected'
  )
  union all
  select 9, extensions.is(
    (select count(*)::bigint from public.opportunity_stage_history where opportunity_id=(select opportunity_id from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002')),
    2::bigint,
    'creation and valid stage change are both audited in history'
  )
) workflow_assertions
order by 1;

reset role;
insert into _tap_results (n, tap)
values (10, extensions.is(
  (select count(*)::bigint from private.outbox_events where aggregate_id=(select opportunity_id from public.lead_creation_requests where id='71000000-0000-0000-0000-000000000002')),
  3::bigint,
  'two lead commands and one stage change create idempotent outbox records'
));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (11, extensions.is(
  (select count(*)::bigint from public.opportunities), 1::bigint,
  'broker sees only their assigned opportunity'
));

select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (12, extensions.is(
  (select count(*)::bigint from public.opportunities), 0::bigint,
  'owner from another tenant sees no CRM opportunity'
));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
