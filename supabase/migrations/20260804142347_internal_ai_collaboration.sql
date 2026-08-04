begin;

-- Journey-level controls keep inbound conservative while allowing a separately
-- gated reactivation pilot.
alter table public.organization_settings
  add column if not exists inbound_ai_mode text not null default 'off'
    check (inbound_ai_mode in ('off','shadow','assisted')),
  add column if not exists reactivation_ai_mode text not null default 'off'
    check (reactivation_ai_mode in ('off','shadow','assisted','production')),
  add column if not exists reactivation_release_state text not null default 'blocked'
    check (reactivation_release_state in ('blocked','test_controlled','released')),
  add column if not exists default_autonomy text not null default 'low'
    check (default_autonomy in ('low','medium','high')),
  add column if not exists reactivation_autonomy text not null default 'low'
    check (reactivation_autonomy in ('low','medium','high')),
  add column if not exists ai_usage_limits jsonb not null default '{"hard_caps_enabled":false,"pedro":null,"campaigns":null,"simulator":null,"lionel":null}'::jsonb;

alter table public.operation_settings
  add column if not exists autonomy_level text
    check (autonomy_level is null or autonomy_level in ('low','medium','high'));

alter table public.conversations
  add column if not exists autonomy_override text
    check (autonomy_override is null or autonomy_override in ('low','medium','high')),
  add column if not exists autonomy_override_expires_at timestamptz,
  add column if not exists journey text not null default 'inbound'
    check (journey in ('inbound','reactivation','post_call'));

create table public.ai_test_allowlist (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  unique (org_id,phone_e164)
);

create table public.internal_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid,
  assistant_role text not null check (assistant_role in ('pedro','lionel')),
  thread_type text not null check (thread_type in ('general','lead_case','broker_assistant','learning','technical')),
  title text not null check (char_length(trim(title)) between 2 and 180),
  conversation_id uuid,
  opportunity_id uuid,
  broker_membership_id uuid,
  status text not null default 'awaiting_response'
    check (status in ('awaiting_response','discussing','awaiting_confirmation','resolved','invalidated','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  requires_action boolean not null default false,
  assigned_membership_id uuid,
  context_version integer not null default 1 check (context_version > 0),
  parent_thread_id uuid references public.internal_threads(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','escalation','assisted_correction','external_device','post_call','runtime_failure')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete set null,
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete set null,
  foreign key (broker_membership_id,org_id) references public.memberships(id,org_id) on delete set null,
  foreign key (assigned_membership_id,org_id) references public.memberships(id,org_id) on delete set null,
  unique (id,org_id)
);

create unique index internal_threads_one_general_per_operation_idx
  on public.internal_threads(org_id,operation_id,assistant_role)
  where thread_type='general' and status<>'archived';
create index internal_threads_queue_idx
  on public.internal_threads(org_id,assistant_role,status,priority,updated_at desc);
create index internal_threads_conversation_idx
  on public.internal_threads(conversation_id,updated_at desc) where conversation_id is not null;

create table public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null,
  actor_kind text not null check (actor_kind in ('user','pedro','lionel','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reply_to_message_id uuid references public.internal_messages(id) on delete set null,
  message_kind text not null default 'message'
    check (message_kind in ('message','proposal','decision','action_result','context_update')),
  body text not null check (char_length(trim(body)) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (thread_id,org_id) references public.internal_threads(id,org_id) on delete cascade,
  unique (id,org_id)
);
create index internal_messages_thread_idx on public.internal_messages(thread_id,created_at,id);

create table public.internal_thread_reads (
  thread_id uuid not null,
  org_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id,user_id),
  foreign key (thread_id,org_id) references public.internal_threads(id,org_id) on delete cascade
);

create table public.internal_action_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null,
  message_id uuid not null,
  conversation_id uuid,
  context_version integer not null check (context_version > 0),
  action_type text not null check (action_type in ('return_to_pedro','continue_human','device_send_unrecognized','apply_learning','bounded_operation')),
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','rebutted','invalidated','completed','failed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (thread_id,org_id) references public.internal_threads(id,org_id) on delete cascade,
  foreign key (message_id,org_id) references public.internal_messages(id,org_id) on delete cascade,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete set null
);
create unique index internal_action_one_pending_idx
  on public.internal_action_proposals(thread_id) where status='pending';

create table public.conversation_ai_guidance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  source_suggestion_id uuid,
  guidance text not null check (char_length(trim(guidance)) between 1 and 4096),
  exact_reply boolean not null default false,
  status text not null default 'active' check (status in ('active','consumed','superseded')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  foreign key (conversation_id,org_id) references public.conversations(id,org_id) on delete cascade,
  foreign key (source_suggestion_id,org_id) references public.ai_suggestions(id,org_id) on delete set null
);
create unique index conversation_ai_guidance_one_active_idx
  on public.conversation_ai_guidance(conversation_id) where status='active';

create table public.platform_internal_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 180),
  thread_type text not null default 'general' check (thread_type in ('general','technical','package_change','incident')),
  status text not null default 'discussing' check (status in ('discussing','awaiting_confirmation','resolved','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.platform_internal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.platform_internal_threads(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('user','lionel','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.learning_suggestions drop constraint if exists learning_suggestions_source_check;
alter table public.learning_suggestions add constraint learning_suggestions_source_check
  check (source in ('marked_message','escalation','pattern','simulator','manual','assisted_correction','lionel','incident'));
alter table public.learning_suggestions
  add column if not exists candidate_kind text not null default 'potential_rule'
    check (candidate_kind in ('case_only','example','potential_rule','duplicate','conflict','technical')),
  add column if not exists target_scope jsonb not null default '{"level":"organization"}'::jsonb,
  add column if not exists duration text not null default 'permanent'
    check (duration in ('permanent','temporary','experimental')),
  add column if not exists source_thread_id uuid references public.internal_threads(id) on delete set null,
  add column if not exists supersedes_id uuid references public.learning_suggestions(id) on delete set null,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists activated_at timestamptz,
  add column if not exists rolled_back_at timestamptz;

alter table public.ai_suggestion_review_requests drop constraint if exists ai_suggestion_review_requests_action_check;
alter table public.ai_suggestion_review_requests add constraint ai_suggestion_review_requests_action_check
  check (action in ('send','discard','teach_only'));

create trigger internal_threads_set_updated_at before update on public.internal_threads
for each row execute function private.set_updated_at();
create trigger internal_action_proposals_set_updated_at before update on public.internal_action_proposals
for each row execute function private.set_updated_at();
create trigger platform_internal_threads_set_updated_at before update on public.platform_internal_threads
for each row execute function private.set_updated_at();

create or replace function private.can_access_internal_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(
    select 1 from public.internal_threads t
    where t.id=p_thread_id and (
      (t.thread_type='broker_assistant' and t.broker_membership_id=private.current_membership_id(t.org_id))
      or (t.thread_type<>'broker_assistant' and private.has_org_role(t.org_id,array['owner','manager']::text[]))
      or private.has_org_permission(t.org_id,'ai.manage')
      or private.has_contractual_support(t.org_id,false)
    )
  )
$$;
revoke all on function private.can_access_internal_thread(uuid) from public,anon;
grant execute on function private.can_access_internal_thread(uuid) to authenticated;

create or replace function public.ensure_internal_general_thread(p_operation_id uuid,p_assistant_role text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;v_thread uuid;begin
  if p_assistant_role not in ('pedro','lionel') then raise exception 'invalid_assistant_role' using errcode='22023';end if;
  select org_id into v_org from public.operations where id=p_operation_id;
  if v_org is null or not (private.has_org_role(v_org,array['owner','manager']::text[]) or private.has_org_permission(v_org,'ai.manage') or private.has_contractual_support(v_org,true)) then
    raise exception 'internal_chat_forbidden' using errcode='42501';
  end if;
  select id into v_thread from public.internal_threads where org_id=v_org and operation_id=p_operation_id and assistant_role=p_assistant_role and thread_type='general' and status<>'archived';
  if v_thread is null then
    insert into public.internal_threads(org_id,operation_id,assistant_role,thread_type,title,status,source,created_by)
    values(v_org,p_operation_id,p_assistant_role,'general',case when p_assistant_role='pedro' then 'Chat geral com Pedro' else 'Curadoria com Lionel' end,'discussing','manual',(select auth.uid()))
    returning id into v_thread;
  end if;
  return v_thread;
end;$$;
revoke all on function public.ensure_internal_general_thread(uuid,text) from public,anon;
grant execute on function public.ensure_internal_general_thread(uuid,text) to authenticated;

create or replace function public.mark_internal_thread_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid;begin
  select org_id into v_org from public.internal_threads where id=p_thread_id;
  if v_org is null or not private.can_access_internal_thread(p_thread_id) then raise exception 'internal_chat_forbidden' using errcode='42501';end if;
  insert into public.internal_thread_reads(thread_id,org_id,user_id,last_read_at)
  values(p_thread_id,v_org,(select auth.uid()),now())
  on conflict(thread_id,user_id) do update set last_read_at=excluded.last_read_at;
end;$$;
revoke all on function public.mark_internal_thread_read(uuid) from public,anon;
grant execute on function public.mark_internal_thread_read(uuid) to authenticated;

create or replace function private.create_external_intervention_topic()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_thread uuid;begin
  if new.category<>'external_human_intervention' or new.conversation_id is null then return new;end if;
  select id into v_thread from public.internal_threads
  where conversation_id=new.conversation_id and source='external_device' and status not in ('resolved','archived','invalidated')
  order by created_at desc limit 1;
  if v_thread is null then
    insert into public.internal_threads(org_id,operation_id,assistant_role,thread_type,title,conversation_id,opportunity_id,status,priority,requires_action,source,metadata,created_by)
    values(new.org_id,new.operation_id,'pedro','lead_case','Intervenção feita pelo celular',new.conversation_id,new.opportunity_id,'awaiting_response','high',true,'external_device',jsonb_build_object('escalation_id',new.id),null)
    returning id into v_thread;
    insert into public.internal_messages(org_id,thread_id,actor_kind,message_kind,body,metadata)
    values(new.org_id,v_thread,'pedro','context_update','Detectei uma mensagem enviada diretamente pelo celular conectado. Pausei minha atuação nesta conversa. Confirme se a equipe continuará como humana, se devo retomar após apresentar um plano, ou se você não reconhece esse envio.',jsonb_build_object('conversation_id',new.conversation_id));
  end if;
  return new;
end;$$;
revoke all on function private.create_external_intervention_topic() from public,anon,authenticated,service_role;
drop trigger if exists escalations_external_intervention_topic on public.escalations;
create trigger escalations_external_intervention_topic after insert on public.escalations
for each row execute function private.create_external_intervention_topic();

alter table public.ai_test_allowlist enable row level security;
alter table public.internal_threads enable row level security;
alter table public.internal_messages enable row level security;
alter table public.internal_thread_reads enable row level security;
alter table public.internal_action_proposals enable row level security;
alter table public.conversation_ai_guidance enable row level security;
alter table public.platform_internal_threads enable row level security;
alter table public.platform_internal_messages enable row level security;

create policy ai_test_allowlist_manage on public.ai_test_allowlist for all to authenticated
using(private.has_org_role(org_id,array['owner','manager']::text[]) or private.has_org_permission(org_id,'ai.manage'))
with check(created_by=(select auth.uid()) and (private.has_org_role(org_id,array['owner','manager']::text[]) or private.has_org_permission(org_id,'ai.manage')));
create policy internal_threads_select on public.internal_threads for select to authenticated using(private.can_access_internal_thread(id));
create policy internal_threads_insert_manager on public.internal_threads for insert to authenticated
with check(created_by=(select auth.uid()) and (private.has_org_role(org_id,array['owner','manager']::text[]) or private.has_org_permission(org_id,'ai.manage') or (thread_type='broker_assistant' and broker_membership_id=private.current_membership_id(org_id))));
create policy internal_threads_update_manager on public.internal_threads for update to authenticated
using(private.can_access_internal_thread(id)) with check(private.can_access_internal_thread(id));
create policy internal_messages_select on public.internal_messages for select to authenticated using(private.can_access_internal_thread(thread_id));
create policy internal_messages_insert on public.internal_messages for insert to authenticated
with check(private.can_access_internal_thread(thread_id) and actor_kind='user' and actor_user_id=(select auth.uid()));
create policy internal_thread_reads_self on public.internal_thread_reads for all to authenticated
using(user_id=(select auth.uid()) and private.can_access_internal_thread(thread_id))
with check(user_id=(select auth.uid()) and private.can_access_internal_thread(thread_id));
create policy internal_action_proposals_select on public.internal_action_proposals for select to authenticated using(private.can_access_internal_thread(thread_id));
create policy internal_action_proposals_update on public.internal_action_proposals for update to authenticated
using(private.can_access_internal_thread(thread_id)) with check(private.can_access_internal_thread(thread_id));
create policy conversation_ai_guidance_manager_select on public.conversation_ai_guidance for select to authenticated
using(private.has_org_role(org_id,array['owner','manager']::text[]) or private.has_org_permission(org_id,'ai.manage'));
create policy conversation_ai_guidance_manager_insert on public.conversation_ai_guidance for insert to authenticated
with check(created_by=(select auth.uid()) and (private.has_org_role(org_id,array['owner','manager']::text[]) or private.has_org_permission(org_id,'ai.manage')));
create policy platform_internal_threads_admin on public.platform_internal_threads for all to authenticated
using(private.is_platform_principal((select auth.uid()),array['platform_admin']::text[]))
with check(private.is_platform_principal((select auth.uid()),array['platform_admin']::text[]));
create policy platform_internal_messages_admin on public.platform_internal_messages for all to authenticated
using(private.is_platform_principal((select auth.uid()),array['platform_admin']::text[]))
with check(private.is_platform_principal((select auth.uid()),array['platform_admin']::text[]));

grant select,insert,update on public.ai_test_allowlist to authenticated;
grant select,insert,update on public.internal_threads to authenticated;
grant select,insert on public.internal_messages to authenticated;
grant select,insert,update on public.internal_thread_reads to authenticated;
grant select,update on public.internal_action_proposals to authenticated;
grant select,insert on public.conversation_ai_guidance to authenticated;
grant select,insert,update on public.platform_internal_threads to authenticated;
grant select,insert on public.platform_internal_messages to authenticated;
grant all on public.ai_test_allowlist,public.internal_threads,public.internal_messages,public.internal_thread_reads,public.internal_action_proposals,public.conversation_ai_guidance,public.platform_internal_threads,public.platform_internal_messages to service_role;

do $$ begin
  alter publication supabase_realtime add table public.internal_threads;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.internal_messages;
exception when duplicate_object then null; end $$;

commit;
