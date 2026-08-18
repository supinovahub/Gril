begin;

-- Phase 19 rebuilt the runtime dispatcher from the phase-12 executor and
-- accidentally bypassed the phase-16 media handler. Preserve every current
-- wrapper and restore media dispatch at the outer edge.
alter function public.execute_runtime_job(uuid)
  rename to execute_runtime_job_before_media_dispatch_fix;

revoke all on function public.execute_runtime_job_before_media_dispatch_fix(uuid)
  from public, anon, authenticated;
grant execute on function public.execute_runtime_job_before_media_dispatch_fix(uuid)
  to service_role;

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
  where id = p_job_id
    and status = 'leased'
  for update;

  if not found then
    return jsonb_build_object('status', 'ignored');
  end if;

  if v_job.job_type = 'media.inbound.process' then
    return jsonb_build_object(
      'status', 'process_media',
      'message_id', (v_job.payload->>'message_id')::uuid
    );
  end if;

  return public.execute_runtime_job_before_media_dispatch_fix(p_job_id);
end;
$$;

revoke all on function public.execute_runtime_job(uuid)
  from public, anon, authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

commit;
