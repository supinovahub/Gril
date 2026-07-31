begin;

create table public.faq_creation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  canonical_question text not null check (char_length(trim(canonical_question)) between 5 and 500),
  base_answer text not null check (char_length(trim(base_answer)) between 10 and 4000),
  response_mode text not null check (response_mode in ('direct','brief_then_call','silent_escalation')),
  source_name text not null check (char_length(trim(source_name)) between 2 and 160),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  faq_entry_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function private.process_faq_creation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_entry_id uuid;
  v_checksum text;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'ai.manage') then
    raise exception 'faq_creation_forbidden' using errcode = '42501';
  end if;

  v_checksum := encode(
    extensions.digest(convert_to(trim(new.canonical_question) || E'\n' || trim(new.base_answer), 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.faq_entries (org_id, scope, canonical_question, status, created_by)
  values (new.org_id, 'global', trim(new.canonical_question), 'published', new.actor_user_id)
  returning id into v_entry_id;

  insert into public.faq_versions (
    org_id, faq_entry_id, version, status, base_answer, response_mode,
    source_name, checksum, published_by, published_at
  ) values (
    new.org_id, v_entry_id, 1, 'published', trim(new.base_answer), new.response_mode,
    trim(new.source_name), v_checksum, new.actor_user_id, now()
  );

  insert into audit.events (org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id, new.actor_user_id, 'faq.created_and_published', 'faq_entries', v_entry_id,
    jsonb_build_object('version', 1, 'response_mode', new.response_mode)
  );

  new.faq_entry_id := v_entry_id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_faq_creation_request() from public, anon, authenticated, service_role;
create trigger faq_creation_request_process
before insert on public.faq_creation_requests
for each row execute function private.process_faq_creation_request();

alter table public.faq_creation_requests enable row level security;
create policy faq_creation_requests_select_actor on public.faq_creation_requests
for select to authenticated using (actor_user_id = (select auth.uid()));
create policy faq_creation_requests_insert_manager on public.faq_creation_requests
for insert to authenticated with check (
  actor_user_id = (select auth.uid())
  and (select private.has_org_permission(org_id, 'ai.manage'))
);

grant select, insert on public.faq_creation_requests to authenticated;
grant all on public.faq_creation_requests to service_role;

comment on table public.faq_creation_requests is 'Atomic audited command that publishes the FAQ entry and its first immutable version.';

commit;
