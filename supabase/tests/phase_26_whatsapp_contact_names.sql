begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

insert into public.organizations (id, name, slug)
values ('22600000-0000-0000-0000-000000000001', 'Contact Name Org', 'contact-name-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('32600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000001', 'Contact Name Operation', 'contact-name-op', true);

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled
)
values (
  '52600000-0000-0000-0000-000000000001',
  '22600000-0000-0000-0000-000000000001',
  '32600000-0000-0000-0000-000000000001',
  'uazapi', 'Contact Name Connection', '+5511999990020', 'https://provider.invalid',
  'vault://contact-name', 'active', true
);

set local role service_role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, provider_message_id, content_type, body, provider_timestamp
)
values (
  '62600000-0000-0000-0000-000000000001',
  '22600000-0000-0000-0000-000000000001',
  '52600000-0000-0000-0000-000000000001',
  'contact-name-device-1', repeat('b', 64),
  '{"_gril":{"event_kind":"external_outbound","source":"whatsapp_device","contact_name":null}}',
  '+5511988880020', 'contact-name-message-1', 'text', 'Oi', now()
);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, provider_message_id, content_type, body, provider_timestamp
)
values (
  '62600000-0000-0000-0000-000000000002',
  '22600000-0000-0000-0000-000000000001',
  '52600000-0000-0000-0000-000000000001',
  'contact-name-device-2', repeat('c', 64),
  '{"_gril":{"event_kind":"external_outbound","source":"whatsapp_device","contact_name":"Cliente Manual"}}',
  '+5511988880020', 'contact-name-message-2', 'text', 'Tudo bem?', now()
);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, provider_message_id, content_type, body, provider_timestamp
)
values (
  '62600000-0000-0000-0000-000000000003',
  '22600000-0000-0000-0000-000000000001',
  '52600000-0000-0000-0000-000000000001',
  'contact-name-device-3', repeat('d', 64),
  '{"_gril":{"event_kind":"external_outbound","source":"whatsapp_device","contact_name":"Outro Nome"}}',
  '+5511988880020', 'contact-name-message-3', 'text', 'Mais uma mensagem', now()
);

select extensions.has_function(
  'private', 'sync_whatsapp_contact_name_from_message', array[]::text[],
  'contact name synchronization trigger function exists'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'public'::regnamespace
      and c.relname = 'messages'
      and t.tgname = 'messages_sync_whatsapp_contact_name'
      and not t.tgisinternal
  ),
  'messages trigger synchronizes provider contact names'
);

select extensions.is(
  (select count(*)::bigint from public.contacts where org_id = '22600000-0000-0000-0000-000000000001'),
  1::bigint,
  'device messages reuse one contact by phone'
);

select extensions.is(
  (select name from public.contacts where org_id = '22600000-0000-0000-0000-000000000001'),
  'Cliente Manual',
  'provider name promotes a placeholder contact'
);

select extensions.is(
  (select count(*)::bigint from public.messages where org_id = '22600000-0000-0000-0000-000000000001'),
  3::bigint,
  'all manual device messages remain in the conversation timeline'
);

select extensions.is(
  (select name from public.contacts where org_id = '22600000-0000-0000-0000-000000000001'),
  'Cliente Manual',
  'a later provider name does not overwrite the recognized name'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'private.sync_whatsapp_contact_name_from_message()', 'execute'),
  'browser sessions cannot invoke contact name synchronization directly'
);

select * from extensions.finish();
rollback;
