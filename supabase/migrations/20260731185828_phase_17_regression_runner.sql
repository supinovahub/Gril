begin;

create table public.regression_case_results(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null,
  case_id uuid not null,
  status text not null default 'queued' check(status in ('queued','running','passed','failed','error')),
  actual_action text,
  output_text text,
  output_structured jsonb,
  violations text[] not null default '{}',
  error_redacted text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(run_id,org_id) references public.regression_runs(id,org_id) on delete cascade,
  foreign key(case_id,org_id) references public.regression_cases(id,org_id) on delete restrict,
  unique(run_id,case_id),
  unique(id,org_id)
);
create index regression_case_results_run_status_idx on public.regression_case_results(run_id,status);

create table public.regression_run_requests(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  run_id uuid,
  total_cases integer not null default 0,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(run_id,org_id) references public.regression_runs(id,org_id) on delete restrict
);

create or replace function private.process_regression_run_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_rule uuid;v_run uuid;v_case record;v_total integer:=0;v_operation uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'ai.manage') then
    raise exception 'regression_run_forbidden' using errcode='42501';
  end if;
  if exists(select 1 from public.regression_runs where org_id=new.org_id and status in ('queued','running')) then
    raise exception 'regression_run_already_active' using errcode='55000';
  end if;
  select rv.id into v_rule from public.rule_versions rv join public.rule_sets rs on rs.id=rv.rule_set_id
    where rv.org_id=new.org_id and rv.status='published' and rs.code='core' order by rv.version desc limit 1;
  if v_rule is null then raise exception 'published_rule_required' using errcode='22023'; end if;
  if not exists(select 1 from public.model_profiles where org_id=new.org_id and status='active' and integration_account_id is not null) then
    raise exception 'active_model_required' using errcode='22023';
  end if;
  select id into v_operation from public.operations where org_id=new.org_id and is_default order by created_at limit 1;
  select count(*) into v_total from public.regression_cases where org_id=new.org_id and active;
  insert into public.regression_runs(org_id,rule_version_id,status,total_cases,created_by)
  values(new.org_id,v_rule,'running',v_total,new.actor_user_id) returning id into v_run;
  for v_case in select id from public.regression_cases where org_id=new.org_id and active order by title loop
    insert into public.regression_case_results(org_id,run_id,case_id) values(new.org_id,v_run,v_case.id);
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by,max_attempts)
    values(new.org_id,v_operation,'regression.case.execute','regression_case',v_case.id,'reconciliation',now(),
      'regression:'||v_run::text||':'||v_case.id::text,jsonb_build_object('run_id',v_run,'case_id',v_case.id),new.actor_user_id,3);
  end loop;
  new.run_id:=v_run;new.total_cases:=v_total;new.processed_at:=now();return new;
end; $$;
revoke all on function private.process_regression_run_request() from public,anon,authenticated,service_role;
create trigger regression_run_request_process before insert on public.regression_run_requests
for each row execute function private.process_regression_run_request();

create or replace function public.claim_regression_case(p_run_id uuid,p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_result public.regression_case_results%rowtype;v_case public.regression_cases%rowtype;
  v_run public.regression_runs%rowtype;v_rule public.rule_versions%rowtype;v_model public.model_profiles%rowtype;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_result from public.regression_case_results where run_id=p_run_id and case_id=p_case_id for update;
  if not found or v_result.status not in ('queued','running') then return jsonb_build_object('status','ignored'); end if;
  select * into v_run from public.regression_runs where id=p_run_id;
  select * into v_case from public.regression_cases where id=p_case_id;
  select * into v_rule from public.rule_versions where id=v_run.rule_version_id;
  select * into v_model from public.model_profiles where org_id=v_run.org_id and status='active' and integration_account_id is not null
    order by is_default desc,updated_at desc limit 1;
  if v_run.status<>'running' or v_model.id is null then return jsonb_build_object('status','cancelled'); end if;
  update public.regression_case_results set status='running',started_at=coalesce(started_at,now()) where id=v_result.id;
  return jsonb_build_object('status','claimed','result_id',v_result.id,'org_id',v_run.org_id,
    'input',v_case.simulated_input,'initial_state',v_case.initial_state,'expected_response',v_case.expected_response,
    'rubric',v_case.rubric,'allowed_actions',to_jsonb(v_case.allowed_actions),'prohibited_actions',to_jsonb(v_case.prohibited_actions),
    'severity',v_case.severity,'rules',v_rule.compiled_rules,'model',v_model.model_identifier,
    'integration_account_id',v_model.integration_account_id);
end; $$;
revoke all on function public.claim_regression_case(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_regression_case(uuid,uuid) to service_role;

create or replace function public.complete_regression_case(
  p_result_id uuid,p_actual_action text,p_output_text text,p_output_structured jsonb,p_violations text[],p_error_redacted text default null
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_result public.regression_case_results%rowtype;v_case public.regression_cases%rowtype;v_pass boolean;v_done integer;v_passed integer;v_critical integer;v_total integer;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_result from public.regression_case_results where id=p_result_id for update;
  if not found or v_result.status not in ('queued','running') then return 'ignored'; end if;
  select * into v_case from public.regression_cases where id=v_result.case_id;
  v_pass:=p_error_redacted is null and p_actual_action=any(v_case.allowed_actions)
    and coalesce(cardinality(p_violations),0)=0 and not (p_actual_action=any(v_case.prohibited_actions));
  update public.regression_case_results set status=case when p_error_redacted is not null then 'error' when v_pass then 'passed' else 'failed' end,
    actual_action=p_actual_action,output_text=left(p_output_text,12000),output_structured=p_output_structured,
    violations=coalesce(p_violations,'{}'),error_redacted=left(p_error_redacted,500),completed_at=now() where id=v_result.id;
  select count(*) filter(where r.status in ('passed','failed','error')),count(*) filter(where r.status='passed'),
    count(*) filter(where r.status in ('failed','error') and c.severity='critical')
    into v_done,v_passed,v_critical from public.regression_case_results r join public.regression_cases c on c.id=r.case_id where r.run_id=v_result.run_id;
  select total_cases into v_total from public.regression_runs where id=v_result.run_id for update;
  update public.regression_runs set passed_cases=v_passed,critical_failures=v_critical,
    status=case when v_done=v_total then case when v_critical=0 and v_passed=v_total then 'passed' else 'failed' end else 'running' end,
    completed_at=case when v_done=v_total then now() else null end,
    results=jsonb_build_object('completed',v_done,'passed',v_passed,'critical_failures',v_critical)
    where id=v_result.run_id;
  return case when v_pass then 'passed' else 'failed' end;
end; $$;
revoke all on function public.complete_regression_case(uuid,text,text,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.complete_regression_case(uuid,text,text,jsonb,text[],text) to service_role;

alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_phase16;
revoke all on function public.execute_runtime_job_phase16(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_phase16(uuid) to service_role;
create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type='regression.case.execute' then
    return jsonb_build_object('status','run_regression','run_id',(v_job.payload->>'run_id')::uuid,'case_id',(v_job.payload->>'case_id')::uuid);
  end if;
  return public.execute_runtime_job_phase16(p_job_id);
end; $$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

alter table public.regression_case_results enable row level security;
alter table public.regression_run_requests enable row level security;
create policy regression_case_results_manager_select on public.regression_case_results for select to authenticated
using((select private.has_org_permission(org_id,'ai.manage')));
create policy regression_run_requests_actor_select on public.regression_run_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy regression_run_requests_manager_insert on public.regression_run_requests for insert to authenticated
with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'ai.manage')));
grant select on public.regression_case_results to authenticated;
grant select,insert on public.regression_run_requests to authenticated;
grant all on public.regression_case_results,public.regression_run_requests to service_role;

comment on table public.regression_case_results is 'One isolated, side-effect-free Pedro evaluation per regression case.';
commit;
