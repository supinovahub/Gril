begin;

-- Provider names are useful for display, but must not overwrite a name that
-- was entered or confirmed by a human. This function only promotes contacts
-- that still carry one of the system placeholders.
create or replace function private.sync_whatsapp_contact_name_from_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_contact_id uuid;
  v_name text;
begin
  if new.direction not in ('inbound', 'outbound') then
    return new;
  end if;

  select c.contact_id
  into v_contact_id
  from public.conversations c
  where c.id = new.conversation_id
    and c.org_id = new.org_id;

  if v_contact_id is null then
    return new;
  end if;

  if new.direction = 'outbound' then
    v_name := nullif(trim(coalesce(
      new.metadata #>> '{_gril,contact_name}',
      new.metadata #>> '{chat,name}',
      new.metadata #>> '{chat,wa_name}',
      new.metadata #>> '{chat,displayName}',
      new.metadata #>> '{chat,display_name}',
      new.metadata #>> '{chat,contactName}',
      new.metadata #>> '{chat,contact_name}',
      new.metadata #>> '{data,chat,name}',
      new.metadata #>> '{data,chat,wa_name}',
      new.metadata #>> '{data,chat,displayName}',
      new.metadata #>> '{data,chat,display_name}',
      new.metadata #>> '{chatName}',
      new.metadata #>> '{chat_name}',
      new.metadata #>> '{data,chatName}',
      new.metadata #>> '{data,chat_name}',
      new.metadata #>> '{message,chat,name}',
      new.metadata #>> '{message,chat,wa_name}',
      new.metadata #>> '{message,chat,displayName}',
      new.metadata #>> '{message,chat,display_name}',
      new.metadata #>> '{message,chatName}',
      new.metadata #>> '{message,chat_name}',
      new.metadata #>> '{data,message,chat,name}',
      new.metadata #>> '{data,message,chat,wa_name}',
      new.metadata #>> '{data,message,chat,displayName}',
      new.metadata #>> '{data,message,chat,display_name}',
      new.metadata #>> '{data,message,chatName}',
      new.metadata #>> '{data,message,chat_name}'
    )), '');
  else
    v_name := nullif(trim(coalesce(
      new.metadata #>> '{_gril,contact_name}',
      new.metadata #>> '{contact_name}',
      new.metadata #>> '{contact,profile,name}',
      new.metadata #>> '{message,senderName}',
      new.metadata #>> '{message,pushName}',
      new.metadata #>> '{message,notifyName}',
      new.metadata #>> '{data,message,senderName}',
      new.metadata #>> '{data,message,pushName}',
      new.metadata #>> '{data,message,notifyName}',
      new.metadata #>> '{chat,name}',
      new.metadata #>> '{chat,wa_name}',
      new.metadata #>> '{data,chat,name}',
      new.metadata #>> '{data,chat,wa_name}',
      new.metadata #>> '{message,chat,name}',
      new.metadata #>> '{message,chat,wa_name}',
      new.metadata #>> '{data,message,chat,name}',
      new.metadata #>> '{data,message,chat,wa_name}'
    )), '');
  end if;

  if v_name is null
     or char_length(v_name) not between 2 and 160
     or lower(v_name) in ('contato do whatsapp', 'contato sem nome') then
    return new;
  end if;

  update public.contacts
  set name = v_name,
      updated_at = now()
  where id = v_contact_id
    and org_id = new.org_id
    and lower(trim(name)) in ('contato do whatsapp', 'contato sem nome');

  return new;
end;
$$;

revoke all on function private.sync_whatsapp_contact_name_from_message()
from public, anon, authenticated, service_role;

drop trigger if exists messages_sync_whatsapp_contact_name
on public.messages;
create trigger messages_sync_whatsapp_contact_name
after insert on public.messages
for each row
when (new.direction in ('inbound', 'outbound'))
execute function private.sync_whatsapp_contact_name_from_message();

-- Recover existing placeholders when the provider name was retained in the
-- message metadata. Names already entered by a human are intentionally left
-- untouched, and rows without a valid provider name remain placeholders.
with named_messages as (
  select
    c.id as contact_id,
    m.created_at,
    nullif(trim(coalesce(
      m.metadata #>> '{_gril,contact_name}',
      m.metadata #>> '{chat,name}',
      m.metadata #>> '{chat,wa_name}',
      m.metadata #>> '{chat,displayName}',
      m.metadata #>> '{chat,display_name}',
      m.metadata #>> '{data,chat,name}',
      m.metadata #>> '{data,chat,wa_name}',
      m.metadata #>> '{message,chat,name}',
      m.metadata #>> '{message,chat,wa_name}',
      m.metadata #>> '{chatName}',
      m.metadata #>> '{chat_name}',
      m.metadata #>> '{data,chatName}',
      m.metadata #>> '{data,chat_name}',
      m.metadata #>> '{message,chatName}',
      m.metadata #>> '{message,chat_name}',
      m.metadata #>> '{data,message,chat,name}',
      m.metadata #>> '{data,message,chat,wa_name}',
      m.metadata #>> '{data,message,chatName}',
      m.metadata #>> '{data,message,chat_name}',
      m.metadata #>> '{contact_name}',
      m.metadata #>> '{contact,profile,name}',
      m.metadata #>> '{message,senderName}',
      m.metadata #>> '{message,pushName}',
      m.metadata #>> '{message,notifyName}'
    )), '') as candidate_name
  from public.contacts c
  join public.conversations conv
    on conv.contact_id = c.id
   and conv.org_id = c.org_id
  join public.messages m
    on m.conversation_id = conv.id
   and m.org_id = c.org_id
  where lower(trim(c.name)) in ('contato do whatsapp', 'contato sem nome')
    and (
      m.direction = 'inbound'
      or m.metadata #>> '{_gril,event_kind}' = 'external_outbound'
    )
), latest_names as (
  select distinct on (contact_id)
    contact_id,
    candidate_name
  from named_messages
  where char_length(candidate_name) between 2 and 160
    and lower(candidate_name) not in ('contato do whatsapp', 'contato sem nome')
  order by contact_id, created_at desc
)
update public.contacts c
set name = latest_names.candidate_name,
    updated_at = now()
from latest_names
where c.id = latest_names.contact_id
  and lower(trim(c.name)) in ('contato do whatsapp', 'contato sem nome');

commit;
