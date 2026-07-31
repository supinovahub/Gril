begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(13);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;

create temporary table _capacity_entities (
  n integer primary key,
  contact_id uuid not null,
  opportunity_id uuid not null,
  conversation_id uuid not null
) on commit drop;
grant select on _capacity_entities to service_role;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values ('13000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'queue-owner@invalid.test', '', now(), '{}', '{"full_name":"Queue Owner"}', now(), now());

insert into public.organizations (id, name, slug)
values ('23000000-0000-0000-0000-000000000001', 'Queue Gate Org', 'queue-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('33000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Queue Gate Operation', 'queue-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values ('43000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'owner', 'active', now());

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled
)
values (
  '53000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'uazapi', 'Queue Gate Connection', '+5511999990020', 'https://provider.invalid',
  'vault://gate', 'active', true
);

insert into _capacity_entities (n, contact_id, opportunity_id, conversation_id)
select n, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from generate_series(1,31) as series(n);

insert into public.contacts (id, org_id, name)
select contact_id, '23000000-0000-0000-0000-000000000001', 'Capacity Contact ' || n
from _capacity_entities;

insert into public.opportunities (
  id, org_id, operation_id, contact_id, pipeline_stage_id, source
)
select
  e.opportunity_id,
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  e.contact_id,
  ps.id,
  'capacity_gate'
from _capacity_entities e
cross join lateral (
  select id from public.pipeline_stages
  where org_id='23000000-0000-0000-0000-000000000001' and code='new'
) ps;

insert into public.conversations (
  id, org_id, operation_id, contact_id, opportunity_id, connection_id,
  status, ownership, ai_mode
)
select
  conversation_id,
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  contact_id,
  opportunity_id,
  '53000000-0000-0000-0000-000000000001',
  'active', 'ai', 'off'
from _capacity_entities;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.scheduled_job_requests (
  id, org_id, operation_id, actor_user_id, job_type, aggregate_type,
  target_queue, run_at, dedupe_key, payload
)
values
  ('63000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'gate.test', 'operation', 'scheduled-actions', now()+interval '10 minutes', 'queue-gate-dedupe', '{"attempt":1}'),
  ('63000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'gate.test', 'operation', 'scheduled-actions', now()+interval '5 minutes', 'queue-gate-dedupe', '{"attempt":2}');

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);

insert into public.capacity_reservation_requests (org_id, operation_id, conversation_id, action, source)
select
  '23000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  conversation_id,
  'reserve',
  'inbound'
from _capacity_entities
where n between 1 and 25
order by n;

insert into public.capacity_reservation_requests (id, org_id, operation_id, conversation_id, action, source)
select '63000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', conversation_id, 'reserve', 'proactive'
from _capacity_entities where n=26;

insert into public.capacity_reservation_requests (org_id, operation_id, conversation_id, action, source)
select '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', conversation_id, 'reserve', 'inbound'
from _capacity_entities where n between 26 and 30 order by n;

insert into public.capacity_reservation_requests (id, org_id, operation_id, conversation_id, action, source)
select '63000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', conversation_id, 'reserve', 'inbound'
from _capacity_entities where n=31;

insert into public.capacity_reservation_requests (id, org_id, operation_id, conversation_id, action, source)
select '63000000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', conversation_id, 'reserve', 'inbound'
from _capacity_entities where n=2;

insert into public.capacity_reservation_requests (id, org_id, operation_id, conversation_id, action, source)
select '63000000-0000-0000-0000-000000000006', '23000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', conversation_id, 'release', 'inbound'
from _capacity_entities where n=1;

reset role;

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(distinct job_id)::bigint from public.scheduled_job_requests where id in ('63000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000002')),
    1::bigint,
    'same dedupe key resolves to one scheduled job'
  )
  union all
  select 2, extensions.is(
    (select count(*)::bigint from public.scheduled_jobs where org_id='23000000-0000-0000-0000-000000000001' and dedupe_key='queue-gate-dedupe'),
    1::bigint,
    'scheduled job remains unique while pending'
  )
  union all
  select 3, extensions.is(
    (select payload->>'attempt' from public.scheduled_jobs where org_id='23000000-0000-0000-0000-000000000001' and dedupe_key='queue-gate-dedupe'),
    '2'::text,
    'duplicate scheduling refreshes the payload deterministically'
  )
  union all
  select 4, extensions.is(
    (select result from public.capacity_reservation_requests where id='63000000-0000-0000-0000-000000000003'),
    'proactive_paused'::text,
    'proactive work is blocked at 25 active conversations'
  )
  union all
  select 5, extensions.is(
    (select result from public.capacity_reservation_requests where id='63000000-0000-0000-0000-000000000004'),
    'backlog'::text,
    'inbound work enters backlog at 30 active conversations'
  )
  union all
  select 6, extensions.is(
    (select result from public.capacity_reservation_requests where id='63000000-0000-0000-0000-000000000005'),
    'existing'::text,
    'repeated reservation is idempotent'
  )
  union all
  select 7, extensions.is(
    (select result from public.capacity_reservation_requests where id='63000000-0000-0000-0000-000000000006'),
    'released'::text,
    'release command frees active capacity'
  )
  union all
  select 8, extensions.is(
    (select active_count::bigint from public.operation_capacity where operation_id='33000000-0000-0000-0000-000000000001'),
    29::bigint,
    'active count is exact after admission and release'
  )
  union all
  select 9, extensions.is(
    (select count(*)::bigint from private.capacity_reservations where operation_id='33000000-0000-0000-0000-000000000001' and status='backlog'),
    1::bigint,
    'one inbound conversation is held in backlog'
  )
  union all
  select 10, extensions.ok(
    (select proactive_paused from public.operation_capacity where operation_id='33000000-0000-0000-0000-000000000001'),
    'proactive pause remains active above the resume threshold'
  )
  union all
  select 11, extensions.ok(
    not has_table_privilege('authenticated', 'public.capacity_reservation_requests', 'insert'),
    'capacity command is service-role only'
  )
  union all
  select 12, extensions.ok(
    not has_table_privilege('anon', 'public.scheduled_jobs', 'select'),
    'anonymous clients cannot inspect scheduled jobs'
  )
  union all
  select 13, extensions.ok(
    to_regprocedure('private.dispatch_due_jobs(integer)') is not null,
    'durable job dispatcher exists'
  )
) queue_assertions
order by 1;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
