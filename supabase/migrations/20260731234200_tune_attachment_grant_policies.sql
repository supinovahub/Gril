begin;

-- Avoid overlapping permissive SELECT policies while retaining the same
-- manager write permissions and recipient visibility.
drop policy if exists attachment_grants_manage_manager on public.attachment_access_grants;

create policy attachment_grants_insert_manager
on public.attachment_access_grants
for insert
to authenticated
with check (
  private.has_org_role(org_id, array['owner', 'manager']::text[])
  and granted_by = (select auth.uid())
);

create policy attachment_grants_update_manager
on public.attachment_access_grants
for update
to authenticated
using (private.has_org_role(org_id, array['owner', 'manager']::text[]))
with check (
  private.has_org_role(org_id, array['owner', 'manager']::text[])
  and granted_by = (select auth.uid())
);

create policy attachment_grants_delete_manager
on public.attachment_access_grants
for delete
to authenticated
using (private.has_org_role(org_id, array['owner', 'manager']::text[]));

commit;
