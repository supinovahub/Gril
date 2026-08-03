begin;

create table public.conversation_read_states (
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_inbound_at timestamptz not null default '-infinity'::timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade
);

create index conversation_read_states_user_org_idx
  on public.conversation_read_states (user_id, org_id, conversation_id);

create index messages_unread_inbound_idx
  on public.messages (conversation_id, created_at)
  where direction = 'inbound';

create or replace function private.keep_conversation_read_cursor_monotonic()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.last_read_inbound_at := greatest(old.last_read_inbound_at, new.last_read_inbound_at);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.keep_conversation_read_cursor_monotonic()
from public, anon, authenticated, service_role;

create trigger conversation_read_states_keep_cursor_monotonic
before update on public.conversation_read_states
for each row execute function private.keep_conversation_read_cursor_monotonic();

alter table public.conversation_read_states enable row level security;

create policy conversation_read_states_select_own
on public.conversation_read_states
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_conversation(conversation_id))
);

create policy conversation_read_states_insert_own
on public.conversation_read_states
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_access_conversation(conversation_id))
);

create policy conversation_read_states_update_own
on public.conversation_read_states
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_conversation(conversation_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.can_access_conversation(conversation_id))
);

grant select, insert, update on public.conversation_read_states to authenticated;
grant all on public.conversation_read_states to service_role;

-- Existing conversations begin as read so the rollout only highlights new
-- inbound activity. Pending AI suggestions remain visible by design.
insert into public.conversation_read_states (
  org_id,
  conversation_id,
  user_id,
  last_read_inbound_at
)
select
  conversation.org_id,
  conversation.id,
  membership.user_id,
  coalesce(max(message.created_at), '-infinity'::timestamptz)
from public.conversations conversation
join public.memberships membership
  on membership.org_id = conversation.org_id
 and membership.status = 'active'
left join public.messages message
  on message.conversation_id = conversation.id
 and message.direction = 'inbound'
where membership.role in ('owner', 'manager')
   or (
     conversation.assigned_membership_id = membership.id
     and exists (
       select 1
       from public.conversation_access_grants access_grant
       where access_grant.conversation_id = conversation.id
         and access_grant.membership_id = membership.id
         and access_grant.starts_at <= now()
         and (access_grant.expires_at is null or access_grant.expires_at > now())
         and access_grant.revoked_at is null
     )
   )
group by conversation.org_id, conversation.id, membership.user_id
on conflict (conversation_id, user_id) do nothing;

create view public.inbox_notification_counts
with (security_invoker = true)
as
select
  conversation.org_id,
  conversation.id as conversation_id,
  count(distinct message.id)::integer as unread_inbound_count,
  count(distinct suggestion.id)::integer as pending_suggestion_count,
  (
    count(distinct message.id)
    + count(distinct suggestion.id)
  )::integer as total_count
from public.conversations conversation
left join public.conversation_read_states read_state
  on read_state.conversation_id = conversation.id
 and read_state.user_id = (select auth.uid())
left join public.messages message
  on message.conversation_id = conversation.id
 and message.direction = 'inbound'
 and message.created_at > coalesce(read_state.last_read_inbound_at, '-infinity'::timestamptz)
left join public.ai_suggestions suggestion
  on suggestion.conversation_id = conversation.id
 and suggestion.status = 'pending'
group by conversation.org_id, conversation.id;

revoke all on public.inbox_notification_counts from public, anon;
grant select on public.inbox_notification_counts to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['ai_suggestions', 'conversation_read_states'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

comment on table public.conversation_read_states is
  'Per-user cursor for inbound Inbox messages. AI suggestions remain pending until reviewed.';

comment on view public.inbox_notification_counts is
  'Per-user Inbox notification totals: unread inbound messages plus pending AI suggestions.';

commit;
