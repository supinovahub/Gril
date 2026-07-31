begin;

create table public.connection_activation_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  connection_id uuid not null,
  action text not null check (action in ('activate','pause','revoke')),
  inbound_enabled boolean not null default false,
  campaign_enabled boolean not null default false,
  reason text,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  resulting_status text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete restrict
);

create or replace function private.protect_connection_status_change()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.status is distinct from new.status and (select auth.role())<>'service_role' and pg_trigger_depth()<=1 then
    raise exception 'use_connection_activation_request' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function private.protect_connection_status_change() from public,anon,authenticated,service_role;
create trigger whatsapp_connections_protect_status before update on public.whatsapp_connections
for each row execute function private.protect_connection_status_change();

create or replace function private.process_connection_activation_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_connection public.whatsapp_connections%rowtype;v_status text;
begin
  if (select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) or not private.has_org_role(new.org_id,array['owner']::text[]) then raise exception 'connection_activation_owner_required' using errcode='42501';end if;
  select * into v_connection from public.whatsapp_connections where id=new.connection_id and org_id=new.org_id for update;
  if not found then raise exception 'connection_not_found' using errcode='22023';end if;
  if new.action='activate' then
    if v_connection.status not in ('draft','paused','error') or v_connection.phone_e164 is null or v_connection.endpoint_url is null or v_connection.secret_reference is null then raise exception 'connection_configuration_incomplete' using errcode='22023';end if;
    if not exists(select 1 from public.integration_health_checks h where h.target_id=v_connection.id and h.status='healthy' and h.checked_at>now()-interval '15 minutes') then raise exception 'recent_healthy_check_required' using errcode='22023';end if;
    v_status:='active';
  elsif new.action='pause' then if v_connection.status<>'active' then raise exception 'connection_not_active' using errcode='22023';end if;v_status:='paused';
  else v_status:='revoked';end if;
  update public.whatsapp_connections set status=v_status,inbound_enabled=case when v_status='active' then new.inbound_enabled else false end,campaign_enabled=case when v_status='active' then new.campaign_enabled else false end,updated_at=now() where id=v_connection.id;
  if v_status='active' then
    update public.system_pauses set active=false,resumed_at=now(),resumed_by=new.actor_user_id where scope_type='connection' and scope_id=v_connection.id and active;
  else
    insert into public.system_pauses(org_id,operation_id,scope_type,scope_id,reason,source,paused_by)
    values(new.org_id,v_connection.operation_id,'connection',v_connection.id,coalesce(nullif(trim(new.reason),''),'Conexão não ativa'),'manual',new.actor_user_id)
    on conflict (org_id,scope_type,coalesce(scope_id,'00000000-0000-0000-0000-000000000000'::uuid)) where active do nothing;
  end if;
  insert into audit.events(org_id,operation_id,actor_user_id,action,entity_type,entity_id,metadata) values(new.org_id,v_connection.operation_id,new.actor_user_id,'connection.'||new.action,'whatsapp_connections',v_connection.id,jsonb_build_object('from',v_connection.status,'to',v_status,'reason',new.reason));
  new.resulting_status:=v_status;new.processed_at:=now();return new;
end; $$;
revoke all on function private.process_connection_activation_request() from public,anon,authenticated,service_role;
create trigger connection_activation_process before insert on public.connection_activation_requests for each row execute function private.process_connection_activation_request();

alter table public.connection_activation_requests enable row level security;
create policy connection_activation_actor_select on public.connection_activation_requests for select to authenticated using(actor_user_id=(select auth.uid()));
create policy connection_activation_owner_insert on public.connection_activation_requests for insert to authenticated with check(actor_user_id=(select auth.uid()) and (select private.has_org_role(org_id,array['owner']::text[])));
grant select,insert on public.connection_activation_requests to authenticated;grant all on public.connection_activation_requests to service_role;

comment on table public.connection_activation_requests is 'Owner-only audited activation. A recent healthy provider check is mandatory before any inbound or campaign is enabled.';

commit;
