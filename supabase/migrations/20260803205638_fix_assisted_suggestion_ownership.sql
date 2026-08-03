begin;

-- A reviewed Pedro suggestion is not a human takeover. Keep direct manual
-- sends explicit so clients cannot spoof the assisted-review path.
alter table public.message_send_requests
  add column source text not null default 'human'
    check (source in ('human', 'ai_suggestion')),
  add column ai_suggestion_id uuid,
  add constraint message_send_requests_source_link_check check (
    (source = 'human' and ai_suggestion_id is null)
    or (source = 'ai_suggestion' and ai_suggestion_id is not null)
  ),
  add constraint message_send_requests_ai_suggestion_fkey
    foreign key (ai_suggestion_id, org_id)
    references public.ai_suggestions(id, org_id)
    on delete restrict;

create index message_send_requests_ai_suggestion_idx
  on public.message_send_requests(ai_suggestion_id)
  where ai_suggestion_id is not null;

drop policy message_send_requests_insert_actor on public.message_send_requests;
create policy message_send_requests_insert_actor
on public.message_send_requests
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and source = 'human'
  and ai_suggestion_id is null
  and (select private.can_access_conversation(conversation_id))
);

create or replace function private.process_message_send_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
  v_suggestion public.ai_suggestions%rowtype;
  v_phone text;
  v_message_id uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'message_send_actor_mismatch' using errcode = '42501';
  end if;

  select * into v_conversation
  from public.conversations c
  where c.id = new.conversation_id
  for update;

  if not found or v_conversation.org_id <> new.org_id
     or not private.can_access_conversation(v_conversation.id) then
    raise exception 'message_send_forbidden' using errcode = '42501';
  end if;
  if v_conversation.status <> 'active' then
    raise exception 'conversation_not_active' using errcode = '22023';
  end if;
  if v_conversation.version <> new.expected_conversation_version then
    raise exception 'conversation_version_conflict' using errcode = '40001';
  end if;

  if new.source = 'ai_suggestion' then
    select * into v_suggestion
    from public.ai_suggestions s
    where s.id = new.ai_suggestion_id
      and s.org_id = new.org_id
      and s.conversation_id = v_conversation.id
      and s.status = 'pending';
    if not found or v_conversation.ai_mode <> 'assisted' then
      raise exception 'assisted_suggestion_send_invalid' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.opt_outs o
    where o.operation_id = v_conversation.operation_id
      and o.contact_id = v_conversation.contact_id
      and o.revoked_at is null
  ) then
    raise exception 'contact_opted_out' using errcode = '22023';
  end if;

  select cp.e164 into v_phone
  from public.contact_phones cp
  where cp.contact_id = v_conversation.contact_id
    and cp.is_primary
    and cp.status = 'active';

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
    sender_user_id, content_type, body, provider_status,
    reply_to_message_id, metadata
  ) values (
    new.org_id, v_conversation.operation_id, v_conversation.id, 'outbound', 'user',
    (select auth.uid()), 'text', trim(new.body), 'queued', new.reply_to_message_id,
    jsonb_strip_nulls(jsonb_build_object(
      'source', new.source,
      'ai_suggestion_id', new.ai_suggestion_id
    ))
  ) returning id into v_message_id;

  update public.conversations
  set ownership = case
        when new.source = 'ai_suggestion' then ownership
        else 'human'
      end,
      assigned_membership_id = case
        when new.source = 'ai_suggestion' then assigned_membership_id
        else coalesce(assigned_membership_id, private.current_membership_id(new.org_id))
      end,
      last_message_preview = left(trim(new.body), 180),
      version = version + 1,
      updated_at = now()
  where id = v_conversation.id;

  insert into private.outbox_events (
    org_id, operation_id, event_type, aggregate_type,
    aggregate_id, payload, idempotency_key
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

create or replace function private.process_ai_suggestion_review_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request public.message_send_requests%rowtype;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'suggestion_review_forbidden' using errcode = '42501';
  end if;

  select * into v_suggestion
  from public.ai_suggestions
  where id = new.suggestion_id and org_id = new.org_id
  for update;

  if not found or v_suggestion.status <> 'pending'
     or v_suggestion.conversation_id is null
     or not private.can_access_conversation(v_suggestion.conversation_id) then
    raise exception 'suggestion_not_reviewable' using errcode = '22023';
  end if;

  select * into v_conversation
  from public.conversations
  where id = v_suggestion.conversation_id
  for update;

  if new.action = 'discard' then
    update public.ai_suggestions
    set status = 'rejected', reviewed_by = new.actor_user_id, reviewed_at = now()
    where id = v_suggestion.id;
    new.result := 'discarded';
  else
    if new.expected_conversation_version is null
       or new.expected_conversation_version <> v_conversation.version then
      raise exception 'version_conflict' using errcode = '40001';
    end if;

    insert into public.message_send_requests(
      org_id, conversation_id, actor_user_id, body,
      expected_conversation_version, source, ai_suggestion_id
    ) values (
      new.org_id, v_conversation.id, new.actor_user_id,
      coalesce(nullif(trim(new.edited_body), ''), v_suggestion.body),
      v_conversation.version, 'ai_suggestion', v_suggestion.id
    ) returning * into v_request;

    update public.ai_suggestions
    set body = coalesce(nullif(trim(new.edited_body), ''), body),
        status = 'approved', reviewed_by = new.actor_user_id, reviewed_at = now()
    where id = v_suggestion.id;

    new.message_id := v_request.message_id;
    new.result := 'sent';
  end if;

  insert into audit.events(
    org_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.org_id, new.actor_user_id, 'ai.suggestion_' || new.action,
    'ai_suggestions', v_suggestion.id,
    jsonb_build_object('message_id', new.message_id, 'preserved_ai_ownership', new.action = 'send')
  );
  return new;
end;
$$;

revoke all on function private.process_ai_suggestion_review_request()
from public, anon, authenticated, service_role;

-- Repair only conversations whose ownership change can be attributed to the
-- old accepted-suggestion path. Explicit takeovers and later manual replies
-- remain untouched.
do $$
declare
  v_target record;
  v_inbound_message_id uuid;
begin
  for v_target in
    select distinct on (c.id)
      c.id, c.org_id, c.operation_id,
      r.message_id, sent.created_at as sent_at
    from public.conversations c
    join public.organization_settings os
      on os.org_id = c.org_id and os.ai_global_mode = 'assisted'
    join public.ai_suggestions suggestion
      on suggestion.conversation_id = c.id and suggestion.status = 'approved'
    join public.ai_suggestion_review_requests r
      on r.suggestion_id = suggestion.id
     and r.action = 'send'
     and r.result = 'sent'
     and r.message_id is not null
    join public.messages sent on sent.id = r.message_id
    where c.status = 'active'
      and c.ownership = 'human'
      and c.ai_mode = 'assisted'
      and c.pause_reason is null
      and not exists (
        select 1
        from public.conversation_takeover_requests takeover
        where takeover.conversation_id = c.id
          and takeover.action in ('take_over', 'pause', 'close')
          and takeover.created_at >= suggestion.created_at
      )
      and not exists (
        select 1
        from public.messages manual_message
        where manual_message.conversation_id = c.id
          and manual_message.direction = 'outbound'
          and manual_message.sender_type = 'user'
          and manual_message.id <> sent.id
          and manual_message.created_at >= suggestion.created_at
      )
    order by c.id, r.created_at desc
  loop
    select inbound.id into v_inbound_message_id
    from public.messages inbound
    where inbound.conversation_id = v_target.id
      and inbound.direction = 'inbound'
      and inbound.created_at > v_target.sent_at
    order by inbound.created_at desc, inbound.id desc
    limit 1;

    update public.conversations
    set ownership = 'ai',
        assigned_membership_id = null,
        version = version + 1,
        updated_at = now()
    where id = v_target.id;

    if v_inbound_message_id is not null then
      insert into private.outbox_events(
        org_id, operation_id, event_type, aggregate_type,
        aggregate_id, payload, idempotency_key
      ) values (
        v_target.org_id, v_target.operation_id, 'message.inbound.requeued.v1',
        'message', v_inbound_message_id,
        jsonb_build_object('message_id', v_inbound_message_id),
        'repair-assisted-suggestion-reply:' || v_inbound_message_id::text
      ) on conflict (idempotency_key) do nothing;
    end if;

    insert into audit.events(
      org_id, operation_id, actor_type, action, entity_type, entity_id, metadata
    ) values (
      v_target.org_id, v_target.operation_id, 'system',
      'conversation.assisted_suggestion_ownership_repaired',
      'conversations', v_target.id,
      jsonb_build_object(
        'suggestion_message_id', v_target.message_id,
        'requeued_inbound_message_id', v_inbound_message_id
      )
    );
  end loop;
end;
$$;

commit;
