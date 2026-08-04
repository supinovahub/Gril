begin;

create or replace function private.schedule_assisted_no_show_cadence()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_call public.calls%rowtype;
  v_conversation public.conversations%rowtype;
  v_plan_id uuid;
  v_step public.followup_steps%rowtype;
begin
  if new.result<>'no_show' then return new; end if;
  select * into v_call from public.calls where id=new.call_id;
  select * into v_conversation from public.conversations
  where org_id=new.org_id and operation_id=v_call.operation_id and opportunity_id=v_call.opportunity_id
    and status='active' order by created_at desc limit 1;
  if v_conversation.id is null or v_conversation.ownership<>'ai' or v_conversation.ai_mode<>'assisted' then return new; end if;
  update public.scheduled_jobs set status='cancelled',updated_at=now()
  where org_id=new.org_id and aggregate_type='conversation' and aggregate_id=v_conversation.id
    and job_type='followup.ai_turn' and status='pending';
  select id into v_plan_id from public.followup_plans
  where operation_id=v_call.operation_id and status='published' and name='Cadencia no-show'
  order by version desc limit 1;
  if v_plan_id is null then raise exception 'no_show_followup_plan_not_found' using errcode='22023'; end if;
  for v_step in select * from public.followup_steps where plan_id=v_plan_id order by step_number loop
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      new.org_id,v_call.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      now()+make_interval(mins=>v_step.delay_minutes),'no-show:'||new.call_id::text||':'||v_step.step_number::text,
      jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_call.opportunity_id,'cadence','no-show',
        'call_id',new.call_id,'step_number',v_step.step_number,'instruction',v_step.instruction),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;
  select id into v_plan_id from public.followup_plans
  where operation_id=v_call.operation_id and status='published' and name='Cadencia longa padrao'
  order by version desc limit 1;
  if v_plan_id is null then raise exception 'long_followup_plan_not_found' using errcode='22023'; end if;
  for v_step in select * from public.followup_steps where plan_id=v_plan_id order by step_number loop
    insert into public.scheduled_jobs(
      org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts
    ) values (
      new.org_id,v_call.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      now()+interval '48 hours'+make_interval(mins=>v_step.delay_minutes),
      'no-show-long:'||new.call_id::text||':'||v_step.step_number::text,
      jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_call.opportunity_id,'cadence','no-show-to-long',
        'call_id',new.call_id,'step_number',v_step.step_number,'instruction',v_step.instruction),3
    ) on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function private.schedule_assisted_no_show_cadence() from public,anon,authenticated,service_role;

drop trigger if exists call_result_assisted_no_show_cadence on public.call_results;
create trigger call_result_assisted_no_show_cadence
after insert on public.call_results
for each row when(new.result='no_show')
execute function private.schedule_assisted_no_show_cadence();

commit;
