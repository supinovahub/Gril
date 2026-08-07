begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%c.ai_mode <> ''production''%',
  'inbound eligibility does not require allowlist for assisted or shadow'
);

select extensions.ok(
  pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
    ilike '%journey%inbound%'
    and pg_get_functiondef('private.is_conversation_ai_eligible(uuid)'::regprocedure)
      ilike '%is_ai_inbound_recipient_allowlisted%',
  'inbound eligibility still references the production allowlist'
);

select extensions.ok(
  pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
    ilike '%v_execution.mode = ''production''%'
    and pg_get_functiondef('public.start_ai_execution(uuid)'::regprocedure)
      ilike '%production_recipient_not_allowlisted%',
  'queued production executions remain protected before the worker starts'
);

select extensions.ok(
  pg_get_functiondef('private.enforce_pedro_inbound_allowlist()'::regprocedure)
    ilike '%v_conversation.ai_mode <> ''production''%',
  'the final outbound guard applies only to inbound production'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'messages_pedro_inbound_allowlist'
      and not tgisinternal
  ),
  'the final outbound production guard remains installed'
);

select * from extensions.finish();
rollback;
