begin;

create or replace function private.sync_assisted_suggestion_topic(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_suggestion public.ai_suggestions%rowtype;
  v_execution public.ai_executions%rowtype;
  v_conversation public.conversations%rowtype;
  v_request_message public.messages%rowtype;
  v_prior_summary public.conversation_summaries%rowtype;
  v_contact_name text;
  v_thread uuid;
  v_title text;
  v_context_metadata jsonb;
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

  select * into v_request_message
  from public.messages
  where id=v_execution.request_message_id
    and org_id=v_suggestion.org_id
    and conversation_id=v_conversation.id
    and direction='inbound';

  if not found then
    select * into v_request_message
    from public.messages
    where org_id=v_suggestion.org_id
      and conversation_id=v_conversation.id
      and direction='inbound'
      and created_at <= coalesce(v_execution.completed_at,v_execution.created_at,now())
    order by created_at desc, id desc
    limit 1;
  end if;

  select * into v_prior_summary
  from public.conversation_summaries
  where org_id=v_suggestion.org_id
    and conversation_id=v_conversation.id
    and (source_execution_id is null or source_execution_id <> v_execution.id)
  order by created_at desc, id desc
  limit 1;

  select nullif(trim(c.name),'') into v_contact_name
  from public.contacts c
  where c.id=v_conversation.contact_id and c.org_id=v_conversation.org_id;
  v_title:=left('Sugestão para '||coalesce(v_contact_name,'o lead'),180);

  v_context_metadata:=jsonb_strip_nulls(jsonb_build_object(
    'analyzed_message', nullif(left(trim(coalesce(v_request_message.body,'['||v_request_message.content_type||']')),1200),''),
    'analyzed_message_at', v_request_message.created_at,
    'context_summary', nullif(left(trim(v_prior_summary.summary),1600),''),
    'context_summary_created_at', v_prior_summary.created_at
  ));

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
      )||v_context_metadata
    );
  else
    update public.internal_messages
    set metadata=metadata||v_context_metadata
    where thread_id=v_thread
      and message_kind='proposal'
      and metadata->>'suggestion_id'=v_suggestion.id::text;
  end if;
end;
$$;
revoke all on function private.sync_assisted_suggestion_topic(uuid) from public,anon,authenticated,service_role;

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
