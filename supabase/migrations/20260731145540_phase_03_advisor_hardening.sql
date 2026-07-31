begin;

drop policy conversation_access_grants_manage on public.conversation_access_grants;
create policy conversation_access_grants_insert_manager on public.conversation_access_grants
for insert to authenticated with check ((select private.has_org_permission(org_id, 'team.manage')));
create policy conversation_access_grants_update_manager on public.conversation_access_grants
for update to authenticated using ((select private.has_org_permission(org_id, 'team.manage')))
with check ((select private.has_org_permission(org_id, 'team.manage')));
create policy conversation_access_grants_delete_manager on public.conversation_access_grants
for delete to authenticated using ((select private.has_org_permission(org_id, 'team.manage')));

drop policy opt_outs_manage on public.opt_outs;
create policy opt_outs_insert_manager on public.opt_outs
for insert to authenticated with check ((select private.can_manage_crm(org_id)));
create policy opt_outs_update_manager on public.opt_outs
for update to authenticated using ((select private.can_manage_crm(org_id)))
with check ((select private.can_manage_crm(org_id)));
create policy opt_outs_delete_manager on public.opt_outs
for delete to authenticated using ((select private.can_manage_crm(org_id)));

drop policy suppression_entries_manage on public.suppression_entries;
create policy suppression_entries_insert_manager on public.suppression_entries
for insert to authenticated with check ((select private.can_manage_crm(org_id)));
create policy suppression_entries_update_manager on public.suppression_entries
for update to authenticated using ((select private.can_manage_crm(org_id)))
with check ((select private.can_manage_crm(org_id)));
create policy suppression_entries_delete_manager on public.suppression_entries
for delete to authenticated using ((select private.can_manage_crm(org_id)));

create index if not exists conversations_contact_idx on public.conversations (contact_id, org_id);
create index if not exists conversations_assignee_idx on public.conversations (assigned_membership_id, org_id) where assigned_membership_id is not null;
create index if not exists messages_operation_idx on public.messages (operation_id, org_id);
create index if not exists messages_sender_idx on public.messages (sender_user_id) where sender_user_id is not null;
create index if not exists opt_outs_contact_idx on public.opt_outs (contact_id, org_id);
create index if not exists conversation_access_membership_idx on public.conversation_access_grants (membership_id, org_id);

commit;
