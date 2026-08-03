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
  ('12000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inbox-owner@invalid.test', '', now(), '{}', '{"full_name":"Inbox Owner"}', now(), now()),
  ('12000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'inbox-broker@invalid.test', '', now(), '{}', '{"full_name":"Inbox Broker"}', now(), now());

update public.profiles set whatsapp_e164 = '+5511988000022'
where user_id = '12000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('22000000-0000-0000-0000-000000000001', 'Inbox Gate Org', 'inbox-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('32000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'Inbox Gate Operation', 'inbox-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('42000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('42000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('42000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001');

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled
)
values (
  '52000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'uazapi', 'Inbox Gate Connection', '+5511999990010', 'https://provider.invalid',
  'vault://gate', 'active', true
);

set local role service_role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, contact_name, provider_message_id, content_type, body, provider_timestamp
)
values
  (
    '62000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    'gate-event-1', repeat('a',64), '{"kind":"message"}',
    '+5511988880010', 'Inbound Lead', 'gate-provider-message-1', 'text', 'Olá', now()
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    'gate-event-1', repeat('a',64), '{"kind":"message"}',
    '+5511988880010', 'Inbound Lead', 'gate-provider-message-1', 'text', 'Olá', now()
  );

reset role;

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.ok(
    not (select duplicate from public.webhook_ingest_requests where id='62000000-0000-0000-0000-000000000001'),
    'first webhook is processed as new'
  )
  union all
  select 2, extensions.ok(
    (select duplicate from public.webhook_ingest_requests where id='62000000-0000-0000-0000-000000000002'),
    'second webhook with same external event is marked duplicate'
  )
  union all
  select 3, extensions.is(
    (select count(distinct conversation_id)::bigint from public.webhook_ingest_requests where id in ('62000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002')),
    1::bigint,
    'duplicate webhook resolves to the original conversation'
  )
  union all
  select 4, extensions.is(
    (select count(distinct message_id)::bigint from public.webhook_ingest_requests where id in ('62000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002')),
    1::bigint,
    'duplicate webhook resolves to the original message'
  )
  union all
  select 5, extensions.is(
    (select count(*)::bigint from public.messages where provider_message_id='gate-provider-message-1'),
    1::bigint,
    'provider message is persisted once'
  )
  union all
  select 6, extensions.is(
    (select count(*)::bigint from public.contacts where org_id='22000000-0000-0000-0000-000000000001'),
    1::bigint,
    'inbound flow creates one contact'
  )
  union all
  select 7, extensions.is(
    (select count(*)::bigint from public.opportunities where org_id='22000000-0000-0000-0000-000000000001'),
    1::bigint,
    'inbound flow creates one opportunity'
  )
  union all
  select 8, extensions.is(
    (select count(*)::bigint from public.conversations where org_id='22000000-0000-0000-0000-000000000001'),
    1::bigint,
    'inbound flow creates one conversation'
  )
  union all
  select 9, extensions.is(
    (select count(*)::bigint from private.outbox_events where idempotency_key='inbound:52000000-0000-0000-0000-000000000001:gate-event-1'),
    1::bigint,
    'inbound outbox event is idempotent'
  )
  union all
  select 10, extensions.ok(
    not has_table_privilege('authenticated', 'public.webhook_ingest_requests', 'insert'),
    'authenticated clients cannot call the webhook ingest command'
  )
) ingest_assertions
order by 1;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (11, extensions.is(
  (select count(*)::bigint from public.conversations), 1::bigint,
  'owner can read the inbound conversation'
));

select set_config('request.jwt.claims', '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (12, extensions.is(
  (select count(*)::bigint from public.conversations), 0::bigint,
  'broker without assignment and access grant sees no conversation'
));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
