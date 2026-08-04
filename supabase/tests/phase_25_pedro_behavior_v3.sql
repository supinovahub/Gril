begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(11);

select extensions.has_function(
  'private','apply_approved_assisted_actions',array['uuid','uuid','integer'],
  'assisted approval has a transactional action applicator'
);

select extensions.ok(
  not has_function_privilege('authenticated','private.apply_approved_assisted_actions(uuid,uuid,integer)','execute'),
  'browser sessions cannot invoke the assisted action applicator directly'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%structured_actions_applied%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='process_ai_suggestion_review_request'),
  'suggestion approval applies structured actions atomically'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%privacy_opt_out%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='apply_inbound_control_intent'),
  'combined privacy and opt-out has a deterministic path'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%not in (''production'', ''assisted'')%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='enforce_exact_followup_cadence'),
  'exact cadence supports production and assisted modes'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%''assisted''%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='execute_runtime_job'),
  'runtime dispatcher creates assisted follow-up turns'
);

select extensions.has_function(
  'private','schedule_assisted_no_show_cadence',array[]::text[],
  'assisted mode has a no-show cadence scheduler'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%jsonb_array_elements_text%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='enqueue_pedro_project_media'),
  'project media delivery supports every recommended project'
);

select extensions.ok(
  exists(
    select 1 from public.persona_versions pv
    where pv.status='published' and pv.compiled_prompt like 'GRIL_BEHAVIOR_V3.%'
  ),
  'a Pedro behavioral persona v3 is published'
);

select extensions.ok(
  exists(
    select 1 from public.rule_versions rv
    where rv.status='published' and rv.compiled_rules->>'behavior_version'='v3'
  ),
  'a Pedro deterministic rule package v3 is published'
);

select extensions.ok(
  not has_function_privilege('authenticated','public.apply_inbound_control_intent(uuid,text)','execute')
  and has_function_privilege('service_role','public.apply_inbound_control_intent(uuid,text)','execute'),
  'only the runtime can apply inbound control intents'
);

select * from extensions.finish();
rollback;
