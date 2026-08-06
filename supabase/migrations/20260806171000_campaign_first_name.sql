begin;

-- Campaign greetings use a campaign-local snapshot so the CRM can keep its
-- canonical full name while preview and dispatch remain consistent.
alter table public.campaign_contacts
  add column campaign_first_name text;

create or replace function private.campaign_first_name_from_text(p_name text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(
    left(
      split_part(
        trim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g')),
        ' ',
        1
      ),
      120
    ),
    ''
  );
$$;

create or replace function private.populate_campaign_first_name()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_import_name text;
  v_contact_name text;
begin
  select nullif(trim(r.normalized_name), '')
    into v_import_name
  from public.campaign_import_rows r
  where r.id = new.import_row_id
    and r.org_id = new.org_id;

  select nullif(trim(c.name), '')
    into v_contact_name
  from public.contacts c
  where c.id = new.contact_id
    and c.org_id = new.org_id;

  -- Older imports could have mapped an identifier such as LEAD-0013 as the
  -- name. In that case the existing contact name is the useful fallback.
  if v_import_name ~* '^(lead|leead)([-_ ]?[0-9]+)?$' then
    v_import_name := null;
  end if;

  new.campaign_first_name := private.campaign_first_name_from_text(
    coalesce(v_import_name, v_contact_name)
  );
  return new;
end;
$$;

revoke all on function private.campaign_first_name_from_text(text)
  from public, anon, authenticated, service_role;
revoke all on function private.populate_campaign_first_name()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_contacts_set_first_name on public.campaign_contacts;
create trigger campaign_contacts_set_first_name
before insert on public.campaign_contacts
for each row execute function private.populate_campaign_first_name();

-- Backfill existing campaign contacts without changing contacts.name.
update public.campaign_contacts cc
set campaign_first_name = private.campaign_first_name_from_text(
  case
    when r.normalized_name ~* '^(lead|leead)([-_ ]?[0-9]+)?$' then c.name
    else coalesce(r.normalized_name, c.name)
  end
)
from public.contacts c, public.campaign_import_rows r
where cc.contact_id = c.id
  and cc.org_id = c.org_id
  and r.id = cc.import_row_id
  and r.org_id = cc.org_id
  and cc.campaign_first_name is null;

update public.campaign_contacts cc
set campaign_first_name = private.campaign_first_name_from_text(c.name)
from public.contacts c
where cc.contact_id = c.id
  and cc.org_id = c.org_id
  and cc.campaign_first_name is null;

create or replace function private.render_campaign_opening(
  p_template text,
  p_first_name text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select replace(
    replace(
      replace(coalesce(p_template, ''), '{{nome}}', coalesce(p_first_name, '')),
      '{{name}}',
      coalesce(p_first_name, '')
    ),
    '{{first_name}}',
    coalesce(p_first_name, '')
  );
$$;

create or replace function private.refresh_campaign_opening_examples()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_examples jsonb;
begin
  if new.campaign_type <> 'reactivation'
     or new.status not in ('review', 'approved', 'running', 'paused') then
    return new;
  end if;

  select coalesce(
    jsonb_agg(
      private.render_campaign_opening(new.opening_template, cc.campaign_first_name)
      order by cc.created_at
    ),
    '[]'::jsonb
  )
    into v_examples
  from public.campaign_contacts cc
  where cc.campaign_id = new.id
    and cc.org_id = new.org_id;

  if v_examples is distinct from new.opening_examples then
    update public.campaigns
    set opening_examples = v_examples
    where id = new.id
      and org_id = new.org_id;
  end if;
  return new;
end;
$$;

revoke all on function private.render_campaign_opening(text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.refresh_campaign_opening_examples()
  from public, anon, authenticated, service_role;

drop trigger if exists campaigns_refresh_opening_examples on public.campaigns;
create trigger campaigns_refresh_opening_examples
after update of status, opening_template, opening_examples on public.campaigns
for each row
when (
  new.campaign_type = 'reactivation'
  and new.status in ('review', 'approved', 'running', 'paused')
  and (
    old.status is distinct from new.status
    or old.opening_template is distinct from new.opening_template
    or old.opening_examples is distinct from new.opening_examples
  )
)
execute function private.refresh_campaign_opening_examples();

-- Rebuild persisted previews for campaigns that already existed.
with refreshed as (
  select
    c.id,
    c.org_id,
    coalesce(
      jsonb_agg(
        private.render_campaign_opening(c.opening_template, cc.campaign_first_name)
        order by cc.created_at
      ),
      '[]'::jsonb
    ) as opening_examples
  from public.campaigns c
  left join public.campaign_contacts cc
    on cc.campaign_id = c.id
   and cc.org_id = c.org_id
  where c.campaign_type = 'reactivation'
  group by c.id, c.org_id
)
update public.campaigns c
set opening_examples = refreshed.opening_examples
from refreshed
where c.id = refreshed.id
  and c.org_id = refreshed.org_id;

-- Keep the durable worker aligned with the preview. This is the phase-12
-- executor retained under this name by the later runtime wrapper chain.
create or replace function public.execute_runtime_job_phase12(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_offer public.call_offers%rowtype;
  v_call public.calls%rowtype;
  v_campaign public.campaigns%rowtype;
  v_campaign_contact public.campaign_contacts%rowtype;
  v_contact public.contacts%rowtype;
  v_conversation public.conversations%rowtype;
  v_message_id uuid;
  v_body text;
  v_first_name text;
  v_local_time time;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'runtime_service_role_required' using errcode = '42501';
  end if;

  select * into v_job
  from public.scheduled_jobs
  where id = p_job_id and status = 'leased'
  for update;
  if not found then
    return jsonb_build_object('status', 'ignored');
  end if;

  if v_job.job_type = 'campaign.contact.dispatch' then
    select * into v_campaign_contact
    from public.campaign_contacts
    where id = (v_job.payload ->> 'campaign_contact_id')::uuid
    for update;
    select * into v_campaign
    from public.campaigns
    where id = v_campaign_contact.campaign_id
    for update;
    select * into v_contact
    from public.contacts
    where id = v_campaign_contact.contact_id;

    if not found or v_campaign.status <> 'running' or v_campaign_contact.status <> 'queued' then
      return jsonb_build_object('status', 'cancelled');
    end if;
    v_local_time := (now() at time zone v_campaign.timezone)::time;
    if v_local_time < v_campaign.send_window_start
       or v_local_time >= v_campaign.send_window_end then
      return jsonb_build_object(
        'status', 'retry',
        'retry_seconds', 900,
        'reason', 'outside_send_window'
      );
    end if;
    if exists (
      select 1
      from public.opt_outs
      where operation_id = v_campaign.operation_id
        and contact_id = v_campaign_contact.contact_id
        and revoked_at is null
    ) then
      update public.campaign_contacts
      set status = 'suppressed',
          suppression_reason = 'opt_out',
          last_revalidated_at = now(),
          updated_at = now()
      where id = v_campaign_contact.id;
      return jsonb_build_object('status', 'cancelled');
    end if;

    select c.* into v_conversation
    from public.conversations c
    where c.opportunity_id = v_campaign_contact.opportunity_id
      and c.status in ('active', 'paused')
    for update;
    if not found then
      insert into public.conversations(
        org_id, operation_id, contact_id, opportunity_id, connection_id,
        status, ownership, ai_mode
      )
      values(
        v_campaign.org_id, v_campaign.operation_id, v_campaign_contact.contact_id,
        v_campaign_contact.opportunity_id, v_campaign.connection_id,
        'active', 'ai', v_campaign.ai_mode
      )
      returning * into v_conversation;
      update public.conversations
      set ai_mode = v_campaign.ai_mode
      where id = v_conversation.id;
      update public.opportunities
      set current_conversation_id = v_conversation.id,
          version = version + 1,
          updated_at = now()
      where id = v_campaign_contact.opportunity_id;
    end if;

    v_first_name := coalesce(
      nullif(trim(v_campaign_contact.campaign_first_name), ''),
      private.campaign_first_name_from_text(v_contact.name)
    );
    v_body := private.render_campaign_opening(v_campaign.opening_template, v_first_name);
    insert into public.messages(
      org_id, operation_id, conversation_id, direction, sender_type,
      content_type, body, provider_status, metadata
    )
    values(
      v_campaign.org_id, v_campaign.operation_id, v_conversation.id,
      'outbound', 'system', 'text', v_body, 'queued',
      jsonb_build_object(
        'campaign_id', v_campaign.id,
        'campaign_contact_id', v_campaign_contact.id,
        'runtime_job_id', v_job.id
      )
    )
    returning id into v_message_id;
    return jsonb_build_object('status', 'send', 'message_id', v_message_id);
  end if;

  if v_job.job_type = 'call.offer.activate' then
    select * into v_offer
    from public.call_offers
    where id = (v_job.payload ->> 'offer_id')::uuid
    for update;
    select * into v_call
    from public.calls
    where id = v_offer.call_id;
    if not found
       or v_offer.status <> 'scheduled'
       or v_call.status not in ('distributing', 'unassigned_alerted')
       or v_offer.expires_at <= now() then
      update public.call_offers
      set status = case when status = 'scheduled' then 'cancelled' else status end
      where id = v_offer.id;
      return jsonb_build_object('status', 'cancelled');
    end if;
    update public.call_offers set status = 'pending', sent_at = now() where id = v_offer.id;
    insert into private.outbox_events(
      org_id, operation_id, event_type, aggregate_type, aggregate_id,
      payload, idempotency_key
    )
    values(
      v_offer.org_id, v_call.operation_id, 'call.offer_sent.v1', 'call_offer',
      v_offer.id, jsonb_build_object('call_id', v_call.id, 'offer_id', v_offer.id),
      'call-offer:' || v_offer.id::text
    )
    on conflict (idempotency_key) do nothing;
    return jsonb_build_object('status', 'completed');
  end if;

  if v_job.job_type = 'call.reminder.lead' then
    select * into v_call
    from public.calls
    where id = (v_job.payload ->> 'call_id')::uuid;
    if not found or v_call.status <> 'assigned' then
      return jsonb_build_object('status', 'cancelled');
    end if;
    select c.* into v_conversation
    from public.opportunities o
    join public.conversations c on c.id = o.current_conversation_id
    where o.id = v_call.opportunity_id;
    if not found then
      return jsonb_build_object('status', 'cancelled');
    end if;
    v_body := case
      when (v_job.payload ->> 'offset')::integer <= 10
        then 'Lembrete: nossa conversa começa em cerca de 10 minutos. Até já!'
      else 'Passando para lembrar da nossa conversa agendada para hoje. Se precisar ajustar, me avise por aqui.'
    end;
    insert into public.messages(
      org_id, operation_id, conversation_id, direction, sender_type,
      content_type, body, provider_status, metadata
    )
    values(
      v_call.org_id, v_call.operation_id, v_conversation.id, 'outbound',
      'system', 'text', v_body, 'queued',
      jsonb_build_object('call_id', v_call.id, 'runtime_job_id', v_job.id)
    )
    returning id into v_message_id;
    return jsonb_build_object('status', 'send', 'message_id', v_message_id);
  end if;

  if v_job.job_type = 'call.result.due' then
    select * into v_call
    from public.calls
    where id = (v_job.payload ->> 'call_id')::uuid;
    if found and v_call.status = 'assigned' then
      insert into public.alerts(
        org_id, operation_id, severity, category, title, body,
        entity_type, entity_id, dedupe_key
      )
      values(
        v_call.org_id, v_call.operation_id, 'warning', 'call',
        'Resultado da call pendente',
        'Registre o resultado para manter o funil atualizado.',
        'call', v_call.id, 'call-result-due:' || v_call.id::text
      )
      on conflict (org_id, dedupe_key)
        where dedupe_key is not null and status <> 'resolved'
      do nothing;
    end if;
    return jsonb_build_object('status', 'completed');
  end if;

  return jsonb_build_object('status', 'unsupported', 'reason', 'unsupported_job_type');
end;
$$;

revoke all on function public.execute_runtime_job_phase12(uuid)
  from public, anon, authenticated;
grant execute on function public.execute_runtime_job_phase12(uuid) to service_role;

commit;
