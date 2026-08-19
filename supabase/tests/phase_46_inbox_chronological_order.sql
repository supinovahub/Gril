begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.ok(
  position(
    'order by row.updated_at desc, row.id'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) > 0,
  'Inbox page selects conversations by latest activity and deterministic id'
);

select extensions.ok(
  position(
    'has_attention desc'
    in lower(pg_get_functiondef('public.inbox_conversation_page(uuid,integer)'::regprocedure))
  ) = 0,
  'Inbox page no longer promotes conversations with pending attention'
);

select extensions.ok(
  position(
    'order by conversation.updated_at desc, conversation.id'
    in lower(pg_get_functiondef('public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure))
  ) > 0,
  'Inbox bootstrap serializes conversations by latest activity and deterministic id'
);

select extensions.ok(
  position(
    'has_attention desc'
    in lower(pg_get_functiondef('public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure))
  ) = 0,
  'Inbox bootstrap no longer promotes conversations with pending attention'
);

select extensions.ok(
  (select function.proconfig @> array['search_path=""', 'jit=off']
   from pg_proc function
   where function.oid = 'public.inbox_conversation_page(uuid,integer)'::regprocedure),
  'Inbox page keeps its locked search path and bounded-query JIT setting'
);

select extensions.ok(
  (select function.proconfig @> array['search_path=""', 'jit=off']
   from pg_proc function
   where function.oid = 'public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure),
  'Inbox bootstrap keeps its locked search path and bounded-query JIT setting'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.inbox_conversation_page(uuid,integer)',
    'execute'
  ),
  'authenticated users still cannot bypass the Inbox bootstrap'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.inbox_workspace_bootstrap(uuid,integer)',
    'execute'
  ),
  'authenticated users can still execute the Inbox bootstrap'
);

select * from extensions.finish();
rollback;
