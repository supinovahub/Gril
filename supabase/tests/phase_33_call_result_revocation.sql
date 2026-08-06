begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(3);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversation_access_grants'
      and column_name = 'revoked_by'
      and udt_name = 'uuid'
  ),
  'conversation access grants keep the revoking user'
);

select extensions.ok(
  position('revoked_by' in pg_get_functiondef(
    'private.route_completed_call_to_manager()'::regprocedure
  )) > 0,
  'post-call routing records who revoked the call window'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'conversation_access_grants'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%revoked_by%'
  ),
  'revoking user references auth users safely'
);

select * from extensions.finish();
rollback;
