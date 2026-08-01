begin;

-- Keep the exposed RPCs as security-invoker wrappers. The privileged work
-- remains outside the exposed schema and retains its explicit authorization.
alter function public.log_support_access(uuid,text,text,uuid,jsonb) set schema private;
revoke all on function private.log_support_access(uuid,text,text,uuid,jsonb) from public, anon, service_role;
grant execute on function private.log_support_access(uuid,text,text,uuid,jsonb) to authenticated;

create function public.log_support_access(
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security invoker
set search_path = pg_catalog
as $$ select private.log_support_access(p_org_id,p_action,p_entity_type,p_entity_id,p_metadata) $$;
revoke all on function public.log_support_access(uuid,text,text,uuid,jsonb) from public, anon, service_role;
grant execute on function public.log_support_access(uuid,text,text,uuid,jsonb) to authenticated;

alter function public.platform_organization_metrics() set schema private;
revoke all on function private.platform_organization_metrics() from public, anon;
grant execute on function private.platform_organization_metrics() to authenticated, service_role;

create function public.platform_organization_metrics()
returns table(
  org_id uuid,
  organization_name text,
  status text,
  active_members bigint,
  open_opportunities bigint,
  active_connections bigint,
  last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select * from private.platform_organization_metrics() $$;
revoke all on function public.platform_organization_metrics() from public, anon;
grant execute on function public.platform_organization_metrics() to authenticated, service_role;

drop index if exists public.contact_archive_requests_contact_idx;
create index contact_archive_requests_contact_idx
  on public.contact_archive_requests (contact_id, org_id, created_at desc);
create index contact_archive_requests_org_idx
  on public.contact_archive_requests (org_id, created_at desc);
create index contact_archive_requests_actor_idx
  on public.contact_archive_requests (actor_user_id);

-- ALL also applies to SELECT and duplicated the read policy. Keep exactly one
-- read path and split the mutation authorization by command.
drop policy if exists checklist_waivers_manage on public.checklist_waivers;
create policy checklist_waivers_insert on public.checklist_waivers
for insert to authenticated with check (private.has_org_permission(org_id,'checklists.manage'));
create policy checklist_waivers_update on public.checklist_waivers
for update to authenticated using (private.has_org_permission(org_id,'checklists.manage'))
with check (private.has_org_permission(org_id,'checklists.manage'));
create policy checklist_waivers_delete on public.checklist_waivers
for delete to authenticated using (private.has_org_permission(org_id,'checklists.manage'));

drop policy if exists contact_tags_manager_all on public.contact_tags;
create policy contact_tags_insert on public.contact_tags
for insert to authenticated with check (private.has_org_permission(org_id,'contacts.manage'));
create policy contact_tags_update on public.contact_tags
for update to authenticated using (private.has_org_permission(org_id,'contacts.manage'))
with check (private.has_org_permission(org_id,'contacts.manage'));
create policy contact_tags_delete on public.contact_tags
for delete to authenticated using (private.has_org_permission(org_id,'contacts.manage'));

commit;
