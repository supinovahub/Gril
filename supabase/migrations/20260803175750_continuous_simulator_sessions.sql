begin;

create table public.simulator_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  title text not null check (char_length(trim(title)) between 2 and 160),
  initial_state jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  turn_count integer not null default 0 check (turn_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id, org_id) references public.operations(id, org_id) on delete cascade,
  unique (id, org_id),
  check (
    (status = 'active' and archived_at is null and archived_by is null)
    or (status = 'archived' and archived_at is not null and archived_by is not null)
  )
);

create index simulator_sessions_status_activity_idx
  on public.simulator_sessions(org_id, status, last_activity_at desc);

alter table public.simulator_runs
  add column session_id uuid,
  add column turn_index integer;

insert into public.simulator_sessions (
  id,
  org_id,
  operation_id,
  title,
  initial_state,
  status,
  turn_count,
  created_by,
  last_activity_at,
  created_at,
  updated_at
)
select
  run.id,
  run.org_id,
  run.operation_id,
  run.title,
  run.initial_state,
  'active',
  1,
  run.created_by,
  coalesce(run.completed_at, run.created_at),
  run.created_at,
  coalesce(run.completed_at, run.created_at)
from public.simulator_runs as run;

update public.simulator_runs
set session_id = id,
    turn_index = 1;

alter table public.simulator_runs
  alter column session_id set not null,
  alter column turn_index set not null,
  add constraint simulator_runs_turn_index_check check (turn_index > 0),
  add constraint simulator_runs_session_org_fkey
    foreign key (session_id, org_id) references public.simulator_sessions(id, org_id) on delete cascade,
  add constraint simulator_runs_session_turn_key unique (session_id, turn_index);

alter table public.simulator_run_requests
  add column session_id uuid;

update public.simulator_run_requests as request
set session_id = run.session_id
from public.simulator_runs as run
where run.id = request.simulator_run_id
  and run.org_id = request.org_id;

alter table public.simulator_run_requests
  add constraint simulator_run_requests_session_org_fkey
    foreign key (session_id, org_id) references public.simulator_sessions(id, org_id) on delete cascade;

create table public.simulator_session_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  action text not null check (action in ('archive', 'restore')),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  result text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (session_id, org_id) references public.simulator_sessions(id, org_id) on delete cascade
);

create or replace function private.process_simulator_run_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_execution uuid;
  v_result text;
  v_run uuid;
  v_session public.simulator_sessions%rowtype;
  v_turn integer;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'ai.manage') then
    raise exception 'simulator_forbidden' using errcode = '42501';
  end if;

  if new.session_id is null then
    insert into public.simulator_sessions (
      org_id,
      operation_id,
      title,
      initial_state,
      created_by
    ) values (
      new.org_id,
      new.operation_id,
      new.title,
      new.initial_state,
      new.actor_user_id
    ) returning * into v_session;
    new.session_id := v_session.id;
    v_turn := 1;
  else
    select * into v_session
    from public.simulator_sessions
    where id = new.session_id
      and org_id = new.org_id
    for update;

    if not found then
      raise exception 'simulator_session_not_found' using errcode = '22023';
    end if;
    if v_session.status <> 'active' then
      raise exception 'simulator_session_archived' using errcode = '22023';
    end if;
    if v_session.operation_id is distinct from new.operation_id then
      raise exception 'simulator_session_operation_mismatch' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.simulator_runs
      where session_id = v_session.id
        and status = 'queued'
    ) then
      raise exception 'simulator_turn_pending' using errcode = '55000';
    end if;

    v_turn := v_session.turn_count + 1;
    new.title := v_session.title;
    new.initial_state := v_session.initial_state;
  end if;

  insert into public.ai_execution_requests (
    org_id,
    operation_id,
    mode,
    input_snapshot,
    idempotency_key,
    actor_user_id
  ) values (
    new.org_id,
    new.operation_id,
    'simulator',
    jsonb_build_object(
      'title', v_session.title,
      'input', new.simulated_input,
      'initial_state', v_session.initial_state,
      'simulator_session_id', v_session.id,
      'simulator_turn_index', v_turn
    ),
    'simulator:' || new.id::text,
    new.actor_user_id
  ) returning execution_id, result into v_execution, v_result;

  insert into public.simulator_runs (
    org_id,
    operation_id,
    session_id,
    turn_index,
    title,
    simulated_input,
    initial_state,
    status,
    execution_id,
    created_by
  ) values (
    new.org_id,
    new.operation_id,
    v_session.id,
    v_turn,
    v_session.title,
    new.simulated_input,
    v_session.initial_state,
    v_result,
    v_execution,
    new.actor_user_id
  ) returning id into v_run;

  update public.simulator_sessions
  set turn_count = v_turn,
      last_activity_at = now(),
      updated_at = now()
  where id = v_session.id;

  new.simulator_run_id := v_run;
  new.processed_at := now();
  return new;
end;
$$;

create or replace function private.process_simulator_session_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_session public.simulator_sessions%rowtype;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'ai.manage') then
    raise exception 'simulator_session_forbidden' using errcode = '42501';
  end if;

  select * into v_session
  from public.simulator_sessions
  where id = new.session_id
    and org_id = new.org_id
  for update;

  if not found then
    raise exception 'simulator_session_not_found' using errcode = '22023';
  end if;

  if new.action = 'archive' then
    if v_session.status = 'archived' then
      new.result := 'already_archived';
    else
      if exists (
        select 1
        from public.simulator_runs
        where session_id = v_session.id
          and status = 'queued'
      ) then
        raise exception 'simulator_turn_pending' using errcode = '55000';
      end if;
      update public.simulator_sessions
      set status = 'archived',
          archived_by = new.actor_user_id,
          archived_at = now(),
          updated_at = now()
      where id = v_session.id;
      new.result := 'archived';
    end if;
  else
    if v_session.status = 'active' then
      new.result := 'already_active';
    else
      update public.simulator_sessions
      set status = 'active',
          archived_by = null,
          archived_at = null,
          updated_at = now()
      where id = v_session.id;
      new.result := 'restored';
    end if;
  end if;

  insert into audit.events (
    org_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    new.org_id,
    new.actor_user_id,
    'simulator_session.' || new.action,
    'simulator_sessions',
    new.session_id,
    jsonb_build_object('result', new.result)
  );

  new.processed_at := now();
  return new;
end;
$$;

create or replace function private.sync_simulator_run_from_execution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_session_id uuid;
begin
  update public.simulator_runs
  set status = case
        when new.status = 'completed' then 'completed'
        when new.status in ('failed', 'superseded', 'cancelled') then 'failed'
        when new.status = 'blocked' then 'blocked'
        else 'queued'
      end,
      output_text = new.output_text,
      output_structured = new.output_structured,
      completed_at = case
        when new.status in ('completed', 'failed', 'superseded', 'cancelled', 'blocked')
          then coalesce(new.completed_at, now())
        else null
      end
  where execution_id = new.id
    and org_id = new.org_id
  returning session_id into v_session_id;

  if v_session_id is not null then
    update public.simulator_sessions
    set last_activity_at = greatest(last_activity_at, coalesce(new.completed_at, now())),
        updated_at = now()
    where id = v_session_id;
  end if;
  return new;
end;
$$;

revoke all on function private.process_simulator_run_request() from public, anon, authenticated, service_role;
revoke all on function private.process_simulator_session_request() from public, anon, authenticated, service_role;
revoke all on function private.sync_simulator_run_from_execution() from public, anon, authenticated, service_role;

create trigger simulator_session_request_process
before insert on public.simulator_session_requests
for each row execute function private.process_simulator_session_request();

create trigger simulator_sessions_set_updated_at
before update on public.simulator_sessions
for each row execute function private.set_updated_at();

alter table public.simulator_sessions enable row level security;
alter table public.simulator_session_requests enable row level security;

create policy simulator_sessions_manager_select
on public.simulator_sessions
for select
to authenticated
using ((select private.has_org_permission(org_id, 'ai.manage')));

create policy simulator_session_requests_actor_select
on public.simulator_session_requests
for select
to authenticated
using (actor_user_id = (select auth.uid()));

create policy simulator_session_requests_manager_insert
on public.simulator_session_requests
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select private.has_org_permission(org_id, 'ai.manage'))
);

grant select on public.simulator_sessions to authenticated;
grant select, insert on public.simulator_session_requests to authenticated;
grant all on public.simulator_sessions, public.simulator_session_requests to service_role;

comment on table public.simulator_sessions is
  'Persistent isolated simulator conversations. Archiving is reversible and never affects leads, Inbox, WhatsApp, calls, campaigns or capacity.';
comment on column public.simulator_runs.turn_index is
  'Monotonic turn number inside one simulator session; only one turn may be queued at a time.';
comment on table public.simulator_session_requests is
  'Audited command boundary for archiving and restoring simulator sessions.';

commit;
