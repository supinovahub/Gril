begin;

-- Production is an explicit capability of reactivation campaigns only. Bring
-- stale global settings back to the safe normal-inbound mode before restoring
-- the database constraint that prevents the old switch from being selected.
update public.organization_settings
set ai_global_mode = 'assisted',
    inbound_ai_mode = 'assisted'
where ai_global_mode = 'production'
   or inbound_ai_mode = 'production';

alter table public.organization_settings
  drop constraint if exists organization_settings_inbound_no_production_check,
  drop constraint if exists organization_settings_inbound_ai_mode_check;

alter table public.organization_settings
  add constraint organization_settings_inbound_ai_mode_check
    check (inbound_ai_mode in ('off', 'shadow', 'assisted')),
  add constraint organization_settings_inbound_no_production_check
    check (ai_global_mode <> 'production');

-- Normalize stale production values on campaign types that can never be
-- released as an automatic reactivation response.
update public.campaigns
set ai_mode = 'assisted'
where ai_mode = 'production'
  and campaign_type <> 'reactivation';

create or replace function private.enforce_reactivation_production_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_settings public.organization_settings%rowtype;
begin
  if new.ai_mode <> 'production' then
    return new;
  end if;

  if new.campaign_type <> 'reactivation' then
    raise exception 'production_only_for_reactivation' using errcode = '22023';
  end if;

  select * into v_settings
  from public.organization_settings
  where org_id = new.org_id;

  if not found
     or v_settings.reactivation_ai_mode <> 'production'
     or v_settings.reactivation_release_state = 'blocked' then
    raise exception 'reactivation_production_not_released' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_reactivation_production_gate()
  from public, anon, authenticated, service_role;
drop trigger if exists campaigns_reactivation_production_gate on public.campaigns;
create trigger campaigns_reactivation_production_gate
before insert or update of ai_mode, campaign_type on public.campaigns
for each row execute function private.enforce_reactivation_production_gate();

-- A campaign may remain configured while its release setting is changed. Do
-- not allow a wave to be queued while production is blocked or a controlled
-- test contains a contact outside the organization allowlist.
create or replace function private.enforce_reactivation_wave_production_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_settings public.organization_settings%rowtype;
begin
  select * into v_campaign
  from public.campaigns
  where id = new.campaign_id
    and org_id = new.org_id;

  if not found or v_campaign.ai_mode <> 'production' then
    return new;
  end if;

  if v_campaign.campaign_type <> 'reactivation' then
    raise exception 'production_only_for_reactivation' using errcode = '22023';
  end if;

  select * into v_settings
  from public.organization_settings
  where org_id = new.org_id;

  if not found
     or v_settings.reactivation_ai_mode <> 'production'
     or v_settings.reactivation_release_state = 'blocked' then
    raise exception 'reactivation_production_not_released' using errcode = '22023';
  end if;

  if v_settings.reactivation_release_state = 'test_controlled'
     and exists (
       select 1
       from public.campaign_contacts cc
       where cc.org_id = v_campaign.org_id
         and cc.campaign_id = v_campaign.id
         and cc.status = 'ready'
         and not private.is_ai_inbound_recipient_allowlisted(
           cc.org_id, v_campaign.operation_id, cc.contact_id
         )
     ) then
    raise exception 'campaign_contact_not_allowlisted' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_reactivation_wave_production_gate()
  from public, anon, authenticated, service_role;
drop trigger if exists campaign_wave_reactivation_production_gate
  on public.campaign_wave_release_requests;
create trigger campaign_wave_reactivation_production_gate
before insert on public.campaign_wave_release_requests
for each row execute function private.enforce_reactivation_wave_production_gate();

-- A production reactivation response must have a campaign contact as its
-- provenance. The opening message trigger below marks the conversation before
-- any later inbound turn can enqueue Pedro.
create or replace function private.is_reactivation_production_allowed(
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    join public.campaign_contacts cc
      on cc.org_id = c.org_id
     and cc.contact_id = c.contact_id
     and cc.opportunity_id = c.opportunity_id
    join public.campaigns campaign
      on campaign.org_id = cc.org_id
     and campaign.id = cc.campaign_id
    join public.organization_settings os
      on os.org_id = c.org_id
    where c.id = p_conversation_id
      and c.journey = 'reactivation'
      and c.ai_mode = 'production'
      and campaign.campaign_type = 'reactivation'
      and campaign.ai_mode = 'production'
      and os.reactivation_ai_mode = 'production'
      and os.reactivation_release_state in ('test_controlled', 'released')
      and (
        os.reactivation_release_state = 'released'
        or private.is_ai_inbound_recipient_allowlisted(
          c.org_id, c.operation_id, c.contact_id
        )
      )
  );
$$;

revoke all on function private.is_reactivation_production_allowed(uuid)
  from public, anon, authenticated, service_role;

-- Reapply eligibility at queue time. Normal inbound may use shadow or
-- assisted, but production is never eligible outside a reactivation campaign.
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
      and ct.status = 'active'
      and (
        (
          c.journey = 'reactivation'
          and (
            (c.ai_mode = 'production'
             and private.is_reactivation_production_allowed(c.id))
            or (c.ai_mode in ('shadow', 'assisted')
                and os.reactivation_ai_mode = c.ai_mode
                and os.reactivation_release_state <> 'blocked')
          )
        )
        or (
          c.journey <> 'reactivation'
          and c.ai_mode <> 'production'
          and os.ai_global_mode = c.ai_mode
          and os.inbound_ai_mode = c.ai_mode
          and os.ai_global_mode <> 'off'
        )
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

-- Revalidate queued production turns when the runtime worker claims them.
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

  if v_execution.mode = 'production' then
    select * into v_conversation
    from public.conversations
    where id = v_execution.conversation_id;

    if not found or v_conversation.journey <> 'reactivation' then
      update public.ai_executions
      set status = 'blocked',
          error_code = 'production_only_for_reactivation',
          error_redacted = 'Produção automática só está liberada para reativação.',
          completed_at = now()
      where id = v_execution.id;
      return false;
    end if;

    if not private.is_reactivation_production_allowed(v_conversation.id) then
      update public.ai_executions
      set status = 'blocked',
          error_code = 'reactivation_production_not_released',
          error_redacted = 'A produção da reativação não está liberada para este destinatário.',
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

-- Final defense for every AI-authored production message, including stale
-- conversations created before this migration.
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

  if not found or v_conversation.ai_mode <> 'production' then
    return new;
  end if;

  if v_conversation.journey <> 'reactivation' then
    raise exception 'production_only_for_reactivation' using errcode = '22023';
  end if;

  if not private.is_reactivation_production_allowed(v_conversation.id) then
    raise exception 'reactivation_production_not_released' using errcode = '22023';
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

-- The current campaign executor inserts the opening as a system message. Use
-- its campaign_id metadata to carry reactivation provenance into the existing
-- conversation without duplicating that large executor function here.
create or replace function private.mark_reactivation_campaign_conversation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.direction <> 'outbound'
     or new.sender_type <> 'system'
     or new.metadata->>'campaign_id' is null then
    return new;
  end if;

  update public.conversations conversation
  set journey = 'reactivation',
      ai_mode = campaign.ai_mode,
      updated_at = now()
  from public.campaigns campaign
  where conversation.id = new.conversation_id
    and campaign.org_id = new.org_id
    and campaign.id::text = new.metadata->>'campaign_id'
    and campaign.campaign_type = 'reactivation';

  return new;
end;
$$;

revoke all on function private.mark_reactivation_campaign_conversation()
  from public, anon, authenticated, service_role;
drop trigger if exists campaign_opening_marks_reactivation on public.messages;
create trigger campaign_opening_marks_reactivation
after insert on public.messages
for each row execute function private.mark_reactivation_campaign_conversation();

commit;
