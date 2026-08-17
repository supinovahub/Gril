begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

select extensions.ok(
  to_regprocedure('public.internal_chat_workspace_bootstrap(uuid,text,uuid,uuid,text,text,text,text,boolean)') is not null,
  'internal chat exposes one workspace bootstrap'
);

select extensions.ok(
  not (select prosecdef from pg_proc
       where oid='public.internal_chat_workspace_bootstrap(uuid,text,uuid,uuid,text,text,text,text,boolean)'::regprocedure),
  'internal chat bootstrap remains a security invoker and preserves RLS'
);

select extensions.ok(
  position('mark_internal_thread_read' in pg_get_functiondef(
    'public.internal_chat_workspace_bootstrap(uuid,text,uuid,uuid,text,text,text,text,boolean)'::regprocedure
  ))>0,
  'workspace bootstrap preserves read markers'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.internal_chat_workspace_bootstrap(uuid,text,uuid,uuid,text,text,text,text,boolean)',
    'execute'
  ) and not has_function_privilege(
    'anon',
    'public.internal_chat_workspace_bootstrap(uuid,text,uuid,uuid,text,text,text,text,boolean)',
    'execute'
  ),
  'only signed-in callers can execute the internal chat bootstrap'
);

select * from extensions.finish();
rollback;
