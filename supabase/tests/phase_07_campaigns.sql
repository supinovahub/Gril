begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(14);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('16000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'campaign-owner@invalid.test', '', now(), '{}', '{"full_name":"Campaign Owner"}', now(), now()),
  ('16000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'campaign-broker@invalid.test', '', now(), '{}', '{"full_name":"Campaign Broker"}', now(), now());

update public.profiles set whatsapp_e164 = '+5511988000062'
where user_id = '16000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('26000000-0000-0000-0000-000000000001', 'Campaign Gate Org', 'campaign-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 'Campaign Gate Operation', 'campaign-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('46000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('46000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('46000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001');

insert into public.whatsapp_connections (
  id, org_id, operation_id, provider, name, phone_e164, endpoint_url,
  secret_reference, status, inbound_enabled, campaign_enabled
)
values (
  '56000000-0000-0000-0000-000000000001',
  '26000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001',
  'uazapi', 'Campaign Gate Connection', '+5511999990030', 'https://provider.invalid',
  'vault://gate', 'active', true, true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"16000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.campaign_creation_requests (
  id, org_id, operation_id, connection_id, name, ai_mode,
  opening_template, consent_statement, consent_source, actor_user_id
)
values (
  '66000000-0000-0000-0000-000000000001',
  '26000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001',
  '56000000-0000-0000-0000-000000000001',
  'Campaign Gate', 'off',
  'Hello {{name}}, retomar imoveis.',
  'Os contatos autorizaram o relacionamento comercial.',
  'CRM legado autorizado',
  '16000000-0000-0000-0000-000000000001'
);

insert into public.campaign_import_requests (
  id, org_id, campaign_id, filename, rows, actor_user_id
)
select
  '66000000-0000-0000-0000-000000000002',
  '26000000-0000-0000-0000-000000000001',
  campaign_id,
  'gate.csv',
  '[{"name":"Alice Gate","phone":"+5511988880031"},{"name":"Bruno Gate","phone":"+5511988880032"},{"name":"Alice Gate","phone":"+5511988880031"},{"name":"X","phone":"invalid"}]'::jsonb,
  '16000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id='66000000-0000-0000-0000-000000000001';

insert into public.opt_outs (org_id, operation_id, contact_id, reason, source, recorded_by)
select
  '26000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001',
  cp.contact_id,
  'Gate opt-out', 'user', '16000000-0000-0000-0000-000000000001'
from public.contact_phones cp
where cp.org_id='26000000-0000-0000-0000-000000000001' and cp.e164='+5511988880031';

insert into public.campaign_transition_requests (
  id, org_id, campaign_id, requested_action, expected_version, actor_user_id
)
select
  '66000000-0000-0000-0000-000000000003',
  '26000000-0000-0000-0000-000000000001',
  campaign_id,
  'approve',
  3,
  '16000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id='66000000-0000-0000-0000-000000000001';

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(*)::bigint from public.consent_declarations where id=(select consent_declaration_id from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001'))),
    1::bigint,
    'campaign creation persists the consent declaration'
  )
  union all
  select 2, extensions.is(
    (select valid_rows::bigint from public.campaign_import_requests where id='66000000-0000-0000-0000-000000000002'),
    2::bigint,
    'import accepts two valid unique contacts'
  )
  union all
  select 3, extensions.is(
    (select duplicate_rows::bigint from public.campaign_import_requests where id='66000000-0000-0000-0000-000000000002'),
    1::bigint,
    'import reports the repeated phone once'
  )
  union all
  select 4, extensions.is(
    (select error_rows::bigint from public.campaign_import_requests where id='66000000-0000-0000-0000-000000000002'),
    1::bigint,
    'import rejects invalid name or E.164 rows'
  )
  union all
  select 5, extensions.is(
    (select count(*)::bigint from public.campaign_contacts where campaign_id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001')),
    2::bigint,
    'deduplication creates two campaign contacts'
  )
  union all
  select 6, extensions.is(
    (select status from public.campaigns where id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001')),
    'approved'::text,
    'reviewed campaign can be explicitly approved'
  )
  union all
  select 7, extensions.ok(
    position(
      'v_required:=casewhenv_wave_no=1thenleast(20,v_remaining)'
      in replace(lower(pg_get_functiondef('private.process_campaign_wave_release_request()'::regprocedure)), ' ', '')
    ) > 0,
    'campaign wave sizes are derived on the server'
  )
) pre_wave_assertions
order by 1;

insert into public.campaign_wave_release_requests (
  id, org_id, campaign_id, requested_count, actor_user_id
)
select
  '66000000-0000-0000-0000-000000000004',
  '26000000-0000-0000-0000-000000000001',
  campaign_id,
  2,
  '16000000-0000-0000-0000-000000000001'
from public.campaign_creation_requests
where id='66000000-0000-0000-0000-000000000001';

insert into _tap_results (n, tap)
select * from (
  select 8, extensions.is(
    (select released_count::bigint from public.campaign_wave_release_requests where id='66000000-0000-0000-0000-000000000004'),
    1::bigint,
    'wave releases only the non-suppressed contact'
  )
  union all
  select 9, extensions.is(
    (select count(*)::bigint from public.campaign_contacts where campaign_id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001') and status in ('opted_out','suppressed')),
    1::bigint,
    'opt-out removes the contact before dispatch'
  )
  union all
  select 10, extensions.is(
    (select count(*)::bigint from public.scheduled_jobs where payload->>'campaign_id'=(select campaign_id::text from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001') and status='pending'),
    1::bigint,
    'wave creates one idempotent dispatch job'
  )
  union all
  select 11, extensions.is(
    (select count(*)::bigint from public.campaign_waves where campaign_id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001') and wave_number=1),
    1::bigint,
    'first wave is persisted once'
  )
) wave_assertions
order by 1;

insert into _tap_results (n, tap)
select * from (
  select 13, extensions.is(
    (
      select string_agg(campaign_first_name, ',' order by campaign_first_name)
      from public.campaign_contacts
      where campaign_id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001')
    ),
    'Alice,Bruno'::text,
    'campaign contacts snapshot the first name independently from CRM lookup'
  )
  union all
  select 14, extensions.ok(
    (
      select opening_examples::text like '%Hello Alice,%'
        and opening_examples::text like '%Hello Bruno,%'
        and opening_examples::text not like '%Alice Gate%'
        and opening_examples::text not like '%Bruno Gate%'
      from public.campaigns
      where id=(select campaign_id from public.campaign_creation_requests where id='66000000-0000-0000-0000-000000000001')
    ),
    'campaign opening examples use only the first name'
  )
) first_name_assertions
order by 1;

select set_config('request.jwt.claims', '{"sub":"16000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (12, extensions.is(
  (select count(*)::bigint from public.campaigns),
  0::bigint,
  'broker cannot inspect or operate campaigns'
));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
