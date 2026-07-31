begin;

create table public.rule_publish_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  rule_version_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (rule_version_id,org_id) references public.rule_versions(id,org_id) on delete restrict
);

create or replace function private.process_rule_publish_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_version public.rule_versions%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_role(new.org_id,array['owner']::text[]) then raise exception 'rule_publish_owner_required' using errcode='42501'; end if;
  select * into v_version from public.rule_versions where id=new.rule_version_id and org_id=new.org_id for update;
  if not found or v_version.status<>'draft' then raise exception 'rule_draft_required' using errcode='22023'; end if;
  if not exists(select 1 from public.regression_runs r where r.rule_version_id=v_version.id and r.status='passed' and r.critical_failures=0 and r.passed_cases=r.total_cases) then raise exception 'passing_regression_required' using errcode='22023'; end if;
  update public.rule_versions set status='archived',updated_at=now() where rule_set_id=v_version.rule_set_id and status='published';
  update public.rule_versions set status='published',published_by=new.actor_user_id,published_at=now(),updated_at=now() where id=v_version.id;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.actor_user_id,'rule.version_published','rule_versions',v_version.id,jsonb_build_object('version',v_version.version));
  new.processed_at:=now(); return new;
end; $$;
revoke all on function private.process_rule_publish_request() from public,anon,authenticated,service_role;
create trigger rule_publish_request_process before insert on public.rule_publish_requests for each row execute function private.process_rule_publish_request();

create or replace function private.audit_alert_transition()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.status is distinct from new.status then insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(new.org_id,(select auth.uid()),'alert.'||new.status,'alerts',new.id,jsonb_build_object('from',old.status,'to',new.status)); end if; return new;
end; $$;
revoke all on function private.audit_alert_transition() from public,anon,authenticated,service_role;
create trigger alerts_audit_transition after update on public.alerts for each row execute function private.audit_alert_transition();

create or replace function private.audit_learning_created()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,new.created_by,'learning.created','learning_suggestions',new.id,jsonb_build_object('source',new.source,'scope',new.scope)); return new; end; $$;
revoke all on function private.audit_learning_created() from public,anon,authenticated,service_role;
create trigger learning_suggestions_audit_insert after insert on public.learning_suggestions for each row execute function private.audit_learning_created();

alter table public.rule_publish_requests enable row level security;
create policy rule_publish_requests_actor_select on public.rule_publish_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy rule_publish_requests_owner_insert on public.rule_publish_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_role(org_id,array['owner']::text[])));
grant select,insert on public.rule_publish_requests to authenticated;
grant all on public.rule_publish_requests to service_role;

comment on table public.rule_publish_requests is 'Final human gate: owner can publish only after a fully passing regression with zero critical failures.';

commit;
