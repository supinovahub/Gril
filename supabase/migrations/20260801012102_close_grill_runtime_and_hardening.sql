begin;

-- Persona originals are transient. Confirmed extracted patterns remain.
alter table public.persona_samples alter column raw_text drop not null;
create or replace function private.purge_persona_samples_after_publish()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$ begin
 update public.persona_samples s set raw_text=null,status='purged',updated_at=now()
 from public.persona_versions v where v.id=new.persona_version_id and s.persona_id=v.persona_id and s.status in('confirmed','discarded');return new;end;$$;
revoke all on function private.purge_persona_samples_after_publish() from public,anon,authenticated,service_role;
create trigger persona_publish_purge_samples after insert on public.persona_publish_requests for each row execute function private.purge_persona_samples_after_publish();

create or replace function private.run_grill_daily_retention()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_samples integer;v_facts integer;
begin
 update public.persona_samples set raw_text=null,status='purged',updated_at=now()
 where raw_text is not null and(status='discarded' or purge_after<=now());get diagnostics v_samples=row_count;
 with expired as(
   update public.project_facts f set active=false,updated_at=now()
   where f.active and f.valid_until is not null and f.valid_until<current_date returning f.*
 ),alerts as(
   insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
   select e.org_id,p.operation_id,'warning','knowledge','Fato aprovado expirou',
     'O fato '||e.code||' saiu automaticamente do contexto do Pedro e aguarda revisão.','project_fact',e.id,'project-fact-expired:'||e.id::text
   from expired e join public.projects p on p.id=e.project_id
   on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing returning 1
 ) select count(*) into v_facts from expired;
 return jsonb_build_object('persona_samples_purged',v_samples,'project_facts_expired',v_facts);
end;$$;
revoke all on function private.run_grill_daily_retention() from public,anon,authenticated,service_role;
do $$ declare v_job bigint;begin select jobid into v_job from cron.job where jobname='gril-daily-retention';if v_job is not null then perform cron.unschedule(v_job);end if;
 perform cron.schedule('gril-daily-retention','17 3 * * *','select private.run_grill_daily_retention();');end $$;

alter table public.project_fact_conflicts add column current_snapshot jsonb not null default '{}'::jsonb;
create or replace function private.snapshot_project_fact_conflict()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$ begin
 select to_jsonb(f) into new.current_snapshot from public.project_facts f where f.id=new.current_fact_id and f.org_id=new.org_id;
 if new.current_snapshot='{}'::jsonb then raise exception 'current_project_fact_not_found' using errcode='22023';end if;return new;end;$$;
revoke all on function private.snapshot_project_fact_conflict() from public,anon,authenticated,service_role;
create trigger project_fact_conflict_snapshot before insert on public.project_fact_conflicts for each row execute function private.snapshot_project_fact_conflict();

create table public.project_fact_conflict_resolution_requests(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 conflict_id uuid not null references public.project_fact_conflicts(id) on delete cascade,
 decision text not null check(decision in('accept_new','keep_current','quarantine_current')),reason text not null check(char_length(trim(reason)) between 5 and 1000),
 actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create or replace function private.resolve_project_fact_conflict()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_conflict public.project_fact_conflicts%rowtype;
begin
 if new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'ai.manage') then raise exception 'fact_conflict_resolution_forbidden' using errcode='42501';end if;
 select * into v_conflict from public.project_fact_conflicts where id=new.conflict_id and org_id=new.org_id and status='pending' for update;
 if not found then raise exception 'pending_fact_conflict_not_found' using errcode='22023';end if;
 if new.decision='accept_new' then
   update public.project_facts set value_text=v_conflict.proposed_value_text,value_number=v_conflict.proposed_value_number,unit=v_conflict.proposed_unit,
     source_name=v_conflict.proposed_source_name,reference_date=v_conflict.proposed_reference_date,valid_until=v_conflict.proposed_valid_until,
     active=true,updated_at=now() where id=v_conflict.current_fact_id;
   update public.project_fact_conflicts set status='accepted',resolution_reason=trim(new.reason),resolved_by=new.actor_user_id,resolved_at=now() where id=v_conflict.id;new.result:='new_fact_active';
 elsif new.decision='keep_current' then update public.project_fact_conflicts set status='rejected',resolution_reason=trim(new.reason),resolved_by=new.actor_user_id,resolved_at=now() where id=v_conflict.id;new.result:='current_fact_kept';
 else update public.project_facts set active=false,updated_at=now() where id=v_conflict.current_fact_id;
   update public.project_fact_conflicts set status='quarantined',resolution_reason=trim(new.reason),resolved_by=new.actor_user_id,resolved_at=now() where id=v_conflict.id;new.result:='current_fact_quarantined';end if;
 insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.actor_user_id,'knowledge.fact_conflict_'||new.decision,'project_fact_conflicts',v_conflict.id,jsonb_build_object('result',new.result));return new;
end;$$;
revoke all on function private.resolve_project_fact_conflict() from public,anon,authenticated,service_role;
create trigger project_fact_conflict_resolve before insert on public.project_fact_conflict_resolution_requests for each row execute function private.resolve_project_fact_conflict();

-- Use a partial active-transfer invariant so a completed transfer never blocks a future one.
alter table public.ownership_transfer_requests drop constraint ownership_transfer_requests_org_id_key;
create unique index ownership_transfer_one_pending_idx on public.ownership_transfer_requests(org_id) where status='pending';

-- Private, short-lived Excel-compatible CSV exports.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gril-exports','gril-exports',false,10485760,array['text/csv']::text[])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['text/csv']::text[];
create or replace function public.enqueue_storage_retention(p_org_id uuid,p_entity_type text,p_entity_id uuid,p_bucket text,p_path text,p_due_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog as $$ begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501';end if;
 if p_due_at<=now() or p_bucket not in('gril-exports','gril-media','gril-projects') then raise exception 'retention_target_invalid' using errcode='22023';end if;
 insert into private.retention_purge_queue(org_id,entity_type,entity_id,storage_bucket,storage_path,action,due_at)
 values(p_org_id,left(p_entity_type,80),p_entity_id,p_bucket,p_path,'delete',p_due_at);
end;$$;
revoke all on function public.enqueue_storage_retention(uuid,text,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_storage_retention(uuid,text,uuid,text,text,timestamptz) to service_role;

-- A/B assignment becomes the effective frozen context before an execution is created.
create or replace function private.apply_running_experiment_context()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_conversation public.conversations%rowtype;v_experiment public.experiments%rowtype;v_variant uuid;v_details public.experiment_variants%rowtype;v_latest public.conversation_context_versions%rowtype;v_profile jsonb;
begin
 if new.conversation_id is null or new.mode not in('shadow','assisted','production') then return new;end if;
 select * into v_conversation from public.conversations where id=new.conversation_id;
 select * into v_experiment from public.experiments where org_id=new.org_id and status='running' and(operation_id is null or operation_id=v_conversation.operation_id)
   and scope='eligible_inbound' order by starts_at desc limit 1;
 if not found then return new;end if;
 v_variant:=public.assign_experiment_variant(v_experiment.id,v_conversation.opportunity_id,v_conversation.id);if v_variant is null then return new;end if;
 select * into v_details from public.experiment_variants where id=v_variant;
 select * into v_latest from public.conversation_context_versions where conversation_id=v_conversation.id order by version desc limit 1;
 if v_latest.persona_version_id=v_details.persona_version_id and v_latest.rule_version_id=v_details.rule_version_id then return new;end if;
 select institutional_profile into v_profile from public.organization_settings where org_id=new.org_id;
 insert into public.conversation_context_versions(org_id,conversation_id,version,persona_version_id,rule_version_id,institutional_snapshot)
 values(new.org_id,v_conversation.id,coalesce(v_latest.version,0)+1,v_details.persona_version_id,v_details.rule_version_id,coalesce(v_profile,'{}'));
 return new;
end;$$;
revoke all on function private.apply_running_experiment_context() from public,anon,authenticated,service_role;
create trigger a_experiment_context_refresh before insert on public.ai_execution_requests for each row execute function private.apply_running_experiment_context();

-- Versioned checklist editor command. Files continue to live outside checklists.
create table public.checklist_template_requests(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,operation_id uuid not null,
 stage_code text not null check(stage_code in('proposal','reservation','documents','payment','sale')),name text not null check(char_length(trim(name)) between 2 and 160),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 50),
 actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,template_id uuid,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
 foreign key(operation_id,org_id) references public.operations(id,org_id) on delete cascade
);
create or replace function private.process_checklist_template_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_version integer;v_item jsonb;v_position integer:=0;
begin
 if new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'checklists.manage') then raise exception 'checklist_template_forbidden' using errcode='42501';end if;
 select coalesce(max(version),0)+1 into v_version from public.checklist_templates where operation_id=new.operation_id and stage_code=new.stage_code;
 update public.checklist_templates set status='archived' where operation_id=new.operation_id and stage_code=new.stage_code and status='published';
 insert into public.checklist_templates(org_id,operation_id,stage_code,name,version,status) values(new.org_id,new.operation_id,new.stage_code,trim(new.name),v_version,'published') returning id into new.template_id;
 for v_item in select value from jsonb_array_elements(new.items) loop v_position:=v_position+1;
   if nullif(trim(v_item->>'label'),'') is null then raise exception 'checklist_item_label_required' using errcode='22023';end if;
   insert into public.checklist_items(org_id,template_id,position,label,required) values(new.org_id,new.template_id,v_position,left(trim(v_item->>'label'),200),coalesce((v_item->>'required')::boolean,true));
 end loop;new.result:='published_v'||v_version::text;return new;
end;$$;
revoke all on function private.process_checklist_template_request() from public,anon,authenticated,service_role;
create trigger checklist_template_request_process before insert on public.checklist_template_requests for each row execute function private.process_checklist_template_request();

-- Aggregate-only platform view; tenant content remains behind explicit support grants.
create or replace function public.platform_organization_metrics()
returns table(org_id uuid,organization_name text,status text,active_members bigint,open_opportunities bigint,active_connections bigint,last_activity_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$ begin
 if not exists(select 1 from private.platform_principals where user_id=(select auth.uid()) and active) then raise exception 'platform_access_forbidden' using errcode='42501';end if;
 return query select o.id,o.name,o.status,(select count(*) from public.memberships m where m.org_id=o.id and m.status='active'),
   (select count(*) from public.opportunities op where op.org_id=o.id and op.status='open'),
   (select count(*) from public.whatsapp_connections w where w.org_id=o.id and w.status='active'),
   greatest((select max(op.updated_at) from public.opportunities op where op.org_id=o.id),(select max(c.updated_at) from public.conversations c where c.org_id=o.id))
 from public.organizations o order by o.name;end;$$;
revoke all on function public.platform_organization_metrics() from public,anon;
grant execute on function public.platform_organization_metrics() to authenticated,service_role;

drop policy if exists usage_ledger_select_owner on public.usage_ledger;
create policy usage_ledger_finance_select on public.usage_ledger for select to authenticated using(private.has_org_role(org_id,array['owner']::text[]) or private.has_org_permission(org_id,'finance.view'));
drop policy if exists budget_alerts_select_owner on public.budget_alerts;
create policy budget_alerts_finance_select on public.budget_alerts for select to authenticated using(private.has_org_role(org_id,array['owner']::text[]) or private.has_org_permission(org_id,'finance.view'));

alter table public.project_fact_conflict_resolution_requests enable row level security;
alter table public.checklist_template_requests enable row level security;
create policy fact_conflict_resolution_manager_select on public.project_fact_conflict_resolution_requests for select to authenticated using(private.has_org_permission(org_id,'ai.manage'));
create policy fact_conflict_resolution_manager_insert on public.project_fact_conflict_resolution_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'ai.manage'));
create policy checklist_template_request_manager_select on public.checklist_template_requests for select to authenticated using(private.has_org_permission(org_id,'checklists.manage'));
create policy checklist_template_request_manager_insert on public.checklist_template_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'checklists.manage'));
grant select,insert on public.project_fact_conflict_resolution_requests,public.checklist_template_requests to authenticated;
grant all on public.project_fact_conflict_resolution_requests,public.checklist_template_requests to service_role;

commit;
