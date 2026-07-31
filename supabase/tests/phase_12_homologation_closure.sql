begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(17);

select extensions.has_table('public', 'organization_bootstrap_requests', 'organization bootstrap command exists');
select extensions.has_table('public', 'ai_suggestion_review_requests', 'assisted-mode review command exists');
select extensions.has_table('public', 'privacy_review_requests', 'privacy review workflow exists');
select extensions.has_table('public', 'attachment_access_grants', 'sensitive attachment grants exist');
select extensions.has_table('public', 'campaign_wave_contact_reviews', 'campaign wave quality gate exists');

select extensions.has_function(
  'public', 'schedule_inbound_ai_aggregation', array['uuid'],
  'inbound aggregation scheduler exists'
);
select extensions.has_function(
  'public', 'runtime_queue_dead_letter', array['text', 'bigint', 'integer', 'jsonb', 'text', 'text'],
  'runtime dead-letter command exists'
);
select extensions.has_function(
  'public', 'list_audit_events', array['uuid', 'integer'],
  'tenant audit feed exists'
);

select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'ai_action_execution_exact_followup' and not tgisinternal
  ),
  'Pedro follow-up action is rewired to the exact named cadence'
);
select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'call_result_confirmed_no_show_cadence' and not tgisinternal
  ),
  'human-confirmed no-show schedules its exact cadence'
);

select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'call_creation_supersede_previous_slot' and not tgisinternal
  ),
  'a confirmed replacement slot supersedes prior open calls'
);

select extensions.ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'seed_default_followup_plan'
      and pg_get_functiondef(p.oid) like '%Cadencia curta padrao%'
      and pg_get_functiondef(p.oid) like '%Cadencia no-show%'
      and pg_get_functiondef(p.oid) like '%Compra futura%'
  ),
  'new operations receive every required cadence'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('messages', 'conversations', 'alerts', 'calls', 'call_offers', 'campaigns', 'campaign_waves')
  ),
  7::bigint,
  'all seven operational tables are in the realtime publication'
);

select extensions.ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_audit_events'
      and not p.prosecdef
  ),
  'authenticated audit feed uses invoker rights'
);

select extensions.is(
  (select count(*)::bigint from public.regression_cases where active),
  100::bigint,
  'the complete 100-case regression catalog is present'
);
select extensions.is(
  (select count(*)::bigint from public.regression_cases where active and severity = 'critical'),
  52::bigint,
  'the 52 critical regression cases remain explicit'
);

select extensions.ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  'every public table has RLS enabled'
);

select * from extensions.finish();
rollback;
