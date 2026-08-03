begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(2);

create or replace function pg_temp.has_mojibake(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from unnest(array[
      'c383c2a0','c383c2a1','c383c2a2','c383c2a3','c383c2a4','c383c2a7',
      'c383c2a8','c383c2a9','c383c2aa','c383c2ab','c383c2ac','c383c2ad',
      'c383c2ae','c383c2af','c383c2b2','c383c2b3','c383c2b4','c383c2b5',
      'c383c2b6','c383c2b9','c383c2ba','c383c2bb','c383c2bc',
      'c383c281','c383c289','c383c28d','c383c293','c383c29a',
      'c383e280a1','c383c692',
      'c3a2e282ace2809d','c3a2e282ace2809c','c3a2e280a0e28099',
      'c3a2e282acc593','c3a2e282acc29d','c3a2e282ace284a2',
      'c3a2e282acc2a6','c3a2e282acc2a2',
      'c382c2b7','c382c2a0','c382c2ba','c382c2aa','c382c2b0'
    ]::text[]) marker_hex
    where position(convert_from(decode(marker_hex, 'hex'), 'UTF8') in coalesce(p_value, '')) > 0
  )
$$;

create temporary table encoding_audit (
  affected_rows bigint not null
) on commit drop;

do $$
declare
  v_column record;
begin
  for v_column in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema in ('public', 'private', 'audit')
      and t.table_type = 'BASE TABLE'
      and c.is_generated = 'NEVER'
      and c.data_type in ('text', 'character varying', 'character', 'json', 'jsonb')
  loop
    execute format(
      'insert into encoding_audit(affected_rows)
       select count(*) from %I.%I where pg_temp.has_mojibake(%I::text)
       having count(*) > 0',
      v_column.table_schema,
      v_column.table_name,
      v_column.column_name
    );
  end loop;
end;
$$;

select extensions.is(
  coalesce((select sum(affected_rows) from encoding_audit), 0)::bigint,
  0::bigint,
  'persisted product text contains no mojibake'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'audit')
      and p.prokind = 'f'
      and pg_temp.has_mojibake(pg_get_functiondef(p.oid))
  ),
  0::bigint,
  'database function definitions contain no mojibake'
);

select * from extensions.finish();
rollback;
