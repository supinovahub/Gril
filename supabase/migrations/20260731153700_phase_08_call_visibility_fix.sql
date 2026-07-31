begin;

create or replace function private.can_view_call(p_call_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists (
    select 1 from public.calls c
    where c.id=p_call_id and (
      private.has_org_permission(c.org_id,'pipeline.manage')
      or c.assigned_membership_id=private.current_membership_id(c.org_id)
      or exists (
        select 1 from public.call_offers o
        where o.call_id=c.id and o.recipient_membership_id=private.current_membership_id(c.org_id)
      )
    )
  );
$$;
revoke all on function private.can_view_call(uuid) from public,anon,service_role;
grant execute on function private.can_view_call(uuid) to authenticated;

drop policy calls_visible on public.calls;
create policy calls_visible on public.calls for select to authenticated using ((select private.can_view_call(id)));

drop policy call_holds_visible on public.call_holds;
create policy call_holds_visible on public.call_holds for select to authenticated using (
  exists(select 1 from public.calls c where c.hold_id=id and (select private.can_view_call(c.id)))
);

drop policy call_results_visible on public.call_results;
create policy call_results_visible on public.call_results for select to authenticated using ((select private.can_view_call(call_id)));

commit;
