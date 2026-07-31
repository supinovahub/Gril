begin;

create or replace function private.restore_human_qualification_after_conflict()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_previous_state text;
begin
  if new.result='conflict' and new.qualification_value_id is not null then
    select h.previous_value->>'state' into v_previous_state
    from public.qualification_value_history h
    where h.qualification_value_id=new.qualification_value_id and h.result='conflict'
    order by h.created_at desc limit 1;
    update public.qualification_values
    set state=coalesce(v_previous_state,'valid'), updated_at=now()
    where id=new.qualification_value_id and human_confirmed;
  end if;
  return new;
end;
$$;
revoke all on function private.restore_human_qualification_after_conflict()
from public,anon,authenticated,service_role;
create trigger qualification_value_request_restore_human
after insert on public.qualification_value_requests
for each row execute function private.restore_human_qualification_after_conflict();

drop policy qualification_definitions_manage on public.qualification_definitions;
create policy qualification_definitions_insert_manager on public.qualification_definitions for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy qualification_definitions_update_manager on public.qualification_definitions for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy qualification_definitions_delete_manager on public.qualification_definitions for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

drop policy projects_manage on public.projects;
create policy projects_insert_manager on public.projects for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy projects_update_manager on public.projects for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy projects_delete_manager on public.projects for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

drop policy project_facts_manage on public.project_facts;
create policy project_facts_insert_manager on public.project_facts for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_facts_update_manager on public.project_facts for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_facts_delete_manager on public.project_facts for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

drop policy project_media_manage on public.project_media;
create policy project_media_insert_manager on public.project_media for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_media_update_manager on public.project_media for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy project_media_delete_manager on public.project_media for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

drop policy faq_entries_manage on public.faq_entries;
create policy faq_entries_insert_manager on public.faq_entries for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_entries_update_manager on public.faq_entries for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_entries_delete_manager on public.faq_entries for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

drop policy faq_versions_manage on public.faq_versions;
create policy faq_versions_insert_manager on public.faq_versions for insert to authenticated with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_versions_update_manager on public.faq_versions for update to authenticated using ((select private.has_org_permission(org_id,'ai.manage'))) with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy faq_versions_delete_manager on public.faq_versions for delete to authenticated using ((select private.has_org_permission(org_id,'ai.manage')));

create index if not exists qualification_value_history_definition_idx on public.qualification_value_history (definition_id,org_id);
create index if not exists qualification_value_requests_opportunity_idx on public.qualification_value_requests (opportunity_id,created_at desc);
create index if not exists projects_operation_idx on public.projects (operation_id,org_id) where operation_id is not null;
create index if not exists project_facts_project_idx on public.project_facts (project_id,org_id);
create index if not exists project_media_project_idx on public.project_media (project_id,org_id);
create index if not exists faq_entries_project_idx on public.faq_entries (project_id,org_id) where project_id is not null;
create index if not exists project_matches_opportunity_idx on public.project_matches (opportunity_id,created_at desc);

commit;
