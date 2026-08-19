-- WhatsApp providers can return Brazilian mobile JIDs in the legacy
-- eight-digit form. Canonicalize them before either inbound trigger resolves
-- the contact so campaign replies keep using the original conversation.
create or replace function private.canonical_whatsapp_e164(p_e164 text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when p_e164 ~ '^\+55[1-9][0-9][6-9][0-9]{7}$'
      then left(p_e164, 5) || '9' || substr(p_e164, 6)
    else p_e164
  end;
$$;

revoke all on function private.canonical_whatsapp_e164(text)
from public, anon, authenticated, service_role;

create or replace function private.canonicalize_whatsapp_ingest_phone()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.from_e164 := private.canonical_whatsapp_e164(new.from_e164);
  return new;
end;
$$;

revoke all on function private.canonicalize_whatsapp_ingest_phone()
from public, anon, authenticated, service_role;

drop trigger if exists webhook_ingest_canonicalize_phone
on public.webhook_ingest_requests;

create trigger webhook_ingest_canonicalize_phone
before insert on public.webhook_ingest_requests
for each row execute function private.canonicalize_whatsapp_ingest_phone();

-- The continuous-improvement trigger was created before escalations adopted
-- source_execution_id. Referencing the removed execution_id field aborted the
-- complete transaction for every manual message sent from the connected phone.
create or replace function private.capture_escalation_feedback_signal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.ai_feedback_signals(
    org_id,
    operation_id,
    conversation_id,
    execution_id,
    source,
    signal_type,
    severity,
    dedupe_key,
    evidence,
    occurred_at
  ) values (
    new.org_id,
    new.operation_id,
    new.conversation_id,
    new.source_execution_id,
    'escalation',
    'unexpected_escalation',
    case when new.severity = 'critical' then 'critical' else 'important' end,
    'escalation:' || new.id::text,
    jsonb_build_object(
      'escalation_id', new.id,
      'category', new.category,
      'severity', new.severity,
      'source_execution_id', new.source_execution_id
    ),
    new.created_at
  )
  on conflict(org_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function private.capture_escalation_feedback_signal()
from public, anon, authenticated, service_role;

-- Repair only the unambiguous technical-duplicate shape produced by the
-- provider mismatch: one legacy inbound conversation and one campaign
-- conversation for the canonical variant, in the same operation/connection.
do $$
declare
  v_pair record;
  v_snapshot jsonb;
begin
  for v_pair in
    select
      legacy_phone.org_id,
      legacy_phone.id as legacy_phone_id,
      legacy_phone.contact_id as source_contact_id,
      canonical_phone.contact_id as target_contact_id,
      source_conversation.id as source_conversation_id,
      target_conversation.id as target_conversation_id,
      source_conversation.opportunity_id as source_opportunity_id,
      target_conversation.opportunity_id as target_opportunity_id
    from public.contact_phones legacy_phone
    join public.contacts source_contact
      on source_contact.id = legacy_phone.contact_id
     and source_contact.org_id = legacy_phone.org_id
     and source_contact.status = 'active'
    join public.contact_phones canonical_phone
      on canonical_phone.org_id = legacy_phone.org_id
     and canonical_phone.e164 = private.canonical_whatsapp_e164(legacy_phone.e164)
     and canonical_phone.status = 'active'
     and canonical_phone.contact_id <> legacy_phone.contact_id
    join public.contacts target_contact
      on target_contact.id = canonical_phone.contact_id
     and target_contact.org_id = canonical_phone.org_id
     and target_contact.status = 'active'
    join public.conversations source_conversation
      on source_conversation.contact_id = legacy_phone.contact_id
     and source_conversation.org_id = legacy_phone.org_id
     and source_conversation.status in ('active', 'paused')
     and source_conversation.journey = 'inbound'
    join public.conversations target_conversation
      on target_conversation.contact_id = canonical_phone.contact_id
     and target_conversation.org_id = canonical_phone.org_id
     and target_conversation.status in ('active', 'paused')
     and target_conversation.journey = 'reactivation'
     and target_conversation.operation_id = source_conversation.operation_id
     and target_conversation.connection_id = source_conversation.connection_id
    where legacy_phone.status = 'active'
      and legacy_phone.e164 ~ '^\+55[1-9][0-9][6-9][0-9]{7}$'
      and (
        select count(*)
        from public.conversations c
        where c.contact_id = legacy_phone.contact_id
          and c.status in ('active', 'paused')
      ) = 1
      and (
        select count(*)
        from public.conversations c
        where c.contact_id = canonical_phone.contact_id
          and c.status in ('active', 'paused')
      ) = 1
      and exists (
        select 1
        from public.campaign_contacts campaign_contact
        where campaign_contact.contact_id = canonical_phone.contact_id
          and campaign_contact.opportunity_id = target_conversation.opportunity_id
      )
      and not exists (
        select 1
        from public.campaign_contacts campaign_contact
        where campaign_contact.contact_id = legacy_phone.contact_id
      )
    order by legacy_phone.created_at, legacy_phone.id
  loop
    perform 1
    from public.contacts
    where id in (v_pair.source_contact_id, v_pair.target_contact_id)
    order by id
    for update;

    select jsonb_build_object(
      'reason', 'canonical_brazilian_mobile_identity_repair',
      'source_contact', to_jsonb(source_contact),
      'target_contact', to_jsonb(target_contact),
      'source_conversation_id', v_pair.source_conversation_id,
      'target_conversation_id', v_pair.target_conversation_id,
      'source_opportunity_id', v_pair.source_opportunity_id,
      'target_opportunity_id', v_pair.target_opportunity_id
    )
    into v_snapshot
    from public.contacts source_contact
    cross join public.contacts target_contact
    where source_contact.id = v_pair.source_contact_id
      and target_contact.id = v_pair.target_contact_id;

    insert into public.contact_merge_history(
      org_id,
      source_contact_id,
      target_contact_id,
      snapshot,
      merged_by
    ) values (
      v_pair.org_id,
      v_pair.source_contact_id,
      v_pair.target_contact_id,
      v_snapshot,
      null
    );

    update public.messages
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.ai_execution_requests
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.ai_executions
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.ai_suggestions
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.ai_feedback_signals
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.conversation_summaries
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.message_send_requests
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.webhook_ingest_requests
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.escalations
    set conversation_id = v_pair.target_conversation_id,
        opportunity_id = v_pair.target_opportunity_id
    where conversation_id = v_pair.source_conversation_id;

    update public.internal_threads
    set conversation_id = v_pair.target_conversation_id,
        opportunity_id = v_pair.target_opportunity_id,
        updated_at = now()
    where conversation_id = v_pair.source_conversation_id;

    update public.internal_action_proposals
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.learning_suggestions
    set conversation_id = v_pair.target_conversation_id
    where conversation_id = v_pair.source_conversation_id;

    update public.experiment_assignments
    set conversation_id = v_pair.target_conversation_id,
        opportunity_id = v_pair.target_opportunity_id
    where conversation_id = v_pair.source_conversation_id;

    update public.qualification_value_history history
    set opportunity_id = v_pair.target_opportunity_id
    where history.opportunity_id = v_pair.source_opportunity_id
      and exists (
        select 1
        from public.qualification_values value
        where value.id = history.qualification_value_id
          and value.opportunity_id = v_pair.source_opportunity_id
          and not exists (
            select 1
            from public.qualification_values target_value
            where target_value.opportunity_id = v_pair.target_opportunity_id
              and target_value.definition_id = value.definition_id
          )
      );

    update public.qualification_values value
    set opportunity_id = v_pair.target_opportunity_id
    where value.opportunity_id = v_pair.source_opportunity_id
      and not exists (
        select 1
        from public.qualification_values target_value
        where target_value.opportunity_id = v_pair.target_opportunity_id
          and target_value.definition_id = value.definition_id
      );

    update public.qualification_value_requests request
    set opportunity_id = v_pair.target_opportunity_id
    where request.opportunity_id = v_pair.source_opportunity_id;

    update public.scheduled_jobs job
    set aggregate_id = v_pair.target_conversation_id,
        payload = jsonb_set(
          jsonb_set(
            coalesce(job.payload, '{}'::jsonb),
            '{conversation_id}',
            to_jsonb(v_pair.target_conversation_id::text),
            true
          ),
          '{opportunity_id}',
          to_jsonb(v_pair.target_opportunity_id::text),
          true
        ),
        dedupe_key = replace(
          replace(
            job.dedupe_key,
            v_pair.source_conversation_id::text,
            v_pair.target_conversation_id::text
          ),
          v_pair.source_opportunity_id::text,
          v_pair.target_opportunity_id::text
        ),
        updated_at = now()
    where job.aggregate_type = 'conversation'
      and job.aggregate_id = v_pair.source_conversation_id
      and job.status = 'pending';

    update public.conversations target_conversation
    set last_inbound_at = activity.last_inbound_at,
        last_outbound_at = activity.last_outbound_at,
        last_message_preview = activity.last_message_preview,
        version = target_conversation.version + 1,
        updated_at = now()
    from lateral (
      select
        max(coalesce(message.provider_timestamp, message.created_at))
          filter (where message.direction = 'inbound') as last_inbound_at,
        max(coalesce(message.provider_timestamp, message.created_at))
          filter (where message.direction = 'outbound') as last_outbound_at,
        (
          select left(coalesce(latest.body, '[' || latest.content_type || ']'), 180)
          from public.messages latest
          where latest.conversation_id = v_pair.target_conversation_id
          order by latest.created_at desc, latest.id desc
          limit 1
        ) as last_message_preview
      from public.messages message
      where message.conversation_id = v_pair.target_conversation_id
    ) activity
    where target_conversation.id = v_pair.target_conversation_id;

    update public.conversations
    set status = 'closed',
        closed_at = now(),
        pause_reason = 'duplicate_phone_identity_repaired',
        version = version + 1,
        updated_at = now()
    where id = v_pair.source_conversation_id;

    update public.opportunities
    set last_activity_at = greatest(
          last_activity_at,
          coalesce((
            select max(message.created_at)
            from public.messages message
            where message.conversation_id = v_pair.target_conversation_id
          ), last_activity_at)
        ),
        version = version + 1,
        updated_at = now()
    where id = v_pair.target_opportunity_id;

    update public.opportunities
    set status = 'lost',
        current_conversation_id = null,
        internal_note = concat_ws(
          E'\n',
          nullif(internal_note, ''),
          '[system] Duplicate opportunity retired after canonical phone identity repair.'
        ),
        version = version + 1,
        updated_at = now()
    where id = v_pair.source_opportunity_id;

    delete from public.contact_tags source_tag
    where source_tag.contact_id = v_pair.source_contact_id
      and exists (
        select 1
        from public.contact_tags target_tag
        where target_tag.contact_id = v_pair.target_contact_id
          and target_tag.label = source_tag.label
      );

    update public.contact_tags
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    delete from public.opportunity_participants source_participant
    where source_participant.contact_id = v_pair.source_contact_id
      and exists (
        select 1
        from public.opportunity_participants target_participant
        where target_participant.opportunity_id = source_participant.opportunity_id
          and target_participant.contact_id = v_pair.target_contact_id
      );

    update public.opportunity_participants
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.opportunities
    set contact_id = v_pair.target_contact_id,
        version = version + 1,
        updated_at = now()
    where contact_id = v_pair.source_contact_id;

    update public.conversations
    set contact_id = v_pair.target_contact_id,
        version = version + 1,
        updated_at = now()
    where contact_id = v_pair.source_contact_id;

    update public.source_attributions
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.lead_creation_requests
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.campaign_import_rows
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    delete from public.campaign_contacts source_campaign_contact
    where source_campaign_contact.contact_id = v_pair.source_contact_id
      and exists (
        select 1
        from public.campaign_contacts target_campaign_contact
        where target_campaign_contact.campaign_id = source_campaign_contact.campaign_id
          and target_campaign_contact.contact_id = v_pair.target_contact_id
      );

    update public.campaign_contacts
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.contact_persona_bindings
    set unbound_at = now()
    where contact_id = v_pair.source_contact_id
      and unbound_at is null
      and exists (
        select 1
        from public.contact_persona_bindings target_binding
        where target_binding.contact_id = v_pair.target_contact_id
          and target_binding.unbound_at is null
      );

    update public.contact_persona_bindings
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.preleads
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    update public.privacy_requests
    set contact_id = v_pair.target_contact_id
    where contact_id = v_pair.source_contact_id;

    insert into public.opt_outs(
      org_id,
      operation_id,
      contact_id,
      channel,
      reason,
      source,
      recorded_at,
      recorded_by
    )
    select
      opt_out.org_id,
      opt_out.operation_id,
      v_pair.target_contact_id,
      opt_out.channel,
      coalesce(opt_out.reason, 'Inherited during canonical phone identity repair'),
      opt_out.source,
      opt_out.recorded_at,
      opt_out.recorded_by
    from public.opt_outs opt_out
    where opt_out.contact_id = v_pair.source_contact_id
      and opt_out.revoked_at is null
    on conflict(operation_id, contact_id, channel)
      where revoked_at is null
    do nothing;

    update public.opt_outs
    set revoked_at = coalesce(revoked_at, now())
    where contact_id = v_pair.source_contact_id
      and revoked_at is null;

    update public.contact_phones
    set contact_id = v_pair.target_contact_id,
        is_primary = false,
        status = case
          when private.canonical_whatsapp_e164(e164) =
               private.canonical_whatsapp_e164((
                 select e164
                 from public.contact_phones
                 where id = v_pair.legacy_phone_id
               ))
            then 'inactive'
          else status
        end,
        updated_at = now()
    where contact_id = v_pair.source_contact_id;

    update public.contacts
    set status = 'merged',
        merged_into_contact_id = v_pair.target_contact_id,
        updated_at = now()
    where id = v_pair.source_contact_id;

    insert into audit.events(
      org_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      v_pair.org_id,
      'system',
      'contact.canonical_phone_identity_repaired',
      'contacts',
      v_pair.source_contact_id,
      jsonb_build_object(
        'target_contact_id', v_pair.target_contact_id,
        'source_conversation_id', v_pair.source_conversation_id,
        'target_conversation_id', v_pair.target_conversation_id
      )
    );

    perform private.recompute_opportunity_score(v_pair.target_opportunity_id);
  end loop;
end;
$$;

-- Canonicalize every remaining standalone legacy mobile in place. The original
-- provider/import value remains available in contact_phones.original.
update public.contact_phones phone
set e164 = private.canonical_whatsapp_e164(phone.e164),
    updated_at = now()
from public.contacts contact
where contact.id = phone.contact_id
  and contact.org_id = phone.org_id
  and contact.status = 'active'
  and phone.status = 'active'
  and phone.e164 ~ '^\+55[1-9][0-9][6-9][0-9]{7}$'
  and not exists (
    select 1
    from public.contact_phones existing
    where existing.org_id = phone.org_id
      and existing.status = 'active'
      and existing.e164 = private.canonical_whatsapp_e164(phone.e164)
      and existing.id <> phone.id
  );
