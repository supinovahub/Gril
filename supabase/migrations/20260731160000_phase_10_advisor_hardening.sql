begin;

create index meta_lead_forms_operation_idx
  on public.meta_lead_forms (operation_id, org_id);
create index meta_lead_submissions_org_received_idx
  on public.meta_lead_submissions (org_id, received_at desc);
create index preleads_operation_status_idx
  on public.preleads (operation_id, org_id, status, created_at desc);
create index preleads_contact_idx
  on public.preleads (contact_id, org_id)
  where contact_id is not null;
create index preleads_opportunity_idx
  on public.preleads (opportunity_id, org_id)
  where opportunity_id is not null;
create index meta_form_creation_requests_org_idx
  on public.meta_form_creation_requests (org_id, created_at desc);
create index meta_form_ingest_requests_org_idx
  on public.meta_form_ingest_requests (org_id, created_at desc);
create index privacy_requests_contact_idx
  on public.privacy_requests (contact_id, org_id);
create index privacy_requests_open_idx
  on public.privacy_requests (org_id, due_at)
  where status in ('open', 'reviewing');
create index retention_purge_queue_due_idx
  on private.retention_purge_queue (org_id, due_at)
  where status in ('pending', 'failed');
create index connection_activation_requests_connection_idx
  on public.connection_activation_requests (connection_id, org_id, created_at desc);

comment on table public.meta_form_ingest_requests is
  'Deliberately has RLS with no authenticated policy: only the service-role adapter may ingest Meta submissions.';

commit;
