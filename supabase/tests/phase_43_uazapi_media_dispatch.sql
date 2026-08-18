begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.has_function(
  'public', 'execute_runtime_job', array['uuid'],
  'runtime job dispatcher remains available'
);

select extensions.ok(
  position(
    'media.inbound.process'
    in pg_get_functiondef('public.execute_runtime_job(uuid)'::regprocedure)
  ) > 0
  and position(
    'process_media'
    in pg_get_functiondef('public.execute_runtime_job(uuid)'::regprocedure)
  ) > 0,
  'runtime dispatcher routes inbound media jobs to the worker'
);

select extensions.ok(
  position(
    'execute_runtime_job_before_media_dispatch_fix'
    in pg_get_functiondef('public.execute_runtime_job(uuid)'::regprocedure)
  ) > 0,
  'runtime dispatcher delegates every other job to the preserved chain'
);

select extensions.ok(
  position(
    'ai.meta_review.execute'
    in pg_get_functiondef(
      'public.execute_runtime_job_before_media_dispatch_fix(uuid)'::regprocedure
    )
  ) > 0
  and position(
    'execute_runtime_job_before_continuous_improvement'
    in pg_get_functiondef(
      'public.execute_runtime_job_before_media_dispatch_fix(uuid)'::regprocedure
    )
  ) > 0,
  'media fix preserves the current continuous-improvement dispatcher'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated', 'public.execute_runtime_job(uuid)', 'execute'
  )
  and has_function_privilege(
    'service_role', 'public.execute_runtime_job(uuid)', 'execute'
  ),
  'runtime dispatch remains restricted to the service role'
);

select * from extensions.finish();
rollback;
