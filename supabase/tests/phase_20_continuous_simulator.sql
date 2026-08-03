begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.ok(
  to_regclass('public.simulator_sessions') is not null
    and to_regclass('public.simulator_session_requests') is not null,
  'continuous simulator sessions and their command boundary exist'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.simulator_sessions'::regclass)
    and (select relrowsecurity from pg_class where oid = 'public.simulator_session_requests'::regclass),
  'continuous simulator tables enforce RLS'
);

select extensions.ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.simulator_runs'::regclass
      and conname = 'simulator_runs_session_turn_key'
  ),
  'turn numbers are unique inside each simulator session'
);

select extensions.ok(
  (select attnotnull from pg_attribute where attrelid = 'public.simulator_runs'::regclass and attname = 'session_id')
    and (select attnotnull from pg_attribute where attrelid = 'public.simulator_runs'::regclass and attname = 'turn_index'),
  'every simulator turn belongs to a session and has an order'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.simulator_sessions', 'select')
    and not has_table_privilege('authenticated', 'public.simulator_sessions', 'update')
    and not has_table_privilege('authenticated', 'public.simulator_sessions', 'delete'),
  'clients can read sessions but can only mutate them through commands'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.simulator_session_requests', 'insert')
    and not has_table_privilege('anon', 'public.simulator_session_requests', 'insert'),
  'only authenticated managers can reach the session command boundary'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'private.process_simulator_run_request()', 'execute')
    and not has_function_privilege('authenticated', 'private.process_simulator_session_request()', 'execute'),
  'private simulator trigger functions are not directly executable by clients'
);

select extensions.ok(
  position('simulator_turn_pending' in pg_get_functiondef('private.process_simulator_run_request()'::regprocedure)) > 0
    and position('status <> ''active''' in pg_get_functiondef('private.process_simulator_run_request()'::regprocedure)) > 0,
  'the database rejects concurrent turns and writes to archived sessions'
);

select * from extensions.finish();

rollback;
