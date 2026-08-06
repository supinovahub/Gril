begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
create temporary table _campaign_ref (campaign_id uuid not null) on commit drop;
grant select, insert on _tap_results to authenticated;
grant all on _campaign_ref to authenticated;

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
  'uazapi', 'Campaign Edit Connection', '+5511999990070', 'https://provider.invalid',
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
  'Olá, podemos retomar seu atendimento sobre imóveis?',
  'Os contatos autorizaram o relacionamento comercial.',
  'CRM próprio autorizado',
  '35000000-0000-0000-0000-000000000001'
);

insert into _campaign_ref
select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001';

insert into public.campaign_edit_requests (
  id, org_id, campaign_id, connection_id, name, ai_mode,
  opening_template, message_template_provided, expected_version, actor_user_id
)
select
  '85000000-0000-0000-0000-000000000002',
  '45000000-0000-0000-0000-000000000001',
  campaign_id,
  '75000000-0000-0000-0000-000000000001',
  'Campaign Edited', 'assisted',
  'Olá, podemos retomar seu atendimento sobre imóveis?', true, 1,
  '35000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id = '85000000-0000-0000-0000-000000000001';

insert into _tap_results (n, tap) select 1, extensions.ok(
  (select name from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')) = 'Campaign Edited',
  'manager can edit the campaign configuration'
);
insert into _tap_results (n, tap) select 2, extensions.is(
  (select ai_mode from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
  'assisted',
  'edit persists Pedro mode'
);
insert into _tap_results (n, tap) select 3, extensions.is(
  (select version from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
  2,
  'edit increments the campaign version'
);
set local role postgres;
insert into _tap_results (n, tap) select 4, extensions.is(
  (select action from audit.events where entity_type='campaigns' and entity_id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001') and action='campaign.updated' order by occurred_at desc limit 1),
  'campaign.updated',
  'edit is audited'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"35000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.campaign_transition_requests (
  id, org_id, campaign_id, requested_action, expected_version, actor_user_id
)
select
  '85000000-0000-0000-0000-000000000003',
  '45000000-0000-0000-0000-000000000001',
  campaign_id,
  'archive', 2,
  '35000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id = '85000000-0000-0000-0000-000000000001';

insert into _tap_results (n, tap) select 5, extensions.is(
  (select status from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
  'archived',
  'manager can archive the campaign'
);
insert into _tap_results (n, tap) select 6, extensions.ok(
  (select archived_at is not null and archived_by='35000000-0000-0000-0000-000000000001'::uuid from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001')),
  'archive stores actor and timestamp'
);
set local role postgres;
insert into _tap_results (n, tap) select 7, extensions.is(
  (select action from audit.events where entity_type='campaigns' and entity_id=(select campaign_id from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001') and action='campaign.archive' order by occurred_at desc limit 1),
  'campaign.archive',
  'archive is audited'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"35000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into _tap_results (n, tap) select 8, extensions.throws_ok(
  $$insert into public.campaign_edit_requests (org_id,campaign_id,name,expected_version,actor_user_id) select '45000000-0000-0000-0000-000000000001',campaign_id,'Should Fail',3,'35000000-0000-0000-0000-000000000001' from public.campaign_creation_requests where id='85000000-0000-0000-0000-000000000001'$$,
  '22023',
  'campaign_not_editable',
  'archived campaign cannot be edited'
);

select set_config('request.jwt.claims', '{"sub":"35000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap) select 9, extensions.throws_ok(
  $$insert into public.campaign_transition_requests (org_id,campaign_id,requested_action,expected_version,actor_user_id) values ('45000000-0000-0000-0000-000000000001',(select campaign_id from _campaign_ref),'archive',3,'35000000-0000-0000-0000-000000000002')$$,
  '42501',
  'campaign_transition_forbidden',
  'broker cannot archive campaigns without manage permission'
);

select tap from _tap_results order by n;
select * from extensions.finish();
rollback;
