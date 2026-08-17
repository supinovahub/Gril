begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(24);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'private.workspace_access_context(uuid)'::regprocedure),
  'workspace access context bypasses row policies only inside its locked authorization boundary'
);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'public.current_viewer_context_v3()'::regprocedure),
  'viewer context v3 uses the locked authorization boundary'
);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'public.inbox_conversation_page(uuid,integer)'::regprocedure),
  'Inbox page uses the locked authorization boundary'
);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'public.dashboard_workspace_v2(uuid,timestamptz,timestamptz,timestamptz)'::regprocedure),
  'Dashboard workspace uses the locked authorization boundary'
);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure),
  'Inbox bootstrap uses the locked authorization boundary'
);

select extensions.ok(
  (select function.prosecdef from pg_proc function where function.oid = 'public.dashboard_workspace_bootstrap(text,timestamptz,uuid)'::regprocedure),
  'Dashboard bootstrap uses the locked authorization boundary'
);

select extensions.ok(
  not exists (
    select 1
    from pg_proc function
    where function.oid in (
      'private.workspace_access_context(uuid)'::regprocedure,
      'public.current_viewer_context_v3()'::regprocedure,
      'public.inbox_conversation_page(uuid,integer)'::regprocedure,
      'public.dashboard_workspace_v2(uuid,timestamptz,timestamptz,timestamptz)'::regprocedure,
      'public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure,
      'public.dashboard_workspace_bootstrap(text,timestamptz,uuid)'::regprocedure
    )
      and not (function.proconfig @> array['search_path=""'])
  ),
  'all definer functions lock search_path'
);

select extensions.ok(
  (select function.proconfig @> array['jit=off'] from pg_proc function where function.oid = 'public.inbox_workspace_bootstrap(uuid,integer)'::regprocedure),
  'Inbox bootstrap avoids JIT startup cost for a bounded OLTP page'
);

select extensions.ok(
  (select function.proconfig @> array['jit=off'] from pg_proc function where function.oid = 'public.dashboard_workspace_bootstrap(text,timestamptz,uuid)'::regprocedure),
  'Dashboard bootstrap avoids JIT startup cost for a bounded OLTP payload'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.current_viewer_context_v3()', 'execute'),
  'anonymous users cannot execute viewer context v3'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.inbox_conversation_page(uuid,integer)', 'execute'),
  'anonymous users cannot execute the Inbox page contract'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.dashboard_workspace_v2(uuid,timestamptz,timestamptz,timestamptz)', 'execute'),
  'anonymous users cannot execute the Dashboard data contract'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.inbox_workspace_bootstrap(uuid,integer)', 'execute'),
  'anonymous users cannot execute the Inbox bootstrap'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.dashboard_workspace_bootstrap(text,timestamptz,uuid)', 'execute'),
  'anonymous users cannot execute the Dashboard bootstrap'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.current_viewer_context_v3()', 'execute'),
  'authenticated users can execute viewer context v3'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.inbox_workspace_bootstrap(uuid,integer)', 'execute'),
  'authenticated users can execute the Inbox bootstrap'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.dashboard_workspace_bootstrap(text,timestamptz,uuid)', 'execute'),
  'authenticated users can execute the Dashboard bootstrap'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.inbox_conversation_page(uuid,integer)', 'execute'),
  'authenticated users cannot bypass the Inbox bootstrap'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.dashboard_workspace_v2(uuid,timestamptz,timestamptz,timestamptz)', 'execute'),
  'authenticated users cannot bypass the Dashboard bootstrap'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'private.workspace_access_context(uuid)', 'execute'),
  'authenticated users cannot call the private access helper directly'
);

select extensions.is(
  public.inbox_workspace_bootstrap(null, 100) ->> 'authenticated',
  'false',
  'Inbox bootstrap reports an unauthenticated caller without claims'
);

select extensions.is(
  public.inbox_workspace_bootstrap(null, 100) ->> 'authorized',
  'false',
  'Inbox bootstrap denies a caller without workspace access'
);

select extensions.is(
  public.dashboard_workspace_bootstrap('7d', now(), null) ->> 'authenticated',
  'false',
  'Dashboard bootstrap reports an unauthenticated caller without claims'
);

select extensions.is(
  public.dashboard_workspace_bootstrap('7d', now(), null) ->> 'authorized',
  'false',
  'Dashboard bootstrap denies a caller without workspace access'
);

select * from extensions.finish();
rollback;
