begin;

create table public.contact_name_update_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (contact_id, org_id) references public.contacts(id, org_id) on delete restrict
);

create index contact_name_update_requests_contact_idx
  on public.contact_name_update_requests (contact_id, created_at desc);

create or replace function private.process_contact_name_update_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_contact public.contacts%rowtype;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.can_manage_crm(new.org_id) then
    raise exception 'contact_name_update_forbidden' using errcode = '42501';
  end if;

  select *
  into v_contact
  from public.contacts
  where id = new.contact_id
    and org_id = new.org_id
  for update;

  if not found or v_contact.status = 'merged' then
    raise exception 'contact_name_update_invalid_contact' using errcode = '22023';
  end if;

  update public.contacts
  set name = trim(new.name), updated_at = now()
  where id = v_contact.id and org_id = new.org_id;

  insert into audit.events (org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id,
    new.actor_user_id,
    'contact.name_updated',
    'contacts',
    v_contact.id,
    jsonb_build_object('request_id', new.id, 'previous_name', v_contact.name, 'name', trim(new.name))
  );

  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_contact_name_update_request()
from public, anon, authenticated, service_role;

create trigger contact_name_update_request_process
before insert on public.contact_name_update_requests
for each row execute function private.process_contact_name_update_request();

alter table public.contact_name_update_requests enable row level security;

create policy contact_name_update_requests_actor_select
on public.contact_name_update_requests
for select to authenticated
using (actor_user_id = (select auth.uid()) or private.can_manage_crm(org_id));

create policy contact_name_update_requests_insert
on public.contact_name_update_requests
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and private.can_manage_crm(org_id)
);

grant select, insert on public.contact_name_update_requests to authenticated;
grant all on public.contact_name_update_requests to service_role;

commit;
