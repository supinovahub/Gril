begin;

-- Homologation data is deliberately identified by the HML- prefix required by
-- the operational protocol. This function never accepts an arbitrary lead id
-- and never touches organization configuration or the audit trail.
create or replace function private.prepare_homologation_context(
  p_org_id uuid,
  p_for_execution boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, audit
as $$
begin
  if p_org_id is null or not exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'owner'
        or (
          m.role = 'manager'
          and exists (
            select 1
            from public.membership_permissions mp
            where mp.membership_id = m.id
              and mp.permission = 'team.manage'
          )
        )
      )
  ) then
    raise exception 'homologation_context_forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gril:homologation:' || p_org_id::text, 0));

  drop table if exists pg_temp.hml_context_blockers;
  drop table if exists pg_temp.hml_context_storage;
  drop table if exists pg_temp.hml_context_ids;
  drop table if exists pg_temp.hml_context_contacts;
  drop table if exists pg_temp.hml_context_phones;
  drop table if exists pg_temp.hml_context_opportunities;
  drop table if exists pg_temp.hml_context_conversations;
  drop table if exists pg_temp.hml_context_messages;
  drop table if exists pg_temp.hml_context_calls;
  drop table if exists pg_temp.hml_context_holds;
  drop table if exists pg_temp.hml_context_executions;
  drop table if exists pg_temp.hml_context_suggestions;
  drop table if exists pg_temp.hml_context_ai_requests;
  drop table if exists pg_temp.hml_context_send_requests;
  drop table if exists pg_temp.hml_context_reviews;
  drop table if exists pg_temp.hml_context_context_versions;
  drop table if exists pg_temp.hml_context_qualification_values;
  drop table if exists pg_temp.hml_context_submissions;
  drop table if exists pg_temp.hml_context_jobs;

  create temporary table hml_context_blockers (
    reason text primary key
  ) on commit drop;
  create temporary table hml_context_storage (
    bucket text not null,
    path text not null,
    primary key (bucket, path)
  ) on commit drop;
  create temporary table hml_context_ids (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_contacts (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_phones (
    e164 text primary key
  ) on commit drop;
  create temporary table hml_context_opportunities (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_conversations (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_messages (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_calls (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_holds (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_executions (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_suggestions (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_ai_requests (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_send_requests (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_reviews (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_context_versions (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_qualification_values (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_submissions (
    id uuid primary key
  ) on commit drop;
  create temporary table hml_context_jobs (
    id uuid primary key
  ) on commit drop;

  insert into hml_context_contacts (id)
  select c.id
  from public.contacts c
  where c.org_id = p_org_id
    and upper(left(trim(c.name), 4)) = 'HML-';

  if (select count(*) from hml_context_contacts) > 20 then
    insert into hml_context_blockers (reason)
    values ('Mais de 20 contatos HML- foram encontrados; execute a limpeza em lotes menores.')
    on conflict do nothing;
  end if;

  if exists (
    select 1
    from public.contacts c
    where c.org_id = p_org_id
      and (
        (exists (select 1 from hml_context_contacts h where h.id = c.id) and c.merged_into_contact_id is not null)
        or exists (select 1 from hml_context_contacts h where h.id = c.merged_into_contact_id)
      )
  ) then
    insert into hml_context_blockers (reason)
    values ('Um contato HML- possui vínculo de merge; revise-o antes da limpeza.')
    on conflict do nothing;
  end if;

  insert into hml_context_phones (e164)
  select distinct cp.e164
  from public.contact_phones cp
  where cp.org_id = p_org_id
    and exists (select 1 from hml_context_contacts h where h.id = cp.contact_id);

  insert into hml_context_opportunities (id)
  select o.id
  from public.opportunities o
  where o.org_id = p_org_id
    and exists (select 1 from hml_context_contacts h where h.id = o.contact_id);

  if exists (
    select 1
    from public.opportunity_participants op
    where op.org_id = p_org_id
      and exists (select 1 from hml_context_contacts h where h.id = op.contact_id)
      and not exists (select 1 from hml_context_opportunities h where h.id = op.opportunity_id)
  ) then
    insert into hml_context_blockers (reason)
    values ('Um contato HML- participa de uma oportunidade que não é HML-; a limpeza foi bloqueada para evitar apagar dados comerciais.')
    on conflict do nothing;
  end if;

  if exists (
    select 1
    from public.source_attributions sa
    where sa.org_id = p_org_id
      and exists (select 1 from hml_context_contacts h where h.id = sa.contact_id)
      and sa.opportunity_id is not null
      and not exists (select 1 from hml_context_opportunities h where h.id = sa.opportunity_id)
  ) then
    insert into hml_context_blockers (reason)
    values ('Um contato HML- possui atribuição de origem em uma oportunidade não HML-; a limpeza foi bloqueada.')
    on conflict do nothing;
  end if;

  if exists (
    select 1
    from public.campaign_contacts cc
    where cc.org_id = p_org_id
      and exists (select 1 from hml_context_contacts h where h.id = cc.contact_id)
      and not exists (select 1 from hml_context_opportunities h where h.id = cc.opportunity_id)
  ) then
    insert into hml_context_blockers (reason)
    values ('Um contato HML- está em campanha para uma oportunidade não HML-; a limpeza foi bloqueada.')
    on conflict do nothing;
  end if;

  if exists (
    select 1
    from public.campaign_import_rows cir
    where cir.org_id = p_org_id
      and exists (select 1 from hml_context_contacts h where h.id = cir.contact_id)
      and cir.opportunity_id is not null
      and not exists (select 1 from hml_context_opportunities h where h.id = cir.opportunity_id)
  ) then
    insert into hml_context_blockers (reason)
    values ('Uma importação HML- aponta para uma oportunidade não HML-; a limpeza foi bloqueada.')
    on conflict do nothing;
  end if;

  insert into hml_context_conversations (id)
  select c.id
  from public.conversations c
  where c.org_id = p_org_id
    and (
      exists (select 1 from hml_context_contacts h where h.id = c.contact_id)
      or exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id)
    );

  if exists (
    select 1
    from public.conversations c
    where c.org_id = p_org_id
      and (
        (exists (select 1 from hml_context_contacts h where h.id = c.contact_id)
         and not exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id))
        or
        (exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id)
         and not exists (select 1 from hml_context_contacts h where h.id = c.contact_id))
      )
  ) then
    insert into hml_context_blockers (reason)
    values ('Uma conversa cruza um contato ou oportunidade fora do contexto HML-; a limpeza foi bloqueada.')
    on conflict do nothing;
  end if;

  insert into hml_context_messages (id)
  select m.id
  from public.messages m
  where m.org_id = p_org_id
    and exists (select 1 from hml_context_conversations h where h.id = m.conversation_id);

  insert into hml_context_calls (id)
  select c.id
  from public.calls c
  where c.org_id = p_org_id
    and exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id);

  insert into hml_context_holds (id)
  select h.id
  from public.call_holds h
  where h.org_id = p_org_id
    and exists (select 1 from hml_context_opportunities o where o.id = h.opportunity_id);

  insert into hml_context_context_versions (id)
  select v.id
  from public.conversation_context_versions v
  where v.org_id = p_org_id
    and exists (select 1 from hml_context_conversations c where c.id = v.conversation_id);

  insert into hml_context_executions (id)
  select e.id
  from public.ai_executions e
  where e.org_id = p_org_id
    and (
      exists (select 1 from hml_context_conversations c where c.id = e.conversation_id)
      or exists (select 1 from hml_context_messages m where m.id = e.request_message_id)
      or exists (select 1 from hml_context_context_versions v where v.id = e.context_version_id)
    );

  insert into hml_context_suggestions (id)
  select s.id
  from public.ai_suggestions s
  where s.org_id = p_org_id
    and (
      exists (select 1 from hml_context_conversations c where c.id = s.conversation_id)
      or exists (select 1 from hml_context_executions e where e.id = s.execution_id)
    );

  insert into hml_context_ai_requests (id)
  select r.id
  from public.ai_execution_requests r
  where r.org_id = p_org_id
    and (
      exists (select 1 from hml_context_conversations c where c.id = r.conversation_id)
      or exists (select 1 from hml_context_messages m where m.id = r.request_message_id)
      or exists (select 1 from hml_context_executions e where e.id = r.execution_id)
    );

  insert into hml_context_send_requests (id)
  select r.id
  from public.message_send_requests r
  where r.org_id = p_org_id
    and (
      exists (select 1 from hml_context_conversations c where c.id = r.conversation_id)
      or exists (select 1 from hml_context_messages m where m.id = r.message_id)
      or exists (select 1 from hml_context_messages m where m.id = r.reply_to_message_id)
      or exists (select 1 from hml_context_suggestions s where s.id = r.ai_suggestion_id)
    );

  insert into hml_context_reviews (id)
  select r.id
  from public.ai_suggestion_review_requests r
  where r.org_id = p_org_id
    and exists (select 1 from hml_context_suggestions s where s.id = r.suggestion_id);

  insert into hml_context_qualification_values (id)
  select q.id
  from public.qualification_values q
  where q.org_id = p_org_id
    and exists (select 1 from hml_context_opportunities o where o.id = q.opportunity_id);

  insert into hml_context_submissions (id)
  select p.submission_id
  from public.preleads p
  where p.org_id = p_org_id
    and (
      exists (select 1 from hml_context_contacts c where c.id = p.contact_id)
      or exists (select 1 from hml_context_opportunities o where o.id = p.opportunity_id)
    );

  insert into hml_context_ids (id)
  select id from hml_context_contacts
  union select id from hml_context_opportunities
  union select id from hml_context_conversations
  union select id from hml_context_messages
  union select id from hml_context_calls
  union select id from hml_context_holds
  union select id from hml_context_context_versions
  union select id from hml_context_executions
  union select id from hml_context_suggestions
  union select id from hml_context_ai_requests
  union select id from hml_context_send_requests
  union select id from hml_context_reviews
  union select id from hml_context_qualification_values
  union select id from hml_context_submissions
  on conflict do nothing;

  insert into hml_context_storage (bucket, path)
  select a.storage_bucket, a.storage_path
  from public.attachments a
  where a.org_id = p_org_id
    and exists (select 1 from hml_context_messages m where m.id = a.message_id)
  union
  select s.storage_bucket, s.storage_path
  from public.message_media_sources s
  where s.org_id = p_org_id
    and s.storage_bucket is not null
    and s.storage_path is not null
    and exists (select 1 from hml_context_messages m where m.id = s.message_id)
  on conflict do nothing;

  insert into hml_context_ids (id)
  select a.id
  from public.attachments a
  where a.org_id = p_org_id
    and exists (select 1 from hml_context_messages m where m.id = a.message_id)
  on conflict do nothing;

  insert into hml_context_jobs (id)
  select j.id
  from public.scheduled_jobs j
  where j.org_id = p_org_id
    and (
      exists (select 1 from hml_context_ids h where h.id = j.aggregate_id)
      or exists (select 1 from hml_context_ids h where j.payload::text like '%' || h.id::text || '%')
    );

  if p_for_execution and exists (select 1 from hml_context_blockers) then
    raise exception 'homologation_context_blocked' using
      errcode = '22023',
      detail = (select string_agg(reason, ' | ' order by reason) from hml_context_blockers);
  end if;
end;
$$;

create or replace function private.homologation_context_snapshot(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, audit
as $$
declare
  v_counts jsonb;
  v_ids jsonb;
begin
  v_counts := jsonb_build_object(
    'contacts', (select count(*) from hml_context_contacts),
    'contact_phones', (select count(*) from public.contact_phones cp where cp.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = cp.contact_id)),
    'opportunities', (select count(*) from hml_context_opportunities),
    'conversations', (select count(*) from hml_context_conversations),
    'messages', (select count(*) from hml_context_messages),
    'attachments', (select count(*) from public.attachments a where a.org_id = p_org_id and exists (select 1 from hml_context_messages h where h.id = a.message_id)),
    'ai_executions', (select count(*) from hml_context_executions),
    'ai_suggestions', (select count(*) from hml_context_suggestions),
    'calls', (select count(*) from hml_context_calls),
    'scheduled_jobs', (select count(*) from public.scheduled_jobs j where j.org_id = p_org_id and (exists (select 1 from hml_context_ids h where h.id = j.aggregate_id) or exists (select 1 from hml_context_ids h where j.payload::text like '%' || h.id::text || '%'))),
    'outbox_events', (select count(*) from private.outbox_events e where e.org_id = p_org_id and (exists (select 1 from hml_context_ids h where h.id = e.aggregate_id) or exists (select 1 from hml_context_ids h where e.payload::text like '%' || h.id::text || '%'))),
    'storage_objects', (select count(*) from hml_context_storage)
  );

  v_ids := jsonb_build_object(
    'contacts', coalesce((select jsonb_agg(id order by id) from hml_context_contacts), '[]'::jsonb),
    'opportunities', coalesce((select jsonb_agg(id order by id) from hml_context_opportunities), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(id order by id) from hml_context_conversations), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(id order by id) from hml_context_messages), '[]'::jsonb),
    'calls', coalesce((select jsonb_agg(id order by id) from hml_context_calls), '[]'::jsonb)
  );

  return jsonb_build_object(
    'eligible', (select count(*) from hml_context_contacts) > 0 and not exists (select 1 from hml_context_blockers),
    'blocked', coalesce((select jsonb_agg(reason order by reason) from hml_context_blockers), '[]'::jsonb),
    'max_contacts', 20,
    'counts', v_counts,
    'ids', v_ids,
    'storage_objects', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path) order by bucket, path) from hml_context_storage), '[]'::jsonb),
    'audit_preserved', true
  );
end;
$$;

create or replace function public.preview_homologation_context(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, audit
as $$
begin
  perform private.prepare_homologation_context(p_org_id, false);
  return private.homologation_context_snapshot(p_org_id);
end;
$$;

create or replace function public.purge_homologation_context(
  p_org_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, audit
as $$
declare
  v_snapshot jsonb;
  v_receipt jsonb;
  v_now timestamptz := now();
  v_actor uuid := (select auth.uid());
begin
  if p_confirmation is distinct from 'CONFIRMAR AÇÃO' then
    raise exception 'homologation_context_confirmation_required' using errcode = '22023';
  end if;

  perform private.prepare_homologation_context(p_org_id, true);
  v_snapshot := private.homologation_context_snapshot(p_org_id);

  if coalesce((v_snapshot->>'eligible')::boolean, false) = false then
    return v_snapshot || jsonb_build_object('status', 'no_eligible_context');
  end if;

  -- Cancel anything that could recreate or send a test effect before the
  -- records are removed. Audit rows are intentionally excluded everywhere.
  delete from public.scheduled_job_requests r
  where r.org_id = p_org_id
    and (
      r.job_id in (select id from hml_context_jobs)
      or exists (select 1 from hml_context_ids h where h.id = r.aggregate_id)
      or exists (select 1 from hml_context_ids h where r.payload::text like '%' || h.id::text || '%')
    );
  delete from public.scheduled_jobs j
  where j.org_id = p_org_id
    and (
      exists (select 1 from hml_context_jobs h where h.id = j.id)
      or exists (select 1 from hml_context_ids h where h.id = j.aggregate_id)
      or exists (select 1 from hml_context_ids h where j.payload::text like '%' || h.id::text || '%')
    );
  delete from private.outbox_events e
  where e.org_id = p_org_id
    and (
      exists (select 1 from hml_context_ids h where h.id = e.aggregate_id)
      or exists (select 1 from hml_context_ids h where e.payload::text like '%' || h.id::text || '%')
    );
  delete from private.webhook_inbox w
  where w.org_id = p_org_id
    and exists (select 1 from hml_context_ids h where w.payload::text like '%' || h.id::text || '%');
  delete from private.retention_purge_queue q
  where q.org_id = p_org_id
    and exists (select 1 from hml_context_ids h where h.id = q.entity_id);
  delete from public.operational_messages m
  where m.org_id = p_org_id
    and (exists (select 1 from hml_context_ids h where h.id = m.entity_id) or exists (select 1 from hml_context_ids h where m.metadata::text like '%' || h.id::text || '%'));
  delete from public.alerts a
  where a.org_id = p_org_id
    and exists (select 1 from hml_context_ids h where h.id = a.entity_id);
  delete from public.suppression_entries s
  where s.org_id = p_org_id
    and exists (select 1 from hml_context_phones h where h.e164 = s.phone_e164);

  delete from public.call_offer_response_requests r
  where r.org_id = p_org_id
    and (exists (select 1 from hml_context_calls h where h.id = r.call_id) or exists (select 1 from hml_context_ids h where h.id = r.offer_id));
  delete from public.call_offer_accept_requests r
  where r.org_id = p_org_id
    and (exists (select 1 from hml_context_calls h where h.id = r.call_id) or exists (select 1 from hml_context_ids h where h.id = r.offer_id));
  delete from public.call_distribution_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_result_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_video_link_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_results r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_assignments r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_offers r
  where r.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = r.call_id);
  delete from public.call_creation_requests r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_calls h where h.id = r.call_id));
  delete from public.calls c
  where c.org_id = p_org_id and exists (select 1 from hml_context_calls h where h.id = c.id);
  delete from public.call_holds h
  where h.org_id = p_org_id and exists (select 1 from hml_context_holds x where x.id = h.id);

  delete from public.conversation_ai_guidance g
  where g.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = g.conversation_id) or exists (select 1 from hml_context_suggestions h where h.id = g.source_suggestion_id));
  delete from public.ai_suggestion_review_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_suggestions h where h.id = r.suggestion_id);
  delete from public.message_send_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_send_requests h where h.id = r.id);
  delete from public.ai_execution_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_ai_requests h where h.id = r.id);
  delete from public.project_media_deliveries d
  where d.org_id = p_org_id and (exists (select 1 from hml_context_messages h where h.id = d.message_id) or exists (select 1 from hml_context_executions h where h.id = d.ai_execution_id));
  delete from public.usage_ledger l
  where l.org_id = p_org_id and exists (select 1 from hml_context_executions h where h.id = l.execution_id);
  delete from public.ai_executions e
  where e.org_id = p_org_id and exists (select 1 from hml_context_executions h where h.id = e.id);
  delete from public.ai_suggestions s
  where s.org_id = p_org_id and exists (select 1 from hml_context_suggestions h where h.id = s.id);
  delete from public.conversation_summaries s
  where s.org_id = p_org_id and exists (select 1 from hml_context_conversations h where h.id = s.conversation_id);
  delete from public.learning_suggestions s
  where s.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = s.conversation_id) or exists (select 1 from hml_context_messages h where h.id = s.message_id));
  delete from public.internal_action_proposals p
  where p.org_id = p_org_id and exists (select 1 from hml_context_conversations h where h.id = p.conversation_id);
  delete from public.internal_threads t
  where t.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = t.conversation_id) or exists (select 1 from hml_context_opportunities h where h.id = t.opportunity_id));
  delete from public.experiment_assignments e
  where e.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = e.conversation_id) or exists (select 1 from hml_context_opportunities h where h.id = e.opportunity_id));
  delete from public.escalations e
  where e.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = e.conversation_id) or exists (select 1 from hml_context_opportunities h where h.id = e.opportunity_id));
  delete from public.webhook_ingest_requests w
  where w.org_id = p_org_id and (exists (select 1 from hml_context_conversations h where h.id = w.conversation_id) or exists (select 1 from hml_context_messages h where h.id = w.message_id));
  delete from public.conversation_takeover_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_conversations h where h.id = r.conversation_id);
  delete from public.messages m
  where m.org_id = p_org_id and exists (select 1 from hml_context_messages h where h.id = m.id);
  update public.opportunities o
  set current_conversation_id = null
  where o.org_id = p_org_id and exists (select 1 from hml_context_conversations h where h.id = o.current_conversation_id);
  delete from public.conversations c
  where c.org_id = p_org_id and exists (select 1 from hml_context_conversations h where h.id = c.id);

  delete from public.qualification_value_requests r
  where r.org_id = p_org_id
    and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_qualification_values h where h.id = r.qualification_value_id) or exists (select 1 from hml_context_messages h where h.id = r.source_message_id));
  delete from public.qualification_value_history h
  where h.org_id = p_org_id
    and (exists (select 1 from hml_context_opportunities x where x.id = h.opportunity_id) or exists (select 1 from hml_context_qualification_values x where x.id = h.qualification_value_id) or exists (select 1 from hml_context_messages x where x.id = h.source_message_id));
  delete from public.qualification_values q
  where q.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = q.opportunity_id);
  delete from public.project_match_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id);
  delete from public.project_snapshots s
  where s.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = s.opportunity_id);
  delete from public.sales s
  where s.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = s.opportunity_id);
  delete from public.opportunity_stage_change_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id);
  delete from public.opportunity_purchase_structure_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id);
  delete from public.opportunity_participant_requests r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = r.contact_id));
  delete from public.opportunity_participants r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = r.contact_id));
  delete from public.source_attributions s
  where s.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = s.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = s.contact_id));
  delete from public.campaign_contacts c
  where c.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = c.contact_id));
  delete from public.campaign_import_rows r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = r.contact_id));
  delete from public.lead_creation_requests r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = r.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = r.contact_id));
  delete from public.preleads p
  where p.org_id = p_org_id and (exists (select 1 from hml_context_opportunities h where h.id = p.opportunity_id) or exists (select 1 from hml_context_contacts h where h.id = p.contact_id));
  delete from public.meta_lead_submissions s
  where s.org_id = p_org_id and exists (select 1 from hml_context_submissions h where h.id = s.id);
  delete from public.opportunity_checklists c
  where c.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = c.opportunity_id);
  delete from public.next_actions a
  where a.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = a.opportunity_id);
  delete from public.opportunities o
  where o.org_id = p_org_id and exists (select 1 from hml_context_opportunities h where h.id = o.id);

  delete from public.privacy_review_requests r
  where r.org_id = p_org_id and exists (select 1 from public.privacy_requests p where p.id = r.privacy_request_id and exists (select 1 from hml_context_contacts h where h.id = p.contact_id));
  delete from public.privacy_action_requests r
  where r.org_id = p_org_id and exists (select 1 from public.privacy_requests p where p.id = r.privacy_request_id and exists (select 1 from hml_context_contacts h where h.id = p.contact_id));
  delete from public.privacy_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = r.contact_id);
  delete from public.contact_archive_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = r.contact_id);
  delete from public.contact_name_update_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = r.contact_id);
  delete from public.contact_phone_requests r
  where r.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = r.contact_id);
  delete from public.contact_merge_requests r
  where r.org_id = p_org_id and (exists (select 1 from hml_context_contacts h where h.id = r.source_contact_id) or exists (select 1 from hml_context_contacts h where h.id = r.target_contact_id));
  delete from public.contact_merge_history r
  where exists (select 1 from hml_context_contacts h where h.id = r.source_contact_id) or exists (select 1 from hml_context_contacts h where h.id = r.target_contact_id);
  delete from public.opt_outs o
  where o.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = o.contact_id);
  delete from public.contacts c
  where c.org_id = p_org_id and exists (select 1 from hml_context_contacts h where h.id = c.id);

  v_receipt := v_snapshot || jsonb_build_object(
    'status', 'purged',
    'executed_at', v_now,
    'actor_user_id', v_actor
  );

  insert into audit.events (org_id, actor_user_id, action, entity_type, metadata)
  values (
    p_org_id,
    v_actor,
    'homologation.context_purged',
    'homologation_context',
    v_receipt - 'storage_objects'
  );

  return v_receipt;
end;
$$;

revoke all on function private.prepare_homologation_context(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function private.homologation_context_snapshot(uuid) from public, anon, authenticated, service_role;
revoke all on function public.preview_homologation_context(uuid) from public, anon;
revoke all on function public.purge_homologation_context(uuid, text) from public, anon;
grant execute on function public.preview_homologation_context(uuid) to authenticated;
grant execute on function public.purge_homologation_context(uuid, text) to authenticated;

comment on function public.preview_homologation_context(uuid) is 'Returns a bounded, HML-prefixed homologation cleanup preview without changing data.';
comment on function public.purge_homologation_context(uuid, text) is 'Atomically removes HML-prefixed homologation context, cancels related effects, preserves audit, and returns a receipt.';

commit;
