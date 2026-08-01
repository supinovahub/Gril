begin;

create index checklist_template_requests_operation_org_idx on public.checklist_template_requests(operation_id,org_id);
create index checklist_template_requests_org_idx on public.checklist_template_requests(org_id);
create index checklist_template_requests_actor_idx on public.checklist_template_requests(actor_user_id);

create index crm_bulk_action_requests_org_idx on public.crm_bulk_action_requests(org_id,created_at desc);
create index crm_bulk_action_requests_actor_idx on public.crm_bulk_action_requests(actor_user_id);
create index crm_export_requests_org_idx on public.crm_export_requests(org_id,created_at desc);
create index crm_export_requests_actor_idx on public.crm_export_requests(actor_user_id);

create index experiment_transition_requests_experiment_org_idx on public.experiment_transition_requests(experiment_id,org_id);
create index experiment_transition_requests_org_idx on public.experiment_transition_requests(org_id,created_at desc);
create index experiment_transition_requests_actor_idx on public.experiment_transition_requests(actor_user_id);

create index ownership_transfer_requests_target_org_idx on public.ownership_transfer_requests(target_membership_id,org_id);
create index ownership_transfer_requests_requested_by_idx on public.ownership_transfer_requests(requested_by);
create index ownership_transfer_requests_accepted_by_idx on public.ownership_transfer_requests(accepted_by) where accepted_by is not null;

create index persona_samples_persona_org_idx on public.persona_samples(persona_id,org_id);
create index persona_samples_org_idx on public.persona_samples(org_id,created_at desc);
create index persona_samples_created_by_idx on public.persona_samples(created_by);

create index project_fact_conflicts_project_org_idx on public.project_fact_conflicts(project_id,org_id);
create index project_fact_conflicts_org_idx on public.project_fact_conflicts(org_id,status,created_at desc);
create index project_fact_conflicts_current_fact_idx on public.project_fact_conflicts(current_fact_id) where current_fact_id is not null;
create index project_fact_conflicts_created_by_idx on public.project_fact_conflicts(created_by);
create index project_fact_conflicts_resolved_by_idx on public.project_fact_conflicts(resolved_by) where resolved_by is not null;

create index project_media_org_idx on public.project_media(org_id,active,created_at desc);
create index project_media_published_by_idx on public.project_media(published_by) where published_by is not null;
create index project_media_deliveries_execution_org_idx on public.project_media_deliveries(ai_execution_id,org_id);
create index project_media_deliveries_org_idx on public.project_media_deliveries(org_id,created_at desc);
create index project_media_deliveries_media_idx on public.project_media_deliveries(project_media_id);
create index project_media_deliveries_message_idx on public.project_media_deliveries(message_id) where message_id is not null;
create index project_media_uploads_project_org_idx on public.project_media_uploads(project_id,org_id);
create index project_media_uploads_org_idx on public.project_media_uploads(org_id,created_at desc);
create index project_media_uploads_actor_idx on public.project_media_uploads(actor_user_id);
create index project_media_uploads_media_idx on public.project_media_uploads(media_id) where media_id is not null;

commit;
