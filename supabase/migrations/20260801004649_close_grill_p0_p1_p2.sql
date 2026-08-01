begin;

-- Decisions closed in the post-package Grill.  This migration intentionally
-- extends the existing vertical slices instead of replacing their audit,
-- tenancy, queue and idempotency contracts.

-- ---------------------------------------------------------------------------
-- Knowledge facts and approved outbound media
-- ---------------------------------------------------------------------------

alter table public.project_media
  add column mime_type text,
  add column size_bytes bigint,
  add column published_at timestamptz,
  add column published_by uuid references auth.users(id) on delete set null;

alter table public.project_media
  add constraint project_media_mime_type_check check (
    mime_type is null or mime_type in ('image/jpeg','image/png','application/pdf')
  ),
  add constraint project_media_size_check check (
    size_bytes is null or (
      media_type in ('cover','image') and size_bytes between 1 and 5242880
      or media_type='pdf' and size_bytes between 1 and 20971520
      or media_type='official_link'
    )
  ),
  add constraint project_media_publish_check check (
    published_at is null or published_by is not null
  );

create or replace function private.validate_project_media_limits()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_images integer; v_pdfs integer; v_covers integer;
begin
  if new.media_type='official_link' then
    return new;
  end if;
  if new.storage_path is null or new.external_url is not null then
    raise exception 'project_media_must_use_private_storage' using errcode='22023';
  end if;
  if new.media_type in ('cover','image') and new.mime_type not in ('image/jpeg','image/png') then
    raise exception 'project_image_must_be_jpeg_or_png' using errcode='22023';
  end if;
  if new.media_type='pdf' and new.mime_type<>'application/pdf' then
    raise exception 'project_book_must_be_pdf' using errcode='22023';
  end if;
  if new.active then
    select count(*) filter(where media_type in ('cover','image')),
           count(*) filter(where media_type='pdf'),
           count(*) filter(where media_type='cover')
      into v_images,v_pdfs,v_covers
    from public.project_media
    where project_id=new.project_id and active and id<>new.id;
    if new.media_type in ('cover','image') and v_images>=5 then
      raise exception 'project_image_limit_reached_delete_before_adding' using errcode='22023';
    end if;
    if new.media_type='pdf' and v_pdfs>=1 then
      raise exception 'project_pdf_limit_reached_delete_before_adding' using errcode='22023';
    end if;
    if new.media_type='cover' and v_covers>=1 then
      raise exception 'project_principal_image_already_exists' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_project_media_limits() from public,anon,authenticated,service_role;
create trigger project_media_validate_limits
before insert or update of project_id,media_type,storage_path,external_url,mime_type,size_bytes,active
on public.project_media for each row execute function private.validate_project_media_limits();

create unique index project_media_one_active_cover_idx
  on public.project_media(project_id) where active and media_type='cover';
create unique index project_media_one_active_pdf_idx
  on public.project_media(project_id) where active and media_type='pdf';

create table public.project_media_uploads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  media_type text not null check(media_type in ('cover','image','pdf')),
  title text not null check(char_length(trim(title)) between 2 and 160),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  storage_path text not null unique,
  status text not null default 'reserved' check(status in ('reserved','completed','cancelled','failed')),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  media_id uuid references public.project_media(id) on delete set null,
  error_redacted text,
  expires_at timestamptz not null default now()+interval '30 minutes',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key(project_id,org_id) references public.projects(id,org_id) on delete cascade,
  unique(id,org_id),
  check((media_type in ('cover','image') and mime_type in ('image/jpeg','image/png') and size_bytes<=5242880)
     or (media_type='pdf' and mime_type='application/pdf' and size_bytes<=20971520))
);
create index project_media_uploads_expiry_idx on public.project_media_uploads(status,expires_at);

create table public.project_media_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  ai_execution_id uuid not null,
  project_media_id uuid not null references public.project_media(id) on delete restrict,
  message_id uuid not null references public.messages(id) on delete restrict,
  delivery_kind text not null check(delivery_kind in ('principal','more_photos','book')),
  created_at timestamptz not null default now(),
  foreign key(ai_execution_id,org_id) references public.ai_executions(id,org_id) on delete cascade,
  unique(ai_execution_id,project_media_id)
);

create table public.project_fact_conflicts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  code text not null check(code~'^[a-z0-9_]+$'),
  current_fact_id uuid not null references public.project_facts(id) on delete restrict,
  proposed_value_text text,
  proposed_value_number numeric,
  proposed_unit text,
  proposed_source_name text not null,
  proposed_reference_date date not null,
  proposed_valid_until date,
  status text not null default 'pending' check(status in ('pending','accepted','rejected','quarantined')),
  resolution_reason text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key(project_id,org_id) references public.projects(id,org_id) on delete cascade,
  check(num_nonnulls(proposed_value_text,proposed_value_number)=1)
);
create unique index project_fact_conflicts_one_pending_idx
  on public.project_fact_conflicts(project_id,code) where status='pending';

create or replace function public.enqueue_pedro_project_media(p_execution_id uuid)
returns integer
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_execution public.ai_executions%rowtype;v_conversation public.conversations%rowtype;
  v_request jsonb;v_kind text;v_project uuid;v_media public.project_media%rowtype;v_message uuid;v_count integer:=0;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_execution from public.ai_executions where id=p_execution_id and status='completed';
  if not found or v_execution.mode<>'production' or v_execution.conversation_id is null then return 0; end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id;
  if v_conversation.status<>'active' or v_conversation.ownership<>'ai' then return 0; end if;
  v_request:=v_execution.output_structured->'project_media_request';
  if v_request is not null and v_request<>'null'::jsonb then
    v_project:=(v_request->>'project_id')::uuid;
    v_kind:=v_request->>'kind';
  elsif jsonb_array_length(coalesce(v_execution.output_structured->'recommended_project_ids','[]'::jsonb))>0 then
    v_project:=(v_execution.output_structured->'recommended_project_ids'->>0)::uuid;
    v_kind:='principal';
  else return 0; end if;
  if not exists(select 1 from public.projects where id=v_project and org_id=v_execution.org_id and status='active' and recommendable) then return 0; end if;
  for v_media in
    select * from public.project_media m
    where m.project_id=v_project and m.org_id=v_execution.org_id and m.active and m.published_at is not null
      and (case v_kind
        when 'principal' then m.media_type='cover'
        when 'more_photos' then m.media_type='image'
        when 'book' then m.media_type='pdf'
        when 'photos_and_book' then m.media_type in ('image','pdf')
        else false end)
    order by case when m.media_type='cover' then 0 when m.media_type='image' then 1 else 2 end,m.sort_order,m.created_at
  loop
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_status,metadata)
    values(v_execution.org_id,v_execution.operation_id,v_conversation.id,'outbound','ai',
      case when v_media.media_type='pdf' then 'document' else 'image' end,
      coalesce(v_media.title,case when v_media.media_type='pdf' then 'Book do empreendimento' else 'Foto do empreendimento' end),'queued',
      jsonb_build_object('ai_execution_id',v_execution.id,'project_id',v_project,'project_media_id',v_media.id,
        'storage_bucket','gril-projects','storage_path',v_media.storage_path,'mime_type',v_media.mime_type,
        'file_name',case when v_media.media_type='pdf' then coalesce(nullif(v_media.title,''),'book')||'.pdf' else null end))
    returning id into v_message;
    insert into public.project_media_deliveries(org_id,ai_execution_id,project_media_id,message_id,delivery_kind)
    values(v_execution.org_id,v_execution.id,v_media.id,v_message,
      case when v_media.media_type='cover' then 'principal' when v_media.media_type='pdf' then 'book' else 'more_photos' end)
    on conflict(ai_execution_id,project_media_id) do nothing;
    if found then
      insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
      values(v_execution.org_id,v_execution.operation_id,'message.outbound.send','message',v_message,'outbound-whatsapp',now()+make_interval(secs=>2+v_count*2),
        'project-media-send:'||v_execution.id::text||':'||v_media.id::text,jsonb_build_object('message_id',v_message),3)
      on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
      v_count:=v_count+1;
    else
      delete from public.messages where id=v_message;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_pedro_project_media(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_pedro_project_media(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Exact future-purchase cadence and privacy workflow
-- ---------------------------------------------------------------------------

create or replace function private.schedule_future_purchase_cadence()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_execution public.ai_executions%rowtype;v_conversation public.conversations%rowtype;v_opportunity uuid;v_day integer;
begin
  if new.action_type<>'followup' or new.status<>'executed' or new.action_input->>'strategy'<>'future' then return new; end if;
  select * into v_execution from public.ai_executions where id=new.execution_id;
  if not found or v_execution.mode<>'production' or v_execution.conversation_id is null then return new; end if;
  select * into v_conversation from public.conversations where id=v_execution.conversation_id;
  v_opportunity:=v_conversation.opportunity_id;
  update public.scheduled_jobs set status='cancelled',updated_at=now()
  where org_id=new.org_id and aggregate_type='conversation' and aggregate_id=v_conversation.id
    and job_type in ('followup.ai_turn','followup.future.expire') and status='pending';
  foreach v_day in array array[30,60,90,120,150] loop
    insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
    values(new.org_id,v_execution.operation_id,'followup.ai_turn','conversation',v_conversation.id,'scheduled-actions',
      coalesce(v_execution.completed_at,now())+make_interval(days=>v_day),
      'future-purchase:'||v_conversation.id::text||':'||v_execution.id::text||':'||v_day::text,
      jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity,'cadence','future_purchase','day',v_day,
        'instruction','Retome com contexto e valor, sem pressionar. Confirme se o horizonte de compra mudou.'),3)
    on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  end loop;
  insert into public.scheduled_jobs(org_id,operation_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
  values(new.org_id,v_execution.operation_id,'followup.future.expire','conversation',v_conversation.id,'scheduled-actions',
    coalesce(v_execution.completed_at,now())+interval '180 days','future-purchase-expire:'||v_conversation.id::text||':'||v_execution.id::text,
    jsonb_build_object('conversation_id',v_conversation.id,'opportunity_id',v_opportunity),3)
  on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return new;
end;$$;
revoke all on function private.schedule_future_purchase_cadence() from public,anon,authenticated,service_role;
create trigger ai_action_execution_future_followup after insert on public.ai_action_executions
for each row when(new.action_type='followup' and new.status='executed') execute function private.schedule_future_purchase_cadence();

create table private.contact_suppression_fingerprints(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
  phone_fingerprint text not null check(phone_fingerprint~'^[a-f0-9]{64}$'),source_request_id uuid,
  created_at timestamptz not null default now(),unique(org_id,phone_fingerprint)
);

create table public.privacy_action_requests(
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  privacy_request_id uuid not null,action text not null check(action in ('archive','resume_ai','correct','anonymize','delete','retain_close')),
  identity_verified boolean not null default false,reason text not null check(char_length(trim(reason)) between 5 and 2000),
  corrected_name text,retention_until timestamptz,result text,actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now(),created_at timestamptz not null default now(),
  foreign key(privacy_request_id,org_id) references public.privacy_requests(id,org_id) on delete restrict
);

create or replace function private.pause_contact_for_privacy()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.conversations set status='paused',ownership='pending_handoff',pause_reason='privacy_request',version=version+1,updated_at=now()
  where contact_id=new.contact_id and org_id=new.org_id and status='active';
  update public.scheduled_jobs j set status='cancelled',updated_at=now()
  where j.org_id=new.org_id and j.status='pending' and exists(select 1 from public.conversations c where c.contact_id=new.contact_id and c.id=j.aggregate_id);
  update public.campaign_contacts set status='suppressed',suppression_reason='privacy_request',updated_at=now()
  where org_id=new.org_id and contact_id=new.contact_id and status in ('ready','queued','sending');
  insert into public.scheduled_jobs(org_id,job_type,aggregate_type,aggregate_id,target_queue,run_at,dedupe_key,payload,max_attempts)
  select new.org_id,'privacy.deadline.reminder','privacy_request',new.id,'notifications',new.created_at+make_interval(days=>d),
    'privacy-reminder:'||new.id::text||':'||d::text,jsonb_build_object('privacy_request_id',new.id,'day',d),3
  from unnest(array[5,10,14,15]) d
  on conflict(org_id,dedupe_key) where status in ('pending','leased') do nothing;
  return new;
end;$$;
revoke all on function private.pause_contact_for_privacy() from public,anon,authenticated,service_role;
create trigger privacy_request_immediate_pause after insert on public.privacy_requests
for each row execute function private.pause_contact_for_privacy();

create or replace function private.process_privacy_action_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_request public.privacy_requests%rowtype;v_phone record;v_conversation record;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid())
     or not (private.has_org_role(new.org_id,array['owner','manager']::text[]) or private.has_org_permission(new.org_id,'privacy.manage')) then
    raise exception 'privacy_action_forbidden' using errcode='42501';
  end if;
  select * into v_request from public.privacy_requests where id=new.privacy_request_id and org_id=new.org_id for update;
  if not found then raise exception 'privacy_request_not_found' using errcode='22023'; end if;
  if new.action in ('correct','anonymize','delete') and not new.identity_verified then
    raise exception 'privacy_identity_verification_required' using errcode='22023';
  end if;
  if new.action='archive' then
    update public.contacts set status='archived',updated_at=now() where id=v_request.contact_id;
    new.result:='archived';
  elsif new.action='resume_ai' then
    if exists(select 1 from public.opt_outs where contact_id=v_request.contact_id and revoked_at is null) then
      raise exception 'active_opt_out_blocks_proactive_resume' using errcode='22023';
    end if;
    update public.contacts set status='active',updated_at=now() where id=v_request.contact_id;
    update public.conversations set status='active',ownership='ai',ai_mode='production',pause_reason=null,version=version+1,updated_at=now()
    where contact_id=v_request.contact_id and org_id=new.org_id;
    new.result:='resumed';
  elsif new.action='correct' then
    if nullif(trim(new.corrected_name),'') is null then raise exception 'corrected_name_required' using errcode='22023'; end if;
    update public.contacts set name=trim(new.corrected_name),updated_at=now() where id=v_request.contact_id;
    new.result:='corrected';
  elsif new.action in ('anonymize','delete') then
    for v_phone in select e164 from public.contact_phones where contact_id=v_request.contact_id loop
      insert into private.contact_suppression_fingerprints(org_id,phone_fingerprint,source_request_id)
      values(new.org_id,encode(digest(new.org_id::text||':'||v_phone.e164,'sha256'),'hex'),v_request.id)
      on conflict do nothing;
    end loop;
    insert into private.retention_purge_queue(org_id,entity_type,entity_id,storage_bucket,storage_path,action,due_at)
    select a.org_id,'attachment',a.id,a.storage_bucket,a.storage_path,'delete',now()
    from public.attachments a join public.messages m on m.id=a.message_id
    join public.conversations c on c.id=m.conversation_id
    where c.contact_id=v_request.contact_id and a.storage_path is not null
    on conflict do nothing;
    delete from public.contact_phones where contact_id=v_request.contact_id;
    update public.messages set body='[conteudo removido por solicitacao de privacidade]',metadata='{}'::jsonb,error_redacted=null
    where conversation_id in(select id from public.conversations where contact_id=v_request.contact_id);
    update public.contacts set name='Lead anonimizado '||left(id::text,8),preferences='{}'::jsonb,status='archived',updated_at=now()
    where id=v_request.contact_id;
    new.result:=case when new.action='delete' then 'identifiers_deleted_links_anonymized' else 'anonymized' end;
  elsif new.action='retain_close' then
    if new.retention_until is null or new.retention_until<=now() then raise exception 'future_retention_deadline_required' using errcode='22023'; end if;
    update public.privacy_requests set legal_hold_reason=trim(new.reason),status='blocked_legal_hold',updated_at=now() where id=v_request.id;
    new.result:='retained_until_'||new.retention_until::text;
  end if;
  if new.action<>'retain_close' then
    update public.privacy_requests set status='completed',resolution_notes=trim(new.reason),reviewed_by=new.actor_user_id,
      reviewed_at=now(),completed_at=now(),updated_at=now(),execution_proof=jsonb_build_object('action',new.action,'result',new.result)
    where id=v_request.id;
  end if;
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(new.org_id,new.actor_user_id,'privacy.'||new.action,'privacy_requests',v_request.id,jsonb_build_object('result',new.result));
  return new;
end;$$;
revoke all on function private.process_privacy_action_request() from public,anon,authenticated,service_role;
create trigger privacy_action_process before insert on public.privacy_action_requests
for each row execute function private.process_privacy_action_request();

-- The existing runtime wrapper remains authoritative for every other job.
alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_before_grill_close;
revoke all on function public.execute_runtime_job_before_grill_close(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_before_grill_close(uuid) to service_role;
create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;v_conversation public.conversations%rowtype;v_request public.privacy_requests%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored');end if;
  if v_job.job_type='followup.future.expire' then
    select * into v_conversation from public.conversations where id=(v_job.payload->>'conversation_id')::uuid for update;
    if not found or v_conversation.status<>'active' or v_conversation.ownership<>'ai'
       or exists(select 1 from public.messages where conversation_id=v_conversation.id and direction='inbound' and created_at>v_job.created_at) then
      return jsonb_build_object('status','cancelled');end if;
    update public.conversations set status='paused',ownership='pending_handoff',pause_reason='future_purchase_180d_no_response',version=version+1,updated_at=now()
    where id=v_conversation.id;
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_conversation.org_id,v_conversation.operation_id,'normal','followup','Compra futura sem resposta por 180 dias',
      'A cadencia automatica terminou. Revise o lead antes de qualquer nova abordagem.','conversation',v_conversation.id,
      'future-purchase-expired:'||v_conversation.id::text)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    return jsonb_build_object('status','completed');
  elsif v_job.job_type='privacy.deadline.reminder' then
    select * into v_request from public.privacy_requests where id=(v_job.payload->>'privacy_request_id')::uuid;
    if not found or v_request.status in ('completed','rejected') then return jsonb_build_object('status','cancelled');end if;
    insert into public.alerts(org_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_request.org_id,case when (v_job.payload->>'day')::int>=15 then 'immediate' else 'normal' end,'privacy',
      case when (v_job.payload->>'day')::int>=15 then 'Solicitacao de privacidade vencida' else 'Prazo de privacidade se aproximando' end,
      'A solicitacao esta no dia '||(v_job.payload->>'day')||' do prazo interno de 15 dias.','privacy_request',v_request.id,v_job.dedupe_key)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    return jsonb_build_object('status','completed');
  end if;
  return public.execute_runtime_job_before_grill_close(p_job_id);
end;$$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

-- Every inbound message cancels all pending proactive work, including the
-- future-purchase expiry marker.
create or replace function private.cancel_pending_followups_on_inbound()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.direction='inbound' then
    update public.scheduled_jobs set status='cancelled',updated_at=now()
    where org_id=new.org_id and aggregate_type='conversation' and aggregate_id=new.conversation_id
      and job_type in ('followup.ai_turn','followup.future.expire') and status='pending';
  end if;return new;
end;$$;
revoke all on function private.cancel_pending_followups_on_inbound() from public,anon,authenticated,service_role;
create trigger messages_cancel_pending_followups after insert on public.messages
for each row when(new.direction='inbound') execute function private.cancel_pending_followups_on_inbound();

commit;
