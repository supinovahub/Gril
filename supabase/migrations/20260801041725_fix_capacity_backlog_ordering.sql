begin;

create or replace function private.reconcile_conversation_capacity()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_slept integer:=0;v_promoted integer:=0;v_operation record;v_reservation record;v_message_id uuid;
begin
  with sleeping as (
    update private.capacity_reservations r
    set status='sleeping',last_activity_at=now()
    where r.status='active' and r.last_activity_at<=now()-interval '5 minutes'
    returning r.operation_id
  ), counts as (
    select operation_id,count(*)::integer as qty from sleeping group by operation_id
  )
  update public.operation_capacity c
  set active_count=greatest(0,c.active_count-counts.qty),
      below_ten_since=case when greatest(0,c.active_count-counts.qty)<10 then coalesce(c.below_ten_since,now()) else null end,
      version=c.version+1,updated_at=now()
  from counts where c.operation_id=counts.operation_id;
  get diagnostics v_slept=row_count;

  for v_operation in select * from public.operation_capacity where active_count<30 for update loop
    for v_reservation in select * from private.capacity_reservations
      where operation_id=v_operation.operation_id and status='backlog'
      order by reserved_at for update skip locked limit greatest(0,30-v_operation.active_count) loop
      update private.capacity_reservations set status='active',last_activity_at=now() where id=v_reservation.id;
      update public.operation_capacity set active_count=active_count+1,version=version+1,updated_at=now()
      where operation_id=v_operation.operation_id;
      select id into v_message_id from public.messages
      where conversation_id=v_reservation.conversation_id and direction='inbound' order by created_at desc limit 1;
      if v_message_id is not null then
        insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
        values(v_reservation.org_id,v_reservation.operation_id,'message.inbound.requeued.v1','message',v_message_id,
          jsonb_build_object('message_id',v_message_id),'capacity-requeue:'||v_message_id::text)
        on conflict(idempotency_key) do nothing;
      end if;
      v_promoted:=v_promoted+1;
    end loop;
  end loop;
  perform private.resume_proactive_capacity();
  return jsonb_build_object('slept_operations',v_slept,'promoted',v_promoted);
end;
$$;

revoke all on function private.reconcile_conversation_capacity() from public,anon,authenticated,service_role;

commit;
