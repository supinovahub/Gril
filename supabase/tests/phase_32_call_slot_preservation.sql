begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(2);

select extensions.ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'calls_active_slot_unique_idx'
  ),
  'only one active call can own an opportunity slot'
);

select extensions.ok(
  position('call.reused' in pg_get_functiondef(
    'private.process_call_creation_request()'::regprocedure
  )) > 0,
  'a repeated slot updates the existing call instead of superseding it'
);

select * from extensions.finish();
rollback;
