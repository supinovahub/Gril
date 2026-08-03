begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

select extensions.has_function(
  'public', 'finish_runtime_job', array['uuid', 'boolean', 'text', 'integer'],
  'runtime job acknowledgement exists'
);

select extensions.has_function(
  'public', 'recover_stalled_inbound_ai', array['integer'],
  'stalled inbound recovery exists'
);

select extensions.has_function(
  'public', 'schedule_inbound_ai_aggregation', array['uuid'],
  'inbound aggregation scheduler remains available'
);

select extensions.ok(
  (
    select pg_get_functiondef(p.oid) like '%completed_at = coalesce(completed_at, now())%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'finish_runtime_job'
  ),
  'successful acknowledgement records completed_at'
);

select extensions.ok(
  (
    select pg_get_functiondef(p.oid) like '%:after:%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'schedule_inbound_ai_aggregation'
  ),
  'an inbound arriving during a lease receives a successor job'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.recover_stalled_inbound_ai(integer)', 'execute'),
  'browser sessions cannot invoke automatic recovery directly'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.recover_stalled_inbound_ai(integer)', 'execute'),
  'only the runtime service role can invoke automatic recovery'
);

select * from extensions.finish();
rollback;
