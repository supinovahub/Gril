begin;

-- The notifications table uses `app` as the canonical in-product channel.
-- Two governance RPCs predated that contract and still attempted to insert
-- `in_app`, causing otherwise valid access requests to fail at notification
-- creation. Preserve the current live function bodies and ACLs while replacing
-- only the invalid channel literal.
do $$
declare
  v_function_name text;
  v_definition text;
  v_updated_definition text;
  v_function_names constant text[] := array[
    'submit_access_request',
    'decide_access_request'
  ];
begin
  foreach v_function_name in array v_function_names loop
    select pg_get_functiondef(p.oid)
      into v_definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_function_name
       and p.prokind = 'f';

    if v_definition is null then
      raise exception 'notification_function_not_found:%', v_function_name;
    end if;

    v_updated_definition := replace(v_definition, '''in_app''', '''app''');

    if v_updated_definition = v_definition then
      raise exception 'invalid_notification_channel_not_found:%', v_function_name;
    end if;

    execute v_updated_definition;
  end loop;
end;
$$;

commit;
