begin;

-- The inbound webhook identifies the connection that currently carries the
-- conversation. Rebind it after a revoked credential is reconnected.
create or replace function private.rebind_inbound_conversation_connection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.conversation_id is null or new.processed_at is null then
    return new;
  end if;

  update public.conversations c
  set connection_id = new.connection_id,
      updated_at = now()
  from public.whatsapp_connections wc
  where c.id = new.conversation_id
    and c.org_id = new.org_id
    and wc.id = new.connection_id
    and wc.org_id = new.org_id
    and wc.operation_id = c.operation_id
    and wc.status = 'active'
    and wc.inbound_enabled
    and c.connection_id <> new.connection_id;

  return new;
end;
$$;

revoke all on function private.rebind_inbound_conversation_connection()
from public, anon, authenticated, service_role;

drop trigger if exists webhook_ingest_rebind_connection
on public.webhook_ingest_requests;
create trigger webhook_ingest_rebind_connection
after insert on public.webhook_ingest_requests
for each row execute function private.rebind_inbound_conversation_connection();

-- Repair conversations already pinned to a revoked connection when there is
-- an active replacement for the same organization, operation and number.
update public.conversations c
set connection_id = active_connection.id,
    updated_at = now()
from public.whatsapp_connections old_connection
join public.whatsapp_connections active_connection
  on active_connection.org_id = old_connection.org_id
 and active_connection.operation_id = old_connection.operation_id
 and active_connection.phone_e164 = old_connection.phone_e164
 and active_connection.status = 'active'
 and active_connection.inbound_enabled
where c.connection_id = old_connection.id
  and old_connection.status <> 'active'
  and c.connection_id <> active_connection.id;

-- Refuse the request before creating a misleading outbound bubble if a
-- conversation ever points to an inactive connection again.
create or replace function private.guard_message_send_connection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.conversations c
    join public.whatsapp_connections wc
      on wc.id = c.connection_id
     and wc.org_id = c.org_id
     and wc.operation_id = c.operation_id
    where c.id = new.conversation_id
      and c.org_id = new.org_id
      and wc.status = 'active'
  ) then
    raise exception 'conversation_connection_inactive' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_message_send_connection()
from public, anon, authenticated, service_role;

drop trigger if exists message_send_requests_connection_guard
on public.message_send_requests;
create trigger message_send_requests_connection_guard
before insert on public.message_send_requests
for each row execute function private.guard_message_send_connection();

commit;
