begin;

-- Continuous improvement is deliberately split into evidence, proposals and
-- immutable releases. The reviewer may create candidates, but it can never
-- publish a behavior change or bypass the existing regression gate.

create table public.ai_skill_modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{3,80}$'),
  name text not null check (char_length(trim(name)) between 3 and 120),
  category text not null check (category in ('style','rule','faq','qualification','scheduling','escalation')),
  description text check (description is null or char_length(trim(description)) between 3 and 1000),
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id,code),
  unique (id,org_id)
);

create table public.ai_skill_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  trigger_config jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger_config) = 'object'),
  instructions text not null check (char_length(trim(instructions)) between 5 and 8000),
  positive_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(positive_examples) = 'array'),
  negative_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(negative_examples) = 'array'),
  allowed_actions text[] not null default '{}',
  prohibited_actions text[] not null default '{}',
  priority smallint not null default 50 check (priority between 0 and 100),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  source_learning_suggestion_id uuid references public.learning_suggestions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (module_id,org_id) references public.ai_skill_modules(id,org_id) on delete cascade,
  unique (module_id,version),
  unique (id,org_id),
  unique (id,module_id,org_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index ai_skill_versions_one_published_idx
  on public.ai_skill_versions(module_id) where status='published';
create index ai_skill_versions_queue_idx
  on public.ai_skill_versions(org_id,status,created_at desc);

create table public.ai_skill_release_items (
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_version_id uuid not null,
  skill_module_id uuid not null,
  skill_version_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (rule_version_id,skill_module_id),
  foreign key (rule_version_id,org_id) references public.rule_versions(id,org_id) on delete cascade,
  foreign key (skill_module_id,org_id) references public.ai_skill_modules(id,org_id) on delete restrict,
  foreign key (skill_version_id,skill_module_id,org_id)
    references public.ai_skill_versions(id,module_id,org_id) on delete restrict
);

create table public.ai_feedback_signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  conversation_id uuid,
  execution_id uuid,
  ai_suggestion_id uuid,
  learning_suggestion_id uuid,
  source text not null check (source in ('runtime','assisted_review','learning','escalation','manual')),
  signal_type text not null check (signal_type in ('human_correction','suggestion_discarded','execution_failure','unexpected_escalation','low_confidence','manual_observation')),
  severity text not null default 'normal' check (severity in ('normal','important','critical')),
  status text not null default 'new' check (status in ('new','grouped','ignored')),
  dedupe_key text not null check (char_length(dedupe_key) between 3 and 220),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete set null,
  foreign key (execution_id,org_id) references public.ai_executions(id,org_id) on delete set null,
  foreign key (ai_suggestion_id,org_id) references public.ai_suggestions(id,org_id) on delete set null,
  foreign key (learning_suggestion_id,org_id) references public.learning_suggestions(id,org_id) on delete set null,
  unique (org_id,dedupe_key),
  unique (id,org_id)
);
create index ai_feedback_signals_review_queue_idx
  on public.ai_feedback_signals(org_id,status,severity,occurred_at) where status='new';

create table public.ai_review_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('automatic','manual')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','blocked')),
  model_profile_id uuid,
  requested_by uuid not null references auth.users(id) on delete restrict,
  signal_count integer not null default 0 check (signal_count >= 0),
  finding_count integer not null default 0 check (finding_count >= 0),
  model_returned text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  error_redacted text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (model_profile_id,org_id) references public.model_profiles(id,org_id) on delete restrict,
  unique (id,org_id)
);
create unique index ai_review_runs_one_active_idx
  on public.ai_review_runs(org_id) where status in ('queued','running');
create index ai_review_runs_history_idx on public.ai_review_runs(org_id,created_at desc);

create table public.ai_review_run_signals (
  org_id uuid not null references public.organizations(id) on delete cascade,
  review_run_id uuid not null,
  signal_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_run_id,signal_id),
  foreign key (review_run_id,org_id) references public.ai_review_runs(id,org_id) on delete cascade,
  foreign key (signal_id,org_id) references public.ai_feedback_signals(id,org_id) on delete restrict
);

create table public.ai_feedback_clusters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  dedupe_key text not null check (dedupe_key ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(trim(title)) between 3 and 180),
  failure_family text not null check (failure_family in ('objection','qualification','faq','tone','scheduling','escalation','tooling','knowledge','other')),
  root_cause_layer text not null check (root_cause_layer in ('skill','knowledge','core_prompt','runtime','data','unknown')),
  severity text not null check (severity in ('normal','important','critical')),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  status text not null default 'open' check (status in ('open','reviewing','drafted','resolved','ignored')),
  observed_pattern text not null check (char_length(trim(observed_pattern)) between 5 and 4000),
  proposed_change text not null check (char_length(trim(proposed_change)) between 5 and 4000),
  target_skill_code text check (target_skill_code is null or target_skill_code ~ '^[a-z0-9_]{3,80}$'),
  target_skill_module_id uuid,
  learning_suggestion_id uuid,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  evidence_count integer not null default 1 check (evidence_count > 0),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_review_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (target_skill_module_id,org_id) references public.ai_skill_modules(id,org_id) on delete set null,
  foreign key (learning_suggestion_id,org_id) references public.learning_suggestions(id,org_id) on delete set null,
  foreign key (last_review_run_id,org_id) references public.ai_review_runs(id,org_id) on delete set null,
  unique (org_id,dedupe_key),
  unique (id,org_id)
);
create index ai_feedback_clusters_queue_idx
  on public.ai_feedback_clusters(org_id,status,severity,last_seen_at desc);

create table public.ai_feedback_cluster_signals (
  org_id uuid not null references public.organizations(id) on delete cascade,
  cluster_id uuid not null,
  signal_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (cluster_id,signal_id),
  foreign key (cluster_id,org_id) references public.ai_feedback_clusters(id,org_id) on delete cascade,
  foreign key (signal_id,org_id) references public.ai_feedback_signals(id,org_id) on delete restrict
);

create table public.ai_meta_review_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  review_run_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (review_run_id,org_id) references public.ai_review_runs(id,org_id) on delete restrict
);

alter table public.learning_suggestions
  add column if not exists feedback_cluster_id uuid,
  add column if not exists target_skill_module_id uuid;
alter table public.learning_suggestions
  add constraint learning_suggestions_feedback_cluster_fkey
    foreign key (feedback_cluster_id,org_id) references public.ai_feedback_clusters(id,org_id) on delete set null,
  add constraint learning_suggestions_target_skill_module_fkey
    foreign key (target_skill_module_id,org_id) references public.ai_skill_modules(id,org_id) on delete set null;

alter table public.learning_review_requests
  add column if not exists target_skill_module_id uuid,
  add column if not exists skill_version_id uuid,
  add column if not exists skill_code text,
  add column if not exists skill_name text,
  add column if not exists trigger_description text,
  add column if not exists final_instructions text;
alter table public.learning_review_requests drop constraint if exists learning_review_requests_decision_check;
alter table public.learning_review_requests add constraint learning_review_requests_decision_check
  check (decision in ('approve_draft','approve_case','reject','mark_conflict'));
alter table public.learning_review_requests
  add constraint learning_review_requests_target_skill_module_fkey
    foreign key (target_skill_module_id,org_id) references public.ai_skill_modules(id,org_id) on delete restrict,
  add constraint learning_review_requests_skill_version_fkey
    foreign key (skill_version_id,org_id) references public.ai_skill_versions(id,org_id) on delete restrict,
  add constraint learning_review_requests_skill_code_check
    check (skill_code is null or skill_code ~ '^[a-z0-9_]{3,80}$'),
  add constraint learning_review_requests_skill_name_check
    check (skill_name is null or char_length(trim(skill_name)) between 3 and 120),
  add constraint learning_review_requests_trigger_check
    check (trigger_description is null or char_length(trim(trigger_description)) between 3 and 1000),
  add constraint learning_review_requests_instructions_check
    check (final_instructions is null or char_length(trim(final_instructions)) between 5 and 8000);

alter table public.internal_threads drop constraint if exists internal_threads_source_check;
alter table public.internal_threads add constraint internal_threads_source_check
  check (source in ('manual','escalation','assisted_correction','external_device','post_call','runtime_failure','meta_review'));

create trigger ai_skill_modules_set_updated_at before update on public.ai_skill_modules
for each row execute function private.set_updated_at();
create trigger ai_skill_versions_set_updated_at before update on public.ai_skill_versions
for each row execute function private.set_updated_at();
create trigger ai_feedback_clusters_set_updated_at before update on public.ai_feedback_clusters
for each row execute function private.set_updated_at();

create or replace function private.capture_learning_feedback_signal()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.source <> 'pattern' then
    insert into public.ai_feedback_signals(
      org_id,operation_id,conversation_id,learning_suggestion_id,source,signal_type,severity,dedupe_key,evidence,occurred_at
    ) values (
      new.org_id,new.operation_id,new.conversation_id,new.id,
      case when new.source='assisted_correction' then 'assisted_review' else 'learning' end,
      case when new.source='assisted_correction' then 'human_correction' else 'manual_observation' end,
      case when new.scope in ('scheduling','escalation') then 'critical' else 'important' end,
      'learning:'||new.id::text,
      jsonb_build_object('learning_suggestion_id',new.id,'scope',new.scope,'source',new.source),
      new.created_at
    ) on conflict(org_id,dedupe_key) do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.capture_learning_feedback_signal() from public,anon,authenticated,service_role;
create trigger learning_suggestions_capture_feedback after insert on public.learning_suggestions
for each row execute function private.capture_learning_feedback_signal();

create or replace function private.capture_execution_failure_signal()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.status in ('failed','blocked') and old.status is distinct from new.status then
    insert into public.ai_feedback_signals(
      org_id,operation_id,conversation_id,execution_id,source,signal_type,severity,dedupe_key,evidence,occurred_at
    ) values (
      new.org_id,new.operation_id,new.conversation_id,new.id,'runtime','execution_failure',
      case when new.status='failed' then 'important' else 'normal' end,
      'execution:'||new.id::text||':'||new.status,
      jsonb_build_object('execution_id',new.id,'status',new.status,'error_code',new.error_code,'mode',new.mode),
      coalesce(new.completed_at,now())
    ) on conflict(org_id,dedupe_key) do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.capture_execution_failure_signal() from public,anon,authenticated,service_role;
create trigger ai_executions_capture_failure after update of status on public.ai_executions
for each row execute function private.capture_execution_failure_signal();

create or replace function private.capture_rejected_suggestion_signal()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_operation uuid;
begin
  if new.status='rejected' and old.status is distinct from new.status then
    select operation_id into v_operation from public.conversations where id=new.conversation_id;
    insert into public.ai_feedback_signals(
      org_id,operation_id,conversation_id,execution_id,ai_suggestion_id,source,signal_type,severity,dedupe_key,evidence,occurred_at
    ) values (
      new.org_id,v_operation,new.conversation_id,new.execution_id,new.id,'assisted_review','suggestion_discarded','normal',
      'suggestion:'||new.id::text||':rejected',
      jsonb_build_object('ai_suggestion_id',new.id,'execution_id',new.execution_id),now()
    ) on conflict(org_id,dedupe_key) do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.capture_rejected_suggestion_signal() from public,anon,authenticated,service_role;
create trigger ai_suggestions_capture_rejection after update of status on public.ai_suggestions
for each row execute function private.capture_rejected_suggestion_signal();

create or replace function private.capture_escalation_feedback_signal()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.ai_feedback_signals(
    org_id,operation_id,conversation_id,execution_id,source,signal_type,severity,dedupe_key,evidence,occurred_at
  ) values (
    new.org_id,new.operation_id,new.conversation_id,new.execution_id,'escalation','unexpected_escalation',
    case when new.severity='critical' then 'critical' else 'important' end,
    'escalation:'||new.id::text,
    jsonb_build_object('escalation_id',new.id,'category',new.category,'severity',new.severity),new.created_at
  ) on conflict(org_id,dedupe_key) do nothing;
  return new;
end; $$;
revoke all on function private.capture_escalation_feedback_signal() from public,anon,authenticated,service_role;
create trigger escalations_capture_feedback after insert on public.escalations
for each row execute function private.capture_escalation_feedback_signal();

create or replace function private.compile_skill_snapshot(
  p_org_id uuid,
  p_replacement_skill_version_id uuid
)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  with replacement as (
    select sv.*,sm.code,sm.name,sm.category
    from public.ai_skill_versions sv
    join public.ai_skill_modules sm on sm.id=sv.module_id and sm.org_id=sv.org_id
    where sv.id=p_replacement_skill_version_id and sv.org_id=p_org_id
  ), selected as (
    select sv.*,sm.code,sm.name,sm.category
    from public.ai_skill_versions sv
    join public.ai_skill_modules sm on sm.id=sv.module_id and sm.org_id=sv.org_id
    where sv.org_id=p_org_id and sv.status='published'
      and sv.module_id<>(select module_id from replacement)
    union all
    select * from replacement
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_id',module_id,'skill_version_id',id,'code',code,'name',name,'category',category,
    'version',version,'trigger',trigger_config,'instructions',instructions,
    'positive_examples',positive_examples,'negative_examples',negative_examples,
    'allowed_actions',to_jsonb(allowed_actions),'prohibited_actions',to_jsonb(prohibited_actions),
    'priority',priority
  ) order by priority desc,code),'[]'::jsonb) from selected
$$;
revoke all on function private.compile_skill_snapshot(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.queue_regression_run(
  p_org_id uuid,
  p_rule_version_id uuid,
  p_actor_user_id uuid
)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_run uuid;
  v_case record;
  v_total integer;
  v_operation uuid;
begin
  if exists(select 1 from public.regression_runs
    where org_id=p_org_id and status in ('queued','running')) then
    raise exception 'regression_run_already_active' using errcode='55000';
  end if;
  if not exists(select 1 from public.model_profiles
    where org_id=p_org_id and status='active' and integration_account_id is not null) then
    raise exception 'active_model_required' using errcode='22023';
  end if;
  select id into v_operation from public.operations
  where org_id=p_org_id and is_default order by created_at limit 1;
  select count(*) into v_total from public.regression_cases
  where org_id=p_org_id and active;
  if v_total=0 then raise exception 'regression_case_required' using errcode='22023'; end if;
  insert into public.regression_runs(org_id,rule_version_id,status,total_cases,created_by)
  values(p_org_id,p_rule_version_id,'running',v_total,p_actor_user_id)
  returning id into v_run;
  for v_case in select id from public.regression_cases
    where org_id=p_org_id and active order by title
  loop
    insert into public.regression_case_results(org_id,run_id,case_id)
    values(p_org_id,v_run,v_case.id);
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,
      dedupe_key,payload,created_by,max_attempts
    ) values (
      p_org_id,v_operation,'regression.case.execute','regression_case',v_case.id,
      'reconciliation',now(),'regression:'||v_run::text||':'||v_case.id::text,
      jsonb_build_object('run_id',v_run,'case_id',v_case.id),p_actor_user_id,3
    );
  end loop;
  return v_run;
end; $$;
revoke all on function private.queue_regression_run(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.process_learning_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_learning public.learning_suggestions%rowtype;
  v_rule_set uuid;
  v_published public.rule_versions%rowtype;
  v_rule_version integer;
  v_rules jsonb;
  v_checksum text;
  v_draft uuid;
  v_case uuid;
  v_module public.ai_skill_modules%rowtype;
  v_skill_version integer;
  v_skill_version_id uuid;
  v_skill_code text;
  v_skill_name text;
  v_instructions text;
  v_trigger text;
  v_skill_checksum text;
  v_allowed text[];
  v_prohibited text[];
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.has_org_permission(new.org_id,'ai.manage') then
    raise exception 'learning_review_forbidden' using errcode='42501';
  end if;
  select * into v_learning from public.learning_suggestions
  where id=new.learning_suggestion_id and org_id=new.org_id for update;
  if not found or v_learning.status in ('approved','rejected') then
    raise exception 'learning_not_reviewable' using errcode='22023';
  end if;

  if new.decision='reject' then
    update public.learning_suggestions set status='rejected',reviewed_by=new.actor_user_id,
      reviewed_at=now(),updated_at=now() where id=v_learning.id;
    update public.ai_feedback_clusters set status='ignored'
      where id=v_learning.feedback_cluster_id and org_id=new.org_id;
  elsif new.decision='mark_conflict' then
    update public.learning_suggestions set status='conflict',
      conflict_details=coalesce(nullif(trim(new.reason),''),'Conflito requer resolucao humana.'),
      reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_learning.id;
    update public.ai_feedback_clusters set status='reviewing'
      where id=v_learning.feedback_cluster_id and org_id=new.org_id;
  elsif new.decision='approve_case' then
    v_allowed:=case v_learning.scope
      when 'qualification' then array['ask_field','ask_next_field','reply']::text[]
      when 'faq' then array['answer_faq','reply']::text[]
      when 'scheduling' then array['propose_call','reschedule','followup','reply']::text[]
      when 'escalation' then array['escalate','reply']::text[]
      else array['reply','answer_faq','ask_field','ask_next_field','suggest_projects','propose_call','followup','reschedule','escalate','opt_out']::text[]
    end;
    select coalesce(array_agg(value),v_allowed) into v_allowed
    from jsonb_array_elements_text(coalesce(v_learning.evidence->'regression'->'allowed_actions','[]'::jsonb)) value;
    select coalesce(array_agg(value),array[]::text[]) into v_prohibited
    from jsonb_array_elements_text(coalesce(v_learning.evidence->'regression'->'prohibited_actions','[]'::jsonb)) value;
    select rv.* into v_published from public.rule_versions rv
    join public.rule_sets rs on rs.id=rv.rule_set_id
    where rv.org_id=new.org_id and rv.status='published' and rs.code='core'
    order by rv.version desc limit 1;
    if v_published.id is null then raise exception 'published_rule_required' using errcode='22023'; end if;
    insert into public.regression_cases(
      org_id,title,simulated_input,expected_response,rubric,allowed_actions,prohibited_actions,severity,source,created_by
    ) values (
      new.org_id,'Caso: '||left(v_learning.human_observation,110),
      coalesce(nullif(v_learning.evidence->'regression'->>'simulated_input',''),nullif(v_learning.observed_response,''),v_learning.human_observation),
      coalesce(nullif(v_learning.evidence->'regression'->>'expected_response',''),v_learning.suggested_change),
      jsonb_build_object('suggestion_id',v_learning.id,'review_kind','case_only'),v_allowed,v_prohibited,
      case when v_learning.scope in ('scheduling','escalation') then 'critical' else 'important' end,
      'learning',new.actor_user_id
    ) returning id into v_case;
    update public.learning_suggestions set status='approved',regression_case_id=v_case,
      reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_learning.id;
    update public.ai_feedback_clusters set status='resolved'
      where id=v_learning.feedback_cluster_id and org_id=new.org_id;
    perform private.queue_regression_run(new.org_id,v_published.id,new.actor_user_id);
    new.regression_case_id:=v_case;
  else
    if v_learning.source='pattern' and (
      v_learning.candidate_kind not in ('example','potential_rule')
      or coalesce(v_learning.evidence->>'root_cause_layer','unknown')<>'skill'
    ) then
      raise exception 'learning_not_a_skill_candidate' using errcode='22023';
    end if;
    select rs.id into v_rule_set from public.rule_sets rs
    where rs.org_id=new.org_id and rs.code='core';
    if v_rule_set is null then raise exception 'published_rule_required' using errcode='22023'; end if;
    if exists(select 1 from public.rule_versions
      where rule_set_id=v_rule_set and status='draft') then
      raise exception 'rule_draft_already_pending' using errcode='55000';
    end if;
    new.target_skill_module_id:=coalesce(new.target_skill_module_id,v_learning.target_skill_module_id);
    if new.target_skill_module_id is not null then
      select * into v_module from public.ai_skill_modules
      where id=new.target_skill_module_id and org_id=new.org_id and status='active' for update;
      if not found then raise exception 'skill_module_not_found' using errcode='22023'; end if;
    else
      v_skill_code:=coalesce(nullif(trim(new.skill_code),''),
        coalesce(nullif(v_learning.scope,''),'rule')||'_'||substr(replace(v_learning.id::text,'-',''),1,12));
      v_skill_name:=coalesce(nullif(trim(new.skill_name),''),'Aprendizado: '||left(v_learning.human_observation,90));
      insert into public.ai_skill_modules(org_id,code,name,category,description,created_by)
      values(new.org_id,v_skill_code,v_skill_name,v_learning.scope,
        left(v_learning.human_observation,1000),new.actor_user_id)
      returning * into v_module;
    end if;

    select coalesce(max(version),0)+1 into v_skill_version
    from public.ai_skill_versions where module_id=v_module.id;
    v_instructions:=coalesce(nullif(trim(new.final_instructions),''),v_learning.suggested_change);
    v_trigger:=coalesce(nullif(trim(new.trigger_description),''),v_learning.human_observation);
    v_allowed:=case v_learning.scope
      when 'qualification' then array['ask_field','ask_next_field','reply']::text[]
      when 'faq' then array['answer_faq','reply']::text[]
      when 'scheduling' then array['propose_call','reschedule','followup','reply']::text[]
      when 'escalation' then array['escalate','reply']::text[]
      else array['reply','answer_faq','ask_field','ask_next_field','suggest_projects','propose_call','followup','reschedule','escalate','opt_out']::text[]
    end;
    select coalesce(array_agg(value),array[]::text[]) into v_prohibited
    from jsonb_array_elements_text(coalesce(v_learning.evidence->'regression'->'prohibited_actions','[]'::jsonb)) value;
    v_skill_checksum:=encode(extensions.digest(convert_to(
      jsonb_build_object('trigger',v_trigger,'instructions',v_instructions,'allowed',v_allowed,'prohibited',v_prohibited)::text,
      'UTF8'),'sha256'),'hex');
    insert into public.ai_skill_versions(
      org_id,module_id,version,status,trigger_config,instructions,allowed_actions,prohibited_actions,
      checksum,source_learning_suggestion_id,created_by
    ) values (
      new.org_id,v_module.id,v_skill_version,'draft',
      jsonb_build_object('description',v_trigger,'scope',v_learning.scope),v_instructions,v_allowed,v_prohibited,
      v_skill_checksum,v_learning.id,new.actor_user_id
    ) returning id into v_skill_version_id;

    select * into v_published from public.rule_versions
    where rule_set_id=v_rule_set and status='published';
    if v_published.id is null then raise exception 'published_rule_required' using errcode='22023'; end if;
    select coalesce(max(version),0)+1 into v_rule_version
    from public.rule_versions where rule_set_id=v_rule_set;
    v_rules:=jsonb_set(v_published.rules,'{skill_modules}',
      private.compile_skill_snapshot(new.org_id,v_skill_version_id),true);
    v_checksum:=encode(extensions.digest(convert_to(v_rules::text,'UTF8'),'sha256'),'hex');
    insert into public.rule_versions(org_id,rule_set_id,version,status,rules,compiled_rules,checksum,created_by)
    values(new.org_id,v_rule_set,v_rule_version,'draft',v_rules,v_rules,v_checksum,new.actor_user_id)
    returning id into v_draft;

    insert into public.ai_skill_release_items(org_id,rule_version_id,skill_module_id,skill_version_id)
    select new.org_id,v_draft,sv.module_id,sv.id
    from public.ai_skill_versions sv
    where sv.org_id=new.org_id and sv.status='published' and sv.module_id<>v_module.id
    union all select new.org_id,v_draft,v_module.id,v_skill_version_id;

    insert into public.regression_cases(
      org_id,title,simulated_input,expected_response,rubric,allowed_actions,prohibited_actions,severity,source,created_by
    ) values (
      new.org_id,'Skill '||v_module.name,
      coalesce(nullif(v_learning.observed_response,''),v_learning.human_observation),v_instructions,
      jsonb_build_object('suggestion_id',v_learning.id,'skill_module_id',v_module.id,'trigger',v_trigger),
      v_allowed,v_prohibited,
      case when v_learning.scope in ('scheduling','escalation') then 'critical' else 'important' end,
      'learning',new.actor_user_id
    ) returning id into v_case;
    update public.learning_suggestions set status='approved',draft_rule_version_id=v_draft,
      regression_case_id=v_case,target_skill_module_id=v_module.id,reviewed_by=new.actor_user_id,
      reviewed_at=now(),updated_at=now() where id=v_learning.id;
    update public.ai_feedback_clusters set status='drafted',target_skill_module_id=v_module.id
      where id=v_learning.feedback_cluster_id and org_id=new.org_id;
    perform private.queue_regression_run(new.org_id,v_draft,new.actor_user_id);
    new.draft_rule_version_id:=v_draft;
    new.regression_case_id:=v_case;
    new.target_skill_module_id:=v_module.id;
    new.skill_version_id:=v_skill_version_id;
  end if;

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'learning.'||new.decision,'learning_suggestions',v_learning.id,
    jsonb_build_object('draft_rule_version_id',new.draft_rule_version_id,'skill_version_id',new.skill_version_id,'reason',new.reason));
  new.processed_at:=now();
  return new;
end; $$;
revoke all on function private.process_learning_review_request() from public,anon,authenticated,service_role;

create or replace function private.process_rule_publish_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_version public.rule_versions%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.has_org_role(new.org_id,array['owner']::text[]) then
    raise exception 'rule_publish_owner_required' using errcode='42501';
  end if;
  select * into v_version from public.rule_versions
  where id=new.rule_version_id and org_id=new.org_id for update;
  if not found or v_version.status<>'draft' then raise exception 'rule_draft_required' using errcode='22023'; end if;
  if not exists(select 1 from public.regression_runs r where r.rule_version_id=v_version.id
    and r.status='passed' and r.critical_failures=0 and r.passed_cases=r.total_cases and r.total_cases>0) then
    raise exception 'passing_regression_required' using errcode='22023';
  end if;

  update public.rule_versions set status='archived',updated_at=now()
  where rule_set_id=v_version.rule_set_id and status='published';
  update public.rule_versions set status='published',published_by=new.actor_user_id,published_at=now(),updated_at=now()
  where id=v_version.id;

  update public.ai_skill_versions old_version set status='archived',updated_at=now()
  where old_version.status='published' and exists(
    select 1 from public.ai_skill_release_items item
    where item.rule_version_id=v_version.id and item.skill_module_id=old_version.module_id
      and item.skill_version_id<>old_version.id
  );
  update public.ai_skill_versions skill set status='published',published_by=new.actor_user_id,
    published_at=now(),updated_at=now()
  where skill.status='draft' and exists(
    select 1 from public.ai_skill_release_items item
    where item.rule_version_id=v_version.id and item.skill_version_id=skill.id
  );
  update public.learning_suggestions learning set activated_at=now(),updated_at=now()
  where learning.draft_rule_version_id=v_version.id;
  update public.ai_feedback_clusters cluster set status='resolved'
  where exists(select 1 from public.learning_suggestions learning
    where learning.feedback_cluster_id=cluster.id and learning.draft_rule_version_id=v_version.id);

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'rule.version_published','rule_versions',v_version.id,
    jsonb_build_object('version',v_version.version,'skill_modules',(
      select count(*) from public.ai_skill_release_items where rule_version_id=v_version.id)));
  new.processed_at:=now();
  return new;
end; $$;
revoke all on function private.process_rule_publish_request() from public,anon,authenticated,service_role;

create or replace function private.create_ai_review_run(
  p_org_id uuid,
  p_source text,
  p_requested_by uuid
)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_run uuid;v_model uuid;v_count integer;
begin
  select id into v_model from public.model_profiles
  where org_id=p_org_id and status='active'
  order by is_default desc,case workload_role when 'quality' then 0 when 'balanced' then 1 else 2 end,created_at
  limit 1;
  if v_model is null then raise exception 'meta_review_model_required' using errcode='22023'; end if;
  insert into public.ai_review_runs(org_id,source,status,model_profile_id,requested_by)
  values(p_org_id,p_source,'queued',v_model,p_requested_by) returning id into v_run;
  insert into public.ai_review_run_signals(org_id,review_run_id,signal_id)
  select p_org_id,v_run,signal.id from public.ai_feedback_signals signal
  where signal.org_id=p_org_id and signal.status='new'
  order by case signal.severity when 'critical' then 0 when 'important' then 1 else 2 end,signal.occurred_at
  limit 80;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'meta_review_signals_required' using errcode='22023'; end if;
  update public.ai_review_runs set signal_count=v_count where id=v_run;
  insert into public.scheduled_jobs(
    org_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by
  ) values (
    p_org_id,'ai.meta_review.execute','ai_review_run',v_run,'scheduled-actions',now(),
    'ai-meta-review:'||v_run::text,jsonb_build_object('review_run_id',v_run),p_requested_by
  );
  return v_run;
end; $$;
revoke all on function private.create_ai_review_run(uuid,text,uuid) from public,anon,authenticated,service_role;

create or replace function private.process_ai_meta_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_existing uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.has_org_permission(new.org_id,'ai.manage') then
    raise exception 'meta_review_forbidden' using errcode='42501';
  end if;
  select id into v_existing from public.ai_review_runs
  where org_id=new.org_id and status in ('queued','running') order by created_at limit 1;
  new.review_run_id:=coalesce(v_existing,private.create_ai_review_run(new.org_id,'manual',new.actor_user_id));
  new.processed_at:=now();
  return new;
end; $$;
revoke all on function private.process_ai_meta_review_request() from public,anon,authenticated,service_role;
create trigger ai_meta_review_request_process before insert on public.ai_meta_review_requests
for each row execute function private.process_ai_meta_review_request();

create or replace function public.enqueue_due_ai_meta_reviews()
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_target record;v_count integer:=0;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  for v_target in
    select signal.org_id,owner_membership.user_id
    from public.ai_feedback_signals signal
    join lateral (
      select membership.user_id from public.memberships membership
      where membership.org_id=signal.org_id and membership.role='owner' and membership.status='active'
      order by membership.created_at limit 1
    ) owner_membership on true
    where signal.status='new'
      and exists(select 1 from public.model_profiles model where model.org_id=signal.org_id and model.status='active')
      and not exists(select 1 from public.ai_review_runs run where run.org_id=signal.org_id
        and (run.status in ('queued','running') or run.created_at>now()-interval '24 hours'))
    group by signal.org_id,owner_membership.user_id
    having count(*)>=3
  loop
    perform private.create_ai_review_run(v_target.org_id,'automatic',v_target.user_id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.enqueue_due_ai_meta_reviews() from public,anon,authenticated;
grant execute on function public.enqueue_due_ai_meta_reviews() to service_role;

create or replace function public.record_ai_low_confidence_signal(
  p_execution_id uuid,
  p_confidence numeric
)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_execution public.ai_executions%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if p_confidence<0 or p_confidence>1 then raise exception 'confidence_out_of_range' using errcode='22023'; end if;
  select * into v_execution from public.ai_executions where id=p_execution_id;
  if not found then return; end if;
  insert into public.ai_feedback_signals(
    org_id,operation_id,conversation_id,execution_id,source,signal_type,severity,dedupe_key,evidence,occurred_at
  ) values (
    v_execution.org_id,v_execution.operation_id,v_execution.conversation_id,v_execution.id,
    'runtime','low_confidence','normal','execution:'||v_execution.id::text||':low-confidence',
    jsonb_build_object('execution_id',v_execution.id,'confidence',p_confidence,'mode',v_execution.mode),now()
  ) on conflict(org_id,dedupe_key) do nothing;
end; $$;
revoke all on function public.record_ai_low_confidence_signal(uuid,numeric) from public,anon,authenticated;
grant execute on function public.record_ai_low_confidence_signal(uuid,numeric) to service_role;

create or replace function public.claim_ai_review_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_run public.ai_review_runs%rowtype;v_model public.model_profiles%rowtype;v_signals jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_run from public.ai_review_runs where id=p_run_id for update;
  if not found or v_run.status<>'queued' then return jsonb_build_object('status','ignored'); end if;
  select * into v_model from public.model_profiles
  where id=v_run.model_profile_id and org_id=v_run.org_id and status='active';
  if not found or v_model.integration_account_id is null then
    update public.ai_review_runs set status='blocked',error_redacted='Modelo de revisao indisponivel.',completed_at=now()
    where id=v_run.id;
    return jsonb_build_object('status','blocked');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',signal.id,'signal_type',signal.signal_type,'severity',signal.severity,'occurred_at',signal.occurred_at,
    'evidence',signal.evidence,
    'learning',case when learning.id is null then null else jsonb_build_object(
      'observed_response',learning.observed_response,'human_observation',learning.human_observation,
      'suggested_change',learning.suggested_change,'scope',learning.scope) end,
    'execution',case when execution.id is null then null else jsonb_build_object(
      'status',execution.status,'mode',execution.mode,'error_code',execution.error_code,
      'error_redacted',execution.error_redacted,'output',execution.model_output_structured) end
  ) order by signal.occurred_at),'[]'::jsonb) into v_signals
  from public.ai_review_run_signals selected
  join public.ai_feedback_signals signal on signal.id=selected.signal_id
  left join public.learning_suggestions learning on learning.id=signal.learning_suggestion_id
  left join public.ai_executions execution on execution.id=signal.execution_id
  where selected.review_run_id=v_run.id;
  update public.ai_review_runs set status='running',started_at=now() where id=v_run.id;
  return jsonb_build_object(
    'status','claimed','org_id',v_run.org_id,'integration_account_id',v_model.integration_account_id,
    'model',v_model.model_identifier,'reasoning_effort',v_model.reasoning_effort,
    'text_verbosity',v_model.text_verbosity,'signals',v_signals
  );
end; $$;
revoke all on function public.claim_ai_review_run(uuid) from public,anon,authenticated;
grant execute on function public.claim_ai_review_run(uuid) to service_role;

create or replace function public.complete_ai_review_run(
  p_run_id uuid,
  p_findings jsonb,
  p_model_returned text,
  p_input_tokens integer,
  p_output_tokens integer
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_run public.ai_review_runs%rowtype;
  v_finding jsonb;
  v_signal_id uuid;
  v_cluster uuid;
  v_learning uuid;
  v_thread uuid;
  v_target_module uuid;
  v_key text;
  v_scope text;
  v_signal_count integer;
  v_findings integer:=0;
  v_first timestamptz;
  v_last timestamptz;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  if jsonb_typeof(p_findings)<>'array' then raise exception 'meta_review_findings_invalid' using errcode='22023'; end if;
  select * into v_run from public.ai_review_runs where id=p_run_id and status='running' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;

  for v_finding in select value from jsonb_array_elements(p_findings)
  loop
    select count(*),min(signal.occurred_at),max(signal.occurred_at)
      into v_signal_count,v_first,v_last
    from jsonb_array_elements_text(v_finding->'signal_ids') item
    join public.ai_feedback_signals signal on signal.id=item.value::uuid
    join public.ai_review_run_signals selected on selected.signal_id=signal.id and selected.review_run_id=v_run.id;
    if v_signal_count=0 then continue; end if;
    v_key:=encode(extensions.digest(convert_to(
      lower(coalesce(v_finding->>'failure_family','other')||'|'||coalesce(v_finding->>'target_skill_code','')||'|'||coalesce(v_finding->>'title','')),
      'UTF8'),'sha256'),'hex');
    insert into public.ai_feedback_clusters(
      org_id,dedupe_key,title,failure_family,root_cause_layer,severity,confidence,status,
      observed_pattern,proposed_change,target_skill_code,occurrence_count,evidence_count,
      first_seen_at,last_seen_at,last_review_run_id
    ) values (
      v_run.org_id,v_key,left(v_finding->>'title',180),v_finding->>'failure_family',
      v_finding->>'root_cause_layer',v_finding->>'severity',(v_finding->>'confidence')::numeric,'open',
      left(v_finding->>'observed_pattern',4000),left(v_finding->>'proposed_change',4000),
      nullif(v_finding->>'target_skill_code',''),v_signal_count,v_signal_count,v_first,v_last,v_run.id
    ) on conflict(org_id,dedupe_key) do update set
      occurrence_count=public.ai_feedback_clusters.occurrence_count+excluded.occurrence_count,
      evidence_count=public.ai_feedback_clusters.evidence_count+excluded.evidence_count,
      last_seen_at=greatest(public.ai_feedback_clusters.last_seen_at,excluded.last_seen_at),
      severity=case
        when public.ai_feedback_clusters.severity='critical' or excluded.severity='critical' then 'critical'
        when public.ai_feedback_clusters.severity='important' or excluded.severity='important' then 'important'
        else 'normal' end,
      confidence=greatest(public.ai_feedback_clusters.confidence,excluded.confidence),
      observed_pattern=excluded.observed_pattern,proposed_change=excluded.proposed_change,
      target_skill_code=coalesce(excluded.target_skill_code,public.ai_feedback_clusters.target_skill_code),
      last_review_run_id=excluded.last_review_run_id,updated_at=now()
    returning id,learning_suggestion_id into v_cluster,v_learning;

    select id into v_target_module from public.ai_skill_modules
    where org_id=v_run.org_id and code=nullif(v_finding->>'target_skill_code','') and status='active';
    if v_target_module is not null then
      update public.ai_feedback_clusters set target_skill_module_id=v_target_module where id=v_cluster;
    end if;

    for v_signal_id in select item.value::uuid from jsonb_array_elements_text(v_finding->'signal_ids') item
    loop
      insert into public.ai_feedback_cluster_signals(org_id,cluster_id,signal_id)
      select v_run.org_id,v_cluster,v_signal_id where exists(
        select 1 from public.ai_review_run_signals where review_run_id=v_run.id and signal_id=v_signal_id)
      on conflict do nothing;
    end loop;

    if v_learning is null then
      v_scope:=case v_finding->>'failure_family'
        when 'qualification' then 'qualification' when 'faq' then 'faq' when 'tone' then 'style'
        when 'scheduling' then 'scheduling' when 'escalation' then 'escalation' else 'rule' end;
      insert into public.learning_suggestions(
        org_id,source,observed_response,human_observation,suggested_change,scope,evidence,status,
        candidate_kind,target_scope,created_by,feedback_cluster_id
      ) values (
        v_run.org_id,'pattern',left(v_finding->>'observed_pattern',4000),
        left((v_finding->>'title')||': '||(v_finding->>'observed_pattern'),4000),
        left(v_finding->>'proposed_change',4000),v_scope,
        jsonb_build_object(
          'review_run_id',v_run.id,'cluster_id',v_cluster,'regression',v_finding->'regression',
          'root_cause_layer',v_finding->>'root_cause_layer','candidate_kind',v_finding->>'candidate_kind'
        ),
        'new',coalesce(v_finding->>'candidate_kind','potential_rule'),
        jsonb_build_object('level','organization'),v_run.requested_by,v_cluster
      ) returning id into v_learning;
      update public.learning_suggestions set target_skill_module_id=v_target_module where id=v_learning;
      update public.ai_feedback_clusters set learning_suggestion_id=v_learning where id=v_cluster;
      insert into public.internal_threads(
        org_id,assistant_role,thread_type,title,status,priority,requires_action,source,metadata,created_by
      ) values (
        v_run.org_id,'lionel','learning',left('Revisar padrao: '||(v_finding->>'title'),180),
        'awaiting_confirmation',case v_finding->>'severity' when 'critical' then 'critical' when 'important' then 'high' else 'normal' end,
        true,'meta_review',jsonb_build_object('learning_suggestion_id',v_learning,'feedback_cluster_id',v_cluster,'review_run_id',v_run.id),
        v_run.requested_by
      ) returning id into v_thread;
      update public.learning_suggestions set source_thread_id=v_thread where id=v_learning;
      insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
      values(v_run.org_id,v_thread,'lionel','proposal',
        'Encontrei um padrao recorrente e preparei uma proposta. Revise as evidencias, o gatilho e a instrucao antes de criar o rascunho da skill.',
        jsonb_build_object('learning_suggestion_id',v_learning,'feedback_cluster_id',v_cluster));
    end if;
    update public.ai_feedback_signals set status='grouped'
    where id in (select item.value::uuid from jsonb_array_elements_text(v_finding->'signal_ids') item)
      and org_id=v_run.org_id;
    v_findings:=v_findings+1;
  end loop;

  update public.ai_review_runs set status='completed',finding_count=v_findings,
    model_returned=left(p_model_returned,200),input_tokens=greatest(coalesce(p_input_tokens,0),0),
    output_tokens=greatest(coalesce(p_output_tokens,0),0),completed_at=now()
  where id=v_run.id;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(v_run.org_id,v_run.requested_by,'ai.meta_review_completed','ai_review_runs',v_run.id,
    jsonb_build_object('signal_count',v_run.signal_count,'finding_count',v_findings));
  return jsonb_build_object('status','completed','finding_count',v_findings);
end; $$;
revoke all on function public.complete_ai_review_run(uuid,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.complete_ai_review_run(uuid,jsonb,text,integer,integer) to service_role;

create or replace function public.fail_ai_review_run(p_run_id uuid,p_error_redacted text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  update public.ai_review_runs set status='failed',error_redacted=left(p_error_redacted,500),completed_at=now()
  where id=p_run_id and status in ('queued','running');
end; $$;
revoke all on function public.fail_ai_review_run(uuid,text) from public,anon,authenticated;
grant execute on function public.fail_ai_review_run(uuid,text) to service_role;

create or replace function public.retry_ai_review_run(p_run_id uuid,p_error_redacted text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  update public.ai_review_runs set status='queued',error_redacted=left(p_error_redacted,500),started_at=null
  where id=p_run_id and status='running';
end; $$;
revoke all on function public.retry_ai_review_run(uuid,text) from public,anon,authenticated;
grant execute on function public.retry_ai_review_run(uuid,text) to service_role;

alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_continuous_improvement;
revoke all on function public.execute_runtime_job_before_continuous_improvement(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_before_continuous_improvement(uuid) to service_role;
create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type='ai.meta_review.execute' then
    return jsonb_build_object('status','run_meta_review','review_run_id',(v_job.payload->>'review_run_id')::uuid);
  end if;
  return public.execute_runtime_job_before_continuous_improvement(p_job_id);
end; $$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

alter table public.ai_skill_modules enable row level security;
alter table public.ai_skill_versions enable row level security;
alter table public.ai_skill_release_items enable row level security;
alter table public.ai_feedback_signals enable row level security;
alter table public.ai_review_runs enable row level security;
alter table public.ai_review_run_signals enable row level security;
alter table public.ai_feedback_clusters enable row level security;
alter table public.ai_feedback_cluster_signals enable row level security;
alter table public.ai_meta_review_requests enable row level security;

create policy ai_skill_modules_manager_select on public.ai_skill_modules for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_skill_versions_manager_select on public.ai_skill_versions for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_skill_release_items_manager_select on public.ai_skill_release_items for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_feedback_signals_manager_select on public.ai_feedback_signals for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_review_runs_manager_select on public.ai_review_runs for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_review_run_signals_manager_select on public.ai_review_run_signals for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_feedback_clusters_manager_select on public.ai_feedback_clusters for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_feedback_cluster_signals_manager_select on public.ai_feedback_cluster_signals for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy ai_meta_review_requests_actor_select on public.ai_meta_review_requests for select to authenticated
using(actor_user_id=(select auth.uid()));
create policy ai_meta_review_requests_manager_insert on public.ai_meta_review_requests for insert to authenticated
with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'ai.manage')));

revoke all on public.ai_skill_modules,public.ai_skill_versions,public.ai_skill_release_items,
  public.ai_feedback_signals,public.ai_review_runs,public.ai_review_run_signals,
  public.ai_feedback_clusters,public.ai_feedback_cluster_signals,public.ai_meta_review_requests
  from public,anon;
grant select on public.ai_skill_modules,public.ai_skill_versions,public.ai_skill_release_items,
  public.ai_feedback_signals,public.ai_review_runs,public.ai_review_run_signals,
  public.ai_feedback_clusters,public.ai_feedback_cluster_signals to authenticated;
grant select,insert on public.ai_meta_review_requests to authenticated;
grant all on public.ai_skill_modules,public.ai_skill_versions,public.ai_skill_release_items,
  public.ai_feedback_signals,public.ai_review_runs,public.ai_review_run_signals,
  public.ai_feedback_clusters,public.ai_feedback_cluster_signals,public.ai_meta_review_requests
  to service_role;

comment on table public.ai_feedback_signals is 'Append-only, tenant-scoped feedback evidence. Payloads keep identifiers and redacted metadata, never a full private transcript.';
comment on table public.ai_review_runs is 'Hermes-like reviewer run. It may group evidence and propose a learning, but never publish rules.';
comment on table public.ai_skill_modules is 'Small independently versioned business behavior modules compiled into the immutable Pedro rule snapshot.';
comment on table public.ai_skill_versions is 'Draft/published skill versions. Publication remains bound to owner approval and a fully passing regression run.';

commit;
