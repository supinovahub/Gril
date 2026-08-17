begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

select extensions.ok(
  pg_get_viewdef('public.inbox_notification_counts'::regclass, true) not ilike '%count(distinct%',
  'Inbox notification counts no longer use multiplicative distinct aggregates'
);

select extensions.ok(
  pg_get_viewdef('public.inbox_notification_counts'::regclass, true) ilike '%join lateral%',
  'Inbox notification counts aggregate messages and suggestions independently'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'inbox_notification_counts'
      and relation.reloptions @> array['security_invoker=true']
  ),
  'Inbox notification view keeps caller RLS'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'inbox_conversation_list'
      and relation.reloptions @> array['security_invoker=true']
  ),
  'Inbox list view uses security invoker'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'lead_list'
      and relation.reloptions @> array['security_invoker=true']
  ),
  'Lead list view uses security invoker'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'kanban_opportunity_list'
      and relation.reloptions @> array['security_invoker=true']
  ),
  'Kanban list view uses security invoker'
);

select extensions.ok(
  exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'dashboard_kanban_snapshot'
      and relation.reloptions @> array['security_invoker=true']
  ),
  'Dashboard snapshot view uses security invoker'
);

select extensions.ok(
  not (select function.prosecdef from pg_proc function where function.oid = 'public.current_viewer_context_v2()'::regprocedure),
  'Viewer context executes with caller permissions'
);

select extensions.ok(
  not (select function.prosecdef from pg_proc function where function.oid = 'public.internal_chat_notification_counts(uuid)'::regprocedure),
  'Internal notification count executes with caller permissions'
);

select extensions.ok(
  not (select function.prosecdef from pg_proc function where function.oid = 'public.dashboard_metrics(uuid,timestamptz,timestamptz)'::regprocedure),
  'Dashboard metrics execute with caller permissions'
);

select extensions.ok(
  not (select function.prosecdef from pg_proc function where function.oid = 'public.central_feed_page(uuid,uuid,text,integer,integer)'::regprocedure),
  'Central feed executes with caller permissions'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.current_viewer_context_v2()', 'execute'),
  'Anonymous users cannot execute viewer context'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.central_feed_page(uuid,uuid,text,integer,integer)', 'execute'),
  'Anonymous users cannot execute Central feed'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.current_viewer_context_v2()', 'execute'),
  'Authenticated users can execute viewer context'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.central_feed_page(uuid,uuid,text,integer,integer)', 'execute'),
  'Authenticated users can execute Central feed'
);

select * from extensions.finish();
rollback;
