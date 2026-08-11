begin;

alter table public.campaigns
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null;

alter table public.campaigns
  drop constraint campaigns_status_check,
  add constraint campaigns_status_check check (status in ('draft','importing','review','approved','running','paused','completed','cancelled','failed','archived')),
  add constraint campaigns_archive_fields_check check (
    (status = 'archived' and archived_at is not null and archived_by is not null)
    or (status <> 'archived' and archived_at is null and archived_by is null)
  );

alter table public.campaign_transition_requests
  drop constraint campaign_transition_requests_requested_action_check,
  add constraint campaign_transition_requests_requested_action_check check (requested_action in ('approve','start','pause','resume','cancel','complete','archive'));

create table public.campaign_edit_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  campaign_id uuid not null,
  name text,
  connection_id uuid,
  ai_mode text,
  opening_template text,
  message_template_id uuid,
  message_template_provided boolean not null default false,
  expected_version integer not null check (expected_version > 0),
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  resulting_status text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (campaign_id, org_id) references public.campaigns(id, org_id) on delete restrict,
  foreign key (connection_id, org_id) references public.whatsapp_connections(id, org_id) on delete restrict,
  foreign key (message_template_id, org_id) references public.whatsapp_message_templates(id, org_id) on delete restrict,
  check (name is not null or connection_id is not null or ai_mode is not null or opening_template is not null or message_template_provided)
);

create or replace function private.process_campaign_edit_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_campaign public.campaigns%rowtype;
  v_connection public.whatsapp_connections%rowtype;
  v_template public.whatsapp_message_templates%rowtype;
  v_name text;
  v_ai_mode text;
  v_opening_template text;
  v_connection_id uuid;
  v_message_template_id uuid;
  v_status text;
  v_examples jsonb;
begin
  if (select auth.uid()) is null
     or new.actor_user_id <> (select auth.uid())
     or not private.has_org_permission(new.org_id, 'campaigns.manage') then
    raise exception 'campaign_edit_forbidden' using errcode = '42501';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = new.campaign_id and org_id = new.org_id
  for update;

  if not found or v_campaign.version <> new.expected_version then
    raise exception 'campaign_version_conflict' using errcode = '40001';
  end if;
  if v_campaign.status not in ('draft','importing','review','approved') then
    raise exception 'campaign_not_editable' using errcode = '22023';
  end if;
  if v_campaign.status = 'approved'
     and exists (select 1 from public.campaign_waves where campaign_id = v_campaign.id) then
    raise exception 'campaign_not_editable' using errcode = '22023';
  end if;

  v_name := coalesce(nullif(trim(new.name), ''), v_campaign.name);
  v_connection_id := coalesce(new.connection_id, v_campaign.connection_id);
  v_ai_mode := coalesce(new.ai_mode, v_campaign.ai_mode);
  v_opening_template := coalesce(nullif(trim(new.opening_template), ''), v_campaign.opening_template);
  v_message_template_id := case
    when new.message_template_provided then new.message_template_id
    else v_campaign.message_template_id
  end;

  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception 'campaign_name_invalid' using errcode = '22023';
  end if;
  if v_ai_mode not in ('off','shadow','assisted','production') then
    raise exception 'invalid_ai_mode' using errcode = '22023';
  end if;
  if char_length(v_opening_template) < 10 or char_length(v_opening_template) > 2000 then
    raise exception 'campaign_opening_template_invalid' using errcode = '22023';
  end if;

  select * into v_connection
  from public.whatsapp_connections
  where id = v_connection_id and org_id = new.org_id;
  if not found or v_connection.operation_id <> v_campaign.operation_id
     or v_connection.status <> 'active' or not v_connection.campaign_enabled then
    raise exception 'active_campaign_connection_required' using errcode = '22023';
  end if;

  if v_connection.provider = 'meta_cloud' then
    select * into v_template
    from public.whatsapp_message_templates
    where id = v_message_template_id
      and org_id = new.org_id
      and connection_id = v_connection.id
      and enabled
      and provider_status = 'APPROVED'
      and purpose = 'campaign'
      and variable_count <= 1;
    if not found then
      raise exception 'approved_meta_campaign_template_required' using errcode = '22023';
    end if;
  elsif v_message_template_id is not null then
    raise exception 'template_only_for_meta' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(replace(v_opening_template, '{{name}}', coalesce(c.name, '')) order by cc.created_at),
    '[]'::jsonb
  ) into v_examples
  from public.campaign_contacts cc
  join public.contacts c on c.id = cc.contact_id and c.org_id = new.org_id
  where cc.campaign_id = v_campaign.id;

  v_status := case when v_campaign.status = 'approved' then 'review' else v_campaign.status end;
  update public.campaigns
  set name = v_name,
      connection_id = v_connection_id,
      ai_mode = v_ai_mode,
      opening_template = v_opening_template,
      message_template_id = v_message_template_id,
      opening_examples = v_examples,
      status = v_status,
      version = version + 1,
      updated_at = now()
  where id = v_campaign.id;

  new.resulting_status := v_status;
  new.processed_at := now();
  insert into audit.events (org_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.org_id,
    new.actor_user_id,
    'campaign.updated',
    'campaigns',
    v_campaign.id,
    jsonb_build_object(
      'from_status', v_campaign.status,
      'to_status', v_status,
      'fields', jsonb_build_array(
        case when new.name is not null then 'name' end,
        case when new.connection_id is not null then 'connection_id' end,
        case when new.ai_mode is not null then 'ai_mode' end,
        case when new.opening_template is not null then 'opening_template' end,
        case when new.message_template_provided then 'message_template_id' end
      )
    )
  );
  return new;
end;
$$;

create or replace function private.process_campaign_transition_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_campaign public.campaigns%rowtype;
  v_status text;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_permission(new.org_id,'campaigns.manage') then raise exception 'campaign_transition_forbidden' using errcode='42501'; end if;
  select * into v_campaign from public.campaigns where id=new.campaign_id and org_id=new.org_id for update;
  if not found or v_campaign.version<>new.expected_version then raise exception 'campaign_version_conflict' using errcode='40001'; end if;
  if new.requested_action='approve' then
    if v_campaign.status<>'review' or not exists(select 1 from public.campaign_contacts where campaign_id=v_campaign.id and status='ready') then raise exception 'campaign_review_with_contacts_required' using errcode='22023'; end if;
    if not exists(select 1 from public.whatsapp_connections where id=v_campaign.connection_id and status='active' and campaign_enabled) then raise exception 'active_campaign_connection_required' using errcode='22023'; end if;
    v_status:='approved'; update public.campaigns set status=v_status,approved_by=new.actor_user_id,approved_at=now(),version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action='pause' then
    if v_campaign.status<>'running' then raise exception 'campaign_not_running' using errcode='22023'; end if;
    v_status:='paused'; update public.campaigns set status=v_status,paused_reason=coalesce(nullif(trim(new.reason),''),'manual'),version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action in ('start','resume') then
    if (new.requested_action='start' and v_campaign.status<>'approved') or (new.requested_action='resume' and v_campaign.status<>'paused') then raise exception 'campaign_not_startable' using errcode='22023'; end if;
    if exists(select 1 from public.system_pauses where org_id=new.org_id and active and (scope_type in ('global','organization','proactive') or (scope_type='campaign' and scope_id=v_campaign.id))) then raise exception 'campaign_pause_active' using errcode='55000'; end if;
    v_status:='running'; update public.campaigns set status=v_status,paused_reason=null,version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action='cancel' then
    if v_campaign.status in ('completed','cancelled','archived') then raise exception 'campaign_terminal' using errcode='22023'; end if;
    v_status:='cancelled'; update public.campaigns set status=v_status,version=version+1,updated_at=now() where id=v_campaign.id;
    update public.scheduled_jobs set status='cancelled',updated_at=now() where org_id=new.org_id and status in ('pending','leased') and payload->>'campaign_id'=v_campaign.id::text;
  elsif new.requested_action='complete' then
    if exists(select 1 from public.campaign_contacts where campaign_id=v_campaign.id and status in ('ready','queued','followup')) then raise exception 'campaign_contacts_not_terminal' using errcode='22023'; end if;
    v_status:='completed'; update public.campaigns set status=v_status,completed_at=now(),version=version+1,updated_at=now() where id=v_campaign.id;
  elsif new.requested_action='archive' then
    if v_campaign.status='archived' then raise exception 'campaign_already_archived' using errcode='22023'; end if;
    v_status:='archived';
    update public.scheduled_jobs
    set status='cancelled', updated_at=now()
    where org_id=new.org_id and status in ('pending','leased') and payload->>'campaign_id'=v_campaign.id::text;
    update public.campaign_contacts
    set status='excluded', suppression_reason='campaign_archived', updated_at=now()
    where campaign_id=v_campaign.id and status in ('ready','queued','followup');
    update public.campaigns
    set status=v_status, archived_at=now(), archived_by=new.actor_user_id, version=version+1, updated_at=now()
    where id=v_campaign.id;
  else raise exception 'unsupported_campaign_action' using errcode='22023'; end if;
  new.resulting_status:=v_status; new.processed_at:=now();
  insert into audit.events (org_id,actor_user_id,action,entity_type,entity_id,metadata)
  values (new.org_id,new.actor_user_id,'campaign.'||new.requested_action,'campaigns',v_campaign.id,jsonb_build_object('from',v_campaign.status,'to',v_status,'reason',new.reason));
  return new;
end; $$;

revoke all on function private.process_campaign_edit_request() from public,anon,authenticated,service_role;
create trigger campaign_edit_process before insert on public.campaign_edit_requests for each row execute function private.process_campaign_edit_request();

alter table public.campaign_edit_requests enable row level security;
create policy campaign_edit_actor_select on public.campaign_edit_requests for select to authenticated using (actor_user_id=(select auth.uid()));
create policy campaign_edit_manager_insert on public.campaign_edit_requests for insert to authenticated with check (actor_user_id=(select auth.uid()) and (select private.has_org_permission(org_id,'campaigns.manage')));

grant select, insert on public.campaign_edit_requests to authenticated;

comment on table public.campaign_edit_requests is 'Audited optimistic-concurrency command for editing a reactivation campaign before dispatch.';
comment on column public.campaigns.archived_at is 'When the campaign was archived; archived campaigns never resume dispatch.';

commit;
