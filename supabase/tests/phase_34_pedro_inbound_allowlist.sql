begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

select extensions.ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'is_ai_inbound_recipient_allowlisted'
  ),
  'inbound allowlist helper exists in the private schema'
);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%ai_test_allowlist%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%journey%inbound%',
  'normal inbound eligibility checks the allowlist'
);

select extensions.ok(
  pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
    ilike '%production_recipient_not_allowlisted%',
  'queued production executions are revalidated before running'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'messages_pedro_inbound_allowlist'
      and not tgisinternal
  ),
  'AI outbound messages have a final allowlist trigger'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%sender_type%ai%'
    and pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
      ilike '%production_recipient_not_allowlisted%',
  'the final trigger blocks an unlisted production recipient'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'ai_test_allowlist_audit'
      and not tgisinternal
  ),
  'whitelist changes are audited'
);

select * from extensions.finish();
rollback;
