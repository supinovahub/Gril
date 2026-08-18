begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    not ilike '%institutional_profile%',
  'institutional profile completeness no longer gates inbound production'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    not ilike '%regression_runs%',
  'regression results no longer gate inbound production'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    not ilike '%last_health_at%',
  'health check recency no longer gates inbound production'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    not ilike '%last_error_redacted%',
  'the last health error no longer gates inbound production'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    ilike '%w.status = ''active''%'
    and pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
      ilike '%w.inbound_enabled%',
  'an active inbound WhatsApp connection remains mandatory'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    ilike '%production_allowlist_empty%',
  'an active allowlist entry remains mandatory for activation'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    ilike '%production_knowledge_or_rules_incomplete%',
  'published knowledge and rules remain mandatory'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_ai_production_readiness()'::regprocedure)
    ilike '%production_models_incomplete%',
  'approved primary and fallback models remain mandatory'
);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%is_ai_inbound_recipient_allowlisted%',
  'inbound production eligibility still checks the recipient allowlist'
);

select extensions.ok(
  pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
    ilike '%private.is_conversation_ai_eligible%',
  'the worker still revalidates production eligibility'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%production_recipient_not_allowlisted%'
    and exists (
      select 1 from pg_trigger
      where tgname = 'messages_pedro_inbound_allowlist'
        and not tgisinternal
    ),
  'the final outbound allowlist trigger remains installed'
);

select extensions.ok(
  not has_function_privilege('public', 'private.enforce_ai_production_readiness()', 'execute')
    and not has_function_privilege('anon', 'private.enforce_ai_production_readiness()', 'execute')
    and not has_function_privilege('authenticated', 'private.enforce_ai_production_readiness()', 'execute')
    and not has_function_privilege('service_role', 'private.enforce_ai_production_readiness()', 'execute'),
  'the private readiness trigger function remains non-callable by API roles'
);

select * from extensions.finish();
rollback;
