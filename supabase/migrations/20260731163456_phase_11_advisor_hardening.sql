begin;

create index integration_accounts_connected_by_idx
  on public.integration_accounts (connected_by);

create index whatsapp_connections_integration_account_org_idx
  on public.whatsapp_connections (integration_account_id, org_id);

drop index public.model_profiles_integration_account_idx;
create index model_profiles_integration_account_org_idx
  on public.model_profiles (integration_account_id, org_id);

commit;
