alter table public.webhook_ingest_requests
  add column reply_to_provider_message_id text
  check (
    reply_to_provider_message_id is null
    or char_length(reply_to_provider_message_id) between 1 and 300
  );

comment on column public.webhook_ingest_requests.reply_to_provider_message_id is
  'Provider message identifier explicitly quoted by the inbound or device-originated WhatsApp message.';

create or replace function private.link_webhook_ingest_reply_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_reply_to_message_id uuid;
begin
  if new.message_id is null
     or new.conversation_id is null
     or nullif(btrim(new.reply_to_provider_message_id), '') is null then
    return new;
  end if;

  select message.id
  into v_reply_to_message_id
  from public.messages message
  where message.org_id = new.org_id
    and message.conversation_id = new.conversation_id
    and message.provider_message_id = new.reply_to_provider_message_id
    and message.id <> new.message_id
  order by message.created_at desc
  limit 1;

  if v_reply_to_message_id is not null then
    update public.messages message
    set reply_to_message_id = v_reply_to_message_id
    where message.id = new.message_id
      and message.org_id = new.org_id
      and message.conversation_id = new.conversation_id
      and message.reply_to_message_id is null;
  end if;

  return new;
end;
$$;

revoke all on function private.link_webhook_ingest_reply_reference()
  from public, anon, authenticated, service_role;

drop trigger if exists webhook_ingest_link_reply_reference
  on public.webhook_ingest_requests;

create trigger webhook_ingest_link_reply_reference
after insert on public.webhook_ingest_requests
for each row execute function private.link_webhook_ingest_reply_reference();

with reply_candidates as (
  select distinct on (child.id)
    child.id as child_message_id,
    target.id as target_message_id
  from public.messages child
  cross join lateral (
    select coalesce(
      nullif(btrim(child.metadata #>> '{message,quoted,messageid}'), ''),
      nullif(btrim(child.metadata #>> '{message,quoted,messageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,quoted,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,quoted,key,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMessage,messageid}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMessage,messageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMessage,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMessage,key,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMsg,messageid}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMsg,messageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMsg,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,quotedMessageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,replyToMessageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,contextInfo,stanzaId}'), ''),
      nullif(btrim(child.metadata #>> '{message,contextInfo,messageId}'), ''),
      nullif(btrim(child.metadata #>> '{message,contextInfo,id}'), ''),
      nullif(btrim(child.metadata #>> '{message,context,id}'), ''),
      case
        when jsonb_typeof(child.metadata #> '{message,quoted}') = 'string'
          then nullif(btrim(child.metadata #>> '{message,quoted}'), '')
        else null
      end
    ) as provider_message_id
  ) quoted
  join public.messages target
    on target.org_id = child.org_id
   and target.conversation_id = child.conversation_id
   and target.provider_message_id = quoted.provider_message_id
   and target.id <> child.id
  where child.reply_to_message_id is null
    and quoted.provider_message_id is not null
  order by child.id, target.created_at desc
)
update public.messages child
set reply_to_message_id = candidate.target_message_id
from reply_candidates candidate
where child.id = candidate.child_message_id
  and child.reply_to_message_id is null;
