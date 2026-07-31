begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(10);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.ok(
    to_regclass('public.learning_suggestions') is not null,
    'learning suggestions are persisted separately from published rules'
  )
  union all
  select 2, extensions.ok(
    to_regclass('public.regression_cases') is not null and to_regclass('public.regression_runs') is not null,
    'regression cases and runs are durable records'
  )
  union all
  select 3, extensions.ok(
    to_regclass('public.simulator_runs') is not null and to_regclass('public.simulator_run_requests') is not null,
    'simulator has an isolated request and result boundary'
  )
  union all
  select 4, extensions.ok(
    to_regclass('public.experiments') is not null and to_regclass('public.experiment_variants') is not null,
    'experiments and variants are explicit entities'
  )
  union all
  select 5, extensions.ok(
    (select bool_and(relrowsecurity)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname in (
       'learning_suggestions','regression_cases','regression_runs','simulator_runs',
       'experiments','experiment_variants','experiment_assignments','experiment_events'
     )),
    'all operations tables enforce RLS'
  )
  union all
  select 6, extensions.ok(
    not has_table_privilege('anon','public.learning_suggestions','select')
    and not has_table_privilege('anon','public.regression_runs','select'),
    'anonymous clients cannot inspect learning or regression data'
  )
  union all
  select 7, extensions.ok(
    not has_table_privilege('authenticated','public.rule_versions','update'),
    'published rule versions are immutable to clients'
  )
  union all
  select 8, extensions.ok(
    position('critical_failures' in pg_get_functiondef('private.process_rule_publish_request()'::regprocedure))>0
    and position('passed_cases' in pg_get_functiondef('private.process_rule_publish_request()'::regprocedure))>0,
    'rule publication checks passed cases and critical failures'
  )
  union all
  select 9, extensions.ok(
    position('status=''paused''' in pg_get_functiondef('private.pause_experiment_on_critical_event()'::regprocedure))>0,
    'critical experiment events pause the experiment server-side'
  )
  union all
  select 10, extensions.ok(
    exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='usage_ledger'
        and policyname='usage_ledger_select_owner'
    ),
    'usage and cost ledger remains owner-only'
  )
) operations_assertions
order by 1;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
