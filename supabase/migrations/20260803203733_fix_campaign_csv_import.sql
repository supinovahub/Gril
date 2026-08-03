begin;

-- A failed import must not make the same source file permanently unusable.
drop index if exists public.campaign_imports_file_hash_idx;
create unique index campaign_imports_file_hash_idx
  on public.campaign_imports(campaign_id, file_sha256)
  where file_sha256 is not null and valid_rows > 0;

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
    v_name := nullif(trim(v_row ->> 'name'), '');
    v_phone_input := nullif(trim(v_row ->> 'phone'), '');
    v_digits := nullif(regexp_replace(coalesce(v_phone_input, ''), '[^0-9]', '', 'g'), '');
    v_phone := null;
    v_contact := null;
    v_opportunity := null;

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

    insert into public.campaign_contacts(
      org_id, campaign_id, contact_id, opportunity_id, import_row_id
    ) values (
      new.org_id, new.campaign_id, v_contact, v_opportunity, v_import_row
    );
    v_valid := v_valid + 1;
  end loop;

  select coalesce(
    jsonb_agg(replace(v_campaign.opening_template, '{{name}}', name)),
    '[]'::jsonb
  ) into v_examples
  from (
    select c.name
    from public.campaign_contacts cc
    join public.contacts c on c.id = cc.contact_id
    where cc.campaign_id = new.campaign_id
    order by cc.created_at
    limit 5
  ) s;

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

revoke all on function private.process_campaign_import_request()
from public, anon, authenticated, service_role;

commit;
