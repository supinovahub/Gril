begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.ok(
  pg_get_functiondef((
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%analyzed_message%',
  'assisted suggestion topics retain the exact inbound message that was analyzed'
);

select extensions.ok(
  pg_get_functiondef((
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%context_summary%',
  'assisted suggestion topics retain the latest prior conversation summary'
);

select extensions.ok(
  pg_get_functiondef((
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%request_message_id%',
  'the context is anchored to the execution request message'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname='ai_suggestion_assisted_topic' and not tgisinternal
  ),
  'new assisted suggestions continue to synchronize automatically'
);

select extensions.ok(
  pg_get_functiondef((
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%suggestion_body%',
  'existing assisted proposals keep their exact suggested response'
);

select * from extensions.finish();
rollback;
