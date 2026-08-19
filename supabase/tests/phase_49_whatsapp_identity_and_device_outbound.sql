begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

select extensions.is(
  private.canonical_whatsapp_e164('+551187654321'),
  '+5511987654321',
  'legacy Brazilian mobile receives the canonical ninth digit'
);

select extensions.is(
  private.canonical_whatsapp_e164('+551133334444'),
  '+551133334444',
  'Brazilian landline is not changed'
);

select extensions.is(
  private.canonical_whatsapp_e164('+14155552671'),
  '+14155552671',
  'explicit international number is not changed'
);

select extensions.ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.webhook_ingest_requests'::regclass
      and tgname = 'webhook_ingest_canonicalize_phone'
      and not tgisinternal
  ),
  'webhook ingestion canonicalizes the phone before contact lookup'
);

select extensions.ok(
  position(
    'new.source_execution_id'
    in pg_get_functiondef('private.capture_escalation_feedback_signal()'::regprocedure)
  ) > 0
  and position(
    'new.execution_id'
    in pg_get_functiondef('private.capture_escalation_feedback_signal()'::regprocedure)
  ) = 0,
  'escalation feedback reads the current source execution field'
);

select extensions.ok(
  not has_function_privilege(
    'service_role',
    'private.canonical_whatsapp_e164(text)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'private.canonicalize_whatsapp_ingest_phone()',
    'execute'
  ),
  'canonicalization helpers remain trigger-only'
);

select * from extensions.finish();

rollback;
