begin;

-- Phase 19 replaced the phase-17 dispatcher and delegated directly to the
-- phase-12 executor, which does not know regression.case.execute. Keep every
-- current wrapper intact and restore the missing regression route at the edge.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_regression_fix;
revoke all on function public.execute_runtime_job_before_regression_fix(uuid) from public, anon, authenticated;
grant execute on function public.execute_runtime_job_before_regression_fix(uuid) to service_role;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_job
  from public.scheduled_jobs
  where id = p_job_id and status = 'leased'
  for update;

  if not found then
    return jsonb_build_object('status', 'ignored');
  end if;

  if v_job.job_type = 'regression.case.execute' then
    return jsonb_build_object(
      'status', 'run_regression',
      'run_id', (v_job.payload ->> 'run_id')::uuid,
      'case_id', (v_job.payload ->> 'case_id')::uuid
    );
  end if;

  return public.execute_runtime_job_before_regression_fix(p_job_id);
end;
$$;

revoke all on function public.execute_runtime_job(uuid) from public, anon, authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

-- Resume only regression jobs that died from the missing dispatcher while
-- their parent run is still active. Other dead-letter jobs stay untouched.
update public.scheduled_jobs j
set status = 'pending',
    attempts = 0,
    lease_until = null,
    run_at = now(),
    last_error = null,
    completed_at = null,
    updated_at = now()
where j.job_type = 'regression.case.execute'
  and j.status = 'dead'
  and exists (
    select 1
    from public.regression_runs r
    where r.id = (j.payload ->> 'run_id')::uuid
      and r.org_id = j.org_id
      and r.status in ('queued', 'running')
  );

commit;
