begin;

create or replace function private.reconcile_internal_chat_lifecycle()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_archived integer:=0;v_reminders integer:=0;v_more integer:=0;begin
  update public.internal_threads
  set status='archived',archived_at=now(),requires_action=false,updated_at=now()
  where status='resolved' and resolved_at<now()-interval '7 days';
  get diagnostics v_archived=row_count;

  insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
  select t.org_id,t.operation_id,'warning','internal_chat','Decisão do Pedro aguardando responsável',
    'Este tópico está bloqueando o atendimento há pelo menos cinco minutos.','internal_thread',t.id,
    'internal-thread-reminder-5:'||t.id::text
  from public.internal_threads t
  where t.requires_action and t.assigned_membership_id is null
    and t.status in ('awaiting_response','awaiting_confirmation')
    and t.updated_at<=now()-interval '5 minutes'
  on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  get diagnostics v_reminders=row_count;

  insert into public.alerts(org_id,operation_id,severity,category,title,body,entity_type,entity_id,dedupe_key)
  select t.org_id,t.operation_id,'critical','internal_chat','Decisão operacional escalada ao dono',
    'O tópico segue sem responsável há pelo menos quinze minutos e precisa de decisão.','internal_thread',t.id,
    'internal-thread-reminder-15:'||t.id::text
  from public.internal_threads t
  where t.requires_action and t.assigned_membership_id is null
    and t.status in ('awaiting_response','awaiting_confirmation')
    and t.updated_at<=now()-interval '15 minutes'
  on conflict(org_id,dedupe_key) where dedupe_key is not null and status<>'resolved' do nothing;
  get diagnostics v_more=row_count;
  v_reminders:=v_reminders+v_more;
  return jsonb_build_object('archived',v_archived,'reminders',v_reminders);
end;$$;
revoke all on function private.reconcile_internal_chat_lifecycle() from public,anon,authenticated,service_role;

do $$ begin
  perform cron.unschedule('gril-internal-chat-lifecycle');
exception when others then null;end $$;
select cron.schedule('gril-internal-chat-lifecycle','* * * * *','select private.reconcile_internal_chat_lifecycle();');

commit;
