begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

select extensions.has_column('public','escalations','source_message_id','escalation records the source message');
select extensions.has_column('public','escalations','source_execution_id','escalation records the contextual AI execution');
select extensions.has_column('public','escalations','contextual_evidence','escalation records contextual evidence');
select extensions.has_column('public','escalations','confidence','escalation records contextual confidence');

select extensions.ok(
  exists(select 1 from pg_indexes where schemaname='public' and indexname='escalations_source_execution_uidx'),
  'one AI execution cannot create duplicate escalations'
);

select extensions.ok(
  position('p_output_structured->''escalation''->>''category''' in pg_get_functiondef(
    'public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)'::regprocedure
  ))>0,
  'completion applies the category selected after contextual AI analysis'
);

select extensions.ok(
  position('source_execution_id' in pg_get_functiondef(
    'public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)'::regprocedure
  ))>0,
  'completion persists an idempotent contextual control trace'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)',
    'execute'
  ),
  'browser sessions cannot complete AI controls'
);

select extensions.ok(
  not has_function_privilege('service_role','public.apply_inbound_control_intent(uuid,text)','execute')
  and not has_function_privilege('service_role','public.apply_inbound_control_intent_before_behavior_v3(uuid,text)','execute'),
  'legacy keyword controls cannot execute before contextual AI analysis'
);

select * from extensions.finish();
rollback;
