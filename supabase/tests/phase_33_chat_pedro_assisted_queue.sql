begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid='public.internal_threads'::regclass
      and c.conname='internal_threads_source_check'
      and pg_get_constraintdef(c.oid) ilike '%assisted_suggestion%'
  ),
  'internal topics support assisted suggestions as a source'
);

select extensions.ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
  ),
  'assisted suggestion topic synchronizer exists'
);

select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgname='ai_suggestion_assisted_topic' and not tgisinternal
  ),
  'pending assisted suggestions create internal topics'
);

select extensions.ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='create_assisted_suggestion_topic'
  ),
  'assisted suggestion insert trigger function exists'
);

select extensions.ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='sync_assisted_suggestion_review_topic'
  ),
  'review synchronizer exists'
);

select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgname='ai_suggestion_review_sync_topic' and not tgisinternal
  ),
  'suggestion review updates the internal topic'
);

select extensions.ok(
  pg_get_functiondef((
    select p.oid from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%mode=''assisted''%',
  'only assisted mode suggestions enter the Pedro queue'
);

select extensions.ok(
  pg_get_functiondef((
    select p.oid from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='sync_assisted_suggestion_topic'
    limit 1
  )) ilike '%suggestion_body%',
  'the proposal keeps the exact suggested response for human review'
);

select * from extensions.finish();
rollback;
