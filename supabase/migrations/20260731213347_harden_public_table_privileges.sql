begin;

-- Supabase's project defaults grant every table privilege to anon and
-- authenticated. RLS still filters rows, but retaining unused table grants
-- violates least privilege and makes a future policy mistake more dangerous.
-- Rebuild CRUD grants from the policies that explicitly target authenticated.
do $$
declare
  v_authenticated_oid oid;
  v_table record;
  v_privileges text;
begin
  select oid into strict v_authenticated_oid
  from pg_roles
  where rolname = 'authenticated';

  for v_table in
    select n.nspname as schema_name, c.relname as table_name, c.oid as table_oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      v_table.schema_name,
      v_table.table_name
    );

    select string_agg(distinct privilege_name, ', ' order by privilege_name)
    into v_privileges
    from pg_policy policy
    cross join lateral unnest(
      case policy.polcmd
        when '*' then array['select', 'insert', 'update', 'delete']::text[]
        when 'r' then array['select']::text[]
        when 'a' then array['insert']::text[]
        when 'w' then array['update']::text[]
        when 'd' then array['delete']::text[]
        else array[]::text[]
      end
    ) as granted(privilege_name)
    where policy.polrelid = v_table.table_oid
      and (
        0::oid = any(policy.polroles)
        or v_authenticated_oid = any(policy.polroles)
      );

    if v_privileges is not null then
      execute format(
        'grant %s on table %I.%I to authenticated',
        v_privileges,
        v_table.schema_name,
        v_table.table_name
      );
    end if;
  end loop;
end
$$;

-- Keep privileged backend access explicit and prevent future tables from
-- silently inheriting broad client grants before their migrations finish.
grant all privileges on all tables in schema public to service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

commit;
