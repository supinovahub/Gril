begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);
create temporary table _campaign_edit_archive_tap (n integer primary key, tap text not null) on commit drop;
grant select, insert on _campaign_edit_archive_tap to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('35000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'campaign-edit-owner@invalid.test', '', now(), '{}', '{}', now(), now()),
  ('35000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'campaign-edit-broker@invalid.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, name, slug)
values ('45000000-0000-0000-0000-000000000001', 'Campaign Edit Org', 'campaign-edit-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('55000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001', 'Campaign Edit Operation', 'campaign-edit-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('65000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('65000000-0000-0000-0000-000000000002', '45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('65000000-0000-0000-0000-000000000002', '55000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001');

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled, campaign_enabled
)
values (
  '75000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  'uazapi', 'Campaign Edit Connection', '+5511999990099', 'https://provider.invalid',
  'vault://campaign-edit', 'active', true, true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"35000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.campaign_creation_requests (
  id, org_id, operation_id, connection_id, name, ai_mode,
  opening_template, consent_statement, consent_source, actor_user_id
)
values (
  '85000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  '75000000-0000-0000-0000-000000000001',
  'Campaign Before Edit', 'off',
  'Olá, vamos retomar seu atendimento sobre imóveis?',
  'A base possui autorização para contato comercial.',
  'CRM próprio autorizado',
  '35000000-0000-0000-0000-000000000001'
);

insert into public.campaign_edit_requests (
  id, org_id, campaign_id, connection_id, name, ai_mode,
  opening_template, message_template_id, message_template_provided,
  expected_version, actor_user_id
)
select
  '85000000-0000-0000-0000-000000000002',
  '45000000-0000-0000-0000-000000000001',
  campaign_id,
  '75000000-0000-0000-0000-000000000001',
  'Campaign Edited', 'assisted',
  'Olá, podemos retomar seu atendimento imobiliário?',
  null, true, 1,
  '35000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id='85000000-0000-0000-0000-000000000001';

insert into _campaign_edit_archive_tap (n, tap)
select * from (
  select 1, extensions.is(
    (select name from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    'Campaign Edited'::text,
    'manager can edit a draft campaign'
  )
  union all
  select 2, extensions.is(
    (select ai_mode from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    'assisted'::text,
    'editing updates the Pedro mode'
  )
  union all
  select 3, extensions.is(
    (select version from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    2,
    'editing increments the optimistic version'
  )
  union all
  select 4, extensions.is(
    (select count(*)::bigint from audit.events where entity_type='campaigns' and action='campaign.updated' and entity_id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    1::bigint,
    'editing creates an audit event'
  )
) edit_assertions order by 1;

insert into public.campaign_transition_requests (
  id, org_id, campaign_id, requested_action, expected_version, actor_user_id, reason
)
select
  '85000000-0000-0000-0000-000000000003',
  '45000000-0000-0000-0000-000000000001',
  campaign_id, 'archive', 2,
  '35000000-0000-0000-0000-000000000001', 'Campanha encerrada pelo gestor'
from public.campaign_creation_requests
where id='85000000-0000-0000-0000-000000000001';

insert into _campaign_edit_archive_tap (n, tap)
select * from (
  select 5, extensions.is(
    (select status from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    'archived'::text,
    'archive changes the campaign status'
  )
  union all
  select 6, extensions.ok(
    (select archived_at is not null and archived_by='35000000-0000-0000-0000-000000000001' from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    'archive records actor and timestamp'
  )
  union all
  select 7, extensions.is(
    (select count(*)::bigint from audit.events where entity_type='campaigns' and action='campaign.archive' and entity_id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
    1::bigint,
    'archive creates an audit event'
  )
  union all
  select 8, extensions.throws_ok(
    $$insert into public.campaign_edit_requests (org_id,campaign_id,name,expected_version,actor_user_id) values ('45000000-0000-0000-0000-000000000001',(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001'),'Should Fail',3,'35000000-0000-0000-0000-000000000001')$$,
    'campaign_not_editable',
    'archived campaigns cannot be edited'
  )
) archive_assertions order by 1;

select set_config('request.jwt.claims', '{"sub":"35000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _campaign_edit_archive_tap (n, tap)
values (9, extensions.throws_ok(
  $$insert into public.campaign_transition_requests (org_id,campaign_id,requested_action,expected_version,actor_user_id) values ('45000000-0000-0000-0000-000000000001',(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001'),'archive',3,'35000000-0000-0000-0000-000000000002')$$,
  'campaign_transition_forbidden',
  'broker cannot archive campaigns'
));

select tap from _campaign_edit_archive_tap order by n;
select * from extensions.finish();

rollback;
