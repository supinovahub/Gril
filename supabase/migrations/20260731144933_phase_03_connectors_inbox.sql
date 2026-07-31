begin;

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  provider text not null check (provider in ('uazapi', 'meta_cloud')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  visible_profile_name text,
  endpoint_url text,
  secret_reference text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'error', 'revoked')),
  inbound_enabled boolean not null default false,
  campaign_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  last_health_at timestamptz,
  last_error_redacted text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  unique (id, org_id)
);

create unique index whatsapp_connections_active_phone_idx
  on public.whatsapp_connections (org_id, phone_e164)
  where phone_e164 is not null and status <> 'revoked';

create index whatsapp_connections_operation_idx
  on public.whatsapp_connections (operation_id, status);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid not null,
  connection_id uuid not null,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  ownership text not null default 'ai' check (ownership in ('ai', 'human', 'pending_handoff')),
  assigned_membership_id uuid,
  ai_mode text not null default 'off' check (ai_mode in ('off', 'shadow', 'assisted', 'production')),
  pause_reason text,
  version integer not null default 1 check (version > 0),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_preview text,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict,
  foreign key (opportunity_id, org_id)
    references public.opportunities(id, org_id) on delete restrict,
  foreign key (connection_id, org_id)
    references public.whatsapp_connections(id, org_id) on delete restrict,
  foreign key (assigned_membership_id, org_id)
    references public.memberships(id, org_id) on delete restrict,
  unique (id, org_id),
  check ((status = 'closed' and closed_at is not null) or status <> 'closed')
);

create unique index conversations_one_active_per_opportunity_idx
  on public.conversations (opportunity_id)
  where status in ('active', 'paused');

create index conversations_inbox_idx
  on public.conversations (org_id, operation_id, status, coalesce(last_inbound_at, started_at) desc);

alter table public.opportunities
  add constraint opportunities_current_conversation_id_fkey
  foreign key (current_conversation_id, org_id)
  references public.conversations(id, org_id) on delete set null;

create table public.conversation_access_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  conversation_id uuid not null,
  membership_id uuid not null,
  reason text not null check (reason in ('call_window', 'manual', 'ownership')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade,
  foreign key (membership_id, org_id)
    references public.memberships(id, org_id) on delete cascade,
  check (expires_at is null or expires_at > starts_at)
);

create unique index conversation_access_grants_active_idx
  on public.conversation_access_grants (conversation_id, membership_id)
  where revoked_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  conversation_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('contact', 'ai', 'user', 'system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  content_type text not null default 'text' check (content_type in ('text', 'image', 'audio', 'video', 'document', 'location', 'unknown')),
  body text,
  provider_message_id text,
  provider_status text not null default 'received' check (provider_status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed', 'suppressed')),
  provider_timestamp timestamptz,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  error_redacted text,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade,
  unique (id, org_id),
  check (body is not null or content_type <> 'text')
);

create unique index messages_provider_id_idx
  on public.messages (conversation_id, provider_message_id)
  where provider_message_id is not null;

create index messages_timeline_idx
  on public.messages (conversation_id, coalesce(provider_timestamp, created_at), id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  message_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (message_id, org_id)
    references public.messages(id, org_id) on delete cascade,
  unique (storage_bucket, storage_path)
);

create table public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  conversation_id uuid not null,
  message_cursor_id uuid references public.messages(id) on delete set null,
  summary text not null check (char_length(summary) between 1 and 12000),
  facts jsonb not null default '{}'::jsonb,
  generated_by text not null check (generated_by in ('ai', 'human', 'system')),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade
);

create index conversation_summaries_latest_idx
  on public.conversation_summaries (conversation_id, created_at desc);

create table public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  contact_id uuid not null,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  reason text,
  source text not null check (source in ('contact', 'user', 'provider', 'system')),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (contact_id, org_id)
    references public.contacts(id, org_id) on delete restrict
);

create unique index opt_outs_active_contact_idx
  on public.opt_outs (operation_id, contact_id, channel)
  where revoked_at is null;

create table public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  reason text not null,
  source text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict
);

create unique index suppression_entries_active_phone_idx
  on public.suppression_entries (operation_id, phone_e164)
  where revoked_at is null;

create table private.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  connection_id uuid not null,
  provider text not null,
  external_event_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  error_redacted text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  foreign key (connection_id, org_id)
    references public.whatsapp_connections(id, org_id) on delete restrict,
  unique (connection_id, external_event_id)
);

create index webhook_inbox_pending_idx
  on private.webhook_inbox (received_at)
  where status in ('received', 'failed');

create table public.webhook_ingest_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  connection_id uuid not null,
  external_event_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null default '{}'::jsonb,
  from_e164 text not null check (from_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_name text,
  provider_message_id text not null,
  content_type text not null default 'text',
  body text,
  provider_timestamp timestamptz,
  conversation_id uuid,
  message_id uuid,
  duplicate boolean not null default false,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (connection_id, org_id)
    references public.whatsapp_connections(id, org_id) on delete restrict,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete restrict,
  foreign key (message_id, org_id)
    references public.messages(id, org_id) on delete restrict
);

create table public.message_send_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  conversation_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4096),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  expected_conversation_version integer not null check (expected_conversation_version > 0),
  message_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete restrict,
  foreign key (message_id, org_id)
    references public.messages(id, org_id) on delete restrict
);

create table public.conversation_takeover_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  conversation_id uuid not null,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  action text not null check (action in ('take_over', 'return_to_ai', 'pause', 'close')),
  reason text,
  expected_version integer not null check (expected_version > 0),
  resulting_version integer,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete restrict
);

create or replace function private.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    join public.memberships m
      on m.org_id = c.org_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
    where c.id = p_conversation_id
      and private.has_operation_access(c.operation_id)
      and (
        m.role in ('owner', 'manager')
        or (
          c.assigned_membership_id = m.id
          and exists (
            select 1 from public.conversation_access_grants cag
            where cag.conversation_id = c.id
              and cag.membership_id = m.id
              and cag.starts_at <= now()
              and (cag.expires_at is null or cag.expires_at > now())
              and cag.revoked_at is null
          )
        )
      )
  );
$$;

create or replace function private.can_view_contact_phone(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.contacts c
    join public.memberships m
      on m.org_id = c.org_id
     and m.user_id = (select auth.uid())
     and m.status = 'active'
    where c.id = p_contact_id
      and (
        m.role in ('owner', 'manager')
        or exists (
          select 1 from public.conversations conv
          where conv.contact_id = c.id
            and private.can_access_conversation(conv.id)
        )
      )
  );
$$;

revoke all on function private.can_access_conversation(uuid) from public, anon, service_role;
revoke all on function private.can_view_contact_phone(uuid) from public, anon, service_role;
grant execute on function private.can_access_conversation(uuid) to authenticated;
grant execute on function private.can_view_contact_phone(uuid) to authenticated;

drop policy contact_phones_select_visible on public.contact_phones;
create policy contact_phones_select_visible
on public.contact_phones for select to authenticated
using ((select private.can_view_contact_phone(contact_id)));

create or replace function private.process_webhook_ingest_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_contact_id uuid;
  v_opportunity_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_stage_id uuid;
  v_webhook_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'webhook_ingest_service_role_required' using errcode = '42501';
  end if;

  select * into v_connection
  from public.whatsapp_connections c
  where c.id = new.connection_id and c.org_id = new.org_id
  for update;

  if not found or v_connection.status <> 'active' or not v_connection.inbound_enabled then
    raise exception 'connection_not_active_for_inbound' using errcode = '22023';
  end if;

  insert into private.webhook_inbox (
    org_id, connection_id, provider, external_event_id, payload_sha256, payload
  ) values (
    new.org_id, new.connection_id, v_connection.provider,
    new.external_event_id, new.payload_sha256, new.payload
  )
  on conflict (connection_id, external_event_id) do nothing
  returning id into v_webhook_id;

  if v_webhook_id is null then
    select m.conversation_id, m.id into v_conversation_id, v_message_id
    from public.messages m
    where m.provider_message_id = new.provider_message_id
      and m.org_id = new.org_id
    limit 1;
    new.conversation_id := v_conversation_id;
    new.message_id := v_message_id;
    new.duplicate := true;
    new.processed_at := now();
    return new;
  end if;

  select cp.contact_id into v_contact_id
  from public.contact_phones cp
  where cp.org_id = new.org_id and cp.e164 = new.from_e164 and cp.status = 'active'
  for update;

  if not found then
    insert into public.contacts (org_id, name, created_by)
    values (new.org_id, coalesce(nullif(trim(new.contact_name), ''), 'Contato sem nome'), null)
    returning id into v_contact_id;
    insert into public.contact_phones (org_id, contact_id, e164, original, is_primary)
    values (new.org_id, v_contact_id, new.from_e164, new.from_e164, true);
  end if;

  select o.id into v_opportunity_id
  from public.opportunities o
  where o.org_id = new.org_id
    and o.operation_id = v_connection.operation_id
    and o.contact_id = v_contact_id
    and o.status = 'open'
  order by o.created_at desc limit 1 for update;

  if not found then
    select id into v_stage_id from public.pipeline_stages
    where org_id = new.org_id and code = 'new';
    insert into public.opportunities (
      org_id, operation_id, contact_id, pipeline_stage_id, source, created_by
    ) values (
      new.org_id, v_connection.operation_id, v_contact_id, v_stage_id, 'whatsapp_inbound', null
    ) returning id into v_opportunity_id;
    insert into public.opportunity_stage_history (
      org_id, operation_id, opportunity_id, to_stage_id, actor_type, reason, opportunity_version
    ) values (
      new.org_id, v_connection.operation_id, v_opportunity_id, v_stage_id,
      'system', 'Criada por mensagem inbound', 1
    );
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.opportunity_id = v_opportunity_id and c.status in ('active', 'paused')
  for update;

  if not found then
    insert into public.conversations (
      org_id, operation_id, contact_id, opportunity_id, connection_id,
      status, ownership, ai_mode
    ) values (
      new.org_id, v_connection.operation_id, v_contact_id, v_opportunity_id,
      v_connection.id, 'active', 'ai', 'off'
    ) returning id into v_conversation_id;
    update public.opportunities
    set current_conversation_id = v_conversation_id, version = version + 1, updated_at = now()
    where id = v_opportunity_id;
  end if;

  insert into public.messages (
    org_id, operation_id, conversation_id, direction, sender_type,
    content_type, body, provider_message_id, provider_status,
    provider_timestamp, metadata
  ) values (
    new.org_id, v_connection.operation_id, v_conversation_id, 'inbound', 'contact',
    new.content_type, new.body, new.provider_message_id, 'received',
    coalesce(new.provider_timestamp, now()), new.payload
  ) returning id into v_message_id;

  update public.conversations
  set last_inbound_at = coalesce(new.provider_timestamp, now()),
      last_message_preview = left(coalesce(new.body, '[' || new.content_type || ']'), 180),
      version = version + 1,
      updated_at = now()
  where id = v_conversation_id;

  update public.opportunities
  set last_activity_at = now(), updated_at = now()
  where id = v_opportunity_id;

  insert into private.outbox_events (
    org_id, operation_id, event_type, aggregate_type, aggregate_id,
    payload, idempotency_key
  ) values (
    new.org_id, v_connection.operation_id, 'message.inbound_received.v1',
    'conversation', v_conversation_id,
    jsonb_build_object('message_id', v_message_id, 'opportunity_id', v_opportunity_id),
    'inbound:' || new.connection_id::text || ':' || new.external_event_id
  );

  update private.webhook_inbox
  set status = 'processed', attempts = 1, processed_at = now()
  where id = v_webhook_id;

  new.conversation_id := v_conversation_id;
  new.message_id := v_message_id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_webhook_ingest_request()
  from public, anon, authenticated, service_role;

create trigger webhook_ingest_request_process
before insert on public.webhook_ingest_requests
for each row execute function private.process_webhook_ingest_request();

create or replace function private.process_message_send_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
  v_phone text;
  v_message_id uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'message_send_actor_mismatch' using errcode = '42501';
  end if;

  select * into v_conversation from public.conversations c
  where c.id = new.conversation_id for update;

  if not found or v_conversation.org_id <> new.org_id or not private.can_access_conversation(v_conversation.id) then
    raise exception 'message_send_forbidden' using errcode = '42501';
  end if;
  if v_conversation.status <> 'active' then
    raise exception 'conversation_not_active' using errcode = '22023';
  end if;
  if v_conversation.version <> new.expected_conversation_version then
    raise exception 'conversation_version_conflict' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.opt_outs o
    where o.operation_id = v_conversation.operation_id
      and o.contact_id = v_conversation.contact_id
      and o.revoked_at is null
  ) then
    raise exception 'contact_opted_out' using errcode = '22023';
  end if;

  select cp.e164 into v_phone from public.contact_phones cp
  where cp.contact_id = v_conversation.contact_id and cp.is_primary and cp.status = 'active';
  if exists (
    select 1 from public.suppression_entries s
    where s.operation_id = v_conversation.operation_id
      and s.phone_e164 = v_phone
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'contact_suppressed' using errcode = '22023';
  end if;

  insert into public.messages (
    org_id, operation_id, conversation_id, direction, sender_type,
    sender_user_id, content_type, body, provider_status, reply_to_message_id
  ) values (
    new.org_id, v_conversation.operation_id, v_conversation.id, 'outbound', 'user',
    (select auth.uid()), 'text', trim(new.body), 'queued', new.reply_to_message_id
  ) returning id into v_message_id;

  update public.conversations
  set ownership = 'human', assigned_membership_id = coalesce(assigned_membership_id, private.current_membership_id(new.org_id)),
      last_message_preview = left(trim(new.body), 180), version = version + 1, updated_at = now()
  where id = v_conversation.id;

  insert into private.outbox_events (
    org_id, operation_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
  ) values (
    new.org_id, v_conversation.operation_id, 'message.send_requested.v1',
    'message', v_message_id, jsonb_build_object('conversation_id', v_conversation.id),
    'message-send:' || new.id::text
  );

  new.message_id := v_message_id;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_message_send_request()
  from public, anon, authenticated, service_role;

create trigger message_send_request_process
before insert on public.message_send_requests
for each row execute function private.process_message_send_request();

create or replace function private.process_conversation_takeover_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
  v_membership_id uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'conversation_action_actor_mismatch' using errcode = '42501';
  end if;
  select * into v_conversation from public.conversations c where c.id = new.conversation_id for update;
  if not found or v_conversation.org_id <> new.org_id or not private.can_access_conversation(v_conversation.id) then
    raise exception 'conversation_action_forbidden' using errcode = '42501';
  end if;
  if v_conversation.version <> new.expected_version then
    raise exception 'conversation_version_conflict' using errcode = '40001';
  end if;
  v_membership_id := private.current_membership_id(new.org_id);

  update public.conversations
  set ownership = case
        when new.action = 'return_to_ai' then 'ai'
        else 'human'
      end,
      assigned_membership_id = case when new.action = 'return_to_ai' then null else coalesce(assigned_membership_id, v_membership_id) end,
      status = case when new.action = 'close' then 'closed' when new.action = 'pause' then 'paused' else 'active' end,
      pause_reason = case when new.action = 'pause' then coalesce(nullif(trim(new.reason), ''), 'Pausa manual') else null end,
      closed_at = case when new.action = 'close' then now() else null end,
      version = version + 1,
      updated_at = now()
  where id = v_conversation.id;

  insert into audit.events (
    org_id, operation_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.org_id, v_conversation.operation_id, (select auth.uid()),
    'conversation.' || new.action, 'conversations', v_conversation.id,
    jsonb_build_object('reason', new.reason, 'from_version', v_conversation.version)
  );
  new.resulting_version := v_conversation.version + 1;
  new.processed_at := now();
  return new;
end;
$$;

revoke all on function private.process_conversation_takeover_request()
  from public, anon, authenticated, service_role;

create trigger conversation_takeover_request_process
before insert on public.conversation_takeover_requests
for each row execute function private.process_conversation_takeover_request();

create trigger whatsapp_connections_set_updated_at before update on public.whatsapp_connections
for each row execute function private.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function private.set_updated_at();

alter table public.whatsapp_connections enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_access_grants enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.conversation_summaries enable row level security;
alter table public.opt_outs enable row level security;
alter table public.suppression_entries enable row level security;
alter table public.webhook_ingest_requests enable row level security;
alter table public.message_send_requests enable row level security;
alter table public.conversation_takeover_requests enable row level security;

create policy whatsapp_connections_manage_select on public.whatsapp_connections
for select to authenticated using ((select private.has_org_permission(org_id, 'settings.manage')));
create policy whatsapp_connections_manage_insert on public.whatsapp_connections
for insert to authenticated with check ((select private.has_org_permission(org_id, 'settings.manage')) and (select private.has_operation_access(operation_id)));
create policy whatsapp_connections_manage_update on public.whatsapp_connections
for update to authenticated using ((select private.has_org_permission(org_id, 'settings.manage')))
with check ((select private.has_org_permission(org_id, 'settings.manage')) and (select private.has_operation_access(operation_id)));

create policy conversations_select_visible on public.conversations
for select to authenticated using ((select private.can_access_conversation(id)));
create policy conversation_access_grants_select_visible on public.conversation_access_grants
for select to authenticated using (
  membership_id = (select private.current_membership_id(org_id))
  or (select private.has_org_permission(org_id, 'team.manage'))
);
create policy conversation_access_grants_manage on public.conversation_access_grants
for all to authenticated using ((select private.has_org_permission(org_id, 'team.manage')))
with check ((select private.has_org_permission(org_id, 'team.manage')));
create policy messages_select_visible on public.messages
for select to authenticated using ((select private.can_access_conversation(conversation_id)));
create policy attachments_select_visible on public.attachments
for select to authenticated using (exists (
  select 1 from public.messages m where m.id = message_id and private.can_access_conversation(m.conversation_id)
));
create policy conversation_summaries_select_visible on public.conversation_summaries
for select to authenticated using ((select private.can_access_conversation(conversation_id)));
create policy opt_outs_select_manager on public.opt_outs
for select to authenticated using ((select private.can_manage_crm(org_id)));
create policy opt_outs_manage on public.opt_outs
for all to authenticated using ((select private.can_manage_crm(org_id)))
with check ((select private.can_manage_crm(org_id)));
create policy suppression_entries_select_manager on public.suppression_entries
for select to authenticated using ((select private.can_manage_crm(org_id)));
create policy suppression_entries_manage on public.suppression_entries
for all to authenticated using ((select private.can_manage_crm(org_id)))
with check ((select private.can_manage_crm(org_id)));
create policy message_send_requests_select_actor on public.message_send_requests
for select to authenticated using (actor_user_id = (select auth.uid()));
create policy message_send_requests_insert_actor on public.message_send_requests
for insert to authenticated with check (actor_user_id = (select auth.uid()) and (select private.can_access_conversation(conversation_id)));
create policy conversation_takeover_requests_select_actor on public.conversation_takeover_requests
for select to authenticated using (actor_user_id = (select auth.uid()));
create policy conversation_takeover_requests_insert_actor on public.conversation_takeover_requests
for insert to authenticated with check (actor_user_id = (select auth.uid()) and (select private.can_access_conversation(conversation_id)));

grant select, insert, update on public.whatsapp_connections to authenticated;
grant select on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_access_grants to authenticated;
grant select on public.messages to authenticated;
grant select on public.attachments to authenticated;
grant select on public.conversation_summaries to authenticated;
grant select, insert, update, delete on public.opt_outs to authenticated;
grant select, insert, update, delete on public.suppression_entries to authenticated;
grant select, insert on public.message_send_requests to authenticated;
grant select, insert on public.conversation_takeover_requests to authenticated;

revoke all on public.webhook_ingest_requests from public, anon, authenticated;
grant select, insert on public.webhook_ingest_requests to service_role;
grant all on public.whatsapp_connections, public.conversations, public.conversation_access_grants,
  public.messages, public.attachments, public.conversation_summaries, public.opt_outs,
  public.suppression_entries, public.webhook_ingest_requests, public.message_send_requests,
  public.conversation_takeover_requests to service_role;

comment on table public.webhook_ingest_requests is 'Service-role-only idempotent command used by provider adapters after signature validation.';
comment on table private.webhook_inbox is 'Raw webhook inbox outside the Data API. Payloads must be redacted according to retention policy.';
comment on table public.message_send_requests is 'Insert-only human send command; suppression and optimistic conversation version are revalidated transactionally.';

commit;
