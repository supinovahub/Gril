begin;

create or replace function public.organization_has_external_support()
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_org uuid;
begin
  select m.org_id into v_org from public.memberships m where m.user_id=(select auth.uid()) and m.status='active' and m.role='owner';
  if v_org is null then return false;end if;
  return exists(select 1 from private.contractual_support_grants g where g.org_id=v_org and g.active and g.revoked_at is null
    and(g.expires_at is null or g.expires_at>now()));
end;$$;
revoke all on function public.organization_has_external_support() from public,anon;
grant execute on function public.organization_has_external_support() to authenticated,service_role;

create or replace function public.platform_add_access_request_note(p_request_id uuid,p_note text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=(select auth.uid());
begin
  if not private.is_platform_principal(v_actor) or nullif(trim(p_note),'') is null or char_length(trim(p_note))>2000
    or not exists(select 1 from public.access_requests where id=p_request_id) then
    raise exception 'platform_request_note_forbidden' using errcode='42501';end if;
  insert into private.access_request_events(request_id,actor_user_id,action,internal_note)
    values(p_request_id,v_actor,'internal_note_added',trim(p_note));
end;$$;
revoke all on function public.platform_add_access_request_note(uuid,text) from public,anon;
grant execute on function public.platform_add_access_request_note(uuid,text) to authenticated,service_role;

create or replace function public.platform_user_directory()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=private.platform_admin_required();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
    'user_id',u.id,'email',u.email,'full_name',p.full_name,'whatsapp_e164',p.whatsapp_e164,
    'membership_id',m.id,'org_id',m.org_id,'organization_name',o.name,'membership_role',m.role,'membership_status',m.status,
    'account_suspended',coalesce(c.suspended,false),'requests_blocked',coalesce(c.requests_blocked,false),
    'public_message',c.public_message,'created_at',u.created_at
  ) order by u.created_at desc) from auth.users u
    left join public.profiles p on p.user_id=u.id
    left join public.memberships m on m.user_id=u.id and m.status<>'revoked'
    left join public.organizations o on o.id=m.org_id
    left join private.account_controls c on c.user_id=u.id
    where not exists(select 1 from private.platform_principals pp where pp.user_id=u.id)),'[]'::jsonb);
end;$$;
revoke all on function public.platform_user_directory() from public,anon;
grant execute on function public.platform_user_directory() to authenticated,service_role;

commit;
