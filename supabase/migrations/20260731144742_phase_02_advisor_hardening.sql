begin;

drop policy loss_reasons_manage on public.loss_reasons;

create policy loss_reasons_insert_manager
on public.loss_reasons for insert to authenticated
with check ((select private.can_manage_crm(org_id)) and not is_system);

create policy loss_reasons_update_manager
on public.loss_reasons for update to authenticated
using ((select private.can_manage_crm(org_id)) and not is_system)
with check ((select private.can_manage_crm(org_id)) and not is_system);

create policy loss_reasons_delete_manager
on public.loss_reasons for delete to authenticated
using ((select private.can_manage_crm(org_id)) and not is_system);

create index if not exists contact_phones_org_idx on public.contact_phones (org_id);
create index if not exists contacts_merged_into_idx on public.contacts (merged_into_contact_id) where merged_into_contact_id is not null;
create index if not exists lead_creation_requests_actor_idx on public.lead_creation_requests (actor_user_id, created_at desc);
create index if not exists lead_creation_requests_opportunity_idx on public.lead_creation_requests (opportunity_id) where opportunity_id is not null;
create index if not exists next_actions_opportunity_idx on public.next_actions (opportunity_id, status);
create index if not exists opportunities_operation_org_idx on public.opportunities (operation_id, org_id);
create index if not exists opportunities_stage_org_idx on public.opportunities (pipeline_stage_id, org_id);
create index if not exists opportunity_participants_contact_idx on public.opportunity_participants (contact_id, org_id);
create index if not exists stage_change_requests_opportunity_idx on public.opportunity_stage_change_requests (opportunity_id, created_at desc);
create index if not exists stage_history_from_idx on public.opportunity_stage_history (from_stage_id, org_id) where from_stage_id is not null;
create index if not exists stage_history_to_idx on public.opportunity_stage_history (to_stage_id, org_id);
create index if not exists sales_operation_idx on public.sales (operation_id, org_id);
create index if not exists sales_responsible_idx on public.sales (responsible_membership_id, org_id) where responsible_membership_id is not null;
create index if not exists source_attributions_contact_idx on public.source_attributions (contact_id, org_id);

commit;
