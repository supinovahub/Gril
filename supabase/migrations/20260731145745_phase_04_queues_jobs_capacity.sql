begin;

create extension if not exists pgmq;
create extension if not exists pg_cron;

do $$
declare
  v_queue text;
begin
  foreach v_queue in array array[
    'inbound-whatsapp',
    'ai-turns',
    'outbound-whatsapp',
    'scheduled-actions',
    'call-distribution',
    'campaign-dispatch',
    'media-processing',
    'notifications',
    'reconciliation',
    'dead-letter'
  ] loop
    if not exists (select 1 from pgmq.list_queues() q where q.queue_name = v_queue) then
      perform pgmq.create(v_queue);
    end if;
  end loop;
end
$$;

revoke all on schema pgmq from public, anon, authenticated;

create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  job_type text not null check (job_type ~ '^[a-z0-9_.-]+$'),
  aggregate_type text not null,
  aggregate_id uuid,
  target_queue text not null check (target_queue in (
    'inbound-whatsapp', 'ai-turns', 'outbound-whatsapp', 'scheduled-actions',
    'call-distribution', 'campaign-dispatch', 'media-processing',
    'notifications', 'reconciliation'
  )),
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'leased', 'completed', 'cancelled', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  lease_until timestamptz,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  check ((status = 'leased' and lease_until is not null) or status <> 'leased'),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create unique index scheduled_jobs_active_dedupe_idx
  on public.scheduled_jobs (org_id, dedupe_key)
  where status in ('pending', 'leased');

create index scheduled_jobs_due_idx
  on public.scheduled_jobs (run_at, id)
  where status = 'pending';

create index scheduled_jobs_expired_lease_idx
  on public.scheduled_jobs (lease_until)
  where status = 'leased';

create table private.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete restrict,
  scope text not null,
  key text not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  response jsonb,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  locked_until timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, key)
);

create index idempotency_keys_expiry_idx on private.idempotency_keys (expires_at);

create table public.system_pauses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  scope_type text not null check (scope_type in ('global', 'organization', 'operation', 'connection', 'campaign', 'conversation', 'proactive')),
  scope_id uuid,
  reason text not null,
  source text not null check (source in ('manual', 'capacity', 'health', 'quality', 'security')),
  active boolean not null default true,
  paused_at timestamptz not null default now(),
  paused_by uuid references auth.users(id) on delete set null,
  resumed_at timestamptz,
  resumed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  check ((active and resumed_at is null) or (not active and resumed_at is not null))
);

create unique index system_pauses_one_active_scope_idx
  on public.system_pauses (org_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where active;

create table public.operation_capacity (
  operation_id uuid primary key,
  org_id uuid not null,
  active_count smallint not null default 0 check (active_count between 0 and 30),
  proactive_paused boolean not null default false,
  below_ten_since timestamptz,
  last_inbound_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create table private.capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  conversation_id uuid not null,
  source text not null check (source in ('inbound', 'proactive', 'followup', 'campaign')),
  status text not null default 'active' check (status in ('active', 'sleeping', 'released', 'backlog')),
  reserved_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  released_at timestamptz,
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade
);

create unique index capacity_reservations_live_conversation_idx
  on private.capacity_reservations (conversation_id)
  where status in ('active', 'backlog');

create index capacity_reservations_operation_status_idx
  on private.capacity_reservations (operation_id, status, last_activity_at);

create table public.capacity_snapshots (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  active_count smallint not null,
  backlog_count integer not null default 0,
  proactive_paused boolean not null,
  captured_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create index capacity_snapshots_timeline_idx
  on public.capacity_snapshots (operation_id, captured_at desc);

create table public.integration_health_checks (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  operation_id uuid,
  component text not null check (component in ('uazapi', 'meta', 'openai', 'storage', 'queues', 'push', 'cron')),
  target_id uuid,
  status text not null check (status in ('healthy', 'degraded', 'down', 'unknown')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_redacted text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create index integration_health_checks_latest_idx
  on public.integration_health_checks (org_id, component, checked_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  category text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  dedupe_key text,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade
);

create unique index alerts_open_dedupe_idx
  on public.alerts (org_id, dedupe_key)
  where dedupe_key is not null and status <> 'resolved';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_membership_id uuid not null,
  alert_id uuid references public.alerts(id) on delete cascade,
  channel text not null check (channel in ('app', 'push', 'whatsapp')),
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'read', 'failed', 'cancelled')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (recipient_membership_id, org_id)
    references public.memberships(id, org_id) on delete cascade
);

create index notifications_recipient_idx
  on public.notifications (recipient_membership_id, status, created_at desc);

create table public.scheduled_job_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  job_type text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  target_queue text not null,
  run_at timestamptz not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  max_attempts integer not null default 5,
  job_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete restrict,
  foreign key (job_id) references public.scheduled_jobs(id) on delete restrict
);

create table public.capacity_reservation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  conversation_id uuid not null,
  action text not null check (action in ('reserve', 'release', 'sleep', 'wake')),
  source text not null check (source in ('inbound', 'proactive', 'followup', 'campaign')),
  result text check (result in ('admitted', 'existing', 'backlog', 'proactive_paused', 'released', 'sleeping')),
  active_count smallint,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (operation_id, org_id)
    references public.operations(id, org_id) on delete cascade,
  foreign key (conversation_id, org_id)
    references public.conversations(id, org_id) on delete cascade
);

create or replace function private.seed_operation_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.operation_capacity (operation_id, org_id)
  values (new.id, new.org_id) on conflict (operation_id) do nothing;
  return new;
end;
$$;
revoke all on function private.seed_operation_capacity() from public, anon, authenticated, service_role;
create trigger operations_seed_capacity after insert on public.operations
for each row execute function private.seed_operation_capacity();

insert into public.operation_capacity (operation_id, org_id)
select id, org_id from public.operations on conflict (operation_id) do nothing;

create or replace function private.route_event_queue(p_event_type text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_event_type like 'message.inbound%' then 'ai-turns'
    when p_event_type like 'message.send%' then 'outbound-whatsapp'
    when p_event_type like 'call.%' then 'call-distribution'
    when p_event_type like 'campaign.%' then 'campaign-dispatch'
    when p_event_type like 'notification.%' or p_event_type like 'alert.%' then 'notifications'
    when p_event_type like 'media.%' then 'media-processing'
    else 'reconciliation'
  end;
$$;
revoke all on function private.route_event_queue(text) from public, anon, authenticated, service_role;

create or replace function private.dispatch_outbox(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event private.outbox_events%rowtype;
  v_count integer := 0;
  v_queue text;
begin
  for v_event in
    select * from private.outbox_events o
    where o.processed_at is null and o.available_at <= now() and o.attempts < 10
    order by o.created_at
    for update skip locked
    limit greatest(1, least(p_batch_size, 500))
  loop
    begin
      v_queue := private.route_event_queue(v_event.event_type);
      perform pgmq.send(v_queue, jsonb_build_object(
        'event_id', v_event.id,
        'event_type', v_event.event_type,
        'occurred_at', v_event.created_at,
        'organization_id', v_event.org_id,
        'operation_id', v_event.operation_id,
        'aggregate_type', v_event.aggregate_type,
        'aggregate_id', v_event.aggregate_id,
        'correlation_id', v_event.id,
        'causation_id', null,
        'schema_version', 1,
        'payload', v_event.payload,
        'idempotency_key', v_event.idempotency_key
      ));
      update private.outbox_events
      set processed_at = now(), attempts = attempts + 1, last_error = null
      where id = v_event.id;
      v_count := v_count + 1;
    exception when others then
      update private.outbox_events
      set attempts = attempts + 1,
          last_error = left(sqlerrm, 500),
          available_at = now() + make_interval(secs => least(3600, (2 ^ least(attempts + 1, 10))::integer))
      where id = v_event.id;
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.dispatch_outbox(integer) from public, anon, authenticated, service_role;

create or replace function private.dispatch_due_jobs(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.scheduled_jobs%rowtype;
  v_count integer := 0;
begin
  for v_job in
    select * from public.scheduled_jobs j
    where j.status = 'pending' and j.run_at <= now()
    order by j.run_at, j.id
    for update skip locked
    limit greatest(1, least(p_batch_size, 500))
  loop
    perform pgmq.send(v_job.target_queue, jsonb_build_object(
      'job_id', v_job.id,
      'job_type', v_job.job_type,
      'organization_id', v_job.org_id,
      'operation_id', v_job.operation_id,
      'aggregate_type', v_job.aggregate_type,
      'aggregate_id', v_job.aggregate_id,
      'payload', v_job.payload,
      'idempotency_key', v_job.dedupe_key,
      'schema_version', 1
    ));
    update public.scheduled_jobs
    set status = 'leased', lease_until = now() + interval '5 minutes', updated_at = now()
    where id = v_job.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.dispatch_due_jobs(integer) from public, anon, authenticated, service_role;

create or replace function private.reconcile_async_state()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count integer := 0;
begin
  update public.scheduled_jobs
  set status = case when attempts + 1 >= max_attempts then 'dead' else 'pending' end,
      attempts = attempts + 1,
      run_at = case when attempts + 1 >= max_attempts then run_at else now() + make_interval(secs => least(3600, (2 ^ least(attempts + 1, 10))::integer)) end,
      lease_until = null,
      last_error = coalesce(last_error, 'lease_expired'),
      updated_at = now()
  where status = 'leased' and lease_until < now();
  get diagnostics v_count = row_count;

  insert into public.alerts (org_id, operation_id, severity, category, title, body, entity_type, entity_id, dedupe_key)
  select j.org_id, j.operation_id, 'critical', 'dead_letter', 'Job esgotou tentativas',
         'O job ' || j.job_type || ' precisa de revisão manual.', 'scheduled_jobs', j.id,
         'dead-job:' || j.id::text
  from public.scheduled_jobs j
  where j.status = 'dead'
  on conflict (org_id, dedupe_key) where dedupe_key is not null and status <> 'resolved' do nothing;

  delete from private.idempotency_keys where expires_at < now();
  return v_count;
end;
$$;
revoke all on function private.reconcile_async_state() from public, anon, authenticated, service_role;

create or replace function private.process_scheduled_job_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_job_id uuid;
begin
  if (select auth.uid()) is null or new.actor_user_id <> (select auth.uid()) then
    raise exception 'scheduled_job_actor_mismatch' using errcode = '42501';
  end if;
  if not private.has_org_role(new.org_id, array['owner','manager']::text[]) then
    raise exception 'scheduled_job_forbidden' using errcode = '42501';
  end if;
  if new.operation_id is not null and not private.has_operation_access(new.operation_id) then
    raise exception 'scheduled_job_operation_forbidden' using errcode = '42501';
  end if;

  insert into public.scheduled_jobs (
    org_id, operation_id, job_type, aggregate_type, aggregate_id,
    target_queue, run_at, dedupe_key, payload, max_attempts, created_by
  ) values (
    new.org_id, new.operation_id, new.job_type, new.aggregate_type, new.aggregate_id,
    new.target_queue, new.run_at, new.dedupe_key, new.payload, new.max_attempts, (select auth.uid())
  )
  on conflict (org_id, dedupe_key) where status in ('pending','leased')
  do update set run_at = least(public.scheduled_jobs.run_at, excluded.run_at),
                payload = excluded.payload, updated_at = now()
  returning id into v_job_id;
  new.job_id := v_job_id;
  new.processed_at := now();
  return new;
end;
$$;
revoke all on function private.process_scheduled_job_request() from public, anon, authenticated, service_role;
create trigger scheduled_job_request_process before insert on public.scheduled_job_requests
for each row execute function private.process_scheduled_job_request();

create or replace function private.process_capacity_reservation_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_capacity public.operation_capacity%rowtype;
  v_existing private.capacity_reservations%rowtype;
  v_result text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'capacity_service_role_required' using errcode = '42501';
  end if;

  select * into v_capacity from public.operation_capacity c
  where c.operation_id = new.operation_id and c.org_id = new.org_id for update;
  if not found then raise exception 'capacity_operation_not_found' using errcode = '22023'; end if;

  select * into v_existing from private.capacity_reservations r
  where r.conversation_id = new.conversation_id and r.status in ('active','backlog') for update;

  if new.action in ('release','sleep') then
    if found and v_existing.status = 'active' then
      update private.capacity_reservations
      set status = case when new.action = 'sleep' then 'sleeping' else 'released' end,
          released_at = case when new.action = 'release' then now() else null end,
          last_activity_at = now()
      where id = v_existing.id;
      update public.operation_capacity
      set active_count = greatest(0, active_count - 1),
          below_ten_since = case when active_count - 1 < 10 then coalesce(below_ten_since, now()) else null end,
          version = version + 1, updated_at = now()
      where operation_id = new.operation_id;
    end if;
    v_result := case when new.action = 'sleep' then 'sleeping' else 'released' end;
  else
    if found and v_existing.status = 'active' then
      update private.capacity_reservations set last_activity_at = now() where id = v_existing.id;
      v_result := 'existing';
    elsif new.source <> 'inbound' and (v_capacity.active_count >= 25 or v_capacity.proactive_paused) then
      v_result := 'proactive_paused';
    elsif new.source = 'inbound' and v_capacity.active_count >= 30 then
      insert into private.capacity_reservations (org_id, operation_id, conversation_id, source, status)
      values (new.org_id, new.operation_id, new.conversation_id, new.source, 'backlog')
      on conflict (conversation_id) where status in ('active','backlog') do update set last_activity_at = now();
      v_result := 'backlog';
    else
      if v_existing.id is not null then
        update private.capacity_reservations
        set status = 'active', source = new.source, released_at = null, last_activity_at = now()
        where id = v_existing.id;
      else
        insert into private.capacity_reservations (org_id, operation_id, conversation_id, source, status)
        values (new.org_id, new.operation_id, new.conversation_id, new.source, 'active');
      end if;
      update public.operation_capacity
      set active_count = active_count + 1,
          proactive_paused = proactive_paused or active_count + 1 >= 25,
          last_inbound_at = case when new.source = 'inbound' then now() else last_inbound_at end,
          below_ten_since = null, version = version + 1, updated_at = now()
      where operation_id = new.operation_id;
      v_result := 'admitted';
    end if;
  end if;

  select * into v_capacity from public.operation_capacity where operation_id = new.operation_id;
  if v_capacity.proactive_paused then
    insert into public.system_pauses (org_id, operation_id, scope_type, scope_id, reason, source)
    values (new.org_id, new.operation_id, 'proactive', new.operation_id,
            'Capacidade proativa pausada ao atingir 25 conversas ativas.', 'capacity')
    on conflict (org_id, scope_type, (coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))) where active do nothing;
  end if;

  insert into public.capacity_snapshots (org_id, operation_id, active_count, backlog_count, proactive_paused)
  values (
    new.org_id, new.operation_id, v_capacity.active_count,
    (select count(*) from private.capacity_reservations where operation_id = new.operation_id and status = 'backlog'),
    v_capacity.proactive_paused
  );

  new.result := v_result;
  new.active_count := v_capacity.active_count;
  new.processed_at := now();
  return new;
end;
$$;
revoke all on function private.process_capacity_reservation_request() from public, anon, authenticated, service_role;
create trigger capacity_reservation_request_process before insert on public.capacity_reservation_requests
for each row execute function private.process_capacity_reservation_request();

create or replace function private.resume_proactive_capacity()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare v_count integer := 0;
begin
  update public.operation_capacity
  set proactive_paused = false, below_ten_since = null, version = version + 1, updated_at = now()
  where proactive_paused
    and active_count < 10
    and below_ten_since <= now() - interval '5 minutes'
    and (last_inbound_at is null or last_inbound_at <= now() - interval '2 minutes');
  get diagnostics v_count = row_count;

  update public.system_pauses p
  set active = false, resumed_at = now()
  where p.active and p.scope_type = 'proactive' and p.source = 'capacity'
    and exists (
      select 1 from public.operation_capacity c
      where c.operation_id = p.operation_id and not c.proactive_paused
    );
  return v_count;
end;
$$;
revoke all on function private.resume_proactive_capacity() from public, anon, authenticated, service_role;

create trigger scheduled_jobs_set_updated_at before update on public.scheduled_jobs
for each row execute function private.set_updated_at();
create trigger alerts_set_updated_at before update on public.alerts
for each row execute function private.set_updated_at();

alter table public.scheduled_jobs enable row level security;
alter table public.system_pauses enable row level security;
alter table public.operation_capacity enable row level security;
alter table public.capacity_snapshots enable row level security;
alter table public.integration_health_checks enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.scheduled_job_requests enable row level security;
alter table public.capacity_reservation_requests enable row level security;

create policy scheduled_jobs_select_manager on public.scheduled_jobs for select to authenticated
using ((select private.has_org_role(org_id, array['owner','manager']::text[])));
create policy system_pauses_select_member on public.system_pauses for select to authenticated
using ((select private.is_active_org_member(org_id)));
create policy system_pauses_manage_owner on public.system_pauses for all to authenticated
using ((select private.has_org_role(org_id, array['owner']::text[])))
with check ((select private.has_org_role(org_id, array['owner']::text[])));
create policy operation_capacity_select_member on public.operation_capacity for select to authenticated
using ((select private.has_operation_access(operation_id)));
create policy capacity_snapshots_select_manager on public.capacity_snapshots for select to authenticated
using ((select private.has_org_role(org_id, array['owner','manager']::text[])) and (select private.has_operation_access(operation_id)));
create policy integration_health_checks_select_manager on public.integration_health_checks for select to authenticated
using (org_id is null or (select private.has_org_role(org_id, array['owner','manager']::text[])));
create policy alerts_select_member on public.alerts for select to authenticated
using ((select private.is_active_org_member(org_id)) and (operation_id is null or (select private.has_operation_access(operation_id))));
create policy alerts_update_manager on public.alerts for update to authenticated
using ((select private.has_org_role(org_id, array['owner','manager']::text[])))
with check ((select private.has_org_role(org_id, array['owner','manager']::text[])));
create policy notifications_select_recipient on public.notifications for select to authenticated
using (recipient_membership_id = (select private.current_membership_id(org_id)));
create policy notifications_update_recipient on public.notifications for update to authenticated
using (recipient_membership_id = (select private.current_membership_id(org_id)))
with check (recipient_membership_id = (select private.current_membership_id(org_id)));
create policy scheduled_job_requests_select_actor on public.scheduled_job_requests for select to authenticated
using (actor_user_id = (select auth.uid()));
create policy scheduled_job_requests_insert_actor on public.scheduled_job_requests for insert to authenticated
with check (actor_user_id = (select auth.uid()) and (select private.has_org_role(org_id, array['owner','manager']::text[])));

grant select on public.scheduled_jobs to authenticated;
grant select, insert, update, delete on public.system_pauses to authenticated;
grant select on public.operation_capacity, public.capacity_snapshots, public.integration_health_checks to authenticated;
grant select, update on public.alerts, public.notifications to authenticated;
grant select, insert on public.scheduled_job_requests to authenticated;
revoke all on public.capacity_reservation_requests from public, anon, authenticated;
grant select, insert on public.capacity_reservation_requests to service_role;
grant all on public.scheduled_jobs, public.system_pauses, public.operation_capacity,
  public.capacity_snapshots, public.integration_health_checks, public.alerts,
  public.notifications, public.scheduled_job_requests, public.capacity_reservation_requests to service_role;
revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;

select cron.schedule(
  'gril-outbox-dispatch',
  '* * * * *',
  'select private.dispatch_outbox(100);'
);
select cron.schedule(
  'gril-scheduled-job-dispatch',
  '* * * * *',
  'select private.dispatch_due_jobs(100);'
);
select cron.schedule(
  'gril-async-reconciliation',
  '*/5 * * * *',
  'select private.reconcile_async_state(); select private.resume_proactive_capacity();'
);

comment on table public.scheduled_jobs is 'Canonical durable schedule. Cron leases due jobs and publishes to a private Supabase Basic Queue.';
comment on table private.capacity_reservations is 'Transactional capacity source; snapshots are metrics only.';

commit;
