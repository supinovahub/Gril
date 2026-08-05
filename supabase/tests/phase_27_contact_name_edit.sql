begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

select extensions.has_table(
  'public', 'contact_name_update_requests',
  'contact name update command exists'
);

select extensions.has_function(
  'private', 'process_contact_name_update_request', array[]::text[],
  'contact name update processor exists'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relnamespace = 'public'::regnamespace
      and c.relname = 'contact_name_update_requests'
      and t.tgname = 'contact_name_update_request_process'
      and not t.tgisinternal
  ),
  'contact name update command has a processor trigger'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.contact_name_update_requests', 'select')
  and has_table_privilege('authenticated', 'public.contact_name_update_requests', 'insert'),
  'authenticated users can submit and inspect their contact name commands'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.contact_name_update_requests', 'update')
  and not has_table_privilege('authenticated', 'public.contact_name_update_requests', 'delete'),
  'authenticated users cannot mutate or delete processed commands'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'private.process_contact_name_update_request()', 'execute'),
  'browser sessions cannot invoke the processor directly'
);

select * from extensions.finish();
rollback;
