begin;

create or replace function public.internal_chat_workspace_bootstrap(
  p_org_id uuid,
  p_assistant_role text,
  p_operation_id uuid default null,
  p_requested_thread_id uuid default null,
  p_thread_type text default null,
  p_search text default null,
  p_status text default null,
  p_priority text default null,
  p_requires_action boolean default false
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
set jit = off
as $$
declare
  v_payload jsonb;
  v_active_thread_id uuid;
begin
  if p_assistant_role not in ('pedro', 'lionel') then
    raise exception 'invalid_assistant_role' using errcode = '22023';
  end if;
  if p_thread_type is not null and p_thread_type <> 'broker_assistant' then
    raise exception 'invalid_thread_type' using errcode = '22023';
  end if;

  if p_operation_id is not null and p_thread_type is null then
    perform public.ensure_internal_general_thread(p_operation_id, p_assistant_role);
  end if;

  with visible_threads as materialized (
    select thread.*
    from public.internal_threads thread
    where thread.org_id = p_org_id
      and thread.assistant_role = p_assistant_role
      and thread.status <> 'archived'
      and (p_operation_id is null or thread.operation_id = p_operation_id)
      and (p_thread_type is null or thread.thread_type = p_thread_type)
      and (
        nullif(trim(p_search), '') is null
        or thread.title ilike '%' || left(trim(p_search), 80) || '%'
      )
      and (
        p_status is null
        or p_status not in ('awaiting_response', 'discussing', 'awaiting_confirmation', 'resolved', 'invalidated')
        or thread.status = p_status
      )
      and (
        p_priority is null
        or p_priority not in ('low', 'normal', 'high', 'critical')
        or thread.priority = p_priority
      )
      and (not p_requires_action or thread.requires_action)
    order by thread.requires_action desc, thread.updated_at desc
    limit 100
  ),
  active_thread as materialized (
    select thread.*
    from visible_threads thread
    order by
      case when thread.id = p_requested_thread_id then 0 else 1 end,
      thread.requires_action desc,
      thread.updated_at desc
    limit 1
  )
  select jsonb_build_object(
    'threads', coalesce((
      select jsonb_agg(to_jsonb(thread) order by thread.requires_action desc, thread.updated_at desc)
      from visible_threads thread
    ), '[]'::jsonb),
    'activeThread', (select to_jsonb(thread) from active_thread thread),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(message) order by message.created_at, message.id)
      from (
        select message.*
        from public.internal_messages message
        join active_thread thread on thread.id = message.thread_id
        order by message.created_at, message.id
        limit 300
      ) message
    ), '[]'::jsonb)
  )
  into v_payload;

  v_active_thread_id := (v_payload -> 'activeThread' ->> 'id')::uuid;
  if v_active_thread_id is not null then
    perform public.mark_internal_thread_read(v_active_thread_id);
  end if;

  return v_payload;
end;
$$;

revoke all on function public.internal_chat_workspace_bootstrap(uuid, text, uuid, uuid, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.internal_chat_workspace_bootstrap(uuid, text, uuid, uuid, text, text, text, text, boolean)
  to authenticated, service_role;

commit;
