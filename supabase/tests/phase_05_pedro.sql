begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(10);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values ('14000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'pedro-owner@invalid.test', '', now(), '{}', '{"full_name":"Pedro Owner"}', now(), now());

insert into public.organizations (id, name, slug)
values ('24000000-0000-0000-0000-000000000001', 'Pedro Gate Org', 'pedro-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('34000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 'Pedro Gate Operation', 'pedro-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values ('44000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.ai_execution_requests (
  id, org_id, operation_id, mode, input_snapshot, idempotency_key, actor_user_id
)
values (
  '64000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  '34000000-0000-0000-0000-000000000001',
  'simulator', '{"message":"gate"}', 'pedro-gate-execution',
  '14000000-0000-0000-0000-000000000001'
);

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(*)::bigint from public.personas where org_id='24000000-0000-0000-0000-000000000001'),
    1::bigint,
    'organization seed creates one Pedro persona'
  )
  union all
  select 2, extensions.is(
    (select count(*)::bigint from public.persona_versions where org_id='24000000-0000-0000-0000-000000000001' and status='published'),
    1::bigint,
    'organization seed creates one published persona version'
  )
  union all
  select 3, extensions.is(
    (select count(*)::bigint from public.rule_versions where org_id='24000000-0000-0000-0000-000000000001' and status='published'),
    1::bigint,
    'organization seed creates one published rule version'
  )
  union all
  select 4, extensions.throws_ok(
    $$update public.model_profiles
      set status='active', is_default=true
      where id=(select id from public.model_profiles where org_id='24000000-0000-0000-0000-000000000001' and status='draft' limit 1)$$,
    '42501',
    'new row violates row-level security policy for table "model_profiles"',
    'draft model cannot be activated by direct client update'
  )
  union all
  select 5, extensions.is(
    (select result from public.ai_execution_requests where id='64000000-0000-0000-0000-000000000001'),
    'blocked'::text,
    'simulator is blocked without an active verified BYOK model'
  )
  union all
  select 6, extensions.is(
    (select status from public.ai_executions where id=(select execution_id from public.ai_execution_requests where id='64000000-0000-0000-0000-000000000001')),
    'blocked'::text,
    'blocked request creates an auditable blocked execution'
  )
  union all
  select 7, extensions.is(
    (select error_code from public.ai_executions where id=(select execution_id from public.ai_execution_requests where id='64000000-0000-0000-0000-000000000001')),
    'active_model_and_secret_required'::text,
    'blocked execution records a redacted reason'
  )
  union all
  select 8, extensions.throws_ok(
    $$insert into public.model_activation_requests (org_id,model_profile_id,actor_user_id)
      select '24000000-0000-0000-0000-000000000001',id,'14000000-0000-0000-0000-000000000001'
      from public.model_profiles where org_id='24000000-0000-0000-0000-000000000001' limit 1$$,
    '22023',
    'verified_openai_integration_required',
    'model activation requires a verified OpenAI integration'
  )
  union all
  select 9, extensions.ok(
    exists(
      select 1 from pg_indexes
      where schemaname='public' and tablename='ai_execution_requests'
        and indexdef ilike '%unique%org_id, idempotency_key%'
    ),
    'AI execution requests have a tenant-scoped idempotency key'
  )
) pedro_assertions
order by 1;

reset role;
insert into _tap_results (n, tap)
values (10, extensions.is(
  (select count(*)::bigint from private.outbox_events where idempotency_key='pedro-gate-execution'),
  0::bigint,
  'blocked execution never calls an external provider'
));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
