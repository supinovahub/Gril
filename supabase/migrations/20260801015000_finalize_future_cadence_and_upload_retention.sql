begin;

create or replace function private.schedule_future_purchase_cadence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_opportunity uuid;
  v_day integer;
begin
  if new.action_type <> 'followup' or new.status <> 'executed'
     or new.action_input ->> 'strategy' <> 'future' then
    return new;
  end if;
  select * into v_execution from public.ai_executions where id = new.execution_id;
  if not found or v_execution.mode <> 'production' or v_execution.conversation_id is null then return new; end if;
  select * into v_conversation from public.conversations where id = v_execution.conversation_id;
  v_opportunity := v_conversation.opportunity_id;

  update public.scheduled_jobs
  set status = 'cancelled', updated_at = now()
  where org_id = new.org_id and aggregate_type = 'conversation' and aggregate_id = v_conversation.id
    and job_type in ('followup.ai_turn','followup.future.expire') and status = 'pending';

  foreach v_day in array array[30,60,90,120,150,180] loop
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,
      run_at,dedupe_key,payload,max_attempts
    ) values (
      new.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      coalesce(v_execution.completed_at,now())+make_interval(days=>v_day),
      'future-purchase:'||v_conversation.id::text||':'||v_execution.id::text||':'||v_day::text,
      jsonb_build_object(
        'conversation_id',v_conversation.id,'opportunity_id',v_opportunity,
        'cadence','future_purchase','day',v_day,
        'instruction','Retome com contexto e valor, sem pressionar. Confirme se o horizonte de compra mudou.'
      ),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;

  insert into public.scheduled_jobs(
    org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,
    run_at,dedupe_key,payload,max_attempts
  ) values (
    new.org_id,v_execution.operation_id,'followup.future.expire','conversation',v_conversation.id,'scheduled-actions',
    coalesce(v_execution.completed_at,now())+interval '180 days 1 hour',
    'future-purchase-expire:'||v_conversation.id::text||':'||v_execution.id::text,
    jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity),3
  ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return new;
end;
$$;
revoke all on function private.schedule_future_purchase_cadence() from public,anon,authenticated,service_role;

create or replace function private.run_grill_daily_retention()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_samples integer;
  v_facts integer;
  v_uploads integer;
begin
  update public.persona_samples
  set raw_text = null,status = 'purged',updated_at = now()
  where raw_text is not null and(status = 'discarded' or purge_after <= now());
  get diagnostics v_samples = row_count;

  with expired as (
    update public.project_facts f set active = false,updated_at = now()
    where f.active and f.valid_until is not null and f.valid_until < current_date returning f.*
  ), alerts as (
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    select e.org_id,p.operation_id,'warning','knowledge','Fato aprovado expirou',
      'O fato '||e.code||' saiu automaticamente do contexto do Pedro e aguarda revisao.',
      'project_fact',e.id,'project-fact-expired:'||e.id::text
    from expired e join public.projects p on p.id = e.project_id
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status <> 'resolved' do nothing returning 1
  ) select count(*) into v_facts from expired;

  with expired_uploads as (
    update public.project_media_uploads
    set status = 'cancelled',error_redacted = 'upload_reservation_expired'
    where status = 'reserved' and expires_at <= now()
    returning id,org_id,storage_path
  ), queued as (
    insert into private.retention_purge_queue(
      org_id,entity_type,entity_id,storage_bucket,storage_path,action,due_at
    )
    select org_id,'project_media_upload',id,'gril-projects',storage_path,'delete',now()
    from expired_uploads
    on conflict(entity_type,entity_id,action) do nothing
    returning 1
  ) select count(*) into v_uploads from queued;

  return jsonb_build_object(
    'persona_samples_purged',v_samples,
    'project_facts_expired',v_facts,
    'project_uploads_expired',v_uploads
  );
end;
$$;
revoke all on function private.run_grill_daily_retention() from public,anon,authenticated,service_role;

commit;
