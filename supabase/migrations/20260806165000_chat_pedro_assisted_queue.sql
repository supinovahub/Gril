begin;

do $$
declare v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid='public.internal_threads'::regclass
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%source%'
  loop
    execute format('alter table public.internal_threads drop constraint %I',v_constraint.conname);
  end loop;
end;
$$;
alter table public.internal_threads add constraint internal_threads_source_check
  check (source in ('manual','escalation','assisted_correction','assisted_suggestion','external_device','post_call','runtime_failure'));

create or replace function private.sync_assisted_suggestion_topic(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_contact_name text;
  v_thread uuid;
  v_title text;
begin
  select * into v_suggestion
  from public.ai_suggestions
  where id=p_suggestion_id and status='pending';
  if not found or v_suggestion.conversation_id is null then return; end if;

  select * into v_execution
  from public.ai_executions
  where id=v_suggestion.execution_id
    and org_id=v_suggestion.org_id
    and mode='assisted';
  if not found then return; end if;

  select * into v_conversation
  from public.conversations
  where id=v_suggestion.conversation_id and org_id=v_suggestion.org_id;
  if not found then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_conversation.id::text,0));

  select nullif(trim(c.name),'') into v_contact_name
  from public.contacts c
  where c.id=v_conversation.contact_id and c.org_id=v_conversation.org_id;
  v_title:=left('Sugestão para '||coalesce(v_contact_name,'o lead'),180);

  select t.id into v_thread
  from public.internal_threads t
  where t.org_id=v_suggestion.org_id
    and t.operation_id=v_conversation.operation_id
    and t.assistant_role='pedro'
    and t.thread_type='lead_case'
    and t.source='assisted_suggestion'
    and t.conversation_id=v_conversation.id
    and t.status not in ('resolved','archived','invalidated')
  order by t.updated_at desc, t.id desc
  limit 1;

  if v_thread is null then
    insert into public.internal_threads(
      org_id,operation_id,assistant_role,thread_type,title,conversation_id,opportunity_id,
      status,priority,requires_action,context_version,source,metadata,created_by
    ) values (
      v_suggestion.org_id,v_conversation.operation_id,'pedro','lead_case',v_title,
      v_conversation.id,v_conversation.opportunity_id,'awaiting_response','high',true,
      v_conversation.version,'assisted_suggestion',jsonb_build_object(
        'case_kind','assisted_suggestion',
        'conversation_id',v_conversation.id,
        'suggestion_id',v_suggestion.id,
        'execution_id',v_suggestion.execution_id,
        'contact_name',coalesce(v_contact_name,'o lead')
      ),null
    ) returning id into v_thread;
  else
    update public.internal_threads
    set requires_action=true,
        status='awaiting_response',
        resolved_at=null,
        context_version=v_conversation.version,
        metadata=metadata||jsonb_build_object('last_suggestion_id',v_suggestion.id)
    where id=v_thread;
  end if;

  if not exists (
    select 1 from public.internal_messages m
    where m.thread_id=v_thread
      and m.message_kind='proposal'
      and m.metadata->>'suggestion_id'=v_suggestion.id::text
  ) then
    insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
    values (
      v_suggestion.org_id,v_thread,'pedro','proposal',
      'Analisei a conversa e preparei uma resposta para o lead. Revise, edite e aprove o envio no próprio tópico.',
      jsonb_build_object(
        'case_kind','assisted_suggestion',
        'suggestion_id',v_suggestion.id,
        'execution_id',v_suggestion.execution_id,
        'conversation_id',v_conversation.id,
        'contact_name',coalesce(v_contact_name,'o lead'),
        'suggestion_body',v_suggestion.body,
        'expected_conversation_version',v_conversation.version,
        'status','pending'
      )
    );
  end if;
end;
$$;
revoke all on function private.sync_assisted_suggestion_topic(uuid) from public,anon,authenticated,service_role;

create or replace function private.create_assisted_suggestion_topic()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform private.sync_assisted_suggestion_topic(new.id);
  return new;
end;
$$;
revoke all on function private.create_assisted_suggestion_topic() from public,anon,authenticated,service_role;
drop trigger if exists ai_suggestion_assisted_topic on public.ai_suggestions;
create trigger ai_suggestion_assisted_topic
after insert on public.ai_suggestions
for each row execute function private.create_assisted_suggestion_topic();

create or replace function private.sync_assisted_suggestion_review_topic()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_thread uuid;
  v_has_pending boolean;
  v_result_text text;
begin
  select * into v_suggestion
  from public.ai_suggestions
  where id=new.suggestion_id and org_id=new.org_id;
  if not found or v_suggestion.conversation_id is null then return new; end if;

  select t.id into v_thread
  from public.internal_threads t
  where t.org_id=new.org_id
    and t.conversation_id=v_suggestion.conversation_id
    and t.assistant_role='pedro'
    and t.thread_type='lead_case'
    and t.source='assisted_suggestion'
    and t.status not in ('archived','invalidated')
    and exists (
      select 1 from public.internal_messages m
      where m.thread_id=t.id
        and m.message_kind='proposal'
        and m.metadata->>'suggestion_id'=new.suggestion_id::text
    )
  order by t.updated_at desc, t.id desc
  limit 1;
  if v_thread is null then return new; end if;

  v_result_text:=case new.result
    when 'sent' then 'Sugestão aprovada e enviada ao lead.'
    when 'teaching_registered' then 'Orientação registrada. Pedro vai preparar uma nova sugestão para esta conversa.'
    when 'discarded' then 'Sugestão descartada. Nenhuma mensagem foi enviada.'
    else 'Sugestão processada sem envio automático.'
  end;

  update public.internal_messages
  set metadata=metadata||jsonb_build_object(
    'status',case when new.result='sent' then 'approved' when new.result='discarded' then 'rejected' else 'processed' end,
    'review_result',new.result,
    'reviewed_by',new.actor_user_id,
    'reviewed_at',now()
  )
  where thread_id=v_thread
    and message_kind='proposal'
    and metadata->>'suggestion_id'=new.suggestion_id::text;

  insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
  values(new.org_id,v_thread,'system','action_result',v_result_text,jsonb_build_object(
    'case_kind','assisted_suggestion',
    'suggestion_id',new.suggestion_id,
    'review_result',new.result,
    'reviewed_by',new.actor_user_id
  ));

  select exists(
    select 1
    from public.ai_suggestions s
    join public.ai_executions e on e.id=s.execution_id and e.org_id=s.org_id
    where s.org_id=new.org_id
      and s.conversation_id=v_suggestion.conversation_id
      and s.status='pending'
      and e.mode='assisted'
  ) into v_has_pending;

  update public.internal_threads
  set requires_action=v_has_pending,
      status=case when v_has_pending then 'awaiting_response' else 'resolved' end,
      resolved_at=case when v_has_pending then null else now() end,
      context_version=coalesce((select version from public.conversations where id=v_suggestion.conversation_id),context_version)
  where id=v_thread;
  return new;
end;
$$;
revoke all on function private.sync_assisted_suggestion_review_topic() from public,anon,authenticated,service_role;
drop trigger if exists ai_suggestion_review_sync_topic on public.ai_suggestion_review_requests;
create trigger ai_suggestion_review_sync_topic
after insert on public.ai_suggestion_review_requests
for each row execute function private.sync_assisted_suggestion_review_topic();

do $$
declare v_suggestion_id uuid;
begin
  for v_suggestion_id in
    select s.id
    from public.ai_suggestions s
    join public.ai_executions e on e.id=s.execution_id and e.org_id=s.org_id
    where s.status='pending' and e.mode='assisted'
  loop
    perform private.sync_assisted_suggestion_topic(v_suggestion_id);
  end loop;
end;
$$;

commit;
