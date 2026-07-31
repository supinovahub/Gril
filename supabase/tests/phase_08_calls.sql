begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;
create temporary table _call_time (starts_at timestamptz not null) on commit drop;

insert into _call_time (starts_at)
values (((current_date + 2)::timestamp + time '12:00') at time zone 'America/Sao_Paulo');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('17000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'call-owner@invalid.test', '', now(), '{}', '{"full_name":"Call Owner"}', now(), now()),
  ('17000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'call-broker@invalid.test', '', now(), '{}', '{"full_name":"Call Broker"}', now(), now());

update public.profiles
set whatsapp_e164='+5511988880042'
where user_id='17000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('27000000-0000-0000-0000-000000000001', 'Call Gate Org', 'call-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'Call Gate Operation', 'call-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('47000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('47000000-0000-0000-0000-000000000002', '27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('47000000-0000-0000-0000-000000000002', '37000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001');

insert into public.membership_call_settings (
  membership_id, org_id, operation_id, can_receive_calls, is_preferred_receiver
)
values (
  '47000000-0000-0000-0000-000000000002',
  '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  true, true
);

insert into public.availability_rules (
  org_id, operation_id, membership_id, weekday, start_time, end_time, timezone
)
select
  '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000002',
  extract(dow from starts_at at time zone 'America/Sao_Paulo')::smallint,
  time '08:00', time '20:00', 'America/Sao_Paulo'
from _call_time;

insert into public.contacts (id, org_id, name)
values ('57000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', 'Call Lead');

insert into public.opportunities (id, org_id, operation_id, contact_id, pipeline_stage_id, source)
select
  '67000000-0000-0000-0000-000000000001',
  '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  '57000000-0000-0000-0000-000000000001',
  id,
  'call_gate'
from public.pipeline_stages
where org_id='27000000-0000-0000-0000-000000000001' and code='in_service';

insert into public.call_holds (
  id, org_id, operation_id, opportunity_id, starts_at, ends_at,
  preferred_format, status, expires_at, lead_confirmed
)
select
  '77000000-0000-0000-0000-000000000001',
  '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000001',
  starts_at, starts_at+interval '20 minutes',
  'video', 'active', now()+interval '15 minutes', true
from _call_time;

insert into public.calls (
  id, org_id, operation_id, hold_id, opportunity_id, starts_at, ends_at,
  blocked_until, status, format, version
)
select
  '77000000-0000-0000-0000-000000000002',
  '27000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '67000000-0000-0000-0000-000000000001',
  starts_at, starts_at+interval '20 minutes', starts_at+interval '30 minutes',
  'distributing', 'video', 2
from _call_time;

insert into public.call_offers (
  id, org_id, call_id, recipient_membership_id, round, offer_type,
  status, sent_at, expires_at
)
select
  '77000000-0000-0000-0000-000000000003',
  '27000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000002',
  '47000000-0000-0000-0000-000000000002',
  1, 'preferred', 'pending', now()-interval '1 minute', least(starts_at,now()+interval '30 minutes')
from _call_time;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into public.call_offer_accept_requests (
  id, org_id, call_id, offer_id, expected_call_version, actor_user_id
)
values (
  '77000000-0000-0000-0000-000000000004',
  '27000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000002',
  '77000000-0000-0000-0000-000000000003',
  2,
  '17000000-0000-0000-0000-000000000002'
);

reset role;

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select result from public.call_offer_accept_requests where id='77000000-0000-0000-0000-000000000004'),
    'accepted'::text,
    'eligible broker accepts the offer'
  )
  union all
  select 2, extensions.is(
    (select status from public.calls where id='77000000-0000-0000-0000-000000000002'),
    'assigned'::text,
    'call becomes assigned atomically'
  )
  union all
  select 3, extensions.is(
    (select assigned_membership_id from public.calls where id='77000000-0000-0000-0000-000000000002'),
    '47000000-0000-0000-0000-000000000002'::uuid,
    'accepted broker is the call assignee'
  )
  union all
  select 4, extensions.is(
    (select count(*)::bigint from public.call_assignments where call_id='77000000-0000-0000-0000-000000000002' and active),
    1::bigint,
    'only one active assignment exists'
  )
  union all
  select 5, extensions.is(
    (select status from public.call_offers where id='77000000-0000-0000-0000-000000000003'),
    'accepted'::text,
    'winning offer is marked accepted'
  )
  union all
  select 6, extensions.is(
    (select count(*)::bigint from public.scheduled_jobs where aggregate_id='77000000-0000-0000-0000-000000000002'),
    3::bigint,
    'acceptance schedules two reminders and one result deadline'
  )
  union all
  select 7, extensions.is(
    (select ps.code from public.opportunities o join public.pipeline_stages ps on ps.id=o.pipeline_stage_id where o.id='67000000-0000-0000-0000-000000000001'),
    'call_scheduled'::text,
    'opportunity advances only after call acceptance'
  )
  union all
  select 8, extensions.is(
    (select extract(epoch from ends_at-starts_at)::bigint from public.calls where id='77000000-0000-0000-0000-000000000002'),
    1200::bigint,
    'call duration is exactly 20 minutes'
  )
  union all
  select 9, extensions.is(
    (select extract(epoch from blocked_until-starts_at)::bigint from public.calls where id='77000000-0000-0000-0000-000000000002'),
    1800::bigint,
    'broker schedule is blocked for 30 minutes'
  )
  union all
  select 10, extensions.throws_ok(
    $$insert into public.call_offer_accept_requests (org_id,call_id,offer_id,expected_call_version,actor_user_id)
      values ('27000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000003',3,'17000000-0000-0000-0000-000000000002')$$,
    '40001',
    'call_offer_unavailable',
    'second acceptance loses the serialized race'
  )
  union all
  select 11, extensions.ok(
    exists(
      select 1 from pg_indexes
      where schemaname='public' and tablename='call_assignments'
        and indexname='call_assignments_one_active_call_idx'
    ),
    'database enforces one active assignment per call'
  )
  union all
  select 12, extensions.ok(
    position('pg_advisory_xact_lock' in pg_get_functiondef('private.process_call_offer_accept_request()'::regprocedure))>0,
    'acceptance path takes a transaction-scoped advisory lock'
  )
) call_assertions
order by 1;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
