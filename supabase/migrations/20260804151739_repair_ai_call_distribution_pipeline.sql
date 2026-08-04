begin;

create or replace function private.advance_new_opportunity_to_service(
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_opportunity public.opportunities%rowtype;
  v_current_stage public.pipeline_stages%rowtype;
  v_target_stage_id uuid;
  v_version integer;
begin
  select * into v_opportunity from public.opportunities where id=p_opportunity_id for update;
  if not found or v_opportunity.status<>'open' then return false;end if;
  select * into v_current_stage from public.pipeline_stages where id=v_opportunity.pipeline_stage_id;
  if v_current_stage.code<>'new' then return false;end if;
  select id into v_target_stage_id from public.pipeline_stages
  where org_id=v_opportunity.org_id and code='in_service' and is_active;
  if v_target_stage_id is null then raise exception 'in_service_stage_not_found' using errcode='22023';end if;
  v_version:=v_opportunity.version+1;
  update public.opportunities
  set pipeline_stage_id=v_target_stage_id,stage_entered_at=now(),last_activity_at=now(),
      version=v_version,updated_at=now()
  where id=v_opportunity.id;
  insert into public.opportunity_stage_history(
    org_id,operation_id,opportunity_id,from_stage_id,to_stage_id,actor_user_id,
    actor_type,reason,opportunity_version
  ) values (
    v_opportunity.org_id,v_opportunity.operation_id,v_opportunity.id,v_current_stage.id,
    v_target_stage_id,p_actor_user_id,'ai',coalesce(nullif(trim(p_reason),''),'pedro_started_service'),v_version
  );
  return true;
end;
$$;
revoke all on function private.advance_new_opportunity_to_service(uuid,uuid,text)
  from public,anon,authenticated,service_role;

create or replace function private.advance_stage_after_assisted_send()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_opportunity_id uuid;
begin
  if new.action<>'send' or new.result<>'sent' then return new;end if;
  select c.opportunity_id into v_opportunity_id
  from public.ai_suggestions s
  join public.conversations c on c.id=s.conversation_id and c.org_id=s.org_id
  where s.id=new.suggestion_id and s.org_id=new.org_id;
  if v_opportunity_id is not null then
    perform private.advance_new_opportunity_to_service(v_opportunity_id,new.actor_user_id,'pedro_assisted_reply_sent');
  end if;
  return new;
end;
$$;
revoke all on function private.advance_stage_after_assisted_send()
  from public,anon,authenticated,service_role;
drop trigger if exists ai_suggestion_review_advance_stage on public.ai_suggestion_review_requests;
create trigger ai_suggestion_review_advance_stage
after insert on public.ai_suggestion_review_requests
for each row execute function private.advance_stage_after_assisted_send();

create or replace function private.ensure_call_settings_from_availability()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  if not new.active then return new;end if;
  insert into public.membership_call_settings(
    membership_id,org_id,operation_id,can_receive_calls,is_preferred_receiver,receive_urgent_call_alerts
  ) values (new.membership_id,new.org_id,new.operation_id,true,false,false)
  on conflict(membership_id) do nothing;
  return new;
end;
$$;
revoke all on function private.ensure_call_settings_from_availability()
  from public,anon,authenticated,service_role;
drop trigger if exists availability_rules_ensure_call_settings on public.availability_rules;
create trigger availability_rules_ensure_call_settings
after insert or update of active on public.availability_rules
for each row execute function private.ensure_call_settings_from_availability();

insert into public.membership_call_settings(
  membership_id,org_id,operation_id,can_receive_calls,is_preferred_receiver,receive_urgent_call_alerts
)
select distinct on(r.membership_id)
  r.membership_id,r.org_id,r.operation_id,true,false,false
from public.availability_rules r
join public.memberships m on m.id=r.membership_id and m.org_id=r.org_id and m.status='active'
where r.active
order by r.membership_id,r.updated_at desc
on conflict(membership_id) do nothing;

do $$
declare v_opportunity_id uuid;v_actor_user_id uuid;
begin
  for v_opportunity_id,v_actor_user_id in
    select distinct c.opportunity_id,s.reviewed_by
    from public.ai_suggestions s
    join public.conversations c on c.id=s.conversation_id and c.org_id=s.org_id
    join public.opportunities o on o.id=c.opportunity_id and o.org_id=c.org_id
    join public.pipeline_stages ps on ps.id=o.pipeline_stage_id and ps.org_id=o.org_id
    where s.status='approved' and s.reviewed_by is not null and ps.code='new' and o.status='open'
  loop
    perform private.advance_new_opportunity_to_service(v_opportunity_id,v_actor_user_id,'backfill_approved_pedro_service');
  end loop;
end;
$$;

commit;
