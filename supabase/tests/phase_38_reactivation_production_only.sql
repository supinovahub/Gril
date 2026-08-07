begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(10);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_settings'::regclass
      and conname = 'organization_settings_inbound_ai_mode_check'
      and pg_get_constraintdef(oid) ilike '%off%shadow%assisted%'
      and pg_get_constraintdef(oid) not ilike '%production%'
  ),
  'normal inbound settings exclude production'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_settings'::regclass
      and conname = 'organization_settings_inbound_no_production_check'
      and pg_get_constraintdef(oid) ilike '%production%'
  ),
  'legacy global production switch is constrained'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'campaigns_reactivation_production_gate'
      and not tgisinternal
  ),
  'campaign production gate remains installed'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'campaign_wave_reactivation_production_gate'
      and not tgisinternal
  ),
  'wave release production gate is installed'
);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%c.ai_mode <> ''production''%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%is_reactivation_production_allowed%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%reactivation_ai_mode%',
  'eligibility separates reactivation production from normal inbound'
);

select extensions.ok(
  pg_get_functiondef('private.is_reactivation_production_allowed(uuid)'::regprocedure)
    ilike '%campaign.campaign_type = ''reactivation''%'
    and pg_get_functiondef('private.is_reactivation_production_allowed(uuid)'::regprocedure)
      ilike '%reactivation_release_state%',
  'production eligibility requires reactivation campaign provenance and release'
);

select extensions.ok(
  pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
    ilike '%production_only_for_reactivation%'
    and pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
      ilike '%reactivation_production_not_released%',
  'worker revalidates production provenance before starting'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%production_only_for_reactivation%'
    and pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
      ilike '%is_reactivation_production_allowed%',
  'final outbound guard rejects production outside reactivation'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'campaign_opening_marks_reactivation'
      and not tgisinternal
  ),
  'campaign opening records reactivation journey provenance'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_reactivation_production_gate()'::regprocedure)
    ilike '%production_only_for_reactivation%'
    and pg_get_functiondef('private.enforce_reactivation_production_gate()'::regprocedure)
      ilike '%reactivation_production_not_released%',
  'campaign configuration requires explicit reactivation release'
);

select * from extensions.finish();
rollback;
