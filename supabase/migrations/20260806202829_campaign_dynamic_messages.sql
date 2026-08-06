begin;

-- A campaign stores the approved message pack so preview and dispatch use the
-- same copy. Existing campaigns keep the old single-template behavior.
alter table public.campaigns
  add column if not exists opening_variants jsonb not null default '[]'::jsonb;

alter table public.campaign_creation_requests
  add column if not exists opening_variants jsonb not null default '[]'::jsonb;

alter table public.campaigns
  drop constraint if exists campaigns_opening_variants_array;
alter table public.campaigns
  add constraint campaigns_opening_variants_array
  check (jsonb_typeof(opening_variants) = 'array' and jsonb_array_length(opening_variants) <= 3);

alter table public.campaign_creation_requests
  drop constraint if exists campaign_creation_requests_opening_variants_array;
alter table public.campaign_creation_requests
  add constraint campaign_creation_requests_opening_variants_array
  check (jsonb_typeof(opening_variants) = 'array' and jsonb_array_length(opening_variants) <= 3);

create or replace function private.campaign_message_cleanup(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(
    trim(regexp_replace(replace(coalesce(p_value, ''), '_', ' '), '[[:space:]]+', ' ', 'g')),
    ''
  );
$$;

create or replace function private.campaign_message_value(p_fields jsonb, p_key text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select private.campaign_message_cleanup(
    case p_key
      when 'objetivo' then coalesce(nullif(p_fields->>'principal_objetivo', ''), p_fields->>'objetivo_studio')
      when 'entrada' then p_fields->>'limite_entrada'
      when 'parcela' then p_fields->>'limite_parcela'
      when 'ja_investiu' then p_fields->>'ja_investiu_em_studio'
      else p_fields->>p_key
    end
  );
$$;

create or replace function private.campaign_message_context(p_fields jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_objective text := private.campaign_message_value(coalesce(p_fields, '{}'::jsonb), 'objetivo');
  v_entry text := private.campaign_message_value(coalesce(p_fields, '{}'::jsonb), 'entrada');
  v_installment text := private.campaign_message_value(coalesce(p_fields, '{}'::jsonb), 'parcela');
  v_history text;
  v_invested text := lower(coalesce(private.campaign_message_value(coalesce(p_fields, '{}'::jsonb), 'ja_investiu'), ''));
begin
  v_objective := case
    when v_objective ilike '%rentabilizar%' then 'rentabilizar com aluguel'
    when v_objective ilike '%utilização própria%' or v_objective ilike '%utilizacao propria%' then 'morar'
    else coalesce(v_objective, 'investir ou morar')
  end;

  v_history := case
    when v_invested = 'sim' or v_invested like 's%' then 'Você já investiu em studio antes; posso comparar novas possibilidades.'
    when v_invested = 'não' or v_invested = 'nao' or v_invested like 'n%' then 'Como ainda não investiu em studio, posso começar pelas opções mais alinhadas ao seu perfil.'
    else 'Posso partir do ponto em que você parou e te mostrar o que faz sentido hoje.'
  end;

  return jsonb_build_object(
    'objetivo', v_objective,
    'entrada', coalesce(v_entry, ''),
    'parcela', coalesce(v_installment, ''),
    'orcamento', case
      when v_entry is not null and v_installment is not null then 'uma entrada de ' || v_entry || ' e uma parcela de ' || v_installment
      when v_entry is not null then 'uma entrada de ' || v_entry
      when v_installment is not null then 'uma parcela de ' || v_installment
      else 'as condições que você tinha em mente'
    end,
    'historico', v_history
  );
end;
$$;

create or replace function private.campaign_opening_template(
  p_variants jsonb,
  p_variant text,
  p_fallback text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select value->>'template'
      from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb))
      where value->>'id' = p_variant
        and char_length(trim(value->>'template')) >= 10
      limit 1
    ),
    p_fallback
  );
$$;

create or replace function private.render_campaign_opening(
  p_template text,
  p_first_name text,
  p_fields jsonb
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_body text := coalesce(p_template, '');
  v_key text;
  v_value text;
begin
  for v_key, v_value in
    select key, private.campaign_message_cleanup(value)
    from jsonb_each_text(coalesce(p_fields, '{}'::jsonb))
  loop
    v_body := replace(v_body, '{{' || v_key || '}}', coalesce(v_value, ''));
  end loop;

  for v_key, v_value in
    select key, value
    from jsonb_each_text(
      private.campaign_message_context(coalesce(p_fields, '{}'::jsonb))
      || jsonb_build_object(
        'first_name', private.campaign_message_cleanup(p_first_name),
        'name', private.campaign_message_cleanup(p_first_name),
        'nome', private.campaign_message_cleanup(p_first_name)
      )
    )
  loop
    v_body := replace(v_body, '{{' || v_key || '}}', coalesce(v_value, ''));
  end loop;

  v_body := regexp_replace(v_body, E'\\{\\{[a-zA-Z0-9_]+\\}\\}', '', 'g');
  return trim(regexp_replace(v_body, '[[:space:]]+', ' ', 'g'));
end;
$$;

-- Keep the old two-argument helper available for older functions and old
-- campaigns while routing new callers through the field-aware renderer.
create or replace function private.render_campaign_opening(
  p_template text,
  p_first_name text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select private.render_campaign_opening(p_template, p_first_name, '{}'::jsonb);
$$;

create or replace function private.process_campaign_creation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_connection public.whatsapp_connections%rowtype;
  v_consent uuid;
  v_campaign uuid;
  v_template public.whatsapp_message_templates%rowtype;
  v_variants jsonb;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'campaigns.manage') then
    raise exception 'campaign_creation_forbidden' using errcode = '42501';
  end if;

  select * into v_connection
  from public.whatsapp_connections
  where id = new.connection_id and org_id = new.org_id;
  if not found
     or v_connection.operation_id <> new.operation_id
     or v_connection.status <> 'active'
     or not v_connection.campaign_enabled then
    raise exception 'active_campaign_connection_required' using errcode = '22023';
  end if;

  if v_connection.provider = 'meta_cloud' then
    select * into v_template
    from public.whatsapp_message_templates
    where id = new.message_template_id
      and org_id = new.org_id
      and connection_id = v_connection.id
      and enabled
      and provider_status = 'APPROVED'
      and purpose = 'campaign'
      and variable_count <= 1;
    if not found then raise exception 'approved_meta_campaign_template_required' using errcode = '22023'; end if;
  elsif new.message_template_id is not null then
    raise exception 'template_only_for_meta' using errcode = '22023';
  end if;

  if new.ai_mode not in ('off', 'shadow', 'assisted', 'production') then
    raise exception 'invalid_ai_mode' using errcode = '22023';
  end if;
  v_variants := case
    when jsonb_array_length(new.opening_variants) = 0 then
      jsonb_build_array(jsonb_build_object('id', 'legacy', 'label', 'Abertura', 'template', trim(new.opening_template)))
    else new.opening_variants
  end;
  if jsonb_typeof(v_variants) <> 'array'
     or jsonb_array_length(v_variants) not between 1 and 3
     or exists (
       select 1
       from jsonb_array_elements(v_variants) item
       where char_length(trim(item->>'id')) = 0
          or char_length(trim(item->>'template')) not between 10 and 2000
     ) then
    raise exception 'invalid_campaign_opening_variants' using errcode = '22023';
  end if;

  insert into public.consent_declarations(
    org_id, operation_id, statement_text, source_description, confirmed_by
  ) values (
    new.org_id, new.operation_id, trim(new.consent_statement), trim(new.consent_source), new.actor_user_id
  ) returning id into v_consent;

  insert into public.campaigns(
    org_id, operation_id, connection_id, consent_declaration_id, name,
    ai_mode, opening_template, opening_variants, message_template_id, created_by
  ) values (
    new.org_id, new.operation_id, new.connection_id, v_consent, trim(new.name),
    new.ai_mode, trim(new.opening_template), v_variants, new.message_template_id, new.actor_user_id
  ) returning id into v_campaign;

  insert into audit.events(org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id, new.actor_user_id, 'campaign.created', 'campaigns', v_campaign,
    jsonb_build_object('consent_id', v_consent, 'ai_mode', new.ai_mode, 'template_id', new.message_template_id, 'opening_variants', v_variants)
  );
  new.campaign_id := v_campaign;
  new.processed_at := now();
  return new;
end;
$$;

create or replace function private.process_campaign_import_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_import uuid;
  v_row jsonb;
  v_num int := 0;
  v_name text;
  v_phone_input text;
  v_digits text;
  v_phone text;
  v_contact uuid;
  v_opportunity uuid;
  v_import_row uuid;
  v_stage uuid;
  v_variant text;
  v_valid int := 0;
  v_dup int := 0;
  v_error int := 0;
  v_examples jsonb;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'campaigns.manage') then
    raise exception 'campaign_import_forbidden' using errcode = '42501';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = new.campaign_id and org_id = new.org_id
  for update;
  if not found or v_campaign.status not in ('draft', 'importing', 'review') then
    raise exception 'campaign_not_importable' using errcode = '22023';
  end if;
  if jsonb_array_length(new.rows) = 0
     or jsonb_array_length(new.rows) > v_campaign.max_contacts then
    raise exception 'campaign_row_limit' using errcode = '22023';
  end if;
  if new.file_sha256 is not null and exists (
    select 1
    from public.campaign_imports
    where campaign_id = new.campaign_id
      and file_sha256 = new.file_sha256
      and valid_rows > 0
  ) then
    raise exception 'campaign_file_already_imported' using errcode = '23505';
  end if;

  select id into v_stage
  from public.pipeline_stages
  where org_id = new.org_id and code = 'new';
  insert into public.campaign_imports(
    org_id, campaign_id, filename, mapping, file_sha256, status, total_rows, imported_by
  ) values (
    new.org_id, new.campaign_id, new.filename, new.mapping, new.file_sha256,
    'processing', jsonb_array_length(new.rows), new.actor_user_id
  ) returning id into v_import;
  update public.campaigns
  set status = 'importing', version = version + 1, updated_at = now()
  where id = new.campaign_id;

  for v_row in select value from jsonb_array_elements(new.rows) loop
    v_num := v_num + 1;
    v_name := nullif(trim(v_row->>'name'), '');
    v_phone_input := nullif(trim(v_row->>'phone'), '');
    v_digits := nullif(regexp_replace(coalesce(v_phone_input, ''), '[^0-9]', '', 'g'), '');
    v_phone := null;
    v_contact := null;
    v_opportunity := null;
    v_variant := null;

    if left(coalesce(v_phone_input, ''), 1) = '+' and char_length(v_digits) between 8 and 15 then
      v_phone := '+' || v_digits;
    elsif char_length(v_digits) in (10, 11) then
      v_phone := '+55' || v_digits;
    elsif left(coalesce(v_digits, ''), 2) = '55' and char_length(v_digits) in (12, 13) then
      v_phone := '+' || v_digits;
    end if;

    if v_name is null or char_length(v_name) < 2 or v_phone is null then
      insert into public.campaign_import_rows(
        org_id, import_id, row_number, raw_data, normalized_name, normalized_phone, status, error_code
      ) values (
        new.org_id, v_import, v_num, v_row, v_name, v_phone, 'error', 'invalid_name_or_e164'
      );
      v_error := v_error + 1;
      continue;
    end if;

    select cp.contact_id into v_contact
    from public.contact_phones cp
    where cp.org_id = new.org_id and cp.e164 = v_phone and cp.status = 'active';
    if v_contact is null then
      insert into public.contacts(org_id, name, created_by)
      values(new.org_id, v_name, new.actor_user_id)
      returning id into v_contact;
      insert into public.contact_phones(org_id, contact_id, e164, original, is_primary)
      values(new.org_id, v_contact, v_phone, v_phone, true);
    end if;

    if exists (
      select 1 from public.campaign_contacts
      where campaign_id = new.campaign_id and contact_id = v_contact
    ) then
      insert into public.campaign_import_rows(
        org_id, import_id, row_number, raw_data, normalized_name, normalized_phone,
        status, error_code, contact_id
      ) values (
        new.org_id, v_import, v_num, v_row, v_name, v_phone,
        'duplicate', 'already_in_campaign', v_contact
      );
      v_dup := v_dup + 1;
      continue;
    end if;

    select id into v_opportunity
    from public.opportunities
    where org_id = new.org_id
      and operation_id = v_campaign.operation_id
      and contact_id = v_contact
      and status = 'open'
    order by created_at desc
    limit 1;
    if v_opportunity is null then
      insert into public.opportunities(
        org_id, operation_id, contact_id, pipeline_stage_id, source, created_by
      ) values (
        new.org_id, v_campaign.operation_id, v_contact, v_stage, 'campaign', new.actor_user_id
      ) returning id into v_opportunity;
    end if;

    insert into public.campaign_import_rows(
      org_id, import_id, row_number, raw_data, normalized_name, normalized_phone,
      status, contact_id, opportunity_id
    ) values (
      new.org_id, v_import, v_num, v_row, v_name, v_phone,
      'valid', v_contact, v_opportunity
    ) returning id into v_import_row;

    if jsonb_array_length(v_campaign.opening_variants) > 0 then
      select item->>'id' into v_variant
      from jsonb_array_elements(v_campaign.opening_variants) with ordinality as entries(item, ordinal)
      where ordinal = mod(v_valid, jsonb_array_length(v_campaign.opening_variants)) + 1
      limit 1;
    end if;

    insert into public.campaign_contacts(
      org_id, campaign_id, contact_id, opportunity_id, import_row_id, variant
    ) values (
      new.org_id, new.campaign_id, v_contact, v_opportunity, v_import_row, v_variant
    );
    v_valid := v_valid + 1;
  end loop;

  select coalesce(
    jsonb_agg(
      private.render_campaign_opening(
        private.campaign_opening_template(v_campaign.opening_variants, cc.variant, v_campaign.opening_template),
        cc.campaign_first_name,
        coalesce(r.raw_data->'fields', '{}'::jsonb)
      ) order by cc.created_at
    ),
    '[]'::jsonb
  ) into v_examples
  from public.campaign_contacts cc
  left join public.campaign_import_rows r on r.id = cc.import_row_id and r.org_id = cc.org_id
  where cc.campaign_id = new.campaign_id and cc.org_id = new.org_id;

  update public.campaign_imports
  set status = 'review', valid_rows = v_valid, duplicate_rows = v_dup,
      error_rows = v_error, completed_at = now()
  where id = v_import;
  update public.campaigns
  set status = 'review', opening_examples = v_examples,
      version = version + 1, updated_at = now()
  where id = new.campaign_id;

  new.import_id := v_import;
  new.valid_rows := v_valid;
  new.duplicate_rows := v_dup;
  new.error_rows := v_error;
  new.processed_at := now();
  insert into audit.events(
    org_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.org_id, new.actor_user_id, 'campaign.import_reviewed', 'campaign_imports', v_import,
    jsonb_build_object(
      'valid', v_valid, 'duplicates', v_dup, 'errors', v_error,
      'mapping', new.mapping, 'file_sha256', new.file_sha256
    )
  );
  return new;
end;
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
      private.render_campaign_opening(
        private.campaign_opening_template(new.opening_variants, cc.variant, new.opening_template),
        cc.campaign_first_name,
        coalesce(cc.raw_data->'fields', '{}'::jsonb)
      ) order by cc.created_at
    ),
    '[]'::jsonb
  ) into v_examples
  from (
    select cc.*, r.raw_data
    from public.campaign_contacts cc
    left join public.campaign_import_rows r on r.id = cc.import_row_id and r.org_id = cc.org_id
    where cc.campaign_id = new.id and cc.org_id = new.org_id
    order by cc.created_at
    limit 5
  ) cc;

  if v_examples is distinct from new.opening_examples then
    update public.campaigns
    set opening_examples = v_examples
    where id = new.id and org_id = new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_refresh_opening_examples on public.campaigns;
create trigger campaigns_refresh_opening_examples
after update of status, opening_template, opening_variants, opening_examples on public.campaigns
for each row
when (
  new.campaign_type = 'reactivation'
  and new.status in ('review', 'approved', 'running', 'paused')
  and (
    old.status is distinct from new.status
    or old.opening_template is distinct from new.opening_template
    or old.opening_variants is distinct from new.opening_variants
    or old.opening_examples is distinct from new.opening_examples
  )
)
execute function private.refresh_campaign_opening_examples();

-- Preserve the current production executor and only change its campaign copy
-- resolution. Consent, opt-out checks, send windows and idempotent jobs stay
-- in the existing execution path.
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
  v_import_row jsonb;
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
    where id = (v_job.payload->>'campaign_contact_id')::uuid
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
      return jsonb_build_object('status', 'retry', 'retry_seconds', 900, 'reason', 'outside_send_window');
    end if;
    if exists (
      select 1 from public.opt_outs
      where operation_id = v_campaign.operation_id
        and contact_id = v_campaign_contact.contact_id
        and revoked_at is null
    ) then
      update public.campaign_contacts
      set status = 'suppressed', suppression_reason = 'opt_out',
          last_revalidated_at = now(), updated_at = now()
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
      ) values(
        v_campaign.org_id, v_campaign.operation_id, v_campaign_contact.contact_id,
        v_campaign_contact.opportunity_id, v_campaign.connection_id,
        'active', 'ai', v_campaign.ai_mode
      ) returning * into v_conversation;
      update public.conversations set ai_mode = v_campaign.ai_mode where id = v_conversation.id;
      update public.opportunities
      set current_conversation_id = v_conversation.id, version = version + 1, updated_at = now()
      where id = v_campaign_contact.opportunity_id;
    end if;

    select r.raw_data into v_import_row
    from public.campaign_import_rows r
    where r.id = v_campaign_contact.import_row_id
      and r.org_id = v_campaign_contact.org_id;
    v_first_name := coalesce(
      nullif(trim(v_campaign_contact.campaign_first_name), ''),
      private.campaign_first_name_from_text(v_contact.name)
    );
    v_body := private.render_campaign_opening(
      private.campaign_opening_template(v_campaign.opening_variants, v_campaign_contact.variant, v_campaign.opening_template),
      v_first_name,
      coalesce(v_import_row->'fields', '{}'::jsonb)
    );
    insert into public.messages(
      org_id, operation_id, conversation_id, direction, sender_type,
      content_type, body, provider_status, metadata
    ) values(
      v_campaign.org_id, v_campaign.operation_id, v_conversation.id,
      'outbound', 'system', 'text', v_body, 'queued',
      jsonb_build_object(
        'campaign_id', v_campaign.id,
        'campaign_contact_id', v_campaign_contact.id,
        'campaign_variant', v_campaign_contact.variant,
        'runtime_job_id', v_job.id
      )
    ) returning id into v_message_id;
    return jsonb_build_object('status', 'send', 'message_id', v_message_id);
  end if;

  if v_job.job_type = 'call.offer.activate' then
    select * into v_offer from public.call_offers where id = (v_job.payload->>'offer_id')::uuid for update;
    select * into v_call from public.calls where id = v_offer.call_id;
    if not found or v_offer.status <> 'scheduled' or v_call.status not in ('distributing', 'unassigned_alerted') or v_offer.expires_at <= now() then
      update public.call_offers set status = case when status = 'scheduled' then 'cancelled' else status end where id = v_offer.id;
      return jsonb_build_object('status', 'cancelled');
    end if;
    update public.call_offers set status = 'pending', sent_at = now() where id = v_offer.id;
    insert into private.outbox_events(org_id, operation_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key)
    values(v_offer.org_id, v_call.operation_id, 'call.offer_sent.v1', 'call_offer', v_offer.id, jsonb_build_object('call_id', v_call.id, 'offer_id', v_offer.id), 'call-offer:' || v_offer.id::text)
    on conflict (idempotency_key) do nothing;
    return jsonb_build_object('status', 'completed');
  end if;

  if v_job.job_type = 'call.reminder.lead' then
    select * into v_call from public.calls where id = (v_job.payload->>'call_id')::uuid;
    if not found or v_call.status <> 'assigned' then return jsonb_build_object('status', 'cancelled'); end if;
    select c.* into v_conversation
    from public.opportunities o join public.conversations c on c.id = o.current_conversation_id
    where o.id = v_call.opportunity_id;
    if not found then return jsonb_build_object('status', 'cancelled'); end if;
    v_body := case when (v_job.payload->>'offset')::integer <= 10
      then 'Lembrete: nossa conversa começa em cerca de 10 minutos. Até já!'
      else 'Passando para lembrar da nossa conversa agendada para hoje. Se precisar ajustar, me avise por aqui.' end;
    insert into public.messages(org_id, operation_id, conversation_id, direction, sender_type, content_type, body, provider_status, metadata)
    values(v_call.org_id, v_call.operation_id, v_conversation.id, 'outbound', 'system', 'text', v_body, 'queued', jsonb_build_object('call_id', v_call.id, 'runtime_job_id', v_job.id))
    returning id into v_message_id;
    return jsonb_build_object('status', 'send', 'message_id', v_message_id);
  end if;

  if v_job.job_type = 'call.result.due' then
    select * into v_call from public.calls where id = (v_job.payload->>'call_id')::uuid;
    if found and v_call.status = 'assigned' then
      insert into public.alerts(org_id, operation_id, severity, category, title, body, entity_type, entity_id, dedupe_key)
      values(v_call.org_id, v_call.operation_id, 'warning', 'call', 'Resultado da call pendente', 'Registre o resultado para manter o funil atualizado.', 'call', v_call.id, 'call-result-due:' || v_call.id::text)
      on conflict (org_id, dedupe_key) where dedupe_key is not null and status <> 'resolved' do nothing;
    end if;
    return jsonb_build_object('status', 'completed');
  end if;

  return jsonb_build_object('status', 'unsupported', 'reason', 'unsupported_job_type');
end;
$$;

revoke all on function private.campaign_message_cleanup(text) from public, anon, authenticated, service_role;
revoke all on function private.campaign_message_value(jsonb, text) from public, anon, authenticated, service_role;
revoke all on function private.campaign_message_context(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.campaign_opening_template(jsonb, text, text) from public, anon, authenticated, service_role;
revoke all on function private.render_campaign_opening(text, text) from public, anon, authenticated, service_role;
revoke all on function private.render_campaign_opening(text, text, jsonb) from public, anon, authenticated, service_role;

commit;
