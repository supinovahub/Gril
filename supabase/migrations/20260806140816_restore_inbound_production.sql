begin;

-- Restore the original global production switch while retaining the existing
-- database readiness gate on ai_global_mode.
alter table public.organization_settings
  drop constraint if exists organization_settings_inbound_no_production_check;

do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.organization_settings'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%inbound_ai_mode%'
  loop
    execute format(
      'alter table public.organization_settings drop constraint %I',
      v_constraint
    );
  end loop;
end;
$$;

alter table public.organization_settings
  add constraint organization_settings_inbound_ai_mode_check
  check (inbound_ai_mode in ('off', 'shadow', 'assisted', 'production'));

-- Keep the legacy global field and the journey-specific field aligned for
-- organizations created while inbound production was disabled.
update public.organization_settings
set inbound_ai_mode = ai_global_mode
where ai_global_mode in ('off', 'shadow', 'assisted', 'production');

commit;
