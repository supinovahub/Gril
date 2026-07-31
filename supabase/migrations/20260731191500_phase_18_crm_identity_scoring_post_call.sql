begin;

-- Contact identity commands keep phone/participant/merge changes behind audited,
-- server-validated transitions instead of exposing the base tables for writes.
create table public.contact_phone_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null,
  phone_id uuid,
  action text not null check (action in ('add','set_primary','deactivate','mark_wrong')),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_original text,
  make_primary boolean not null default false,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_phone_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (contact_id,org_id) references public.contacts(id,org_id) on delete restrict,
  foreign key (phone_id,org_id) references public.contact_phones(id,org_id) on delete restrict,
  check ((action='add' and phone_e164 is not null and phone_original is not null) or action<>'add')
);

create table public.opportunity_participant_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  contact_id uuid not null,
  action text not null check (action in ('add','remove')),
  role text not null default 'co_buyer' check (role in ('co_buyer','influencer','other')),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete restrict,
  foreign key (contact_id,org_id) references public.contacts(id,org_id) on delete restrict
);

create table public.contact_merge_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  source_contact_id uuid not null references public.contacts(id) on delete restrict,
  target_contact_id uuid not null references public.contacts(id) on delete restrict,
  snapshot jsonb not null,
  merged_by uuid references auth.users(id) on delete set null,
  merged_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  unique (source_contact_id)
);

create table public.contact_merge_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  source_contact_id uuid not null,
  target_contact_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  merge_history_id uuid references public.contact_merge_history(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (source_contact_id,org_id) references public.contacts(id,org_id) on delete restrict,
  foreign key (target_contact_id,org_id) references public.contacts(id,org_id) on delete restrict,
  check (source_contact_id<>target_contact_id)
);

create or replace function private.process_contact_phone_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_phone public.contact_phones%rowtype; v_primary uuid; v_operation uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.can_manage_crm(new.org_id) then
    raise exception 'contact_phone_forbidden' using errcode='42501';
  end if;

  if new.action='add' then
    if exists(select 1 from public.contact_phones where org_id=new.org_id and e164=new.phone_e164 and status='active') then
      raise exception 'phone_already_in_use' using errcode='23505';
    end if;
    if new.make_primary or not exists(select 1 from public.contact_phones where contact_id=new.contact_id and status='active' and is_primary) then
      update public.contact_phones set is_primary=false,updated_at=now() where contact_id=new.contact_id and status='active' and is_primary;
      new.make_primary:=true;
    end if;
    insert into public.contact_phones(org_id,contact_id,e164,original,is_primary)
    values(new.org_id,new.contact_id,new.phone_e164,trim(new.phone_original),new.make_primary)
    returning id into new.processed_phone_id;
  else
    select * into v_phone from public.contact_phones
    where id=new.phone_id and contact_id=new.contact_id and org_id=new.org_id for update;
    if not found then raise exception 'contact_phone_not_found' using errcode='22023'; end if;

    if new.action='set_primary' then
      if v_phone.status<>'active' then raise exception 'inactive_phone_cannot_be_primary' using errcode='22023'; end if;
      update public.contact_phones set is_primary=false,updated_at=now() where contact_id=new.contact_id and status='active' and is_primary;
      update public.contact_phones set is_primary=true,updated_at=now() where id=v_phone.id;
    else
      if not exists(select 1 from public.contact_phones where contact_id=new.contact_id and status='active' and id<>v_phone.id) then
        raise exception 'contact_requires_active_phone' using errcode='22023';
      end if;
      update public.contact_phones set status='inactive',is_primary=false,updated_at=now() where id=v_phone.id;
      if v_phone.is_primary then
        select id into v_primary from public.contact_phones where contact_id=new.contact_id and status='active' order by created_at limit 1;
        update public.contact_phones set is_primary=true,updated_at=now() where id=v_primary;
      end if;
      if new.action='mark_wrong' then
        for v_operation in select id from public.operations where org_id=new.org_id and status='active' loop
          insert into public.suppression_entries(org_id,operation_id,phone_e164,reason,source)
          values(new.org_id,v_operation,v_phone.e164,'Número informado como incorreto','wrong_number')
          on conflict (operation_id,phone_e164) where revoked_at is null do nothing;
        end loop;
        update public.scheduled_jobs j set status='cancelled',lease_until=null,updated_at=now()
        where j.org_id=new.org_id and j.status in ('pending','leased') and exists(
          select 1 from public.conversations c where c.contact_id=new.contact_id and c.id=j.aggregate_id
        );
      end if;
    end if;
    new.processed_phone_id:=v_phone.id;
  end if;

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'contact.phone_'||new.action,'contacts',new.contact_id,
    jsonb_build_object('request_id',new.id,'phone_id',new.processed_phone_id));
  new.processed_at:=now(); return new;
end; $$;

create or replace function private.ensure_primary_opportunity_participant()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  insert into public.opportunity_participants(org_id,opportunity_id,contact_id,role)
  values(new.org_id,new.id,new.contact_id,'primary') on conflict(opportunity_id,contact_id) do nothing;
  return new;
end; $$;

insert into public.opportunity_participants(org_id,opportunity_id,contact_id,role)
select org_id,id,contact_id,'primary' from public.opportunities
on conflict(opportunity_id,contact_id) do nothing;

create trigger opportunities_ensure_primary_participant
after insert on public.opportunities for each row execute function private.ensure_primary_opportunity_participant();

create or replace function private.process_opportunity_participant_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_primary uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.can_manage_crm(new.org_id) then
    raise exception 'participant_change_forbidden' using errcode='42501';
  end if;
  select contact_id into v_primary from public.opportunities where id=new.opportunity_id and org_id=new.org_id;
  if not found then raise exception 'opportunity_not_found' using errcode='22023'; end if;
  if new.contact_id=v_primary then raise exception 'primary_participant_is_immutable' using errcode='22023'; end if;
  if new.action='add' then
    insert into public.opportunity_participants(org_id,opportunity_id,contact_id,role)
    values(new.org_id,new.opportunity_id,new.contact_id,new.role)
    on conflict(opportunity_id,contact_id) do update set role=excluded.role;
  else
    delete from public.opportunity_participants where opportunity_id=new.opportunity_id and contact_id=new.contact_id and role<>'primary';
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'opportunity.participant_'||new.action,'opportunities',new.opportunity_id,
    jsonb_build_object('request_id',new.id,'contact_id',new.contact_id,'role',new.role));
  new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_contact_merge_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_source public.contacts%rowtype; v_target public.contacts%rowtype; v_history uuid; v_snapshot jsonb; v_source_primary uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not private.can_manage_crm(new.org_id) then
    raise exception 'contact_merge_forbidden' using errcode='42501';
  end if;
  select * into v_source from public.contacts where id=new.source_contact_id and org_id=new.org_id for update;
  select * into v_target from public.contacts where id=new.target_contact_id and org_id=new.org_id for update;
  if v_source.id is null or v_target.id is null or v_source.status<>'active' or v_target.status<>'active' then
    raise exception 'contact_merge_invalid_state' using errcode='22023';
  end if;
  if exists(select 1 from public.conversations where contact_id=v_source.id and status in ('active','paused'))
     and exists(select 1 from public.conversations where contact_id=v_target.id and status in ('active','paused')) then
    raise exception 'contacts_have_active_conversations' using errcode='22023';
  end if;

  select jsonb_build_object(
    'source',to_jsonb(v_source),'target',to_jsonb(v_target),
    'source_phones',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.contact_phones p where p.contact_id=v_source.id),
    'opportunity_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.opportunities where contact_id=v_source.id),
    'conversation_ids',(select coalesce(jsonb_agg(id),'[]'::jsonb) from public.conversations where contact_id=v_source.id)
  ) into v_snapshot;
  insert into public.contact_merge_history(org_id,source_contact_id,target_contact_id,snapshot,merged_by)
  values(new.org_id,v_source.id,v_target.id,v_snapshot,new.actor_user_id) returning id into v_history;

  insert into public.opt_outs(org_id,operation_id,contact_id,channel,reason,source,recorded_at,recorded_by)
  select o.org_id,o.operation_id,v_target.id,o.channel,coalesce(o.reason,'Herdado de contato fundido'),o.source,o.recorded_at,new.actor_user_id
  from public.opt_outs o where o.contact_id=v_source.id and o.revoked_at is null
  on conflict(operation_id,contact_id,channel) where revoked_at is null do nothing;

  select id into v_source_primary from public.contact_phones where contact_id=v_source.id and status='active' and is_primary;
  update public.contact_phones set is_primary=false,updated_at=now() where contact_id=v_source.id and is_primary;
  delete from public.contact_phones p where p.contact_id=v_source.id and p.status='inactive' and exists(
    select 1 from public.contact_phones t where t.contact_id=v_target.id and t.e164=p.e164
  );
  update public.contact_phones set contact_id=v_target.id,updated_at=now() where contact_id=v_source.id;
  if not exists(select 1 from public.contact_phones where contact_id=v_target.id and status='active' and is_primary) then
    update public.contact_phones set is_primary=true,updated_at=now()
    where id=coalesce(v_source_primary,(select id from public.contact_phones where contact_id=v_target.id and status='active' order by created_at limit 1));
  end if;

  delete from public.opportunity_participants p where p.contact_id=v_source.id and exists(
    select 1 from public.opportunity_participants t where t.opportunity_id=p.opportunity_id and t.contact_id=v_target.id
  );
  update public.opportunity_participants set contact_id=v_target.id where contact_id=v_source.id;
  update public.opportunities set contact_id=v_target.id,updated_at=now(),version=version+1 where contact_id=v_source.id;
  update public.conversations set contact_id=v_target.id,updated_at=now(),version=version+1 where contact_id=v_source.id;
  update public.source_attributions set contact_id=v_target.id where contact_id=v_source.id;
  update public.lead_creation_requests set contact_id=v_target.id where contact_id=v_source.id;
  update public.campaign_import_rows set contact_id=v_target.id where contact_id=v_source.id;
  delete from public.campaign_contacts s where s.contact_id=v_source.id and exists(
    select 1 from public.campaign_contacts t where t.campaign_id=s.campaign_id and t.contact_id=v_target.id
  );
  update public.campaign_contacts set contact_id=v_target.id where contact_id=v_source.id;
  update public.contact_persona_bindings set unbound_at=now()
  where contact_id=v_source.id and unbound_at is null and exists(
    select 1 from public.contact_persona_bindings t where t.contact_id=v_target.id and t.unbound_at is null
  );
  update public.contact_persona_bindings set contact_id=v_target.id where contact_id=v_source.id;
  update public.preleads set contact_id=v_target.id where contact_id=v_source.id;
  update public.privacy_requests set contact_id=v_target.id where contact_id=v_source.id;
  update public.opt_outs set revoked_at=coalesce(revoked_at,now()),revoked_by=new.actor_user_id where contact_id=v_source.id and revoked_at is null;
  update public.contacts set status='merged',merged_into_contact_id=v_target.id,updated_at=now() where id=v_source.id;

  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'contact.merged','contacts',v_source.id,
    jsonb_build_object('target_contact_id',v_target.id,'history_id',v_history,'reason',trim(new.reason)));
  new.merge_history_id:=v_history; new.processed_at:=now(); return new;
end; $$;

-- Deterministic operational score. Missing data is explicitly reported as
-- unknown and never classified as outside-profile by absence alone.
create or replace function private.recompute_opportunity_score(p_opportunity_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid; v_total numeric; v_down numeric; v_timeline text; v_valid integer; v_matches integer; v_inbound integer;
  v_score numeric:=0; v_band text; v_missing text[]:=array[]::text[];
begin
  select org_id into v_org from public.opportunities where id=p_opportunity_id;
  if v_org is null then return; end if;
  select max(q.value_number) filter(where d.code='total_price'),max(q.value_number) filter(where d.code='down_payment'),
    max(q.value_text) filter(where d.code='purchase_timeline'),count(*)
  into v_total,v_down,v_timeline,v_valid
  from public.qualification_values q join public.qualification_definitions d on d.id=q.definition_id
  where q.opportunity_id=p_opportunity_id and q.state='valid' and (q.valid_until is null or q.valid_until>now());
  select count(*) into v_matches from public.project_matches where opportunity_id=p_opportunity_id and eligible;
  select count(*) into v_inbound from public.messages m join public.conversations c on c.id=m.conversation_id
  where c.opportunity_id=p_opportunity_id and m.direction='inbound';

  if v_total is not null then v_score:=v_score+15; else v_missing:=array_append(v_missing,'total_price'); end if;
  if v_down is not null then v_score:=v_score+15; else v_missing:=array_append(v_missing,'down_payment'); end if;
  if v_total is not null and v_down is not null and v_matches>0 then v_score:=v_score+25;
  elsif v_total is not null and v_down is not null then v_score:=v_score+10; end if;
  if v_timeline is not null then
    v_score:=v_score+case when lower(v_timeline) ~ '(agora|imediat|30 dias|1 mes|1 mês|curto)' then 25 else 15 end;
  else v_missing:=array_append(v_missing,'purchase_timeline'); end if;
  v_score:=v_score+least(20,v_inbound*4);
  v_band:=case when v_score>=75 then 'high' when v_score>=45 then 'normal' else 'followup' end;
  insert into public.opportunity_scores(org_id,opportunity_id,score,explanation,source)
  values(v_org,p_opportunity_id,v_score,jsonb_build_object('band',v_band,'financial',jsonb_build_object('total_price',v_total,'down_payment',v_down),
    'eligible_projects',v_matches,'inbound_messages',v_inbound,'missing',to_jsonb(v_missing),'outside_profile',false),'rule');
end; $$;

create or replace function private.recompute_score_from_qualification()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' then perform private.recompute_opportunity_score(old.opportunity_id); return old; end if;
  perform private.recompute_opportunity_score(new.opportunity_id); return new;
end; $$;
create trigger qualification_values_recompute_score after insert or update or delete on public.qualification_values
for each row execute function private.recompute_score_from_qualification();
create trigger project_matches_recompute_score after insert or update or delete on public.project_matches
for each row execute function private.recompute_score_from_qualification();
create or replace function private.recompute_score_from_message()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_opportunity uuid; begin
  if new.direction='inbound' then select opportunity_id into v_opportunity from public.conversations where id=new.conversation_id; perform private.recompute_opportunity_score(v_opportunity); end if;
  return new;
end; $$;
create trigger messages_recompute_score after insert on public.messages
for each row execute function private.recompute_score_from_message();

-- Complete the post-call contract with an exact next action and purchase forecast.
alter table public.call_results add column next_action_due_at timestamptz;
alter table public.call_results add column purchase_month smallint check (purchase_month between 1 and 12);
alter table public.call_results add column purchase_year smallint check (purchase_year between 2020 and 2200);
alter table public.call_result_requests add column next_action_due_at timestamptz;
alter table public.call_result_requests add column purchase_month smallint check (purchase_month between 1 and 12);
alter table public.call_result_requests add column purchase_year smallint check (purchase_year between 2020 and 2200);

create or replace function private.process_call_result_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype; v_member uuid; v_result_id uuid; v_opp public.opportunities%rowtype; v_target uuid; v_old_stage uuid; v_new_status text:='open';
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_result_forbidden' using errcode='42501'; end if;
  if new.result not in ('start_negotiation','lost','no_show','no_result','reschedule') then raise exception 'invalid_call_result' using errcode='22023'; end if;
  v_member:=private.current_membership_id(new.org_id); select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.version<>new.expected_call_version or (v_call.assigned_membership_id<>v_member and not private.has_org_permission(new.org_id,'pipeline.manage')) then raise exception 'call_result_forbidden' using errcode='42501'; end if;
  if v_call.starts_at>now() and new.result<>'reschedule' then raise exception 'call_not_started' using errcode='22023'; end if;
  if new.result='start_negotiation' and (char_length(trim(coalesce(new.context,'')))<5 or char_length(trim(coalesce(new.next_action,'')))<2
     or new.next_action_due_at is null or new.purchase_month is null or new.purchase_year is null) then
    raise exception 'negotiation_result_requires_context_next_action_and_forecast' using errcode='22023';
  end if;
  insert into public.call_results(org_id,call_id,result,reason,context,next_action,next_action_due_at,purchase_month,purchase_year,recorded_by)
  values(new.org_id,v_call.id,new.result,new.reason,new.context,new.next_action,new.next_action_due_at,new.purchase_month,new.purchase_year,new.actor_user_id) returning id into v_result_id;
  update public.calls set status=case when new.result='no_show' then 'no_show' when new.result='reschedule' then 'cancelled' else 'completed' end,completed_at=now(),version=version+1 where id=v_call.id;
  update public.scheduled_jobs set status='cancelled',lease_until=null,updated_at=now()
  where aggregate_type='call' and aggregate_id=v_call.id and status in ('pending','leased') and job_type like 'call.result.%';
  select * into v_opp from public.opportunities where id=v_call.opportunity_id for update; v_old_stage:=v_opp.pipeline_stage_id;
  if new.result='start_negotiation' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='negotiation';
  elsif new.result='lost' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='lost'; v_new_status:='lost';
  elsif new.result='no_show' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='in_service'; end if;
  if v_target is not null and v_target<>v_old_stage then
    update public.opportunities set pipeline_stage_id=v_target,status=v_new_status,stage_entered_at=now(),last_activity_at=now(),version=version+1 where id=v_opp.id;
    insert into public.opportunity_stage_history(org_id,operation_id,opportunity_id,from_stage_id,to_stage_id,actor_user_id,actor_type,reason,call_id,opportunity_version)
    values(new.org_id,v_call.operation_id,v_opp.id,v_old_stage,v_target,new.actor_user_id,'user','call_result:'||new.result,v_call.id,v_opp.version+1);
  end if;
  if new.result='start_negotiation' then
    update public.next_actions set status='cancelled',updated_at=now() where opportunity_id=v_opp.id and status='open';
    insert into public.next_actions(org_id,operation_id,opportunity_id,owner_membership_id,description,due_at,created_by)
    values(new.org_id,v_call.operation_id,v_opp.id,coalesce(v_call.assigned_membership_id,v_member),trim(new.next_action),new.next_action_due_at,new.actor_user_id);
  elsif new.result='no_result' then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(new.org_id,v_call.operation_id,'warning','call','Resultado de call requer acompanhamento',coalesce(new.context,'Revise a próxima ação.'),'call',v_call.id,'call-result-review:'||v_call.id::text);
  end if;
  new.call_result_id:=v_result_id; new.processed_at:=now(); return new;
end; $$;

-- Snapshot the checklist version when an opportunity first enters each human stage.
create or replace function private.ensure_opportunity_checklist_from_history()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_stage text; v_template public.checklist_templates%rowtype; v_items jsonb;
begin
  select code into v_stage from public.pipeline_stages where id=new.to_stage_id;
  if v_stage not in ('negotiation','proposal','documentation','payment','won') then return new; end if;
  select * into v_template from public.checklist_templates where operation_id=new.operation_id and stage_code=v_stage and status='published' order by version desc limit 1;
  if v_template.id is null then return new; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'position',position,'label',label,'required',required) order by position),'[]'::jsonb)
  into v_items from public.checklist_items where template_id=v_template.id;
  insert into public.opportunity_checklists(org_id,opportunity_id,template_id,template_version,items_snapshot)
  values(new.org_id,new.opportunity_id,v_template.id,v_template.version,v_items)
  on conflict(opportunity_id,template_id) do nothing;
  return new;
end; $$;
create trigger stage_history_ensure_checklist after insert on public.opportunity_stage_history
for each row execute function private.ensure_opportunity_checklist_from_history();

create table public.checklist_update_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_checklist_id uuid not null references public.opportunity_checklists(id) on delete restrict,
  item_id uuid not null,
  action text not null check (action in ('complete','reopen','waive')),
  note text check (note is null or char_length(trim(note))<=1000),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function private.process_checklist_update_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_check public.opportunity_checklists%rowtype; v_stage text; v_item jsonb; v_entry jsonb;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'checklist_update_forbidden' using errcode='42501'; end if;
  select * into v_check from public.opportunity_checklists where id=new.opportunity_checklist_id and org_id=new.org_id for update;
  if not found or not private.can_access_opportunity(v_check.opportunity_id) then raise exception 'checklist_update_forbidden' using errcode='42501'; end if;
  select t.stage_code into v_stage from public.checklist_templates t where t.id=v_check.template_id;
  if (new.action='waive' or v_stage in ('payment','won')) and not private.can_manage_crm(new.org_id) then raise exception 'checklist_manager_required' using errcode='42501'; end if;
  select value into v_item from jsonb_array_elements(v_check.items_snapshot) where value->>'id'=new.item_id::text;
  if v_item is null then raise exception 'checklist_item_not_found' using errcode='22023'; end if;
  if new.action='waive' and char_length(trim(coalesce(new.note,'')))<5 then raise exception 'checklist_waiver_reason_required' using errcode='22023'; end if;
  v_entry:=case when new.action='reopen' then null else jsonb_build_object('status',case when new.action='waive' then 'waived' else 'completed' end,
    'note',nullif(trim(new.note),''),'actor_user_id',new.actor_user_id,'at',now()) end;
  update public.opportunity_checklists set completion=case when v_entry is null then completion-new.item_id::text else jsonb_set(completion,array[new.item_id::text],v_entry,true) end,updated_at=now() where id=v_check.id;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'checklist.'||new.action,'opportunity_checklists',v_check.id,jsonb_build_object('item_id',new.item_id,'note',new.note));
  new.processed_at:=now(); return new;
end; $$;

create trigger contact_phone_request_process before insert on public.contact_phone_requests for each row execute function private.process_contact_phone_request();
create trigger opportunity_participant_request_process before insert on public.opportunity_participant_requests for each row execute function private.process_opportunity_participant_request();
create trigger contact_merge_request_process before insert on public.contact_merge_requests for each row execute function private.process_contact_merge_request();
create trigger checklist_update_request_process before insert on public.checklist_update_requests for each row execute function private.process_checklist_update_request();

alter table public.contact_phone_requests enable row level security;
alter table public.opportunity_participant_requests enable row level security;
alter table public.contact_merge_history enable row level security;
alter table public.contact_merge_requests enable row level security;
alter table public.checklist_update_requests enable row level security;

create policy contact_phone_requests_actor_select on public.contact_phone_requests for select to authenticated using(actor_user_id=(select auth.uid()) or (select private.can_manage_crm(org_id)));
create policy contact_phone_requests_insert on public.contact_phone_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.can_manage_crm(org_id)));
create policy participant_requests_actor_select on public.opportunity_participant_requests for select to authenticated using(actor_user_id=(select auth.uid()) or (select private.can_manage_crm(org_id)));
create policy participant_requests_insert on public.opportunity_participant_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.can_manage_crm(org_id)));
create policy contact_merge_history_manager on public.contact_merge_history for select to authenticated using((select private.can_manage_crm(org_id)));
create policy contact_merge_requests_actor_select on public.contact_merge_requests for select to authenticated using(actor_user_id=(select auth.uid()) or (select private.can_manage_crm(org_id)));
create policy contact_merge_requests_insert on public.contact_merge_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.can_manage_crm(org_id)));
create policy checklist_update_requests_actor_select on public.checklist_update_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy checklist_update_requests_insert on public.checklist_update_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.can_access_opportunity((select opportunity_id from public.opportunity_checklists where id=opportunity_checklist_id))));

grant select,insert on public.contact_phone_requests,public.opportunity_participant_requests,public.contact_merge_requests,public.checklist_update_requests to authenticated;
grant select on public.contact_merge_history to authenticated;
grant all on public.contact_phone_requests,public.opportunity_participant_requests,public.contact_merge_history,public.contact_merge_requests,public.checklist_update_requests to service_role;
revoke update,delete on public.opportunity_checklists from authenticated;

revoke all on function private.process_contact_phone_request(),private.ensure_primary_opportunity_participant(),private.process_opportunity_participant_request(),private.process_contact_merge_request(),private.recompute_opportunity_score(uuid),private.recompute_score_from_qualification(),private.recompute_score_from_message(),private.ensure_opportunity_checklist_from_history(),private.process_checklist_update_request() from public,anon,authenticated,service_role;

commit;
