begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.organization_settings'::regclass
      and c.conname = 'organization_settings_inbound_ai_mode_check'
      and pg_get_constraintdef(c.oid) ilike '%production%'
  ),
  'inbound AI mode accepts production'
);

select extensions.ok(
  not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.organization_settings'::regclass
      and c.conname = 'organization_settings_inbound_no_production_check'
  ),
  'inbound production is not blocked by the retired constraint'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.organization_settings'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%ai_global_mode%production%'
  ),
  'the legacy global mode still accepts production'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'organization_settings_production_gate'
      and not tgisinternal
  ),
  'production readiness remains database-enforced'
);

select extensions.ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'enforce_ai_production_readiness'
  ),
  'production readiness function remains available'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'conversations_default_ai_mode'
      and not tgisinternal
  ),
  'new inbound conversations still inherit the global mode'
);

select * from extensions.finish();
rollback;
