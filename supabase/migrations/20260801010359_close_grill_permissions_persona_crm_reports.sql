begin;

-- ---------------------------------------------------------------------------
-- Granular permissions, ownership transfer and contractual support access
-- ---------------------------------------------------------------------------

alter table public.membership_permissions drop constraint membership_permissions_permission_check;
alter table public.membership_permissions add constraint membership_permissions_permission_check check(permission in(
  'settings.manage','team.manage','operations.manage','contacts.manage','campaigns.manage','pipeline.manage','reports.view','ai.manage',
  'finance.view','privacy.manage','ownership.transfer','managers.create','exports.create','checklists.manage'
));

create table public.ownership_transfer_requests(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  target_membership_id uuid not null,requested_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete restrict,status text not null default 'pending' check(status in('pending','accepted','cancelled','expired')),
  reauthenticated_at timestamptz not null,expires_at timestamptz not null default now()+interval '7 days',
  accepted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(target_membership_id,org_id) references public.memberships(id,org_id) on delete restrict,
  check(expires_at>created_at),unique(org_id) deferrable initially immediate
);

create or replace function private.process_ownership_transfer_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_old_owner public.memberships%rowtype;v_target public.memberships%rowtype;v_permission text;
begin
  if tg_op='INSERT' then
    if new.requested_by<>(select auth.uid()) or not private.has_org_role(new.org_id,array['owner']::text[])
       or new.reauthenticated_at<now()-interval '10 minutes' then raise exception 'ownership_transfer_forbidden_or_reauth_expired' using errcode='42501';end if;
    select * into v_target from public.memberships where id=new.target_membership_id and org_id=new.org_id and status='active';
    if not found or v_target.user_id=new.requested_by then raise exception 'ownership_target_must_be_another_active_member' using errcode='22023';end if;
    return new;
  end if;
  if old.status<>'pending' or new.status<>'accepted' or old.expires_at<=now() then raise exception 'ownership_transfer_not_acceptible' using errcode='22023';end if;
  select * into v_target from public.memberships where id=old.target_membership_id and org_id=old.org_id and status='active' for update;
  if (select auth.uid())<>v_target.user_id or new.accepted_by<>v_target.user_id then raise exception 'ownership_acceptance_forbidden' using errcode='42501';end if;
  select * into v_old_owner from public.memberships where org_id=old.org_id and role='owner' and status='active' for update;
  update public.memberships set role='manager',updated_at=now() where id=v_old_owner.id;
  delete from public.membership_permissions where membership_id=v_old_owner.id;
  foreach v_permission in array array['settings.manage','team.manage','operations.manage','contacts.manage','campaigns.manage','pipeline.manage','reports.view','ai.manage','finance.view','privacy.manage','exports.create','checklists.manage'] loop
    insert into public.membership_permissions(membership_id,permission) values(v_old_owner.id,v_permission) on conflict do nothing;
  end loop;
  update public.memberships set role='owner',updated_at=now() where id=v_target.id;
  delete from public.membership_permissions where membership_id=v_target.id;
  new.accepted_at:=now();new.updated_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(old.org_id,v_target.user_id,'organization.ownership_transferred','organizations',old.org_id,
    jsonb_build_object('previous_owner_membership_id',v_old_owner.id,'new_owner_membership_id',v_target.id));
  return new;
end;$$;
revoke all on function private.process_ownership_transfer_request() from public,anon,authenticated,service_role;
create trigger ownership_transfer_insert before insert on public.ownership_transfer_requests for each row execute function private.process_ownership_transfer_request();
create trigger ownership_transfer_accept before update of status on public.ownership_transfer_requests for each row
when(new.status='accepted') execute function private.process_ownership_transfer_request();

create table private.platform_principals(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in('platform_admin','support')),active boolean not null default true,
  created_at timestamptz not null default now(),created_by uuid references auth.users(id) on delete set null
);
create table private.contractual_support_grants(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
  access_level text not null default 'full' check(access_level in('read_only','full')),starts_at timestamptz not null default now(),
  expires_at timestamptz,contract_reference text not null,active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,revoked_at timestamptz,revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),check(expires_at is null or expires_at>starts_at)
);
create unique index contractual_support_one_active_idx on private.contractual_support_grants(org_id) where active and revoked_at is null;
create table private.support_audit_events(
  id bigint generated always as identity primary key,org_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,action text not null,entity_type text not null,entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now()
);
create index support_audit_events_org_idx on private.support_audit_events(org_id,occurred_at desc);

create or replace function private.has_contractual_support(p_org_id uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from private.platform_principals pp join private.contractual_support_grants g on g.org_id=p_org_id
   where pp.user_id=(select auth.uid()) and pp.active and g.active and g.revoked_at is null
     and (g.expires_at is null or g.expires_at>now()) and (not p_write or g.access_level='full'));
$$;
revoke all on function private.has_contractual_support(uuid,boolean) from public,anon,service_role;
grant execute on function private.has_contractual_support(uuid,boolean) to authenticated;

create or replace function private.is_active_org_member(p_org_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active')
   or private.has_contractual_support(p_org_id,false);$$;
create or replace function private.has_org_role(p_org_id uuid,p_roles text[]) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active' and m.role=any(p_roles))
   or private.has_contractual_support(p_org_id,false);$$;
create or replace function private.has_org_permission(p_org_id uuid,p_permission text) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.memberships m where m.org_id=p_org_id and m.user_id=(select auth.uid()) and m.status='active'
   and(m.role='owner' or(m.role='manager' and exists(select 1 from public.membership_permissions mp where mp.membership_id=m.id and mp.permission=p_permission))))
   or private.has_contractual_support(p_org_id,true);$$;
create or replace function private.has_operation_access(p_operation_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.operations o where o.id=p_operation_id and o.status<>'archived' and(
   private.has_contractual_support(o.org_id,false) or exists(select 1 from public.memberships m where m.org_id=o.org_id and m.user_id=(select auth.uid()) and m.status='active'
     and(m.role in('owner','manager') or exists(select 1 from public.membership_operations mo where mo.membership_id=m.id and mo.operation_id=o.id)))));$$;
create or replace function private.can_access_opportunity(p_opportunity_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.opportunities o where o.id=p_opportunity_id and private.has_operation_access(o.operation_id) and(
   private.has_contractual_support(o.org_id,false) or exists(select 1 from public.memberships m where m.org_id=o.org_id and m.user_id=(select auth.uid()) and m.status='active'
     and(m.role in('owner','manager') or o.assigned_membership_id=m.id))));$$;
create or replace function private.can_access_conversation(p_conversation_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.conversations c where c.id=p_conversation_id and private.has_operation_access(c.operation_id) and(
   private.has_contractual_support(c.org_id,false) or exists(select 1 from public.memberships m where m.org_id=c.org_id and m.user_id=(select auth.uid()) and m.status='active'
     and(m.role in('owner','manager') or(c.assigned_membership_id=m.id and exists(select 1 from public.conversation_access_grants g where g.conversation_id=c.id and g.membership_id=m.id and g.starts_at<=now() and(g.expires_at is null or g.expires_at>now()) and g.revoked_at is null))))));$$;
create or replace function private.can_view_contact_phone(p_contact_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.contacts c where c.id=p_contact_id and(
   private.has_contractual_support(c.org_id,false) or exists(select 1 from public.memberships m where m.org_id=c.org_id and m.user_id=(select auth.uid()) and m.status='active'
     and(m.role in('owner','manager') or exists(select 1 from public.conversations conv where conv.contact_id=c.id and private.can_access_conversation(conv.id))))));$$;

create or replace function public.log_support_access(p_org_id uuid,p_action text,p_entity_type text,p_entity_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$ begin
 if not private.has_contractual_support(p_org_id,false) then raise exception 'support_access_forbidden' using errcode='42501';end if;
 insert into private.support_audit_events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(p_org_id,(select auth.uid()),left(p_action,160),left(p_entity_type,120),p_entity_id,coalesce(p_metadata,'{}'));
end;$$;
revoke all on function public.log_support_access(uuid,text,text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.log_support_access(uuid,text,text,uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Guided persona samples and deterministic experiments
-- ---------------------------------------------------------------------------

create table public.persona_samples(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
  persona_id uuid not null,raw_text text not null check(char_length(raw_text) between 10 and 20000),masked_text text,
  extraction jsonb not null default '{}'::jsonb,status text not null default 'draft' check(status in('draft','confirmed','discarded','purged')),
  purge_after timestamptz not null default now()+interval '30 days',created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(persona_id,org_id) references public.personas(id,org_id) on delete cascade
);
create index persona_samples_purge_idx on public.persona_samples(status,purge_after);

create table public.experiment_transition_requests(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null,action text not null check(action in('start','pause','resume','complete','cancel','promote_winner')),
  winner_variant_id uuid,reason text,actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
  foreign key(experiment_id,org_id) references public.experiments(id,org_id) on delete cascade
);
create or replace function private.process_experiment_transition()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_experiment public.experiments%rowtype;v_count integer;v_allocation integer;
begin
 if new.actor_user_id<>(select auth.uid()) then raise exception 'experiment_actor_mismatch' using errcode='42501';end if;
 select * into v_experiment from public.experiments where id=new.experiment_id and org_id=new.org_id for update;
 if not found then raise exception 'experiment_not_found' using errcode='22023';end if;
 if new.action='pause' then
   if not(private.has_org_role(new.org_id,array['owner']::text[]) or private.has_org_permission(new.org_id,'ai.manage')) then raise exception 'experiment_pause_forbidden' using errcode='42501';end if;
   update public.experiments set status='paused',updated_at=now() where id=v_experiment.id;new.result:='paused';
 else
   if not private.has_org_role(new.org_id,array['owner']::text[]) then raise exception 'experiment_owner_required' using errcode='42501';end if;
   if new.action in('start','resume') then
     select count(*),coalesce(sum(allocation_percent),0) into v_count,v_allocation from public.experiment_variants where experiment_id=v_experiment.id and status='active';
     if v_count<>2 or v_allocation<>100 or exists(select 1 from public.experiment_variants v left join public.persona_versions pv on pv.id=v.persona_version_id left join public.rule_versions rv on rv.id=v.rule_version_id where v.experiment_id=v_experiment.id and(pv.status<>'published' or rv.status<>'published')) then
       raise exception 'experiment_requires_two_approved_variants_totaling_100' using errcode='22023';end if;
     update public.experiments set status='running',starts_at=coalesce(starts_at,now()),ends_at=null,updated_at=now() where id=v_experiment.id;new.result:='running';
   elsif new.action in('complete','promote_winner') then
     if new.action='promote_winner' and not exists(select 1 from public.experiment_variants where id=new.winner_variant_id and experiment_id=v_experiment.id) then raise exception 'winner_variant_invalid' using errcode='22023';end if;
     update public.experiments set status='completed',ends_at=now(),updated_at=now() where id=v_experiment.id;
     if new.winner_variant_id is not null then update public.experiment_variants set status=case when id=new.winner_variant_id then 'winner' else 'loser' end where experiment_id=v_experiment.id;end if;
     new.result:='completed';
   elsif new.action='cancel' then update public.experiments set status='cancelled',ends_at=now(),updated_at=now() where id=v_experiment.id;new.result:='cancelled';end if;
 end if;
 insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.actor_user_id,'experiment.'||new.action,'experiments',new.experiment_id,jsonb_build_object('result',new.result,'winner',new.winner_variant_id));return new;
end;$$;
revoke all on function private.process_experiment_transition() from public,anon,authenticated,service_role;
create trigger experiment_transition_process before insert on public.experiment_transition_requests for each row execute function private.process_experiment_transition();

create or replace function public.assign_experiment_variant(p_experiment_id uuid,p_opportunity_id uuid,p_conversation_id uuid default null)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_experiment public.experiments%rowtype;v_org uuid;v_contact uuid;v_key text;v_variant uuid;v_bucket integer;v_running integer:=0;v_row record;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501';end if;
 select * into v_experiment from public.experiments where id=p_experiment_id and status='running';if not found then return null;end if;
 select org_id,contact_id into v_org,v_contact from public.opportunities where id=p_opportunity_id and org_id=v_experiment.org_id;if not found then return null;end if;
 v_key:='contact:'||v_contact::text;
 select variant_id into v_variant from public.experiment_assignments where experiment_id=p_experiment_id and assignment_key=v_key;if found then return v_variant;end if;
 v_bucket:=abs(hashtext(p_experiment_id::text||':'||v_key))%100;
 for v_row in select id,allocation_percent from public.experiment_variants where experiment_id=p_experiment_id and status='active' order by id loop
   v_running:=v_running+v_row.allocation_percent;if v_bucket<v_running then v_variant:=v_row.id;exit;end if;end loop;
 if v_variant is null then return null;end if;
 insert into public.experiment_assignments(org_id,experiment_id,variant_id,opportunity_id,conversation_id,assignment_key)
 values(v_org,p_experiment_id,v_variant,p_opportunity_id,p_conversation_id,v_key) on conflict(experiment_id,assignment_key) do update set assignment_key=excluded.assignment_key returning variant_id into v_variant;
 return v_variant;
end;$$;
revoke all on function public.assign_experiment_variant(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_experiment_variant(uuid,uuid,uuid) to service_role;

create or replace function private.pause_experiment_on_critical_error()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$ begin
 if new.severity='critical' then update public.experiments set status='paused',updated_at=now() where id=new.experiment_id and status='running';
   update public.experiment_variants set critical_errors=critical_errors+1 where id=new.variant_id;end if;return new;end;$$;
revoke all on function private.pause_experiment_on_critical_error() from public,anon,authenticated,service_role;
create trigger experiment_critical_error_pause after insert on public.experiment_events for each row execute function private.pause_experiment_on_critical_error();

-- ---------------------------------------------------------------------------
-- Safe bulk CRM, checklist waivers and export lifecycle
-- ---------------------------------------------------------------------------

create table public.contact_tags(id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 contact_id uuid not null,label text not null check(char_length(trim(label)) between 1 and 60),created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),foreign key(contact_id,org_id) references public.contacts(id,org_id) on delete cascade,unique(contact_id,label));
create table public.crm_bulk_action_requests(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 contact_ids uuid[] not null check(cardinality(contact_ids) between 1 and 500),action text not null check(action in('tag_add','tag_remove','campaign_include','campaign_exclude','assign_manager','pause_ai','resume_ai','correct_source')),
 payload jsonb not null default '{}'::jsonb,preview_count integer not null default 0,result jsonb not null default '{}'::jsonb,
 actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create or replace function private.process_crm_bulk_action()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;v_label text;v_manager uuid;v_campaign uuid;
begin
 if new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'contacts.manage') then raise exception 'bulk_crm_forbidden' using errcode='42501';end if;
 select count(*) into v_count from public.contacts where org_id=new.org_id and id=any(new.contact_ids);
 if v_count<>cardinality(new.contact_ids) then raise exception 'bulk_contacts_cross_tenant_or_missing' using errcode='22023';end if;new.preview_count:=v_count;
 if new.action in('tag_add','tag_remove') then v_label:=nullif(trim(new.payload->>'label'),'');if v_label is null then raise exception 'bulk_tag_required' using errcode='22023';end if;
   if new.action='tag_add' then insert into public.contact_tags(org_id,contact_id,label,created_by) select new.org_id,unnest(new.contact_ids),v_label,new.actor_user_id on conflict do nothing;
   else delete from public.contact_tags where org_id=new.org_id and contact_id=any(new.contact_ids) and label=v_label;end if;
 elsif new.action='assign_manager' then v_manager:=(new.payload->>'membership_id')::uuid;
   if not exists(select 1 from public.memberships where id=v_manager and org_id=new.org_id and role in('owner','manager') and status='active') then raise exception 'bulk_manager_invalid' using errcode='22023';end if;
   update public.opportunities set assigned_membership_id=v_manager,version=version+1,updated_at=now() where org_id=new.org_id and contact_id=any(new.contact_ids) and status='open';
 elsif new.action='pause_ai' then update public.conversations set status='paused',ownership='pending_handoff',pause_reason='bulk_manager_pause',version=version+1,updated_at=now() where org_id=new.org_id and contact_id=any(new.contact_ids);
 elsif new.action='resume_ai' then update public.conversations c set status='active',ownership='ai',pause_reason=null,version=version+1,updated_at=now()
   where c.org_id=new.org_id and c.contact_id=any(new.contact_ids) and not exists(select 1 from public.opt_outs o where o.contact_id=c.contact_id and o.operation_id=c.operation_id and o.revoked_at is null);
 elsif new.action='correct_source' then if nullif(trim(new.payload->>'source'),'') is null then raise exception 'bulk_source_required' using errcode='22023';end if;
   update public.opportunities set source=left(trim(new.payload->>'source'),80),version=version+1,updated_at=now() where org_id=new.org_id and contact_id=any(new.contact_ids) and status='open';
 elsif new.action in('campaign_include','campaign_exclude') then v_campaign:=(new.payload->>'campaign_id')::uuid;
   if not exists(select 1 from public.campaigns where id=v_campaign and org_id=new.org_id and status in('draft','pending_approval','approved','paused')) then raise exception 'bulk_campaign_invalid' using errcode='22023';end if;
   if new.action='campaign_exclude' then update public.campaign_contacts set status='suppressed',suppression_reason='manager_bulk_exclusion',updated_at=now() where campaign_id=v_campaign and contact_id=any(new.contact_ids) and status='ready';
   else update public.campaign_contacts set status='ready',suppression_reason=null,updated_at=now() where campaign_id=v_campaign and contact_id=any(new.contact_ids) and status='suppressed' and suppression_reason='manager_bulk_exclusion';end if;
 end if;
 new.result:=jsonb_build_object('processed',v_count,'action',new.action);
 insert into audit.events(org_id,actor_user_id,action,entity_type,metadata) values(new.org_id,new.actor_user_id,'crm.bulk_'||new.action,'contacts',jsonb_build_object('count',v_count));return new;
end;$$;
revoke all on function private.process_crm_bulk_action() from public,anon,authenticated,service_role;
create trigger crm_bulk_action_process before insert on public.crm_bulk_action_requests for each row execute function private.process_crm_bulk_action();

create table public.crm_export_requests(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 contact_ids uuid[] not null check(cardinality(contact_ids) between 1 and 5000),status text not null default 'queued' check(status in('queued','completed','failed','expired')),
 storage_bucket text,storage_path text,expires_at timestamptz,error_redacted text,actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),completed_at timestamptz
);
create index crm_exports_expiry_idx on public.crm_export_requests(status,expires_at);

create table public.checklist_waivers(
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 opportunity_checklist_id uuid not null references public.opportunity_checklists(id) on delete cascade,item_code text not null,
 reason text not null check(char_length(trim(reason)) between 5 and 1000),waived_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),unique(opportunity_checklist_id,item_code)
);

-- ---------------------------------------------------------------------------
-- Cost projection in BRL without hard-coded vendor pricing
-- ---------------------------------------------------------------------------

alter table public.organization_settings add column ai_monthly_budget_brl numeric(14,2) check(ai_monthly_budget_brl is null or ai_monthly_budget_brl>=0);
alter table public.usage_ledger add column provider_currency text not null default 'USD',add column provider_cost_original numeric(16,8) not null default 0,
 add column fx_rate_to_brl numeric(16,8),add column estimated_cost_brl numeric(16,8) not null default 0;
create table private.model_pricing_registry(
 id uuid primary key default gen_random_uuid(),provider text not null,model_identifier text not null,currency text not null,
 input_cost_per_million numeric(16,8) not null check(input_cost_per_million>=0),output_cost_per_million numeric(16,8) not null check(output_cost_per_million>=0),
 effective_from timestamptz not null,effective_until timestamptz,source_reference text not null,created_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),unique(provider,model_identifier,effective_from)
);
create table private.fx_rates(
 rate_date date not null,currency text not null,rate_to_brl numeric(16,8) not null check(rate_to_brl>0),source_reference text not null,created_at timestamptz not null default now(),primary key(rate_date,currency)
);
create or replace function private.price_usage_ledger()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_price private.model_pricing_registry%rowtype;v_fx numeric;
begin
 select * into v_price from private.model_pricing_registry where provider='openai' and model_identifier=new.model_identifier and effective_from<=new.recorded_at and(effective_until is null or effective_until>new.recorded_at) order by effective_from desc limit 1;
 if found then new.provider_currency:=v_price.currency;new.provider_cost_original:=(new.input_tokens*v_price.input_cost_per_million+new.output_tokens*v_price.output_cost_per_million)/1000000;
   select rate_to_brl into v_fx from private.fx_rates where currency=v_price.currency and rate_date<=new.recorded_at::date order by rate_date desc limit 1;
   new.fx_rate_to_brl:=v_fx;new.estimated_cost_brl:=case when v_fx is null then 0 else new.provider_cost_original*v_fx end;new.estimated_cost:=new.provider_cost_original;
 end if;return new;
end;$$;
revoke all on function private.price_usage_ledger() from public,anon,authenticated,service_role;
create trigger usage_ledger_price before insert on public.usage_ledger for each row execute function private.price_usage_ledger();
create or replace function private.create_budget_alerts()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_budget numeric;v_total numeric;v_threshold integer;
begin
 select ai_monthly_budget_brl into v_budget from public.organization_settings where org_id=new.org_id;if coalesce(v_budget,0)<=0 then return new;end if;
 select coalesce(sum(estimated_cost_brl),0) into v_total from public.usage_ledger where org_id=new.org_id and recorded_at>=date_trunc('month',new.recorded_at);
 foreach v_threshold in array array[50,80,100] loop if v_total>=v_budget*v_threshold/100 then
   insert into public.budget_alerts(org_id,threshold_percent,period_start,current_cost,budget) values(new.org_id,v_threshold,date_trunc('month',new.recorded_at)::date,v_total,v_budget) on conflict do nothing;
 end if;end loop;return new;
end;$$;
revoke all on function private.create_budget_alerts() from public,anon,authenticated,service_role;
create trigger usage_ledger_budget_alert after insert on public.usage_ledger for each row execute function private.create_budget_alerts();

-- Defaults are advisory. General automatic erasure remains explicitly opt-in;
-- sensitive mistaken documents always keep the closed 30-day ceiling.
alter table public.retention_policies add column automatic_enabled boolean not null default false;
insert into public.retention_policies(org_id,data_class,retention_days,action,active,automatic_enabled)
select id,'contact',730,'anonymize',true,false from public.organizations on conflict(org_id,data_class) do nothing;
insert into public.retention_policies(org_id,data_class,retention_days,action,active,automatic_enabled)
select id,'sensitive_attachment',30,'delete',true,true from public.organizations on conflict(org_id,data_class) do update set retention_days=30,action='delete',active=true,automatic_enabled=true;
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['image/jpeg','image/png','application/pdf']::text[] where id='gril-projects';

-- ---------------------------------------------------------------------------
-- RLS and explicit Data API grants for every new public table
-- ---------------------------------------------------------------------------

alter table public.ownership_transfer_requests enable row level security;
alter table public.persona_samples enable row level security;
alter table public.experiment_transition_requests enable row level security;
alter table public.contact_tags enable row level security;
alter table public.crm_bulk_action_requests enable row level security;
alter table public.crm_export_requests enable row level security;
alter table public.checklist_waivers enable row level security;
alter table public.project_media_uploads enable row level security;
alter table public.project_media_deliveries enable row level security;
alter table public.project_fact_conflicts enable row level security;
alter table public.privacy_action_requests enable row level security;

create policy ownership_transfer_owner_select on public.ownership_transfer_requests for select to authenticated using(private.has_org_role(org_id,array['owner']::text[]) or target_membership_id=private.current_membership_id(org_id));
create policy ownership_transfer_owner_insert on public.ownership_transfer_requests for insert to authenticated with check(requested_by=(select auth.uid()) and private.has_org_role(org_id,array['owner']::text[]));
create policy ownership_transfer_target_update on public.ownership_transfer_requests for update to authenticated using(target_membership_id=private.current_membership_id(org_id)) with check(target_membership_id=private.current_membership_id(org_id));
create policy persona_samples_manager_all on public.persona_samples for all to authenticated using(private.has_org_permission(org_id,'ai.manage')) with check(created_by=(select auth.uid()) and private.has_org_permission(org_id,'ai.manage'));
create policy experiment_transition_manager_select on public.experiment_transition_requests for select to authenticated using(private.has_org_permission(org_id,'ai.manage'));
create policy experiment_transition_manager_insert on public.experiment_transition_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'ai.manage'));
create policy contact_tags_visible on public.contact_tags for select to authenticated using(private.can_access_contact(contact_id));
create policy contact_tags_manager_all on public.contact_tags for all to authenticated using(private.has_org_permission(org_id,'contacts.manage')) with check(private.has_org_permission(org_id,'contacts.manage'));
create policy crm_bulk_manager_select on public.crm_bulk_action_requests for select to authenticated using(private.has_org_permission(org_id,'contacts.manage'));
create policy crm_bulk_manager_insert on public.crm_bulk_action_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'contacts.manage'));
create policy crm_export_manager_select on public.crm_export_requests for select to authenticated using(actor_user_id=(select auth.uid()) or private.has_org_permission(org_id,'exports.create'));
create policy crm_export_manager_insert on public.crm_export_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'exports.create'));
create policy checklist_waivers_visible on public.checklist_waivers for select to authenticated using(private.can_access_opportunity((select opportunity_id from public.opportunity_checklists where id=opportunity_checklist_id)));
create policy checklist_waivers_manage on public.checklist_waivers for all to authenticated using(private.has_org_permission(org_id,'checklists.manage')) with check(waived_by=(select auth.uid()) and private.has_org_permission(org_id,'checklists.manage'));
create policy project_media_uploads_manager_select on public.project_media_uploads for select to authenticated using(private.has_org_permission(org_id,'ai.manage'));
create policy project_media_uploads_manager_insert on public.project_media_uploads for insert to authenticated with check(actor_user_id=(select auth.uid()) and private.has_org_permission(org_id,'ai.manage'));
create policy project_media_deliveries_manager_select on public.project_media_deliveries for select to authenticated using(private.has_org_permission(org_id,'ai.manage'));
create policy project_fact_conflicts_manager_all on public.project_fact_conflicts for all to authenticated using(private.has_org_permission(org_id,'ai.manage')) with check(created_by=(select auth.uid()) and private.has_org_permission(org_id,'ai.manage'));
create policy privacy_actions_manager_select on public.privacy_action_requests for select to authenticated using(private.has_org_permission(org_id,'privacy.manage') or private.has_org_role(org_id,array['owner','manager']::text[]));
create policy privacy_actions_manager_insert on public.privacy_action_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and(private.has_org_permission(org_id,'privacy.manage') or private.has_org_role(org_id,array['owner','manager']::text[])));

grant select,insert,update on public.ownership_transfer_requests to authenticated;
grant select,insert,update,delete on public.persona_samples to authenticated;
grant select,insert on public.experiment_transition_requests to authenticated;
grant select,insert,update,delete on public.contact_tags to authenticated;
grant select,insert on public.crm_bulk_action_requests,public.crm_export_requests to authenticated;
grant select,insert,update,delete on public.checklist_waivers to authenticated;
grant select,insert on public.project_media_uploads to authenticated;
grant select on public.project_media_deliveries to authenticated;
grant select,insert,update on public.project_fact_conflicts to authenticated;
grant select,insert on public.privacy_action_requests to authenticated;
grant all on public.ownership_transfer_requests,public.persona_samples,public.experiment_transition_requests,public.contact_tags,
 public.crm_bulk_action_requests,public.crm_export_requests,public.checklist_waivers,public.project_media_uploads,public.project_media_deliveries,
 public.project_fact_conflicts,public.privacy_action_requests to service_role;

commit;
