begin;

create or replace function public.current_access_block()
returns table(block_type text,public_message text)
language sql
stable
security definer
set search_path=pg_catalog
as $$
  select 'account'::text,c.public_message from private.account_controls c
    where c.user_id=(select auth.uid()) and c.suspended
  union all
  select 'platform'::text,'O acesso desta conta à equipe da plataforma foi desativado.'::text
    from private.platform_principals p
    where p.user_id=(select auth.uid()) and not p.active
  union all
  select o.status,o.suspension_public_message from public.memberships m join public.organizations o on o.id=m.org_id
    where m.user_id=(select auth.uid()) and o.status in('suspended','archived')
  limit 1;
$$;

revoke all on function public.current_access_block() from public,anon;
grant execute on function public.current_access_block() to authenticated,service_role;

commit;
