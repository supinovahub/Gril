begin;

create or replace function private.membership_is_available(p_membership_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_settings public.membership_call_settings%rowtype; v_local_start timestamp; v_local_end timestamp;
begin
  select s.* into v_settings from public.membership_call_settings s
  join public.memberships m on m.id=s.membership_id and m.status='active'
  join public.profiles p on p.user_id=m.user_id and p.whatsapp_e164 is not null
  where s.membership_id=p_membership_id and s.can_receive_calls;
  if not found then return false; end if;
  if v_settings.temporary_unavailable_from is not null and p_starts_at < v_settings.temporary_unavailable_until and p_ends_at > v_settings.temporary_unavailable_from then return false; end if;
  if exists(select 1 from public.availability_exceptions e where e.membership_id=p_membership_id and e.availability='unavailable' and e.starts_at<p_ends_at and e.ends_at>p_starts_at) then return false; end if;
  if exists(select 1 from public.availability_exceptions e where e.membership_id=p_membership_id and e.availability='available' and e.starts_at<=p_starts_at and e.ends_at>=p_ends_at) then return true; end if;
  v_local_start:=p_starts_at at time zone coalesce((select timezone from public.availability_rules where membership_id=p_membership_id and active limit 1),'America/Sao_Paulo');
  v_local_end:=p_ends_at at time zone coalesce((select timezone from public.availability_rules where membership_id=p_membership_id and active limit 1),'America/Sao_Paulo');
  return exists(select 1 from public.availability_rules r where r.membership_id=p_membership_id and r.operation_id=v_settings.operation_id and r.active
    and r.weekday=extract(dow from v_local_start)::int and v_local_start::date between r.valid_from and coalesce(r.valid_until,'infinity'::date)
    and v_local_start::time>=r.start_time and v_local_end::time<=r.end_time);
end; $$;
revoke all on function private.membership_is_available(uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;

create or replace function private.process_call_settings_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_membership public.memberships%rowtype; v_self boolean;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_settings_forbidden' using errcode='42501'; end if;
  select * into v_membership from public.memberships where id=new.membership_id and org_id=new.org_id and status='active';
  if not found or not exists(select 1 from public.membership_operations where membership_id=v_membership.id and operation_id=new.operation_id) then raise exception 'membership_operation_not_found' using errcode='22023'; end if;
  v_self:=v_membership.user_id=(select auth.uid());
  if not v_self and not private.has_org_permission(new.org_id,'team.manage') then raise exception 'call_settings_forbidden' using errcode='42501'; end if;
  if new.is_preferred_receiver and not private.has_org_permission(new.org_id,'team.manage') then raise exception 'preferred_receiver_requires_manager' using errcode='42501'; end if;
  insert into public.membership_call_settings (membership_id,org_id,operation_id,can_receive_calls,is_preferred_receiver,receive_urgent_call_alerts)
  values (new.membership_id,new.org_id,new.operation_id,new.can_receive_calls,new.is_preferred_receiver,new.receive_urgent_call_alerts)
  on conflict (membership_id) do update set can_receive_calls=excluded.can_receive_calls,is_preferred_receiver=excluded.is_preferred_receiver,
    receive_urgent_call_alerts=excluded.receive_urgent_call_alerts,version=public.membership_call_settings.version+1,updated_at=now();
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'call.settings_updated','memberships',new.membership_id,jsonb_build_object('enabled',new.can_receive_calls,'preferred',new.is_preferred_receiver));
  new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_call_creation_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_opp public.opportunities%rowtype; v_stage public.pipeline_stages%rowtype; v_hold uuid; v_call uuid; v_status text; v_is_service boolean:=(select auth.role())='service_role';
begin
  if not v_is_service and ((select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'pipeline.manage')) then raise exception 'call_creation_forbidden' using errcode='42501'; end if;
  if new.format not in ('video','phone','unknown') or not new.lead_confirmed then raise exception 'lead_confirmation_and_format_required' using errcode='22023'; end if;
  if new.starts_at<=now()+interval '10 minutes' then raise exception 'call_start_too_close' using errcode='22023'; end if;
  select * into v_opp from public.opportunities where id=new.opportunity_id and org_id=new.org_id for update;
  if not found or v_opp.operation_id<>new.operation_id or v_opp.version<>new.expected_opportunity_version or v_opp.status<>'open' then raise exception 'opportunity_version_or_state_conflict' using errcode='40001'; end if;
  select * into v_stage from public.pipeline_stages where id=v_opp.pipeline_stage_id;
  if v_stage.position>3 then raise exception 'call_not_allowed_after_human_pipeline' using errcode='22023'; end if;
  v_status:=case when new.starts_at<now()+interval '1 hour' then 'awaiting_manager' else 'awaiting_distribution' end;
  insert into public.call_holds (org_id,operation_id,opportunity_id,starts_at,ends_at,preferred_format,status,expires_at,lead_confirmed,created_by)
  values (new.org_id,new.operation_id,new.opportunity_id,new.starts_at,new.starts_at+interval '20 minutes',new.format,
    case when v_status='awaiting_manager' then 'escalated' else 'active' end,least(new.starts_at,now()+interval '15 minutes'),true,new.actor_user_id) returning id into v_hold;
  insert into public.calls (org_id,operation_id,hold_id,opportunity_id,starts_at,ends_at,blocked_until,status,format)
  values (new.org_id,new.operation_id,v_hold,new.opportunity_id,new.starts_at,new.starts_at+interval '20 minutes',new.starts_at+interval '30 minutes',v_status,new.format) returning id into v_call;
  if v_status='awaiting_manager' then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(new.org_id,new.operation_id,'critical','call','Call com menos de uma hora','O horário foi separado, mas exige resolução humana silenciosa.','call',v_call,'call-short-lead:'||v_call::text);
  else
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values(new.org_id,new.operation_id,'call.hold_created.v1','call',v_call,jsonb_build_object('call_id',v_call),'call-created:'||v_call::text);
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'call.created','calls',v_call,jsonb_build_object('starts_at',new.starts_at,'status',v_status));
  new.call_id:=v_call; new.result:=v_status; new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_call_distribution_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype; v_member record; v_offer uuid; v_count int:=0; v_preferred_count int; v_position int:=0; v_send_at timestamptz; v_is_service boolean:=(select auth.role())='service_role';
begin
  if not v_is_service and ((select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'pipeline.manage')) then raise exception 'call_distribution_forbidden' using errcode='42501'; end if;
  select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.status not in ('awaiting_distribution','distributing','unassigned_alerted') or v_call.starts_at<=now() or exists(select 1 from public.call_assignments where call_id=v_call.id and active) then raise exception 'call_not_distributable' using errcode='22023'; end if;
  update public.call_offers set status='cancelled',responded_at=now() where call_id=v_call.id and status in ('scheduled','pending');
  select count(*) into v_preferred_count from public.membership_call_settings s where s.operation_id=v_call.operation_id and s.is_preferred_receiver and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until)
    and (v_call.nominal_membership_id is null or s.membership_id=v_call.nominal_membership_id);
  if v_call.nominal_membership_id is not null then v_preferred_count:=1; end if;
  if v_preferred_count>0 then
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id
      and (case when v_call.nominal_membership_id is not null then s.membership_id=v_call.nominal_membership_id else s.is_preferred_receiver end)
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until) loop
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
      values(new.org_id,v_call.id,v_member.membership_id,1,case when v_call.nominal_membership_id is null then 'preferred' else 'nominal' end,'pending',now(),least(v_call.starts_at,now()+interval '30 minutes')) returning id into v_offer;
      insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
      values(new.org_id,v_call.operation_id,'call.offer_sent.v1','call_offer',v_offer,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer,'date_only',v_call.starts_at),'call-offer:'||v_offer::text);
      v_count:=v_count+1;
    end loop;
  else
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id and not s.is_preferred_receiver
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until) order by s.updated_at,s.membership_id loop
      v_position:=v_position+1; if v_position>3 then exit; end if; v_send_at:=now()+make_interval(mins=>5*(v_position-1));
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
      values(new.org_id,v_call.id,v_member.membership_id,1,'sequential',case when v_position=1 then 'pending' else 'scheduled' end,v_send_at,v_send_at+interval '5 minutes') returning id into v_offer;
      if v_position=1 then
        insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
        values(new.org_id,v_call.operation_id,'call.offer_sent.v1','call_offer',v_offer,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer,'date_only',v_call.starts_at),'call-offer:'||v_offer::text);
      else
        insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
        values(new.org_id,v_call.operation_id,'call.offer.activate','call_offer',v_offer,'call-distribution',v_send_at,'call-offer-activate:'||v_offer::text,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer),new.actor_user_id);
      end if; v_count:=v_count+1;
    end loop;
    for v_member in select s.membership_id from public.membership_call_settings s where s.operation_id=v_call.operation_id
      and private.membership_is_available(s.membership_id,v_call.starts_at,v_call.blocked_until) loop
      v_send_at:=now()+interval '15 minutes';
      insert into public.call_offers(org_id,call_id,recipient_membership_id,round,offer_type,status,sent_at,expires_at)
      values(new.org_id,v_call.id,v_member.membership_id,2,'broadcast','scheduled',v_send_at,v_call.starts_at) returning id into v_offer;
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by)
      values(new.org_id,v_call.operation_id,'call.offer.activate','call_offer',v_offer,'call-distribution',v_send_at,'call-offer-activate:'||v_offer::text,jsonb_build_object('call_id',v_call.id,'offer_id',v_offer),new.actor_user_id);
      v_count:=v_count+1;
    end loop;
  end if;
  if v_count=0 then
    update public.calls set status='unassigned_alerted',version=version+1 where id=v_call.id;
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(new.org_id,v_call.operation_id,'critical','call','Call sem corretor elegível','Nenhuma agenda compatível foi encontrada. O lead não deve receber detalhes da distribuição.','call',v_call.id,'call-no-eligible:'||v_call.id::text);
    new.result:='no_eligible_member';
  else update public.calls set status='distributing',version=version+1 where id=v_call.id; new.result:='offers_created'; end if;
  new.offer_count:=v_count; new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_call_offer_accept_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype; v_offer public.call_offers%rowtype; v_membership uuid; v_assignment uuid; v_opp public.opportunities%rowtype; v_target uuid; v_current_stage public.pipeline_stages%rowtype; v_conversation uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_accept_forbidden' using errcode='42501'; end if;
  v_membership:=private.current_membership_id(new.org_id);
  perform pg_advisory_xact_lock(hashtextextended(v_membership::text,0));
  select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  select * into v_offer from public.call_offers where id=new.offer_id and call_id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.version<>new.expected_call_version or v_offer.recipient_membership_id<>v_membership or v_offer.status<>'pending' or v_offer.sent_at>now() or v_offer.expires_at<=now() or v_call.status not in ('distributing','unassigned_alerted') then raise exception 'call_offer_unavailable' using errcode='40001'; end if;
  if not private.membership_is_available(v_membership,v_call.starts_at,v_call.blocked_until) or exists(select 1 from public.calls c where c.assigned_membership_id=v_membership and c.status='assigned' and c.id<>v_call.id and c.starts_at<v_call.blocked_until and c.blocked_until>v_call.starts_at) then raise exception 'membership_schedule_conflict' using errcode='23P01'; end if;
  insert into public.call_assignments(org_id,call_id,membership_id,offer_id,assignment_type,assigned_by)
  values(new.org_id,v_call.id,v_membership,v_offer.id,'accepted',new.actor_user_id) returning id into v_assignment;
  update public.call_offers set status=case when id=v_offer.id then 'accepted' else 'lost_race' end,responded_at=now() where call_id=v_call.id and status in ('pending','scheduled');
  update public.calls set status='assigned',assigned_membership_id=v_membership,version=version+1 where id=v_call.id;
  update public.call_holds set status='confirmed' where id=v_call.hold_id;
  select * into v_opp from public.opportunities where id=v_call.opportunity_id for update;
  select * into v_current_stage from public.pipeline_stages where id=v_opp.pipeline_stage_id;
  select id into v_target from public.pipeline_stages where org_id=new.org_id and code='call_scheduled';
  if v_current_stage.position<3 then
    update public.opportunities set pipeline_stage_id=v_target,assigned_membership_id=v_membership,stage_entered_at=now(),last_activity_at=now(),version=version+1 where id=v_opp.id;
    insert into public.opportunity_stage_history(org_id,operation_id,opportunity_id,from_stage_id,to_stage_id,actor_user_id,actor_type,reason,call_id,opportunity_version)
    values(new.org_id,v_call.operation_id,v_opp.id,v_opp.pipeline_stage_id,v_target,new.actor_user_id,'user','call_assigned',v_call.id,v_opp.version+1);
  end if;
  select current_conversation_id into v_conversation from public.opportunities where id=v_opp.id;
  if v_conversation is not null then
    insert into public.conversation_access_grants(org_id,conversation_id,membership_id,reason,starts_at,expires_at,created_by)
    values(new.org_id,v_conversation,v_membership,'call_window',v_call.starts_at-interval '30 minutes',v_call.ends_at+interval '2 hours',new.actor_user_id)
    on conflict (conversation_id,membership_id) where revoked_at is null do update set starts_at=least(public.conversation_access_grants.starts_at,excluded.starts_at),expires_at=greatest(public.conversation_access_grants.expires_at,excluded.expires_at);
  end if;
  insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,created_by) values
    (new.org_id,v_call.operation_id,'call.reminder.lead','call',v_call.id,'scheduled-actions',greatest(now(),v_call.starts_at-interval '1 hour'),'call-reminder:'||v_call.id::text||':60',jsonb_build_object('call_id',v_call.id,'offset',60),new.actor_user_id),
    (new.org_id,v_call.operation_id,'call.reminder.lead','call',v_call.id,'scheduled-actions',greatest(now(),v_call.starts_at-interval '10 minutes'),'call-reminder:'||v_call.id::text||':10',jsonb_build_object('call_id',v_call.id,'offset',10),new.actor_user_id),
    (new.org_id,v_call.operation_id,'call.result.due','call',v_call.id,'scheduled-actions',v_call.ends_at+interval '10 minutes','call-result-due:'||v_call.id::text,jsonb_build_object('call_id',v_call.id),new.actor_user_id);
  insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
  values(new.org_id,v_call.operation_id,'call.offer_accepted.v1','call',v_call.id,jsonb_build_object('call_id',v_call.id,'assignment_id',v_assignment),'call-accepted:'||v_call.id::text);
  new.assignment_id:=v_assignment; new.result:='accepted'; new.processed_at:=now(); return new;
end; $$;

create or replace function private.process_call_result_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_call public.calls%rowtype; v_member uuid; v_result_id uuid; v_opp public.opportunities%rowtype; v_target uuid; v_old_stage uuid; v_new_status text:='open';
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'call_result_forbidden' using errcode='42501'; end if;
  if new.result not in ('start_negotiation','lost','no_show','no_result','reschedule') then raise exception 'invalid_call_result' using errcode='22023'; end if;
  v_member:=private.current_membership_id(new.org_id); select * into v_call from public.calls where id=new.call_id and org_id=new.org_id for update;
  if not found or v_call.version<>new.expected_call_version or (v_call.assigned_membership_id<>v_member and not private.has_org_permission(new.org_id,'pipeline.manage')) then raise exception 'call_result_forbidden' using errcode='42501'; end if;
  if v_call.starts_at>now() and new.result<>'reschedule' then raise exception 'call_not_started' using errcode='22023'; end if;
  insert into public.call_results(org_id,call_id,result,reason,context,next_action,recorded_by)
  values(new.org_id,v_call.id,new.result,new.reason,new.context,new.next_action,new.actor_user_id) returning id into v_result_id;
  update public.calls set status=case when new.result='no_show' then 'no_show' when new.result='reschedule' then 'cancelled' else 'completed' end,completed_at=now(),version=version+1 where id=v_call.id;
  select * into v_opp from public.opportunities where id=v_call.opportunity_id for update; v_old_stage:=v_opp.pipeline_stage_id;
  if new.result='start_negotiation' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='negotiation';
  elsif new.result='lost' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='lost'; v_new_status:='lost';
  elsif new.result='no_show' then select id into v_target from public.pipeline_stages where org_id=new.org_id and code='in_service';
  end if;
  if v_target is not null and v_target<>v_old_stage then
    update public.opportunities set pipeline_stage_id=v_target,status=v_new_status,stage_entered_at=now(),last_activity_at=now(),version=version+1 where id=v_opp.id;
    insert into public.opportunity_stage_history(org_id,operation_id,opportunity_id,from_stage_id,to_stage_id,actor_user_id,actor_type,reason,call_id,opportunity_version)
    values(new.org_id,v_call.operation_id,v_opp.id,v_old_stage,v_target,new.actor_user_id,'user','call_result:'||new.result,v_call.id,v_opp.version+1);
  end if;
  if new.result in ('no_result','start_negotiation') then
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(new.org_id,v_call.operation_id,'warning','call','Resultado de call requer acompanhamento',coalesce(new.context,'Revise a próxima ação.'),'call',v_call.id,'call-result-review:'||v_call.id::text);
  end if;
  new.call_result_id:=v_result_id; new.processed_at:=now(); return new;
end; $$;

create trigger call_settings_request_process before insert on public.call_settings_requests for each row execute function private.process_call_settings_request();
create trigger call_creation_request_process before insert on public.call_creation_requests for each row execute function private.process_call_creation_request();
create trigger call_distribution_request_process before insert on public.call_distribution_requests for each row execute function private.process_call_distribution_request();
create trigger call_offer_accept_request_process before insert on public.call_offer_accept_requests for each row execute function private.process_call_offer_accept_request();
create trigger call_result_request_process before insert on public.call_result_requests for each row execute function private.process_call_result_request();

create or replace function private.audit_availability_change() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(coalesce(new.org_id,old.org_id),(select auth.uid()),'availability.'||lower(tg_op),tg_table_name,coalesce(new.id,old.id),'{}'); return coalesce(new,old); end; $$;
revoke all on function private.audit_availability_change() from public,anon,authenticated,service_role;
create trigger availability_rules_audit after insert or update or delete on public.availability_rules for each row execute function private.audit_availability_change();
create trigger availability_exceptions_audit after insert or update or delete on public.availability_exceptions for each row execute function private.audit_availability_change();

create or replace function private.seed_call_checklists(p_org uuid,p_operation uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_template uuid;
begin
  if exists(select 1 from public.checklist_templates where operation_id=p_operation and stage_code='negotiation' and version=1) then return; end if;
  insert into public.checklist_templates(org_id,operation_id,stage_code,name) values(p_org,p_operation,'negotiation','Pós-call e negociação') returning id into v_template;
  insert into public.checklist_items(org_id,template_id,position,label) values
    (p_org,v_template,1,'Registrar resumo e objeções da call'),(p_org,v_template,2,'Definir próxima ação e prazo'),(p_org,v_template,3,'Confirmar empreendimento ou necessidade de nova curadoria');
  insert into public.checklist_templates(org_id,operation_id,stage_code,name) values(p_org,p_operation,'proposal','Proposta e reserva') returning id into v_template;
  insert into public.checklist_items(org_id,template_id,position,label) values(p_org,v_template,1,'Validar unidade e condições'),(p_org,v_template,2,'Registrar proposta enviada'),(p_org,v_template,3,'Definir validade e retorno');
  insert into public.checklist_templates(org_id,operation_id,stage_code,name) values(p_org,p_operation,'documentation','Documentação') returning id into v_template;
  insert into public.checklist_items(org_id,template_id,position,label) values(p_org,v_template,1,'Registrar documentos solicitados'),(p_org,v_template,2,'Confirmar pendências'),(p_org,v_template,3,'Validar aprovação documental');
  insert into public.checklist_templates(org_id,operation_id,stage_code,name) values(p_org,p_operation,'payment','Pagamento') returning id into v_template;
  insert into public.checklist_items(org_id,template_id,position,label) values(p_org,v_template,1,'Registrar condição final'),(p_org,v_template,2,'Confirmar pagamento/reserva'),(p_org,v_template,3,'Encaminhar comprovação');
end; $$;
revoke all on function private.seed_call_checklists(uuid,uuid) from public,anon,authenticated,service_role;
do $$ declare v record; begin for v in select id,org_id from public.operations loop perform private.seed_call_checklists(v.org_id,v.id); end loop; end $$;

alter table public.membership_call_settings enable row level security; alter table public.availability_rules enable row level security; alter table public.availability_exceptions enable row level security;
alter table public.call_holds enable row level security; alter table public.calls enable row level security; alter table public.call_offers enable row level security; alter table public.call_assignments enable row level security; alter table public.call_results enable row level security;
alter table public.checklist_templates enable row level security; alter table public.checklist_items enable row level security; alter table public.opportunity_checklists enable row level security;
alter table public.call_settings_requests enable row level security; alter table public.call_creation_requests enable row level security; alter table public.call_distribution_requests enable row level security; alter table public.call_offer_accept_requests enable row level security; alter table public.call_result_requests enable row level security;

create policy call_settings_visible on public.membership_call_settings for select to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_rules_visible on public.availability_rules for select to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_rules_insert on public.availability_rules for insert to authenticated with check(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_rules_update on public.availability_rules for update to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage'))) with check(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_rules_delete on public.availability_rules for delete to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_exceptions_visible on public.availability_exceptions for select to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_exceptions_manage on public.availability_exceptions for all to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage'))) with check(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy calls_visible on public.calls for select to authenticated using((select private.has_org_permission(org_id,'pipeline.manage')) or assigned_membership_id=(select private.current_membership_id(org_id)) or exists(select 1 from public.call_offers o where o.call_id=id and o.recipient_membership_id=(select private.current_membership_id(org_id))));
create policy call_holds_visible on public.call_holds for select to authenticated using((select private.has_org_permission(org_id,'pipeline.manage')) or exists(select 1 from public.calls c where c.hold_id=id and (c.assigned_membership_id=(select private.current_membership_id(org_id)) or exists(select 1 from public.call_offers o where o.call_id=c.id and o.recipient_membership_id=(select private.current_membership_id(org_id))))));
create policy call_offers_visible on public.call_offers for select to authenticated using(recipient_membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'pipeline.manage')));
create policy call_assignments_visible on public.call_assignments for select to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'pipeline.manage')));
create policy call_results_visible on public.call_results for select to authenticated using((select private.has_org_permission(org_id,'pipeline.manage')) or exists(select 1 from public.calls c where c.id=call_id and c.assigned_membership_id=(select private.current_membership_id(org_id))));
create policy checklist_templates_visible on public.checklist_templates for select to authenticated using((select private.has_operation_access(operation_id)));
create policy checklist_items_visible on public.checklist_items for select to authenticated using(exists(select 1 from public.checklist_templates t where t.id=template_id and (select private.has_operation_access(t.operation_id))));
create policy opportunity_checklists_visible on public.opportunity_checklists for select to authenticated using((select private.can_access_opportunity(opportunity_id)));
create policy opportunity_checklists_manage on public.opportunity_checklists for all to authenticated using((select private.can_access_opportunity(opportunity_id))) with check((select private.can_access_opportunity(opportunity_id)));

create policy call_settings_requests_actor_select on public.call_settings_requests for select to authenticated using(actor_user_id=(select auth.uid())); create policy call_settings_requests_insert on public.call_settings_requests for insert to authenticated with check(actor_user_id=(select auth.uid()));
create policy call_creation_requests_actor_select on public.call_creation_requests for select to authenticated using(actor_user_id=(select auth.uid())); create policy call_creation_requests_insert on public.call_creation_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'pipeline.manage')));
create policy call_distribution_requests_actor_select on public.call_distribution_requests for select to authenticated using(actor_user_id=(select auth.uid())); create policy call_distribution_requests_insert on public.call_distribution_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'pipeline.manage')));
create policy call_accept_requests_actor_select on public.call_offer_accept_requests for select to authenticated using(actor_user_id=(select auth.uid())); create policy call_accept_requests_insert on public.call_offer_accept_requests for insert to authenticated with check(actor_user_id=(select auth.uid()));
create policy call_result_requests_actor_select on public.call_result_requests for select to authenticated using(actor_user_id=(select auth.uid())); create policy call_result_requests_insert on public.call_result_requests for insert to authenticated with check(actor_user_id=(select auth.uid()));

grant select on public.membership_call_settings,public.call_holds,public.calls,public.call_offers,public.call_assignments,public.call_results,public.checklist_templates,public.checklist_items to authenticated;
grant select,insert,update,delete on public.availability_rules,public.availability_exceptions,public.opportunity_checklists to authenticated;
grant select,insert on public.call_settings_requests,public.call_creation_requests,public.call_distribution_requests,public.call_offer_accept_requests,public.call_result_requests to authenticated;
grant all on public.membership_call_settings,public.availability_rules,public.availability_exceptions,public.call_holds,public.calls,public.call_offers,public.call_assignments,public.call_results,public.checklist_templates,public.checklist_items,public.opportunity_checklists,public.call_settings_requests,public.call_creation_requests,public.call_distribution_requests,public.call_offer_accept_requests,public.call_result_requests to service_role;

comment on table public.call_offer_accept_requests is 'Serialized atomic acceptance command. The first valid commit wins and all remaining offers lose the race.';
comment on function private.membership_is_available(uuid,timestamptz,timestamptz) is 'Eligibility requires active membership, WhatsApp, receive toggle, recurring window, no exception and no temporary absence.';

commit;
