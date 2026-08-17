begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(14);

select extensions.ok(
  to_regclass('public.ai_feedback_signals') is not null
  and to_regclass('public.ai_feedback_clusters') is not null
  and to_regclass('public.ai_review_runs') is not null,
  'feedback evidence, clusters and reviewer runs are durable'
);

select extensions.ok(
  to_regclass('public.ai_skill_modules') is not null
  and to_regclass('public.ai_skill_versions') is not null
  and to_regclass('public.ai_skill_release_items') is not null,
  'skill modules, versions and immutable release composition are explicit'
);

select extensions.ok(
  (select bool_and(relrowsecurity)
   from pg_class relation
   join pg_namespace namespace on namespace.oid=relation.relnamespace
   where namespace.nspname='public' and relation.relname in (
     'ai_feedback_signals','ai_feedback_clusters','ai_feedback_cluster_signals',
     'ai_review_runs','ai_review_run_signals','ai_meta_review_requests',
     'ai_skill_modules','ai_skill_versions','ai_skill_release_items'
   )),
  'every continuous improvement table enforces RLS'
);

select extensions.ok(
  not has_table_privilege('anon','public.ai_feedback_signals','select')
  and not has_table_privilege('anon','public.ai_skill_versions','select')
  and not has_table_privilege('anon','public.ai_review_runs','select'),
  'anonymous clients cannot inspect learning evidence or skills'
);

select extensions.ok(
  has_table_privilege('authenticated','public.ai_feedback_signals','select')
  and not has_table_privilege('authenticated','public.ai_feedback_signals','insert')
  and not has_table_privilege('authenticated','public.ai_skill_versions','insert'),
  'authenticated managers receive read access but cannot forge evidence or versions'
);

select extensions.ok(
  has_table_privilege('authenticated','public.ai_meta_review_requests','insert')
  and not has_table_privilege('authenticated','public.ai_review_runs','insert'),
  'manual analysis uses a validated command instead of direct run writes'
);

select extensions.ok(
  not has_function_privilege('authenticated','public.claim_ai_review_run(uuid)','execute')
  and not has_function_privilege('authenticated','public.complete_ai_review_run(uuid,jsonb,text,integer,integer)','execute')
  and has_function_privilege('service_role','public.claim_ai_review_run(uuid)','execute'),
  'reviewer execution functions remain server-only'
);

select extensions.ok(
  position('ai_skill_versions' in pg_get_functiondef('private.process_learning_review_request()'::regprocedure))>0
  and position('regression_cases' in pg_get_functiondef('private.process_learning_review_request()'::regprocedure))>0
  and position('status=''draft''' in pg_get_functiondef('private.process_learning_review_request()'::regprocedure))>0,
  'human approval creates a draft skill and a regression case'
);

select extensions.ok(
  position('learning_not_a_skill_candidate' in pg_get_functiondef('private.process_learning_review_request()'::regprocedure))>0
  and position('approve_case' in pg_get_functiondef('private.process_learning_review_request()'::regprocedure))>0,
  'non-skill findings cannot be disguised as skills and may become regression-only cases'
);

select extensions.ok(
  position('regression_case_results' in pg_get_functiondef('private.queue_regression_run(uuid,uuid,uuid)'::regprocedure))>0
  and position('regression.case.execute' in pg_get_functiondef('private.queue_regression_run(uuid,uuid,uuid)'::regprocedure))>0,
  'draft approval materializes regression results and durable worker jobs'
);

select extensions.ok(
  position('critical_failures=0' in replace(pg_get_functiondef('private.process_rule_publish_request()'::regprocedure),' ',''))>0
  and position('ai_skill_versions' in pg_get_functiondef('private.process_rule_publish_request()'::regprocedure))>0,
  'owner publication keeps the zero-critical-failure gate and promotes skill versions atomically'
);

select extensions.ok(
  position('ai.meta_review.execute' in pg_get_functiondef('public.execute_runtime_job(uuid)'::regprocedure))>0
  and position('execute_runtime_job_before_continuous_improvement' in pg_get_functiondef('public.execute_runtime_job(uuid)'::regprocedure))>0,
  'runtime routes meta-review jobs without replacing prior dispatch behavior'
);

select extensions.ok(
  exists(select 1 from pg_trigger where tgrelid='public.learning_suggestions'::regclass
    and tgname='learning_suggestions_capture_feedback' and not tgisinternal)
  and exists(select 1 from pg_trigger where tgrelid='public.ai_executions'::regclass
    and tgname='ai_executions_capture_failure' and not tgisinternal),
  'human corrections and runtime failures automatically create feedback signals'
);

select extensions.ok(
  exists(select 1 from pg_indexes where schemaname='public'
    and indexname='ai_review_runs_one_active_idx' and indexdef ilike '%unique%')
  and position('never publish' in lower(obj_description('public.ai_review_runs'::regclass)))>0,
  'only one reviewer runs per tenant and its contract forbids publication'
);

select * from extensions.finish();
rollback;
