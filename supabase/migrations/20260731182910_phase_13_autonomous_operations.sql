begin;

-- Every autonomous mutation is recorded independently from the model transcript.
create table public.ai_action_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null,
  action_type text not null check (action_type in ('qualification','project_match','call','followup','escalation')),
  action_input jsonb not null default '{}'::jsonb,
  status text not null check (status in ('executed','skipped','failed')),
  result jsonb not null default '{}'::jsonb,
  error_redacted text,
  created_at timestamptz not null default now(),
  foreign key (execution_id, org_id) references public.ai_executions(id, org_id) on delete cascade,
  unique (execution_id, action_type, action_input)
);

create index ai_action_executions_timeline_idx
  on public.ai_action_executions (execution_id, created_at);

alter table public.ai_action_executions enable row level security;
create policy ai_action_executions_manager_select
  on public.ai_action_executions for select to authenticated
  using ((select private.has_org_permission(org_id, 'ai.manage')));
grant select on public.ai_action_executions to authenticated;
grant all on public.ai_action_executions to service_role;

-- Service-role AI writes do not impersonate a human user.
alter table public.qualification_value_requests alter column actor_user_id drop not null;

create or replace function public.complete_pedro_turn(
  p_execution_id uuid,
  p_output_text text,
  p_output_structured jsonb,
  p_response_id text,
  p_model_returned text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_opportunity public.opportunities%rowtype;
  v_item jsonb;
  v_definition public.qualification_definitions%rowtype;
  v_value_request public.qualification_value_requests%rowtype;
  v_match_request public.project_match_requests%rowtype;
  v_call_request public.call_creation_requests%rowtype;
  v_distribution_request public.call_distribution_requests%rowtype;
  v_followup text;
  v_step public.followup_steps%rowtype;
  v_plan_id uuid;
  v_completion jsonb;
  v_kind text;
  v_state text;
  v_error text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;

  select * into v_execution from public.ai_executions where id=p_execution_id for update;
  if not found or v_execution.status <> 'running' then
    return jsonb_build_object('status', 'ignored');
  end if;

  if v_execution.conversation_id is not null then
    select * into v_conversation from public.conversations where id=v_execution.conversation_id for update;
    if not found or v_conversation.version <> v_execution.expected_conversation_version then
      update public.ai_executions
      set status='superseded', error_code='conversation_version_conflict',
          error_redacted='Uma mensagem mais recente substituiu esta execução.', completed_at=now()
      where id=v_execution.id;
      return jsonb_build_object('status', 'superseded');
    end if;
    select * into v_opportunity from public.opportunities where id=v_conversation.opportunity_id for update;
  end if;

  -- Shadow and assisted modes preserve the proposed actions but never mutate the CRM.
  if v_execution.mode in ('shadow', 'assisted') then
    insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
    values(v_execution.org_id,v_execution.id,'qualification',coalesce(p_output_structured->'qualification_updates','[]'::jsonb),'skipped',jsonb_build_object('reason','non_production_mode')),
          (v_execution.org_id,v_execution.id,'project_match',jsonb_build_object('requested',coalesce((p_output_structured->>'request_project_match')::boolean,false)),'skipped',jsonb_build_object('reason','non_production_mode')),
          (v_execution.org_id,v_execution.id,'call',coalesce(p_output_structured->'call_request','null'::jsonb),'skipped',jsonb_build_object('reason','non_production_mode')),
          (v_execution.org_id,v_execution.id,'followup',jsonb_build_object('strategy',coalesce(p_output_structured->>'followup_strategy','none')),'skipped',jsonb_build_object('reason','non_production_mode'))
    on conflict do nothing;
  elsif v_execution.mode='production' and v_execution.conversation_id is not null then
    for v_item in select value from jsonb_array_elements(coalesce(p_output_structured->'qualification_updates','[]'::jsonb)) loop
      begin
        select * into v_definition from public.qualification_definitions
        where org_id=v_execution.org_id and code=v_item->>'code' and active;
        if not found then raise exception 'qualification_definition_not_found'; end if;
        v_kind:=v_item->>'value_kind';
        v_state:=case when v_kind in ('refused','unknown') then v_kind else 'valid' end;
        if v_kind='number' and v_definition.answer_type not in ('money','number') then raise exception 'qualification_type_mismatch'; end if;
        if v_kind='boolean' and v_definition.answer_type<>'boolean' then raise exception 'qualification_type_mismatch'; end if;
        if v_kind='text' and v_definition.answer_type in ('money','number','boolean') then raise exception 'qualification_type_mismatch'; end if;

        insert into public.qualification_value_requests(
          org_id,opportunity_id,definition_id,value_text,value_number,value_boolean,state,source,
          confidence,source_message_id,actor_user_id,human_confirmed
        ) values (
          v_execution.org_id,v_opportunity.id,v_definition.id,
          case when v_kind='text' then nullif(trim(v_item->>'value_text'),'') end,
          case when v_kind='number' then (v_item->>'value_number')::numeric end,
          case when v_kind='boolean' then (v_item->>'value_boolean')::boolean end,
          v_state,'ai',greatest(0,least(1,coalesce((v_item->>'confidence')::numeric,0.5))),
          v_execution.request_message_id,null,false
        ) returning * into v_value_request;
        insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
        values(v_execution.org_id,v_execution.id,'qualification',v_item,'executed',jsonb_build_object('code',v_definition.code,'result',v_value_request.result))
        on conflict do nothing;
      exception when others then
        get stacked diagnostics v_error=message_text;
        insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,error_redacted)
        values(v_execution.org_id,v_execution.id,'qualification',v_item,'failed',left(v_error,500))
        on conflict do nothing;
      end;
    end loop;

    if coalesce((p_output_structured->>'request_project_match')::boolean,false) then
      insert into public.project_match_requests(org_id,opportunity_id,actor_user_id)
      values(v_execution.org_id,v_opportunity.id,null) returning * into v_match_request;
      update public.project_matches set sent_at=now()
      where request_id=v_match_request.id
        and project_id in (
          select value::uuid from jsonb_array_elements_text(coalesce(p_output_structured->'recommended_project_ids','[]'::jsonb))
        );
      insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
      values(v_execution.org_id,v_execution.id,'project_match',jsonb_build_object('requested',true),'executed',jsonb_build_object('result_count',v_match_request.result_count))
      on conflict do nothing;
    end if;

    if p_output_structured->'call_request' is not null and p_output_structured->'call_request' <> 'null'::jsonb then
      begin
        insert into public.call_creation_requests(
          org_id,operation_id,opportunity_id,starts_at,format,lead_confirmed,expected_opportunity_version,actor_user_id
        ) values (
          v_execution.org_id,v_execution.operation_id,v_opportunity.id,
          (p_output_structured->'call_request'->>'starts_at')::timestamptz,
          p_output_structured->'call_request'->>'format',true,v_opportunity.version,null
        ) returning * into v_call_request;
        if v_call_request.result='awaiting_distribution' then
          insert into public.call_distribution_requests(org_id,call_id,actor_user_id)
          values(v_execution.org_id,v_call_request.call_id,null) returning * into v_distribution_request;
        end if;
        insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
        values(v_execution.org_id,v_execution.id,'call',p_output_structured->'call_request','executed',
          jsonb_build_object('call_id',v_call_request.call_id,'result',v_call_request.result,'distribution',v_distribution_request.result))
        on conflict do nothing;
      exception when others then
        get stacked diagnostics v_error=message_text;
        p_output_structured:=jsonb_set(p_output_structured,'{action}','"escalate"'::jsonb,true);
        p_output_structured:=jsonb_set(p_output_structured,'{escalation_reason}',to_jsonb('O horário solicitado precisa de confirmação humana.'::text),true);
        p_output_text:='Vou confirmar esse horário com a equipe e retornaremos por aqui.';
        insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,error_redacted)
        values(v_execution.org_id,v_execution.id,'call',p_output_structured->'call_request','failed',left(v_error,500))
        on conflict do nothing;
      end;
    end if;

    v_followup:=coalesce(p_output_structured->>'followup_strategy','none');
    if v_followup in ('cancel','short','long') then
      update public.scheduled_jobs set status='cancelled',updated_at=now()
      where org_id=v_execution.org_id and aggregate_type='conversation'
        and aggregate_id=v_conversation.id and job_type='followup.ai_turn' and status='pending';
    end if;
    if v_followup in ('short','long') and coalesce(p_output_structured->>'action','reply')='reply'
       and p_output_structured->'call_request'='null'::jsonb then
      select id into v_plan_id from public.followup_plans
      where operation_id=v_execution.operation_id and status='published'
      order by version desc limit 1;
      for v_step in select * from public.followup_steps where plan_id=v_plan_id
        and (v_followup='long' or step_number<=5) order by step_number loop
        insert into public.scheduled_jobs(
          org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
        ) values (
          v_execution.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,
          'scheduled-actions',now()+make_interval(mins=>v_step.delay_minutes),
          'followup:'||v_conversation.id::text||':'||v_execution.id::text||':'||v_step.step_number::text,
          jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity.id,'step_number',v_step.step_number,'instruction',v_step.instruction),3
        ) on conflict (org_id,dedupe_key) where status in ('pending','leased') do nothing;
      end loop;
    end if;
    insert into public.ai_action_executions(org_id,execution_id,action_type,action_input,status,result)
    values(v_execution.org_id,v_execution.id,'followup',jsonb_build_object('strategy',v_followup),'executed',jsonb_build_object('strategy',v_followup))
    on conflict do nothing;
  end if;

  select public.complete_ai_execution(
    p_execution_id,p_output_text,p_output_structured,p_response_id,p_model_returned,
    p_input_tokens,p_output_tokens,p_latency_ms
  ) into v_completion;
  return v_completion;
end;
$$;

revoke all on function public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.complete_pedro_turn(uuid,text,jsonb,text,text,integer,integer,integer) to service_role;

-- Preserve the phase-12 executor and add autonomous follow-ups plus campaign capacity admission.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_phase12;
revoke all on function public.execute_runtime_job_phase12(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_phase12(uuid) to service_role;

create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_conversation public.conversations%rowtype;
  v_capacity public.capacity_reservation_requests%rowtype;
  v_execution_request public.ai_execution_requests%rowtype;
  v_result jsonb;
  v_message public.messages%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;

  if v_job.job_type='followup.ai_turn' then
    select * into v_conversation from public.conversations
    where id=(v_job.payload->>'conversation_id')::uuid for update;
    if not found or v_conversation.status<>'active' or v_conversation.ownership<>'ai'
       or v_conversation.ai_mode<>'production'
       or exists(select 1 from public.opt_outs where operation_id=v_conversation.operation_id and contact_id=v_conversation.contact_id and revoked_at is null)
       or exists(select 1 from public.messages where conversation_id=v_conversation.id and direction='inbound' and created_at>v_job.created_at) then
      return jsonb_build_object('status','cancelled');
    end if;
    insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'reserve','followup') returning * into v_capacity;
    if v_capacity.result in ('proactive_paused','backlog') then
      return jsonb_build_object('status','retry','retry_seconds',300,'reason','capacity_paused');
    end if;
    insert into public.ai_execution_requests(
      org_id,operation_id,conversation_id,mode,expected_conversation_version,input_snapshot,idempotency_key,actor_user_id
    ) values (
      v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'production',v_conversation.version,
      jsonb_build_object('source','followup','job_id',v_job.id,'instruction',v_job.payload->>'instruction','step_number',v_job.payload->>'step_number'),
      'ai-followup:'||v_job.id::text,null
    ) on conflict (org_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
    returning * into v_execution_request;
    if v_execution_request.result='queued' then
      return jsonb_build_object('status','run_ai','ai_execution_id',v_execution_request.execution_id);
    end if;
    return jsonb_build_object('status','cancelled');
  end if;

  v_result:=public.execute_runtime_job_phase12(p_job_id);
  if v_job.job_type='campaign.contact.dispatch' and v_result->>'status'='send' then
    select * into v_message from public.messages where id=(v_result->>'message_id')::uuid;
    select * into v_conversation from public.conversations where id=v_message.conversation_id;
    insert into public.capacity_reservation_requests(org_id,operation_id,conversation_id,action,source)
    values(v_conversation.org_id,v_conversation.operation_id,v_conversation.id,'reserve','campaign') returning * into v_capacity;
    if v_capacity.result in ('proactive_paused','backlog') then
      delete from public.messages where id=v_message.id;
      return jsonb_build_object('status','retry','retry_seconds',300,'reason','capacity_paused');
    end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

create or replace function private.reconcile_conversation_capacity()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_slept integer:=0;v_promoted integer:=0;v_operation record;v_reservation record;v_message_id uuid;
begin
  with sleeping as (
    update private.capacity_reservations r
    set status='sleeping',last_activity_at=now()
    where r.status='active' and r.last_activity_at<=now()-interval '5 minutes'
    returning r.operation_id
  ), counts as (
    select operation_id,count(*)::integer as qty from sleeping group by operation_id
  )
  update public.operation_capacity c
  set active_count=greatest(0,c.active_count-counts.qty),
      below_ten_since=case when greatest(0,c.active_count-counts.qty)<10 then coalesce(c.below_ten_since,now()) else null end,
      version=c.version+1,updated_at=now()
  from counts where c.operation_id=counts.operation_id;
  get diagnostics v_slept=row_count;

  for v_operation in select * from public.operation_capacity where active_count<30 for update loop
    for v_reservation in select * from private.capacity_reservations
      where operation_id=v_operation.operation_id and status='backlog'
      order by created_at for update skip locked limit greatest(0,30-v_operation.active_count) loop
      update private.capacity_reservations set status='active',last_activity_at=now() where id=v_reservation.id;
      update public.operation_capacity set active_count=active_count+1,version=version+1,updated_at=now()
      where operation_id=v_operation.operation_id;
      select id into v_message_id from public.messages
      where conversation_id=v_reservation.conversation_id and direction='inbound' order by created_at desc limit 1;
      if v_message_id is not null then
        insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
        values(v_reservation.org_id,v_reservation.operation_id,'message.inbound.requeued.v1','message',v_message_id,
          jsonb_build_object('message_id',v_message_id),'capacity-requeue:'||v_message_id::text)
        on conflict(idempotency_key) do nothing;
      end if;
      v_promoted:=v_promoted+1;
    end loop;
  end loop;
  perform private.resume_proactive_capacity();
  return jsonb_build_object('slept_operations',v_slept,'promoted',v_promoted);
end;
$$;
revoke all on function private.reconcile_conversation_capacity() from public,anon,authenticated,service_role;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='gril-capacity-lifecycle';
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('gril-capacity-lifecycle','* * * * *','select private.reconcile_conversation_capacity();');
end;
$$;

commit;
