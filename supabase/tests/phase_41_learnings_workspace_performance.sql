begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

select extensions.ok(
  to_regprocedure('public.learnings_workspace_bootstrap(uuid)') is not null,
  'learnings workspace exposes one bootstrap function'
);

select extensions.ok(
  (select prosecdef from pg_proc where oid='public.learnings_workspace_bootstrap(uuid)'::regprocedure)
  and position('search_path=' in array_to_string(
    (select proconfig from pg_proc where oid='public.learnings_workspace_bootstrap(uuid)'::regprocedure), ','
  ))>0,
  'learnings bootstrap is security definer with an explicit search path'
);

select extensions.ok(
  position('has_org_permission' in pg_get_functiondef('public.learnings_workspace_bootstrap(uuid)'::regprocedure))>0,
  'learnings bootstrap enforces ai.manage authorization'
);

select extensions.ok(
  has_function_privilege('authenticated','public.learnings_workspace_bootstrap(uuid)','execute')
  and not has_function_privilege('anon','public.learnings_workspace_bootstrap(uuid)','execute'),
  'only authenticated application callers can execute the learnings bootstrap'
);

select * from extensions.finish();
rollback;
