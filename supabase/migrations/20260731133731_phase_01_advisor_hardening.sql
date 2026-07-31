begin;

alter table public.profiles
  drop constraint profiles_full_name_check;

alter table public.profiles
  add constraint profiles_full_name_check
  check (char_length(trim(full_name)) between 1 and 120);

create index audit_events_actor_idx
  on audit.events (actor_user_id, occurred_at desc);

create index audit_events_operation_idx
  on audit.events (operation_id, occurred_at desc);

create index invitation_claims_org_idx
  on public.invitation_claims (org_id);

create index invitation_claims_user_idx
  on public.invitation_claims (user_id, claimed_at desc);

create index invitation_links_created_by_idx
  on public.invitation_links (created_by);

create index invitation_links_operation_org_idx
  on public.invitation_links (operation_id, org_id);

create index membership_operations_membership_org_idx
  on public.membership_operations (membership_id, org_id);

create index membership_operations_operation_org_idx
  on public.membership_operations (operation_id, org_id);

create index memberships_approved_by_idx
  on public.memberships (approved_by);

revoke all on function private.is_active_org_member(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.has_org_role(uuid, text[])
  from public, anon, authenticated, service_role;
revoke all on function private.has_org_permission(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.has_operation_access(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.can_view_profile(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.is_active_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.has_org_permission(uuid, text) to authenticated;
grant execute on function private.has_operation_access(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

create policy audit_events_explicitly_private
on audit.events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row jsonb;
  v_org_id uuid;
  v_operation_id uuid;
  v_entity_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org_id := coalesce(
    nullif(v_row ->> 'org_id', '')::uuid,
    case when tg_table_name = 'organizations' then nullif(v_row ->> 'id', '')::uuid end
  );

  if v_org_id is null and tg_table_name = 'membership_permissions' then
    select m.org_id
    into v_org_id
    from public.memberships m
    where m.id = nullif(v_row ->> 'membership_id', '')::uuid;
  end if;

  v_operation_id := coalesce(
    nullif(v_row ->> 'operation_id', '')::uuid,
    case when tg_table_name = 'operations' then nullif(v_row ->> 'id', '')::uuid end
  );
  v_entity_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'membership_id', '')::uuid
  );

  insert into audit.events (
    org_id,
    operation_id,
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_org_id,
    v_operation_id,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    tg_table_schema || '.' || tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_row_change()
  from public, anon, authenticated, service_role;

commit;
