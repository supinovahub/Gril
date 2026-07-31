begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;

insert into public.organizations (id, name, slug)
values ('29000000-0000-0000-0000-000000000001', 'Hardening Gate Org', 'hardening-gate-org');

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(*)::bigint from public.regression_cases where org_id='29000000-0000-0000-0000-000000000001' and active),
    50::bigint,
    'each organization receives exactly 50 active baseline regression cases'
  )
  union all
  select 2, extensions.is(
    (select count(*)::bigint from public.regression_cases where org_id='29000000-0000-0000-0000-000000000001' and severity='critical' and not active),
    0::bigint,
    'all critical baseline regression cases remain active'
  )
  union all
  select 3, extensions.is(
    (select count(*)::bigint
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
    0::bigint,
    'every public table has RLS enabled'
  )
  union all
  select 4, extensions.is(
    (select count(distinct table_name)::bigint
     from information_schema.role_table_grants
     where table_schema='public' and grantee='anon'),
    0::bigint,
    'anonymous role has no public domain table grants'
  )
  union all
  select 5, extensions.is(
    (select count(distinct table_name)::bigint
     from information_schema.role_table_grants
     where table_schema='public' and grantee='authenticated'
       and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')),
    0::bigint,
    'authenticated role has CRUD-only table privileges'
  )
  union all
  select 6, extensions.ok(
    not has_table_privilege('authenticated','public.webhook_ingest_requests','insert')
    and not has_table_privilege('authenticated','public.capacity_reservation_requests','insert')
    and not has_table_privilege('authenticated','public.meta_form_ingest_requests','insert'),
    'provider and capacity commands are service-role only'
  )
  union all
  select 7, extensions.ok(
    to_regclass('private.retention_purge_queue') is not null
    and to_regclass('public.retention_purge_queue') is null,
    'retention purge queue is outside the Data API schema'
  )
  union all
  select 8, extensions.ok(
    exists(
      select 1 from pg_trigger
      where tgrelid='public.whatsapp_connections'::regclass
        and tgname='whatsapp_connections_protect_status'
        and not tgisinternal
    ),
    'connection status is protected by an audited command gate'
  )
  union all
  select 9, extensions.ok(
    (select relrowsecurity from pg_class where oid='public.retention_policies'::regclass),
    'retention policies enforce RLS'
  )
  union all
  select 10, extensions.ok(
    exists(
      select 1 from pg_indexes
      where schemaname='public' and tablename='meta_lead_submissions'
        and indexdef ilike '%unique%form_id, external_submission_id%'
    ),
    'Meta form submissions have a provider idempotency key'
  )
  union all
  select 11, extensions.ok(
    exists(
      select 1 from pg_indexes
      where schemaname='public' and tablename='regression_cases'
        and indexname='regression_cases_initial_title_idx'
    ),
    'baseline regression titles are unique within each tenant'
  )
  union all
  select 12, extensions.ok(
    not has_schema_privilege('anon','private','usage')
    and not has_schema_privilege('authenticated','audit','usage'),
    'private and audit schemas remain outside client access'
  )
) hardening_assertions
order by 1;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
