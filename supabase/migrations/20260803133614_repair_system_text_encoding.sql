begin;

-- All repair pairs are represented as ASCII hex so applying this migration
-- cannot be corrupted by the SQL client's code page.
create or replace function private.repair_mojibake(p_value text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_value text := p_value;
  v_pair record;
begin
  if v_value is null then
    return null;
  end if;

  for v_pair in
    select * from (values
      ('c383c2a0','c3a0'),('c383c2a1','c3a1'),('c383c2a2','c3a2'),
      ('c383c2a3','c3a3'),('c383c2a4','c3a4'),('c383c2a7','c3a7'),
      ('c383c2a8','c3a8'),('c383c2a9','c3a9'),('c383c2aa','c3aa'),
      ('c383c2ab','c3ab'),('c383c2ac','c3ac'),('c383c2ad','c3ad'),
      ('c383c2ae','c3ae'),('c383c2af','c3af'),('c383c2b1','c3b1'),
      ('c383c2b2','c3b2'),('c383c2b3','c3b3'),('c383c2b4','c3b4'),
      ('c383c2b5','c3b5'),('c383c2b6','c3b6'),('c383c2b9','c3b9'),
      ('c383c2ba','c3ba'),('c383c2bb','c3bb'),('c383c2bc','c3bc'),
      ('c383c692','c383'),('c383e280a1','c387'),
      ('c3a2e282ace2809d','e28094'),
      -- Also recognize the ISO-8859-1 form used by some database clients.
      ('c383c283','c383'),('c383c287','c387'),('c3a2c280c294','e28094')
    ) as pairs(bad_hex, good_hex)
  loop
    v_value := replace(
      v_value,
      convert_from(decode(v_pair.bad_hex, 'hex'), 'UTF8'),
      convert_from(decode(v_pair.good_hex, 'hex'), 'UTF8')
    );
  end loop;

  return v_value;
end;
$$;

create or replace function private.has_mojibake(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_value, '') <> private.repair_mojibake(coalesce(p_value, ''))
$$;

revoke all on function private.repair_mojibake(text)
  from public, anon, authenticated, service_role;
revoke all on function private.has_mojibake(text)
  from public, anon, authenticated, service_role;

-- Repair stored routines first so no future execution can recreate malformed
-- labels, prompts, notifications, slugs, or catalog entries.
do $$
declare
  v_function record;
  v_definition text;
  v_repaired_definition text;
begin
  for v_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'audit')
      and p.prokind = 'f'
      and private.has_mojibake(pg_get_functiondef(p.oid))
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_repaired_definition := private.repair_mojibake(v_definition);

    if v_repaired_definition = v_definition then
      raise exception 'function_encoding_repair_failed:%', v_function.oid;
    end if;

    execute v_repaired_definition;
  end loop;
end;
$$;

-- Defaults are catalog expressions rather than function bodies and therefore
-- need to be recreated independently.
do $$
declare
  v_default record;
begin
  for v_default in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name,
      pg_get_expr(d.adbin, d.adrelid) as expression
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.adnum
    where n.nspname in ('public', 'private', 'audit')
      and private.has_mojibake(pg_get_expr(d.adbin, d.adrelid))
  loop
    execute format(
      'alter table %I.%I alter column %I set default %s',
      v_default.schema_name,
      v_default.table_name,
      v_default.column_name,
      private.repair_mojibake(v_default.expression)
    );
  end loop;
end;
$$;

-- Update only affected values. Triggers are disabled inside this transaction
-- to avoid creating operational side effects from a pure encoding repair.
set local session_replication_role = replica;

do $$
declare
  v_column record;
  v_repaired_expression text;
begin
  for v_column in
    select c.table_schema, c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema in ('public', 'private', 'audit')
      and t.table_type = 'BASE TABLE'
      and c.is_generated = 'NEVER'
      and c.data_type in ('text', 'character varying', 'character', 'json', 'jsonb')
  loop
    v_repaired_expression := case v_column.data_type
      when 'json' then format('private.repair_mojibake(%I::text)::json', v_column.column_name)
      when 'jsonb' then format('private.repair_mojibake(%I::text)::jsonb', v_column.column_name)
      else format('private.repair_mojibake(%I::text)', v_column.column_name)
    end;

    execute format(
      'update %I.%I set %I = %s where private.has_mojibake(%I::text)',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name,
      v_repaired_expression,
      v_column.column_name
    );
  end loop;
end;
$$;

set local session_replication_role = origin;

-- Abort atomically if a known malformed sequence survived in data, routines,
-- or defaults.
do $$
declare
  v_column record;
  v_affected bigint;
begin
  for v_column in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema in ('public', 'private', 'audit')
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'character', 'json', 'jsonb')
  loop
    execute format(
      'select count(*) from %I.%I where private.has_mojibake(%I::text)',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name
    ) into v_affected;

    if v_affected > 0 then
      raise exception 'persisted_mojibake_remains:%.%.%:%',
        v_column.table_schema, v_column.table_name, v_column.column_name, v_affected;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'audit')
      and p.prokind = 'f'
      and private.has_mojibake(pg_get_functiondef(p.oid))
  ) then
    raise exception 'function_mojibake_remains';
  end if;

  if exists (
    select 1
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private', 'audit')
      and private.has_mojibake(pg_get_expr(d.adbin, d.adrelid))
  ) then
    raise exception 'default_mojibake_remains';
  end if;
end;
$$;

commit;
