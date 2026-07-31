begin;

alter table public.ai_execution_requests
  add constraint ai_execution_requests_live_conversation_check
  check (mode in ('simulator', 'regression') or conversation_id is not null);

drop policy personas_manage_manager on public.personas;
create policy personas_insert_manager on public.personas for insert to authenticated
with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy personas_update_manager on public.personas for update to authenticated
using ((select private.has_org_permission(org_id,'ai.manage')))
with check ((select private.has_org_permission(org_id,'ai.manage')));
create policy personas_delete_manager on public.personas for delete to authenticated
using (status='archived' and (select private.has_org_permission(org_id,'ai.manage')));

create index if not exists persona_versions_created_by_idx on public.persona_versions (created_by) where created_by is not null;
create index if not exists persona_versions_published_by_idx on public.persona_versions (published_by) where published_by is not null;
create index if not exists model_profiles_created_by_idx on public.model_profiles (created_by) where created_by is not null;
create index if not exists conversation_context_persona_idx on public.conversation_context_versions (persona_version_id, org_id);
create index if not exists conversation_context_rules_idx on public.conversation_context_versions (rule_version_id, org_id);
create index if not exists ai_executions_model_idx on public.ai_executions (model_profile_id, org_id) where model_profile_id is not null;
create index if not exists ai_suggestions_conversation_idx on public.ai_suggestions (conversation_id, status) where conversation_id is not null;
create index if not exists escalations_conversation_idx on public.escalations (conversation_id, org_id) where conversation_id is not null;
create index if not exists escalations_opportunity_idx on public.escalations (opportunity_id, org_id) where opportunity_id is not null;

commit;
