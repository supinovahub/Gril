begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gril-media','gril-media',false,20971520,array[
  'image/jpeg','image/png','image/webp','image/heic','audio/mpeg','audio/mp4','audio/ogg','audio/webm',
  'video/mp4','video/webm','application/pdf','text/plain','application/octet-stream'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gril-projects','gril-projects',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.message_media_sources(
  message_id uuid primary key,
  org_id uuid not null,
  connection_id uuid not null,
  provider_media_id text,
  source_url text,
  mime_type text,
  file_name text,
  provider_sha256 text,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
  storage_bucket text,
  storage_path text,
  extracted_text text,
  error_redacted text,
  attempts smallint not null default 0 check(attempts between 0 and 10),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(message_id,org_id) references public.messages(id,org_id) on delete cascade,
  foreign key(connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete restrict,
  check(provider_media_id is not null or source_url is not null),
  unique(message_id,org_id)
);
create index message_media_sources_status_idx on public.message_media_sources(status,created_at) where status in ('pending','processing');

create or replace function public.claim_inbound_media(p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_source public.message_media_sources%rowtype;v_connection public.whatsapp_connections%rowtype;v_message public.messages%rowtype;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_source from public.message_media_sources where message_id=p_message_id for update;
  if not found or v_source.status not in ('pending','processing') or v_source.attempts>=5 then return jsonb_build_object('status','ignored'); end if;
  select * into v_connection from public.whatsapp_connections where id=v_source.connection_id;
  select * into v_message from public.messages where id=v_source.message_id;
  if not found or v_connection.status<>'active' then
    update public.message_media_sources set status='failed',error_redacted='Conexao indisponivel para baixar a midia.',processed_at=now(),updated_at=now() where message_id=p_message_id;
    return jsonb_build_object('status','failed');
  end if;
  update public.message_media_sources set status='processing',attempts=attempts+1,updated_at=now() where message_id=p_message_id;
  return jsonb_build_object('status','claimed','message_id',v_source.message_id,'org_id',v_source.org_id,
    'connection_id',v_source.connection_id,'integration_account_id',v_connection.integration_account_id,
    'provider',v_connection.provider,'endpoint_url',v_connection.endpoint_url,
    'provider_media_id',v_source.provider_media_id,'source_url',v_source.source_url,
    'mime_type',coalesce(v_source.mime_type,'application/octet-stream'),'file_name',v_source.file_name,
    'content_type',v_message.content_type);
end; $$;
revoke all on function public.claim_inbound_media(uuid) from public,anon,authenticated;
grant execute on function public.claim_inbound_media(uuid) to service_role;

create or replace function public.complete_inbound_media(
  p_message_id uuid,p_storage_bucket text,p_storage_path text,p_mime_type text,p_size_bytes bigint,p_sha256 text,
  p_extracted_text text default null,p_error_redacted text default null
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_source public.message_media_sources%rowtype;v_message public.messages%rowtype;
begin
  if (select auth.role())<>'service_role' then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  select * into v_source from public.message_media_sources where message_id=p_message_id for update;
  select * into v_message from public.messages where id=p_message_id for update;
  if not found or v_source.status<>'processing' then return 'ignored'; end if;
  if p_error_redacted is not null then
    update public.message_media_sources set status='failed',error_redacted=left(p_error_redacted,500),processed_at=now(),updated_at=now() where message_id=p_message_id;
    insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
    values(v_message.org_id,v_message.operation_id,'warning','media','Midia recebida nao foi processada',left(p_error_redacted,500),'message',p_message_id,'media-failed:'||p_message_id::text)
    on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
    return 'failed';
  end if;
  insert into public.attachments(org_id,message_id,storage_bucket,storage_path,mime_type,size_bytes,sha256,sensitivity,purge_after)
  values(v_source.org_id,p_message_id,p_storage_bucket,p_storage_path,p_mime_type,p_size_bytes,p_sha256,
    case when v_message.content_type='document' then 'sensitive' else 'normal' end,
    case when v_message.content_type='document' then now()+interval '30 days' else null end)
  on conflict(storage_bucket,storage_path) do nothing;
  update public.message_media_sources set status='completed',storage_bucket=p_storage_bucket,storage_path=p_storage_path,
    extracted_text=nullif(left(coalesce(p_extracted_text,''),12000),''),error_redacted=null,processed_at=now(),updated_at=now() where message_id=p_message_id;
  update public.messages set body=coalesce(nullif(left(coalesce(p_extracted_text,''),4096),''),body),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('media_processed',true,'storage_bucket',p_storage_bucket,'storage_path',p_storage_path)
    where id=p_message_id;
  insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
  values(v_message.org_id,v_message.operation_id,'message.inbound.media_processed.v1','message',p_message_id,
    jsonb_build_object('message_id',p_message_id),'media-processed:'||p_message_id::text) on conflict(idempotency_key) do nothing;
  return 'completed';
end; $$;
revoke all on function public.complete_inbound_media(uuid,text,text,text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_inbound_media(uuid,text,text,text,bigint,text,text,text) to service_role;

alter function public.execute_runtime_job(uuid) rename to execute_runtime_job_phase14;
revoke all on function public.execute_runtime_job_phase14(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job_phase14(uuid) to service_role;
create or replace function public.execute_runtime_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_job public.scheduled_jobs%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'runtime_service_role_required' using errcode='42501';
  end if;
  select * into v_job from public.scheduled_jobs where id=p_job_id and status='leased' for update;
  if not found then return jsonb_build_object('status','ignored'); end if;
  if v_job.job_type='media.inbound.process' then
    return jsonb_build_object('status','process_media','message_id',(v_job.payload->>'message_id')::uuid);
  end if;
  return public.execute_runtime_job_phase14(p_job_id);
end; $$;
revoke all on function public.execute_runtime_job(uuid) from public,anon,authenticated;
grant execute on function public.execute_runtime_job(uuid) to service_role;

alter table public.message_media_sources enable row level security;
create policy message_media_sources_visible on public.message_media_sources for select to authenticated
using(exists(select 1 from public.messages m where m.id=message_id and (select private.can_access_conversation(m.conversation_id))));
grant select on public.message_media_sources to authenticated;
grant all on public.message_media_sources to service_role;

comment on table public.message_media_sources is 'Provider media locator and processing state. Raw bytes live only in the private gril-media bucket.';
commit;
