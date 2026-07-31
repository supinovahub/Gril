begin;

create table public.learning_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  conversation_id uuid,
  message_id uuid,
  source text not null check (source in ('marked_message','escalation','pattern','simulator','manual')),
  observed_response text,
  human_observation text not null check (char_length(trim(human_observation)) between 5 and 4000),
  suggested_change text not null check (char_length(trim(suggested_change)) between 5 and 4000),
  scope text not null check (scope in ('style','rule','faq','qualification','scheduling','escalation')),
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','reviewing','approved','rejected','conflict')),
  conflict_details text,
  draft_rule_version_id uuid,
  regression_case_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete set null,
  foreign key (message_id,org_id) references public.messages(id,org_id) on delete set null,
  foreign key (draft_rule_version_id,org_id) references public.rule_versions(id,org_id) on delete restrict,
  unique (id,org_id)
);

create index learning_suggestions_queue_idx on public.learning_suggestions(org_id,status,created_at);

create table public.regression_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  simulated_input text not null,
  initial_state jsonb not null default '{}'::jsonb,
  expected_response text,
  rubric jsonb not null default '{}'::jsonb,
  allowed_actions text[] not null default '{}',
  prohibited_actions text[] not null default '{}',
  severity text not null default 'normal' check (severity in ('normal','important','critical')),
  source text not null check (source in ('initial_package','learning','incident','manual')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,org_id)
);

alter table public.learning_suggestions add constraint learning_suggestions_regression_case_fkey
  foreign key (regression_case_id,org_id) references public.regression_cases(id,org_id) on delete restrict;

create table public.regression_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_version_id uuid not null,
  status text not null default 'queued' check (status in ('queued','running','passed','failed','blocked')),
  total_cases integer not null default 0,
  passed_cases integer not null default 0,
  critical_failures integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (rule_version_id,org_id) references public.rule_versions(id,org_id) on delete restrict,
  unique (id,org_id)
);

create table public.simulator_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  title text not null,
  simulated_input text not null check (char_length(trim(simulated_input)) between 1 and 12000),
  initial_state jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','blocked','completed','failed')),
  execution_id uuid,
  output_text text,
  output_structured jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (execution_id,org_id) references public.ai_executions(id,org_id) on delete restrict,
  unique (id,org_id)
);

create table public.learning_review_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  learning_suggestion_id uuid not null,decision text not null check (decision in ('approve_draft','reject','mark_conflict')),
  reason text,actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  draft_rule_version_id uuid,regression_case_id uuid,processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
  foreign key (learning_suggestion_id,org_id) references public.learning_suggestions(id,org_id) on delete restrict
);

create table public.simulator_run_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,title text not null,simulated_input text not null,initial_state jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),simulator_run_id uuid,
  processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  name text not null,
  scope text not null check (scope in ('campaign','eligible_inbound')),
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  eligibility jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  unique (id,org_id),
  check (ends_at is null or starts_at is not null and ends_at>starts_at)
);

create table public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null,
  name text not null,
  allocation_percent smallint not null check (allocation_percent between 1 and 99),
  persona_version_id uuid not null,
  rule_version_id uuid not null,
  critical_errors integer not null default 0,
  status text not null default 'active' check (status in ('active','paused','winner','loser')),
  created_at timestamptz not null default now(),
  foreign key (experiment_id,org_id) references public.experiments(id,org_id) on delete cascade,
  foreign key (persona_version_id,org_id) references public.persona_versions(id,org_id) on delete restrict,
  foreign key (rule_version_id,org_id) references public.rule_versions(id,org_id) on delete restrict,
  unique (experiment_id,name),
  unique (id,org_id)
);

create table public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null,
  variant_id uuid not null,
  opportunity_id uuid not null,
  conversation_id uuid,
  assignment_key text not null,
  assigned_at timestamptz not null default now(),
  foreign key (experiment_id,org_id) references public.experiments(id,org_id) on delete cascade,
  foreign key (variant_id,org_id) references public.experiment_variants(id,org_id) on delete restrict,
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete cascade,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete set null,
  unique (experiment_id,opportunity_id),
  unique (experiment_id,assignment_key)
);

create table public.experiment_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null,
  variant_id uuid,
  event_type text not null,
  severity text not null check (severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (experiment_id,org_id) references public.experiments(id,org_id) on delete cascade,
  foreign key (variant_id,org_id) references public.experiment_variants(id,org_id) on delete restrict
);

create or replace function private.process_learning_review_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_learning public.learning_suggestions%rowtype; v_rule_set uuid; v_published public.rule_versions%rowtype; v_version int; v_rules jsonb; v_checksum text; v_draft uuid; v_case uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'ai.manage') then raise exception 'learning_review_forbidden' using errcode='42501'; end if;
  select * into v_learning from public.learning_suggestions where id=new.learning_suggestion_id and org_id=new.org_id for update;
  if not found or v_learning.status in ('approved','rejected') then raise exception 'learning_not_reviewable' using errcode='22023'; end if;
  if new.decision='reject' then update public.learning_suggestions set status='rejected',reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_learning.id;
  elsif new.decision='mark_conflict' then update public.learning_suggestions set status='conflict',conflict_details=coalesce(nullif(trim(new.reason),''),'Conflito requer resolução humana.'),reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_learning.id;
  else
    select rs.id into v_rule_set from public.rule_sets rs where rs.org_id=new.org_id and rs.code='core';
    select * into v_published from public.rule_versions where rule_set_id=v_rule_set and status='published';
    select coalesce(max(version),0)+1 into v_version from public.rule_versions where rule_set_id=v_rule_set;
    v_rules:=jsonb_set(v_published.rules,'{reviewed_learnings}',coalesce(v_published.rules->'reviewed_learnings','[]'::jsonb)||jsonb_build_array(jsonb_build_object('suggestion_id',v_learning.id,'scope',v_learning.scope,'change',v_learning.suggested_change)),true);
    v_checksum:=encode(extensions.digest(convert_to(v_rules::text,'UTF8'),'sha256'),'hex');
    insert into public.rule_versions(org_id,rule_set_id,version,status,rules,compiled_rules,checksum,created_by)
    values(new.org_id,v_rule_set,v_version,'draft',v_rules,v_rules,v_checksum,new.actor_user_id) returning id into v_draft;
    insert into public.regression_cases(org_id,title,simulated_input,expected_response,rubric,severity,source,created_by)
    values(new.org_id,'Aprendizado '||left(v_learning.human_observation,80),coalesce(v_learning.observed_response,v_learning.human_observation),v_learning.suggested_change,jsonb_build_object('suggestion_id',v_learning.id),case when v_learning.scope in ('scheduling','escalation') then 'critical' else 'important' end,'learning',new.actor_user_id) returning id into v_case;
    update public.learning_suggestions set status='approved',draft_rule_version_id=v_draft,regression_case_id=v_case,reviewed_by=new.actor_user_id,reviewed_at=now(),updated_at=now() where id=v_learning.id;
    insert into public.regression_runs(org_id,rule_version_id,status,total_cases,created_by) select new.org_id,v_draft,'queued',count(*),new.actor_user_id from public.regression_cases where org_id=new.org_id and active;
    new.draft_rule_version_id:=v_draft; new.regression_case_id:=v_case;
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.actor_user_id,'learning.'||new.decision,'learning_suggestions',v_learning.id,jsonb_build_object('draft_rule_version_id',new.draft_rule_version_id,'reason',new.reason));
  new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_simulator_run_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_execution uuid; v_result text; v_run uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'ai.manage') then raise exception 'simulator_forbidden' using errcode='42501'; end if;
  insert into public.ai_execution_requests(org_id,operation_id,mode,input_snapshot,idempotency_key,actor_user_id)
  values(new.org_id,new.operation_id,'simulator',jsonb_build_object('title',new.title,'input',new.simulated_input,'initial_state',new.initial_state),'simulator:'||new.id::text,new.actor_user_id)
  returning execution_id,result into v_execution,v_result;
  insert into public.simulator_runs(org_id,operation_id,title,simulated_input,initial_state,status,execution_id,created_by)
  values(new.org_id,new.operation_id,new.title,new.simulated_input,new.initial_state,v_result,v_execution,new.actor_user_id) returning id into v_run;
  new.simulator_run_id:=v_run; new.processed_at:=now(); return new;
end; $$;

create or replace function private.pause_experiment_on_critical_event()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.severity='critical' and new.variant_id is not null then
    update public.experiment_variants set status='paused',critical_errors=critical_errors+1 where id=new.variant_id;
    update public.experiments set status='paused',updated_at=now() where id=new.experiment_id and status='running';
    insert into public.alerts(org_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(new.org_id,'critical','experiment','Experimento pausado por erro crítico','A variante exige revisão humana antes de qualquer retomada.','experiment',new.experiment_id,'experiment-critical:'||new.experiment_id::text);
  end if; return new;
end; $$;

revoke all on function private.process_learning_review_request() from public,anon,authenticated,service_role;
revoke all on function private.process_simulator_run_request() from public,anon,authenticated,service_role;
revoke all on function private.pause_experiment_on_critical_event() from public,anon,authenticated,service_role;
create trigger learning_review_process before insert on public.learning_review_requests for each row execute function private.process_learning_review_request();
create trigger simulator_run_process before insert on public.simulator_run_requests for each row execute function private.process_simulator_run_request();
create trigger experiment_critical_pause after insert on public.experiment_events for each row execute function private.pause_experiment_on_critical_event();
create trigger learning_suggestions_set_updated_at before update on public.learning_suggestions for each row execute function private.set_updated_at();
create trigger regression_cases_set_updated_at before update on public.regression_cases for each row execute function private.set_updated_at();
create trigger experiments_set_updated_at before update on public.experiments for each row execute function private.set_updated_at();

alter table public.learning_suggestions enable row level security; alter table public.regression_cases enable row level security; alter table public.regression_runs enable row level security; alter table public.simulator_runs enable row level security; alter table public.learning_review_requests enable row level security; alter table public.simulator_run_requests enable row level security;
alter table public.experiments enable row level security; alter table public.experiment_variants enable row level security; alter table public.experiment_assignments enable row level security; alter table public.experiment_events enable row level security;

create policy learning_suggestions_manager_select on public.learning_suggestions for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));
create policy learning_suggestions_manager_insert on public.learning_suggestions for insert to authenticated with check(created_by=(select auth.uid()) and (select private.has_org_permission(org_id,'ai.manage')));
create policy regression_cases_manager_select on public.regression_cases for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));
create policy regression_runs_manager_select on public.regression_runs for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));
create policy simulator_runs_manager_select on public.simulator_runs for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));
create policy learning_review_actor_select on public.learning_review_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy learning_review_manager_insert on public.learning_review_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'ai.manage')));
create policy simulator_request_actor_select on public.simulator_run_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy simulator_request_manager_insert on public.simulator_run_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'ai.manage')));
create policy experiments_manager_all on public.experiments for all to authenticated using((select private.has_org_permission(org_id,'ai.manage'))) with check((select private.has_org_permission(org_id,'ai.manage')));
create policy experiment_variants_manager_all on public.experiment_variants for all to authenticated using((select private.has_org_permission(org_id,'ai.manage'))) with check((select private.has_org_permission(org_id,'ai.manage')));
create policy experiment_assignments_manager_select on public.experiment_assignments for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));
create policy experiment_events_manager_select on public.experiment_events for select to authenticated using((select private.has_org_permission(org_id,'ai.manage')));

grant select,insert on public.learning_suggestions to authenticated; grant select on public.regression_cases,public.regression_runs,public.simulator_runs to authenticated;
grant select,insert on public.learning_review_requests,public.simulator_run_requests to authenticated;
grant select,insert,update,delete on public.experiments,public.experiment_variants to authenticated; grant select on public.experiment_assignments,public.experiment_events to authenticated;
grant all on public.learning_suggestions,public.regression_cases,public.regression_runs,public.simulator_runs,public.learning_review_requests,public.simulator_run_requests,public.experiments,public.experiment_variants,public.experiment_assignments,public.experiment_events to service_role;

comment on table public.learning_suggestions is 'Human-reviewed learning queue. Approval creates a draft and regression case, never a live rule.';
comment on table public.simulator_runs is 'Isolated execution surface: no real message, job, call or campaign is created from simulator output.';

commit;
