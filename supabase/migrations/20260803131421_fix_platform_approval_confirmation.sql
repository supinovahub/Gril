begin;

-- Keep the typed confirmation independent from the SQL client's text encoding.
-- The hex value is the UTF-8 representation of the product phrase.
create or replace function private.valid_typed_confirmation(p_confirmation text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select encode(convert_to(coalesce(p_confirmation, ''), 'UTF8'), 'hex') =
    '434f4e4649524d41522041c387c3834f'
$$;

revoke all on function private.valid_typed_confirmation(text)
  from public, anon, authenticated, service_role;

-- Older remote migrations were once submitted by a client that changed the
-- encoding of the confirmation phrase. Replace every affected comparison with
-- the encoding-safe helper while preserving each function's ACL and body.
do $$
declare
  v_function_name text;
  v_definition text;
  v_updated_definition text;
  v_function_names constant text[] := array[
    'platform_control_organization',
    'platform_control_user',
    'platform_manage_principal',
    'platform_manage_support_grant',
    'platform_preauthorize_organization',
    'revoke_external_support_access',
    'rotate_organization_join_code'
  ];
begin
  foreach v_function_name in array v_function_names loop
    select pg_get_functiondef(p.oid)
      into v_definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_function_name
       and p.prokind = 'f';

    if v_definition is null then
      raise exception 'confirmation_function_not_found:%', v_function_name;
    end if;

    v_updated_definition := regexp_replace(
      v_definition,
      'p_confirmation\s*<>\s*''[^'']*''',
      'not private.valid_typed_confirmation(p_confirmation)',
      'g'
    );

    if v_updated_definition = v_definition then
      raise exception 'confirmation_comparison_not_found:%', v_function_name;
    end if;

    execute v_updated_definition;
  end loop;
end;
$$;

create or replace function public.decide_access_request(
  p_request_id uuid,p_decision text,p_approved_role text default null,p_operation_ids uuid[] default array[]::uuid[],
  p_public_reason text default null,p_internal_note text default null,p_confirmation text default null
) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=(select auth.uid());v_request public.access_requests%rowtype;v_actor_membership public.memberships%rowtype;
  v_membership uuid;v_operation uuid;v_platform_role text;
begin
  if not private.valid_typed_confirmation(p_confirmation)
    or not(p_decision=any(array['approve','approve_30_days','reject','request_correction','revoke_approval']::text[])) then
    raise exception 'confirmation_or_decision_invalid' using errcode='22023';end if;
  select * into v_request from public.access_requests where id=p_request_id for update;
  if not found then raise exception 'access_request_not_found' using errcode='22023';end if;
  if p_decision='approve_30_days' and v_request.request_type<>'create_organization' then
    raise exception 'temporary_approval_only_for_organization' using errcode='22023';end if;
  v_platform_role:=private.current_platform_role();
  if v_request.request_type='create_organization' then
    if v_platform_role<>'platform_admin' then raise exception 'platform_admin_required' using errcode='42501';end if;
  else
    select * into v_actor_membership from public.memberships where org_id=v_request.org_id and user_id=v_actor and status='active';
    if not found then raise exception 'request_decision_forbidden' using errcode='42501';end if;
    if v_request.requested_role='manager' and v_actor_membership.role<>'owner' then
      raise exception 'owner_required_for_manager_request' using errcode='42501';end if;
    if v_request.requested_role='broker' and not(v_actor_membership.role='owner' or(v_actor_membership.role='manager' and exists(
      select 1 from public.membership_permissions mp where mp.membership_id=v_actor_membership.id and mp.permission='team.manage'))) then
      raise exception 'team_manager_required' using errcode='42501';end if;
    if not exists(select 1 from public.organizations where id=v_request.org_id and status='active') then
      raise exception 'organization_not_active' using errcode='55000';end if;
  end if;
  if p_decision='revoke_approval' then
    if v_request.request_type<>'create_organization' or v_request.status<>'approved' or v_request.consumed_at is not null then
      raise exception 'approval_not_revocable' using errcode='22023';end if;
    update public.access_requests set status='revoked',public_reason=coalesce(nullif(trim(p_public_reason),''),'Autorização revogada.'),updated_at=now() where id=v_request.id;
  elsif p_decision='request_correction' then
    if v_request.status<>'pending' or nullif(trim(p_public_reason),'') is null then raise exception 'correction_reason_required' using errcode='22023';end if;
    update public.access_requests set status='correction_requested',public_reason=trim(p_public_reason),updated_at=now() where id=v_request.id;
  elsif p_decision='reject' then
    if not(v_request.status=any(array['pending','correction_requested']::text[])) or nullif(trim(p_public_reason),'') is null then
      raise exception 'rejection_reason_required' using errcode='22023';end if;
    update public.access_requests set status='rejected',public_reason=trim(p_public_reason),updated_at=now() where id=v_request.id;
  else
    if v_request.status<>'pending' then raise exception 'request_not_pending' using errcode='22023';end if;
    if not exists(select 1 from auth.users where id=v_request.requester_user_id and email_confirmed_at is not null) then
      raise exception 'email_confirmation_required' using errcode='42501';end if;
    perform private.assert_normal_account(v_request.requester_user_id);
    if exists(select 1 from public.memberships where user_id=v_request.requester_user_id and status in('pending','active','suspended')) then
      raise exception 'account_already_linked' using errcode='22023';end if;
    if v_request.request_type='create_organization' then
      update public.access_requests set status='approved',approved_at=now(),approved_by=v_actor,
        approval_expires_at=case when p_decision='approve_30_days' then now()+interval '30 days' else null end,
        public_reason=null,updated_at=now() where id=v_request.id;
    else
      if not(p_approved_role=any(array['manager','broker']::text[])) then raise exception 'approved_role_required' using errcode='22023';end if;
      if v_actor_membership.role='manager' and p_approved_role<>'broker' then raise exception 'manager_cannot_create_manager' using errcode='42501';end if;
      if p_approved_role='broker' and coalesce(array_length(p_operation_ids,1),0)=0 then
        raise exception 'broker_operation_required' using errcode='22023';end if;
      if exists(select 1 from unnest(p_operation_ids) x where not exists(select 1 from public.operations o
        where o.id=x and o.org_id=v_request.org_id and o.status<>'archived')) then raise exception 'operation_invalid' using errcode='22023';end if;
      insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
        values(v_request.org_id,v_request.requester_user_id,p_approved_role,'active',now(),v_actor) returning id into v_membership;
      if p_approved_role='broker' then
        foreach v_operation in array p_operation_ids loop
          insert into public.membership_operations(membership_id,operation_id,org_id) values(v_membership,v_operation,v_request.org_id);
        end loop;
      else
        insert into public.membership_permissions(membership_id,permission) values
          (v_membership,'team.manage'),(v_membership,'operations.manage'),(v_membership,'operations.pause'),
          (v_membership,'contacts.manage'),(v_membership,'campaigns.manage'),(v_membership,'pipeline.manage'),
          (v_membership,'reports.view'),(v_membership,'ai.manage') on conflict do nothing;
      end if;
      update public.profiles set whatsapp_e164=v_request.whatsapp_e164,updated_at=now() where user_id=v_request.requester_user_id;
      update public.access_requests set status='consumed',approved_role=p_approved_role,approved_at=now(),approved_by=v_actor,
        consumed_at=now(),public_reason=null,updated_at=now() where id=v_request.id;
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,status)
        values(v_request.org_id,v_membership,'in_app','Acesso aprovado','Seu acesso foi liberado como '||
          case when p_approved_role='manager' then 'gestor' else 'corretor' end||'.','pending');
    end if;
  end if;
  insert into private.access_request_events(request_id,actor_user_id,action,public_reason,internal_note,snapshot)
    select v_request.id,v_actor,p_decision,nullif(trim(p_public_reason),''),nullif(trim(p_internal_note),''),to_jsonb(r)
      from public.access_requests r where r.id=v_request.id;
  return(select status from public.access_requests where id=v_request.id);
end;$$;

revoke all on function public.decide_access_request(uuid,text,text,uuid[],text,text,text) from public,anon;
grant execute on function public.decide_access_request(uuid,text,text,uuid[],text,text,text) to authenticated,service_role;

create or replace function private.process_organization_bootstrap_request()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_operation uuid;v_membership uuid;v_org_slug text;v_operation_slug text;v_access public.access_requests%rowtype;
begin
  if(select auth.uid()) is null or new.actor_user_id<>(select auth.uid()) then raise exception 'bootstrap_forbidden' using errcode='42501';end if;
  perform private.assert_normal_account(new.actor_user_id);
  if exists(select 1 from public.memberships where user_id=new.actor_user_id and status in('pending','active','suspended')) then
    raise exception 'bootstrap_membership_exists' using errcode='22023';end if;
  select * into v_access from public.access_requests where requester_user_id=new.actor_user_id and request_type='create_organization'
    and status='approved' and (approval_expires_at is null or approval_expires_at>now())
    and(new.access_request_id is null or id=new.access_request_id)
    order by approved_at desc limit 1 for update;
  if not found then raise exception 'approved_organization_request_required' using errcode='42501';end if;
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'bootstrap_timezone_invalid' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(new.actor_user_id::text,0));
  v_org_slug:=coalesce(nullif(private.safe_slug(new.organization_name),''),'organizacao');
  while exists(select 1 from public.organizations where slug=v_org_slug) loop
    v_org_slug:=left(v_org_slug,52)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,7);end loop;
  v_operation_slug:=coalesce(nullif(private.safe_slug(new.operation_name),''),'operacao');
  insert into public.organizations(name,slug,timezone,city,state)
    values(trim(new.organization_name),v_org_slug,new.timezone,coalesce(nullif(trim(new.city),''),v_access.city),
      coalesce(upper(nullif(trim(new.state),'')),v_access.state)) returning id into v_org;
  insert into public.operations(org_id,name,slug,timezone,is_default)
    values(v_org,trim(new.operation_name),v_operation_slug,new.timezone,true) returning id into v_operation;
  insert into public.memberships(org_id,user_id,role,status,approved_at,approved_by)
    values(v_org,new.actor_user_id,'owner','active',now(),v_access.approved_by) returning id into v_membership;
  insert into public.membership_operations(membership_id,operation_id,org_id) values(v_membership,v_operation,v_org);
  update public.profiles set whatsapp_e164=v_access.whatsapp_e164,updated_at=now() where user_id=new.actor_user_id;
  update public.organization_settings set institutional_profile=institutional_profile||jsonb_strip_nulls(jsonb_build_object(
    'company_name',v_access.organization_name,'cnpj',v_access.cnpj,'creci',v_access.creci,'city',v_access.city,'state',v_access.state,
    'operation_description',v_access.operation_description,'approximate_brokers',v_access.approximate_brokers)) where org_id=v_org;
  update public.access_requests set status='consumed',consumed_at=now(),updated_at=now() where id=v_access.id;
  insert into private.access_request_events(request_id,actor_user_id,action,snapshot)
    values(v_access.id,new.actor_user_id,'organization_created',jsonb_build_object('org_id',v_org,'operation_id',v_operation));
  new.organization_id:=v_org;new.operation_id:=v_operation;new.membership_id:=v_membership;new.access_request_id:=v_access.id;
  new.city:=coalesce(new.city,v_access.city);new.state:=coalesce(new.state,v_access.state);new.result:='created';new.processed_at:=now();
  insert into audit.events(org_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(v_org,new.actor_user_id,'organization.bootstrapped','organizations',v_org,jsonb_build_object(
      'operation_id',v_operation,'membership_id',v_membership,'access_request_id',v_access.id));
  return new;
end;$$;

revoke all on function private.process_organization_bootstrap_request() from public,anon,authenticated,service_role;

commit;
