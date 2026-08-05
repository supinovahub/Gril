begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

select extensions.has_column('public','ai_executions','model_output_structured',
  'raw Pedro decision is preserved');
select extensions.has_column('public','ai_executions','validated_action_plan',
  'validated action plan is preserved separately');

select extensions.ok(
  position('project_media_requests' in pg_get_functiondef('public.enqueue_pedro_project_media(uuid)'::regprocedure))>0
  and position('recommended_project_ids' in pg_get_functiondef('public.enqueue_pedro_project_media(uuid)'::regprocedure))=0,
  'media executor never expands the selected projects'
);

select extensions.ok(
  position('executor_semantic_mutation_blocked' in pg_get_functiondef(
    'public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer)'::regprocedure
  ))>0,
  'database rolls back semantic rewrites of Pedro output'
);

select extensions.ok(
  position('explicit_escalation_reply' in pg_get_functiondef(
    'public.complete_ai_execution(uuid,text,jsonb,text,text,integer,integer,integer)'::regprocedure
  ))>0,
  'escalation sends only the explicit reply selected by Pedro'
);

select extensions.ok(
  position('human_edit_invalidated_plan' in pg_get_functiondef(
    'private.process_ai_suggestion_review_request()'::regprocedure
  ))>0,
  'human edit invalidates stale structured actions'
);

select * from extensions.finish();
rollback;
