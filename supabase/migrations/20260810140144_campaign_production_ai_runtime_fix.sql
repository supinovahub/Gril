begin;

-- The organization-level switch controls normal inbound conversations. A
-- reactivation campaign has its own explicit mode and release gate, so a
-- change to the inbound mode must never rewrite campaign conversations.
create or replace function private.sync_conversation_ai_mode_from_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_synced integer := 0;
  v_inbound_mode text := case
    when new.ai_global_mode = 'off' then 'off'
    else coalesce(new.inbound_ai_mode, new.ai_global_mode, 'off')
  end;
begin
  if new.ai_global_mode is not distinct from old.ai_global_mode then
    return new;
  end if;

  update public.conversations c
  set ai_mode = v_inbound_mode,
      version = c.version + 1,
      updated_at = now()
  where c.org_id = new.org_id
    and c.journey = 'inbound'
    and c.ai_mode is distinct from v_inbound_mode
    and (
      v_inbound_mode = 'off'
      or (
        c.status = 'active'
        and c.ownership = 'ai'
        and c.pause_reason is null
        and exists (
          select 1
          from public.contacts ct
          where ct.id = c.contact_id and ct.status = 'active'
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
          where cp.contact_id = c.contact_id and cp.status = 'active'
        )
      )
    );

  get diagnostics v_synced = row_count;
  insert into audit.events (
    org_id, actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    new.org_id,
    (select auth.uid()),
    case when (select auth.uid()) is null then 'system' else 'user' end,
    'organization.ai_mode_synced',
    'organizations',
    new.org_id,
    jsonb_build_object(
      'from', old.ai_global_mode,
      'to', new.ai_global_mode,
      'inbound_mode', v_inbound_mode,
      'conversations', v_synced,
      'journey', 'inbound'
    )
  );
  return new;
end;
$$;

revoke all on function private.sync_conversation_ai_mode_from_organization()
  from public, anon, authenticated, service_role;

drop trigger if exists organization_settings_sync_conversation_ai_mode
  on public.organization_settings;
create trigger organization_settings_sync_conversation_ai_mode
after update of ai_global_mode on public.organization_settings
for each row execute function private.sync_conversation_ai_mode_from_organization();

-- Campaign dispatches can find an already-existing conversation. Mark those
-- rows when the campaign contact is released, and mark newly-created rows
-- before the generic inbound default-mode trigger runs.
create or replace function private.mark_campaign_conversation_reactivation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  if new.status in ('opted_out', 'suppressed', 'failed', 'completed', 'excluded') then
    return new;
  end if;

  select * into v_campaign
  from public.campaigns
  where id = new.campaign_id and org_id = new.org_id;

  if not found
     or v_campaign.campaign_type <> 'reactivation'
     or v_campaign.status not in ('approved', 'running', 'paused') then
    return new;
  end if;

  update public.conversations c
  set journey = 'reactivation',
      ai_mode = v_campaign.ai_mode,
      version = c.version + 1,
      updated_at = now()
  where c.org_id = new.org_id
    and c.opportunity_id = new.opportunity_id
    and c.status in ('active', 'paused')
    and c.ownership = 'ai'
    and c.journey <> 'post_call';

  return new;
end;
$$;

revoke all on function private.mark_campaign_conversation_reactivation()
  from public, anon, authenticated, service_role;
drop trigger if exists campaign_contacts_mark_reactivation
  on public.campaign_contacts;
create trigger campaign_contacts_mark_reactivation
after insert or update of status, campaign_id, opportunity_id
on public.campaign_contacts
for each row execute function private.mark_campaign_conversation_reactivation();

-- The legacy after-insert trigger must respect the journey selected above;
-- otherwise it would replace a campaign's production mode with inbound mode.
create or replace function private.apply_default_conversation_ai_mode()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_mode text;
begin
  if new.journey <> 'inbound' then
    return new;
  end if;

  select inbound_ai_mode into v_mode
  from public.organization_settings
  where org_id = new.org_id;

  if coalesce(v_mode, 'off') <> 'off' then
    update public.conversations
    set ai_mode = v_mode,
        updated_at = now()
    where id = new.id;
    new.ai_mode := v_mode;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_default_conversation_ai_mode()
  from public, anon, authenticated, service_role;

create or replace function private.mark_new_campaign_conversation_reactivation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_campaign_ai_mode text;
begin
  select c.ai_mode into v_campaign_ai_mode
  from public.campaign_contacts cc
  join public.campaigns c on c.id = cc.campaign_id and c.org_id = cc.org_id
  where cc.org_id = new.org_id
    and cc.opportunity_id = new.opportunity_id
    and cc.status not in ('opted_out', 'suppressed', 'failed', 'completed', 'excluded')
    and c.campaign_type = 'reactivation'
    and c.status in ('approved', 'running', 'paused')
  order by c.updated_at desc
  limit 1;

  if v_campaign_ai_mode is not null then
    new.journey := 'reactivation';
    new.ai_mode := v_campaign_ai_mode;
  end if;
  return new;
end;
$$;

revoke all on function private.mark_new_campaign_conversation_reactivation()
  from public, anon, authenticated, service_role;
drop trigger if exists conversations_mark_campaign_reactivation
  on public.conversations;
create trigger conversations_mark_campaign_reactivation
before insert on public.conversations
for each row execute function private.mark_new_campaign_conversation_reactivation();

-- Existing campaign conversations created before the journey fix must use the
-- campaign mode immediately. Never rewrite post-call manager conversations.
with campaign_conversation_modes as (
  select distinct on (c.id)
    c.id,
    campaign.ai_mode
  from public.conversations c
  join public.campaign_contacts cc
    on cc.org_id = c.org_id and cc.opportunity_id = c.opportunity_id
  join public.campaigns campaign
    on campaign.id = cc.campaign_id and campaign.org_id = cc.org_id
  where c.journey <> 'post_call'
    and c.status in ('active', 'paused')
    and c.ownership = 'ai'
    and campaign.campaign_type = 'reactivation'
    and campaign.status in ('approved', 'running', 'paused')
    and cc.status not in ('opted_out', 'suppressed', 'failed', 'completed', 'excluded')
  order by c.id, campaign.updated_at desc
)
update public.conversations c
set journey = 'reactivation',
    ai_mode = m.ai_mode,
    version = c.version + 1,
    updated_at = now()
from campaign_conversation_modes m
where c.id = m.id
  and (c.journey <> 'reactivation' or c.ai_mode is distinct from m.ai_mode);

-- Normal inbound keeps its allowlist gate. Reactivation uses the campaign's
-- own release state and connection gate, independent of ai_global_mode.
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
      and (
        (
          c.journey = 'inbound'
          and os.inbound_ai_mode = c.ai_mode
          and os.inbound_ai_mode <> 'off'
          and (
            c.ai_mode <> 'production'
            or private.is_ai_inbound_recipient_allowlisted(c.org_id, c.operation_id, c.contact_id)
          )
        )
        or (
          c.journey = 'reactivation'
          and exists (
            select 1
            from public.campaign_contacts cc
            join public.campaigns campaign
              on campaign.id = cc.campaign_id
             and campaign.org_id = cc.org_id
            join public.whatsapp_connections wc
              on wc.id = campaign.connection_id
             and wc.org_id = campaign.org_id
            where cc.org_id = c.org_id
              and cc.opportunity_id = c.opportunity_id
              and cc.status not in ('opted_out', 'suppressed', 'failed', 'completed', 'excluded')
              and campaign.campaign_type = 'reactivation'
              and campaign.status = 'running'
              and campaign.ai_mode = c.ai_mode
              and campaign.ai_mode <> 'off'
              and os.reactivation_ai_mode = campaign.ai_mode
              and os.reactivation_release_state <> 'blocked'
              and wc.status = 'active'
              and wc.campaign_enabled
              and (
                os.reactivation_release_state = 'released'
                or (
                  os.reactivation_release_state = 'test_controlled'
                  and private.is_ai_inbound_recipient_allowlisted(c.org_id, c.operation_id, c.contact_id)
                )
              )
          )
        )
        or (
          c.journey = 'post_call'
          and os.ai_global_mode = c.ai_mode
          and os.ai_global_mode <> 'off'
        )
      )
  );
$$;

revoke all on function private.is_conversation_ai_eligible(uuid)
  from public, anon, authenticated, service_role;

-- Production executions are revalidated at claim time for every journey. This
-- closes stale queue entries when a campaign is paused, released, or revoked.
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

    if not found or not private.is_conversation_ai_eligible(v_conversation.id) then
      update public.ai_executions
      set status = 'blocked',
          error_code = 'production_runtime_not_eligible',
          error_redacted = 'A execução de produção foi bloqueada pelos controles atuais da conversa.',
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

commit;
