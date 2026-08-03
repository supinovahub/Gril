begin;

create table public.contact_archive_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null,
  action text not null check (action in ('archive', 'restore')),
  resume_mode text not null default 'manual' check (resume_mode in ('manual', 'pedro', 'followup')),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  result text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (contact_id, org_id) references public.contacts(id, org_id) on delete restrict
);

create index contact_archive_requests_contact_idx
  on public.contact_archive_requests (contact_id, created_at desc);

create or replace function private.process_contact_archive_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_contact public.contacts%rowtype;
  v_conversation public.conversations%rowtype;
begin
  if new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'contacts.manage') then
    raise exception 'contact_archive_forbidden' using errcode = '42501';
  end if;

  select * into v_contact
  from public.contacts
  where id = new.contact_id and org_id = new.org_id
  for update;
  if not found or v_contact.status = 'merged' then
    raise exception 'contact_archive_invalid_contact' using errcode = '22023';
  end if;

  if new.action = 'archive' then
    update public.contacts
    set status = 'archived', updated_at = now()
    where id = v_contact.id;

    update public.conversations
    set status = 'paused', ownership = 'human', ai_mode = 'off',
        pause_reason = 'contact_archived', version = version + 1, updated_at = now()
    where org_id = new.org_id and contact_id = v_contact.id and status in ('active', 'paused');

    update public.scheduled_jobs j
    set status = 'cancelled', updated_at = now()
    where j.org_id = new.org_id and j.status in ('pending', 'leased')
      and (
        (j.aggregate_type = 'conversation' and exists (
          select 1 from public.conversations c
          where c.id = j.aggregate_id and c.contact_id = v_contact.id
        ))
        or j.payload ->> 'contact_id' = v_contact.id::text
        or j.payload ->> 'opportunity_id' in (
          select o.id::text from public.opportunities o where o.contact_id = v_contact.id
        )
      );

    update public.campaign_contacts
    set status = 'suppressed', suppression_reason = 'contact_archived', updated_at = now()
    where org_id = new.org_id and contact_id = v_contact.id
      and status in ('ready', 'queued', 'sending', 'followup');

    new.result := 'archived_automations_paused';
  else
    update public.contacts
    set status = 'active', updated_at = now()
    where id = v_contact.id;

    if new.resume_mode in ('pedro', 'followup') then
      if exists (
        select 1 from public.opt_outs
        where contact_id = v_contact.id and revoked_at is null
      ) then
        raise exception 'active_opt_out_blocks_proactive_resume' using errcode = '22023';
      end if;

      update public.conversations
      set status = 'active', ownership = 'ai', ai_mode = 'production',
          pause_reason = null, version = version + 1, updated_at = now()
      where org_id = new.org_id and contact_id = v_contact.id
        and pause_reason = 'contact_archived';

      if new.resume_mode = 'followup' then
        for v_conversation in
          select * from public.conversations
          where org_id = new.org_id and contact_id = v_contact.id
            and status = 'active' and ownership = 'ai' and ai_mode = 'production'
        loop
          insert into public.scheduled_jobs (
            org_id, operation_id, job_type, aggregate_type, aggregate_id,
            target_queue, run_at, dedupe_key, payload, max_attempts, created_by
          ) values (
            new.org_id, v_conversation.operation_id, 'followup.ai_turn', 'conversation', v_conversation.id,
            'scheduled-actions', now(),
            'manual-archive-restore:' || new.id::text || ':' || v_conversation.id::text,
            jsonb_build_object(
              'conversation_id', v_conversation.id,
              'opportunity_id', v_conversation.opportunity_id,
              'instruction', 'Retome o contato de forma contextual, respeitando o historico e sem inventar urgencia.',
              'step_number', 1,
              'source', 'manual_archive_restore'
            ),
            5, new.actor_user_id
          ) on conflict (org_id, dedupe_key) where status in ('pending', 'leased') do nothing;
        end loop;
      end if;
    end if;

    new.result := case new.resume_mode
      when 'pedro' then 'restored_to_pedro'
      when 'followup' then 'restored_with_followup'
      else 'restored_manual'
    end;
  end if;

  insert into audit.events (org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id, new.actor_user_id, 'contact.' || new.action,
    'contacts', new.contact_id,
    jsonb_build_object('resume_mode', new.resume_mode, 'reason', trim(new.reason), 'result', new.result)
  );
  return new;
end;
$$;

revoke all on function private.process_contact_archive_request() from public, anon, authenticated, service_role;
create trigger contact_archive_request_process
before insert on public.contact_archive_requests
for each row execute function private.process_contact_archive_request();

alter table public.contact_archive_requests enable row level security;
create policy contact_archive_requests_select on public.contact_archive_requests
for select to authenticated using (private.has_org_permission(org_id, 'contacts.manage'));
create policy contact_archive_requests_insert on public.contact_archive_requests
for insert to authenticated with check (
  actor_user_id = (select auth.uid()) and private.has_org_permission(org_id, 'contacts.manage')
);

grant select, insert on public.contact_archive_requests to authenticated;
grant all on public.contact_archive_requests to service_role;

commit;
