begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(10);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'qualification-owner@invalid.test', '', now(), '{}', '{"full_name":"Qualification Owner"}', now(), now()),
  ('15000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'qualification-broker@invalid.test', '', now(), '{}', '{"full_name":"Qualification Broker"}', now(), now());

update public.profiles set whatsapp_e164 = '+5511988000052'
where user_id = '15000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('25000000-0000-0000-0000-000000000001', 'Qualification Gate Org', 'qualification-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'Qualification Gate Operation', 'qualification-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('45000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('45000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('45000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001');

insert into public.contacts (id, org_id, name)
values ('55000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'Qualification Lead');

insert into public.opportunities (id, org_id, operation_id, contact_id, pipeline_stage_id, source)
select
  '65000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000001',
  id,
  'qualification_gate'
from public.pipeline_stages
where org_id='25000000-0000-0000-0000-000000000001' and code='new';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.qualification_value_requests (
  id, org_id, opportunity_id, definition_id, value_number, source,
  actor_user_id, human_confirmed
)
select
  '75000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  '65000000-0000-0000-0000-000000000001',
  id,
  500000,
  'manual',
  '15000000-0000-0000-0000-000000000001',
  true
from public.qualification_definitions
where org_id='25000000-0000-0000-0000-000000000001' and code='total_price';

insert into public.qualification_value_requests (
  id, org_id, opportunity_id, definition_id, value_number, source,
  actor_user_id, confidence, expected_version
)
select
  '75000000-0000-0000-0000-000000000002',
  '25000000-0000-0000-0000-000000000001',
  '65000000-0000-0000-0000-000000000001',
  id,
  700000,
  'ai',
  '15000000-0000-0000-0000-000000000001',
  0.900,
  1
from public.qualification_definitions
where org_id='25000000-0000-0000-0000-000000000001' and code='total_price';

insert into public.faq_creation_requests (
  id, org_id, canonical_question, base_answer, response_mode, source_name, actor_user_id
)
values (
  '75000000-0000-0000-0000-000000000003',
  '25000000-0000-0000-0000-000000000001',
  'Qual é o prazo padrão para retorno?',
  'O retorno padrão acontece em até um dia útil.',
  'direct', 'Gate Source', '15000000-0000-0000-0000-000000000001'
);

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(*)::bigint from public.qualification_definitions where org_id='25000000-0000-0000-0000-000000000001' and active),
    8::bigint,
    'organization seed creates the eight qualification definitions'
  )
  union all
  select 2, extensions.is(
    (select count(*)::bigint from public.qualification_versions where org_id='25000000-0000-0000-0000-000000000001' and status='published'),
    1::bigint,
    'qualification catalog has one published immutable version'
  )
  union all
  select 3, extensions.is(
    (select result from public.qualification_value_requests where id='75000000-0000-0000-0000-000000000002'),
    'conflict'::text,
    'AI conflict against human-confirmed data is recorded'
  )
  union all
  select 4, extensions.is(
    (select value_number from public.qualification_values where opportunity_id='65000000-0000-0000-0000-000000000001'),
    500000::numeric,
    'AI conflict never overwrites the human value'
  )
  union all
  select 5, extensions.ok(
    (select human_confirmed from public.qualification_values where opportunity_id='65000000-0000-0000-0000-000000000001'),
    'human provenance remains explicit'
  )
  union all
  select 6, extensions.is(
    (select state from public.qualification_values where opportunity_id='65000000-0000-0000-0000-000000000001'),
    'valid'::text,
    'conflict handler restores the valid human state'
  )
  union all
  select 7, extensions.is(
    (select count(*)::bigint from public.qualification_value_history where opportunity_id='65000000-0000-0000-0000-000000000001'),
    2::bigint,
    'created and conflicting qualification writes are auditable'
  )
  union all
  select 8, extensions.is(
    (select count(*)::bigint from public.faq_versions where faq_entry_id=(select faq_entry_id from public.faq_creation_requests where id='75000000-0000-0000-0000-000000000003') and status='published'),
    1::bigint,
    'FAQ command atomically creates one published version'
  )
  union all
  select 9, extensions.is(
    (select count(*)::bigint from public.faq_entries where id=(select faq_entry_id from public.faq_creation_requests where id='75000000-0000-0000-0000-000000000003') and status='published'),
    1::bigint,
    'FAQ entry is published with its version'
  )
) owner_assertions
order by 1;

select set_config('request.jwt.claims', '{"sub":"15000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (10, extensions.is(
  (select count(*)::bigint from public.qualification_values),
  0::bigint,
  'broker without assignment cannot read the opportunity qualification'
));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
