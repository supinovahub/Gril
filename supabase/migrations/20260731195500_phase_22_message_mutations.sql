begin;

create table public.message_mutations(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  message_id uuid not null,
  revision_message_id uuid references public.messages(id) on delete set null,
  external_event_id text not null,
  kind text not null check(kind in ('edit','delete','reaction')),
  previous_body text,
  body text,
  emoji text,
  provider_timestamp timestamptz,
  created_at timestamptz not null default now(),
  foreign key(connection_id,org_id) references public.whatsapp_connections(id,org_id) on delete cascade,
  foreign key(message_id,org_id) references public.messages(id,org_id) on delete cascade,
  unique(connection_id,external_event_id)
);
create index message_mutations_message_idx on public.message_mutations(message_id,created_at);

create or replace function public.apply_provider_message_mutation(
  p_connection_id uuid,p_external_event_id text,p_target_provider_message_id text,p_kind text,
  p_body text default null,p_emoji text default null,p_provider_timestamp timestamptz default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_message public.messages%rowtype;v_conversation public.conversations%rowtype;v_mutation uuid;v_revision uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
     and current_user not in ('postgres','service_role') then raise exception 'runtime_service_role_required' using errcode='42501'; end if;
  if p_kind not in ('edit','delete','reaction') or char_length(coalesce(p_external_event_id,''))<1 then raise exception 'message_mutation_invalid' using errcode='22023'; end if;
  select m.* into v_message from public.messages m join public.conversations c on c.id=m.conversation_id
  where c.connection_id=p_connection_id and m.provider_message_id=p_target_provider_message_id order by m.created_at desc limit 1 for update of m;
  if not found then return jsonb_build_object('status','target_not_found'); end if;
  select * into v_conversation from public.conversations where id=v_message.conversation_id for update;
  insert into public.message_mutations(org_id,connection_id,message_id,external_event_id,kind,previous_body,body,emoji,provider_timestamp)
  values(v_message.org_id,p_connection_id,v_message.id,p_external_event_id,p_kind,v_message.body,p_body,p_emoji,p_provider_timestamp)
  on conflict(connection_id,external_event_id) do nothing returning id into v_mutation;
  if v_mutation is null then return jsonb_build_object('status','duplicate'); end if;

  if p_kind='edit' then
    if v_message.direction<>'inbound' or char_length(trim(coalesce(p_body,'')))<1 then return jsonb_build_object('status','recorded'); end if;
    update public.messages set body='[mensagem editada — versão substituída]',metadata=metadata||jsonb_build_object('excluded_from_ai',true,'edited_at',coalesce(p_provider_timestamp,now())) where id=v_message.id;
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_message_id,provider_status,provider_timestamp,reply_to_message_id,metadata)
    values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'inbound','contact','text',trim(p_body),p_external_event_id,'received',p_provider_timestamp,v_message.id,
      jsonb_build_object('edit_revision_of',v_message.id,'mutation_id',v_mutation)) returning id into v_revision;
    update public.message_mutations set revision_message_id=v_revision where id=v_mutation;
    update public.conversations set version=version+1,last_message_preview=left(trim(p_body),240),last_inbound_at=coalesce(p_provider_timestamp,now()),updated_at=now() where id=v_conversation.id;
    update public.ai_executions set status='superseded',error_code='message_edited',error_redacted='A mensagem foi editada antes da conclusão.',completed_at=now()
    where request_message_id=v_message.id and status='queued';
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values(v_message.org_id,v_message.operation_id,'message.inbound.edited.v1','message',v_revision,jsonb_build_object('message_id',v_revision,'conversation_id',v_message.conversation_id),
      'message-edit:'||v_mutation::text) on conflict(idempotency_key) do nothing;
  elsif p_kind='delete' then
    update public.messages set body='[mensagem excluída]',metadata=metadata||jsonb_build_object('excluded_from_ai',true,'deleted_at',coalesce(p_provider_timestamp,now())) where id=v_message.id;
    update public.conversations set version=version+1,updated_at=now() where id=v_conversation.id;
    update public.ai_executions set status='superseded',error_code='message_deleted',error_redacted='A mensagem foi excluída antes da conclusão.',completed_at=now()
    where request_message_id=v_message.id and status='queued';
  elsif p_kind='reaction' and v_message.direction='outbound' and v_message.content_type='text' and char_length(trim(coalesce(p_emoji,''))) between 1 and 20 then
    insert into public.messages(org_id,operation_id,conversation_id,direction,sender_type,content_type,body,provider_message_id,provider_status,provider_timestamp,reply_to_message_id,metadata)
    values(v_message.org_id,v_message.operation_id,v_message.conversation_id,'inbound','contact','text',trim(p_emoji),p_external_event_id,'received',p_provider_timestamp,v_message.id,
      jsonb_build_object('reaction_to',v_message.id,'mutation_id',v_mutation)) returning id into v_revision;
    update public.message_mutations set revision_message_id=v_revision where id=v_mutation;
    update public.conversations set version=version+1,last_message_preview=trim(p_emoji),last_inbound_at=coalesce(p_provider_timestamp,now()),updated_at=now() where id=v_conversation.id;
    insert into private.outbox_events(org_id,operation_id,event_type,aggregate_type,aggregate_id,payload,idempotency_key)
    values(v_message.org_id,v_message.operation_id,'message.inbound.reaction.v1','message',v_revision,jsonb_build_object('message_id',v_revision,'conversation_id',v_message.conversation_id,'reply_to_message_id',v_message.id),
      'message-reaction:'||v_mutation::text) on conflict(idempotency_key) do nothing;
  end if;
  insert into audit.events(org_id,operation_id,actor_type,action,entity_type,entity_id,metadata)
  values(v_message.org_id,v_message.operation_id,'system','message.'||p_kind,'messages',v_message.id,jsonb_build_object('mutation_id',v_mutation,'revision_message_id',v_revision));
  return jsonb_build_object('status','applied','revision_message_id',v_revision);
end; $$;

alter table public.message_mutations enable row level security;
create policy message_mutations_visible on public.message_mutations for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and (select private.can_access_conversation(m.conversation_id))));
grant select on public.message_mutations to authenticated;
grant all on public.message_mutations to service_role;
revoke all on function public.apply_provider_message_mutation(uuid,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_provider_message_mutation(uuid,text,text,text,text,text,timestamptz) to service_role;

commit;
