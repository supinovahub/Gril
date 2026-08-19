begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

insert into public.organizations (id, name, slug)
values ('22000000-0000-0000-0000-000000000048', 'Quoted Reply Org', 'quoted-reply-org');

insert into public.operations (id, org_id, name, slug, is_default)
values (
  '32000000-0000-0000-0000-000000000048',
  '22000000-0000-0000-0000-000000000048',
  'Quoted Reply Operation',
  'quoted-reply-op',
  true
);

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled
)
values (
  '52000000-0000-0000-0000-000000000048',
  '22000000-0000-0000-0000-000000000048',
  '32000000-0000-0000-0000-000000000048',
  'uazapi', 'Quoted Reply Connection', '+5511999990048',
  'https://provider.invalid', 'vault://quoted-reply', 'active', true
);

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',
  true
);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, contact_name, provider_message_id, content_type, body, provider_timestamp
)
values (
  '62000000-0000-0000-0000-000000000048',
  '22000000-0000-0000-0000-000000000048',
  '52000000-0000-0000-0000-000000000048',
  'quoted-bootstrap-event', repeat('a', 64), '{"message":{"quoted":""}}',
  '+5511988880048', 'Quoted Lead', 'quoted-bootstrap-message', 'text', 'Oi', now()
);

insert into public.messages (
  id, org_id, operation_id, conversation_id, direction, sender_type,
  content_type, body, provider_message_id, provider_status, provider_timestamp
)
select
  '72000000-0000-0000-0000-000000000048',
  request.org_id,
  '32000000-0000-0000-0000-000000000048',
  request.conversation_id,
  'outbound', 'ai', 'text',
  'Entrada de 100k e parcela de ate 10k?',
  'quoted-provider-target', 'sent', now()
from public.webhook_ingest_requests request
where request.id = '62000000-0000-0000-0000-000000000048';

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, contact_name, provider_message_id, reply_to_provider_message_id,
  content_type, body, provider_timestamp
)
values
  (
    '62000000-0000-0000-0000-000000000049',
    '22000000-0000-0000-0000-000000000048',
    '52000000-0000-0000-0000-000000000048',
    'quoted-reply-event', repeat('b', 64),
    '{"message":{"quoted":"quoted-provider-target"}}',
    '+5511988880048', 'Quoted Lead', 'quoted-child-message',
    'quoted-provider-target', 'text', 'Estes.', now()
  ),
  (
    '62000000-0000-0000-0000-000000000050',
    '22000000-0000-0000-0000-000000000048',
    '52000000-0000-0000-0000-000000000048',
    'quoted-reply-event', repeat('b', 64),
    '{"message":{"quoted":"quoted-provider-target"}}',
    '+5511988880048', 'Quoted Lead', 'quoted-child-message',
    'quoted-provider-target', 'text', 'Estes.', now()
  );

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, contact_name, provider_message_id, content_type, body, provider_timestamp
)
values (
  '62000000-0000-0000-0000-000000000051',
  '22000000-0000-0000-0000-000000000048',
  '52000000-0000-0000-0000-000000000048',
  'other-conversation-event', repeat('c', 64), '{}',
  '+5511988881048', 'Other Lead', 'other-bootstrap-message', 'text', 'Oi', now()
);

insert into public.webhook_ingest_requests (
  id, org_id, connection_id, external_event_id, payload_sha256, payload,
  from_e164, contact_name, provider_message_id, reply_to_provider_message_id,
  content_type, body, provider_timestamp
)
values (
  '62000000-0000-0000-0000-000000000052',
  '22000000-0000-0000-0000-000000000048',
  '52000000-0000-0000-0000-000000000048',
  'cross-conversation-reply-event', repeat('d', 64),
  '{"message":{"quoted":"quoted-provider-target"}}',
  '+5511988881048', 'Other Lead', 'cross-conversation-child',
  'quoted-provider-target', 'text', 'Essa.', now()
);

reset role;

select extensions.is(
  (
    select child.reply_to_message_id
    from public.messages child
    where child.provider_message_id = 'quoted-child-message'
  ),
  '72000000-0000-0000-0000-000000000048'::uuid,
  'quoted provider id is linked to the canonical message'
);

select extensions.is(
  (
    select count(*)::bigint
    from public.messages
    where provider_message_id = 'quoted-child-message'
  ),
  1::bigint,
  'duplicate quoted webhook does not duplicate the message'
);

select extensions.ok(
  (
    select duplicate
    from public.webhook_ingest_requests
    where id = '62000000-0000-0000-0000-000000000050'
  ),
  'duplicate quoted webhook remains idempotent'
);

select extensions.is(
  (
    select child.reply_to_message_id
    from public.messages child
    where child.provider_message_id = 'cross-conversation-child'
  ),
  null::uuid,
  'quoted reference never links across conversations'
);

select extensions.ok(
  not has_function_privilege(
    'service_role',
    'private.link_webhook_ingest_reply_reference()',
    'execute'
  ),
  'reply-link trigger function is not directly callable'
);

select * from extensions.finish();

rollback;
