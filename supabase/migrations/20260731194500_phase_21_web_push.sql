begin;

create table public.push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check(char_length(endpoint) between 20 and 4000),
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  revoked_at timestamptz,
  last_success_at timestamptz,
  last_error_redacted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(endpoint)
);
create index push_subscriptions_user_active_idx on public.push_subscriptions(user_id,org_id) where revoked_at is null;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions for each row execute function private.set_updated_at();

create or replace function private.enqueue_alert_push_event()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if new.severity in ('warning','critical') then
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values(new.org_id,new.operation_id,'notification.alert_created.v1','alert',new.id,
      jsonb_build_object('alert_id',new.id,'title',new.title,'body',new.body,'severity',new.severity),
      'alert-notification:'||new.id::text) on conflict(idempotency_key) do nothing;
  end if;
  return new;
end; $$;
create trigger alerts_enqueue_push after insert on public.alerts for each row execute function private.enqueue_alert_push_event();

create or replace function public.consume_runtime_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_type text:=p_event->>'event_type';v_event_id uuid;v_offer public.call_offers%rowtype;v_call public.calls%rowtype;
  v_alert public.alerts%rowtype;v_member public.memberships%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  begin v_event_id:=(p_event->>'event_id')::uuid; exception when others then v_event_id:=null; end;
  if v_type='call.offer_sent.v1' then
    select * into v_offer from public.call_offers where id=(p_event->'payload'->>'offer_id')::uuid;
    select * into v_call from public.calls where id=v_offer.call_id;
    if found then
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,source_event_id)
      values(v_offer.org_id,v_offer.recipient_membership_id,'app','Nova oportunidade de call','Uma call está disponível. Abra a agenda para aceitar antes do vencimento.',v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
      insert into public.notifications(org_id,recipient_membership_id,channel,title,body,source_event_id)
      values(v_offer.org_id,v_offer.recipient_membership_id,'push','Nova oportunidade de call','Uma call está disponível. Abra a agenda para aceitar antes do vencimento.',v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
    end if;
    return jsonb_build_object('status','notification_created');
  elsif v_type='notification.alert_created.v1' then
    select * into v_alert from public.alerts where id=(p_event->'payload'->>'alert_id')::uuid;
    if not found then return jsonb_build_object('status','ignored'); end if;
    for v_member in select m.* from public.memberships m where m.org_id=v_alert.org_id and m.status='active' and m.role in ('owner','manager')
      and (v_alert.operation_id is null or m.role='owner' or exists(select 1 from public.membership_operations mo where mo.membership_id=m.id and mo.operation_id=v_alert.operation_id)) loop
      insert into public.notifications(org_id,recipient_membership_id,alert_id,channel,title,body,source_event_id)
      values(v_alert.org_id,v_member.id,v_alert.id,'app',v_alert.title,v_alert.body,v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
      insert into public.notifications(org_id,recipient_membership_id,alert_id,channel,title,body,source_event_id)
      values(v_alert.org_id,v_member.id,v_alert.id,'push',v_alert.title,v_alert.body,v_event_id)
      on conflict(recipient_membership_id,source_event_id,channel) where source_event_id is not null do nothing;
    end loop;
    return jsonb_build_object('status','notification_created');
  end if;
  return jsonb_build_object('status','acknowledged');
end; $$;

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()) and (select private.is_active_org_member(org_id)));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()) and (select private.is_active_org_member(org_id)));
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (select private.is_active_org_member(org_id)));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
revoke all on function private.enqueue_alert_push_event(),public.consume_runtime_event(jsonb) from public,anon,authenticated;
grant execute on function public.consume_runtime_event(jsonb) to service_role;

commit;
