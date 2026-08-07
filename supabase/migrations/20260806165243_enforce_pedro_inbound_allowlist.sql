begin;

-- A number is allowlisted at organization scope unless an older entry keeps
-- an explicit operation scope. This lets the existing campaign allowlist be
-- reused safely by the normal inbound production gate.
create or replace function private.is_ai_inbound_recipient_allowlisted(
  p_org_id uuid,
  p_operation_id uuid,
  p_contact_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.contact_phones cp
    join public.ai_test_allowlist a
      on a.org_id = cp.org_id
     and a.phone_e164 = cp.e164
     and a.active
     and (a.operation_id is null or a.operation_id = p_operation_id)
    where cp.org_id = p_org_id
      and cp.contact_id = p_contact_id
      and cp.status = 'active'
  );
$$;

revoke all on function private.is_ai_inbound_recipient_allowlisted(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- Do not spend a model turn for a normal inbound contact outside the list.
create or replace function private.is_conversation_ai_eligible(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    join public.contacts ct on ct.id = c.contact_id
    join public.organization_settings os on os.org_id = c.org_id
    where c.id = p_conversation_id
      and c.status = 'active'
      and c.ownership = 'ai'
      and c.pause_reason is null
      and c.ai_mode <> 'off'
      and os.ai_global_mode = c.ai_mode
      and os.ai_global_mode <> 'off'
      and ct.status = 'active'
      and (
        c.journey <> 'inbound'
        or private.is_ai_inbound_recipient_allowlisted(c.org_id, c.operation_id, c.contact_id)
      )
      and not exists (
        select 1
        from public.opt_outs oo
        where oo.operation_id = c.operation_id
          and oo.contact_id = c.contact_id
          and oo.revoked_at is null
      )
      and not exists (
        select 1
        from public.contact_phones cp
        join public.suppression_entries se
          on se.operation_id = c.operation_id
         and se.phone_e164 = cp.e164
         and se.revoked_at is null
         and (se.expires_at is null or se.expires_at > now())
        where cp.contact_id = c.contact_id
          and cp.status = 'active'
      )
  );
$$;

revoke all on function private.is_conversation_ai_eligible(uuid)
  from public, anon, authenticated, service_role;

-- Revalidate a queued production turn when the worker claims it. Removing a
-- number from the whitelist therefore also stops work already in the queue.
create or replace function public.start_ai_execution(p_execution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count integer;
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_execution
  from public.ai_executions
  where id = p_execution_id
  for update;

  if not found or v_execution.status <> 'queued' then
    return false;
  end if;

  if v_execution.mode = 'production' and v_execution.conversation_id is not null then
    select * into v_conversation
    from public.conversations
    where id = v_execution.conversation_id;

    if found
       and v_conversation.journey = 'inbound'
       and not private.is_ai_inbound_recipient_allowlisted(
         v_conversation.org_id,
         v_conversation.operation_id,
         v_conversation.contact_id
       ) then
      update public.ai_executions
      set status = 'blocked',
          error_code = 'production_recipient_not_allowlisted',
          error_redacted = 'O destinatário não está na whitelist de produção.',
          completed_at = now()
      where id = v_execution.id;
      return false;
    end if;
  end if;

  update public.ai_executions
  set status = 'running',
      started_at = now(),
      error_code = null,
      error_redacted = null
  where id = p_execution_id
    and status = 'queued';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.start_ai_execution(uuid)
  from public, anon, authenticated;
grant execute on function public.start_ai_execution(uuid) to service_role;

-- Final defense: every AI-authored outbound message for normal inbound
-- production must still target an active allowlisted number.
create or replace function private.enforce_pedro_inbound_allowlist()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
begin
  if new.direction <> 'outbound' or new.sender_type <> 'ai' then
    return new;
  end if;

  select * into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if not found
     or v_conversation.journey <> 'inbound'
     or v_conversation.ai_mode <> 'production' then
    return new;
  end if;

  if not private.is_ai_inbound_recipient_allowlisted(
    v_conversation.org_id,
    v_conversation.operation_id,
    v_conversation.contact_id
  ) then
    raise exception 'production_recipient_not_allowlisted'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_pedro_inbound_allowlist()
  from public, anon, authenticated, service_role;
drop trigger if exists messages_pedro_inbound_allowlist on public.messages;
create trigger messages_pedro_inbound_allowlist
before insert on public.messages
for each row execute function private.enforce_pedro_inbound_allowlist();

-- Whitelist changes are administrative actions and must remain traceable.
drop trigger if exists ai_test_allowlist_audit on public.ai_test_allowlist;
create trigger ai_test_allowlist_audit
after insert or update or delete on public.ai_test_allowlist
for each row execute function private.audit_row_change();

commit;
