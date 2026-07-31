begin;

drop policy availability_exceptions_manage on public.availability_exceptions;
create policy availability_exceptions_insert on public.availability_exceptions for insert to authenticated with check(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_exceptions_update on public.availability_exceptions for update to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage'))) with check(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));
create policy availability_exceptions_delete on public.availability_exceptions for delete to authenticated using(membership_id=(select private.current_membership_id(org_id)) or (select private.has_org_permission(org_id,'team.manage')));

drop policy opportunity_checklists_manage on public.opportunity_checklists;
create policy opportunity_checklists_insert on public.opportunity_checklists for insert to authenticated with check((select private.can_access_opportunity(opportunity_id)));
create policy opportunity_checklists_update on public.opportunity_checklists for update to authenticated using((select private.can_access_opportunity(opportunity_id))) with check((select private.can_access_opportunity(opportunity_id)));
create policy opportunity_checklists_delete on public.opportunity_checklists for delete to authenticated using((select private.can_access_opportunity(opportunity_id)));

commit;
