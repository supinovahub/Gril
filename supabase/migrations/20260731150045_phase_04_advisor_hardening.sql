begin;

drop policy system_pauses_manage_owner on public.system_pauses;
create policy system_pauses_insert_owner on public.system_pauses for insert to authenticated
with check ((select private.has_org_role(org_id, array['owner']::text[])));
create policy system_pauses_update_owner on public.system_pauses for update to authenticated
using ((select private.has_org_role(org_id, array['owner']::text[])))
with check ((select private.has_org_role(org_id, array['owner']::text[])));
create policy system_pauses_delete_owner on public.system_pauses for delete to authenticated
using ((select private.has_org_role(org_id, array['owner']::text[])));

create index if not exists scheduled_jobs_operation_idx on public.scheduled_jobs (operation_id, org_id) where operation_id is not null;
create index if not exists system_pauses_operation_idx on public.system_pauses (operation_id, org_id) where operation_id is not null;
create index if not exists alerts_operation_idx on public.alerts (operation_id, org_id) where operation_id is not null;
create index if not exists alerts_acknowledged_by_idx on public.alerts (acknowledged_by) where acknowledged_by is not null;
create index if not exists notifications_alert_idx on public.notifications (alert_id) where alert_id is not null;

commit;
