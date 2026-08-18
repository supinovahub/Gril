begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_settings'::regclass
      and conname = 'organization_settings_inbound_ai_mode_check'
      and pg_get_constraintdef(oid) ilike '%production%'
  ),
  'normal inbound settings accept production'
);

select extensions.ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_settings'::regclass
      and conname = 'organization_settings_inbound_no_production_check'
  ),
  'the retired inbound production prohibition is absent'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    ilike '%production_allowlist_empty%',
  'production activation requires an active allowlist entry'
);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%c.journey = ''inbound''%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%c.ai_mode <> ''production''%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%is_ai_inbound_recipient_allowlisted%',
  'normal inbound production eligibility is limited to allowlisted recipients'
);

select extensions.ok(
  pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
    ilike '%private.is_conversation_ai_eligible%',
  'the worker revalidates production eligibility before starting'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%v_conversation.journey = ''inbound''%'
    and pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
      ilike '%production_recipient_not_allowlisted%',
  'the final outbound trigger protects allowlisted inbound production'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%v_conversation.journey = ''reactivation''%'
    and pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
      ilike '%is_reactivation_production_allowed%',
  'reactivation keeps its independent production release gate'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'organization_settings_sync_conversation_ai_mode'
      and not tgisinternal
  ),
  'changing the global mode synchronizes eligible active inbound conversations'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'messages_pedro_inbound_allowlist'
      and not tgisinternal
  ),
  'the final outbound production trigger remains installed'
);

select * from extensions.finish();
rollback;
