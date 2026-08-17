-- Remove the multiplicative messages x suggestions join from the Inbox badge.
-- The view remains personalized by auth.uid() and keeps the existing contract.
create or replace view public.inbox_notification_counts
with (security_invoker = true)
as
select
  conversation.org_id,
  conversation.id as conversation_id,
  coalesce(unread.unread_inbound_count, 0)::integer as unread_inbound_count,
  coalesce(pending.pending_suggestion_count, 0)::integer as pending_suggestion_count,
  (
    coalesce(unread.unread_inbound_count, 0)
    + coalesce(pending.pending_suggestion_count, 0)
  )::integer as total_count
from public.conversations conversation
left join public.conversation_read_states read_state
  on read_state.conversation_id = conversation.id
 and read_state.user_id = (select auth.uid())
left join lateral (
  select count(*)::integer as unread_inbound_count
  from public.messages message
  where message.conversation_id = conversation.id
    and message.direction = 'inbound'
    and message.created_at > coalesce(
      read_state.last_read_inbound_at,
      '-infinity'::timestamptz
    )
) unread on true
left join lateral (
  select count(*)::integer as pending_suggestion_count
  from public.ai_suggestions suggestion
  where suggestion.conversation_id = conversation.id
    and suggestion.status = 'pending'
) pending on true;

revoke all on public.inbox_notification_counts from public, anon;
grant select on public.inbox_notification_counts to authenticated, service_role;

-- A single flat Inbox query replaces nested PostgREST embeds and the second
-- lookup for older conversations that require attention.
create or replace view public.inbox_conversation_list
with (security_invoker = true)
as
select
  conversation.id,
  conversation.org_id,
  conversation.operation_id,
  conversation.status,
  conversation.ownership,
  conversation.ai_mode,
  conversation.last_inbound_at,
  conversation.last_message_preview,
  conversation.updated_at,
  contact.name as contact_name,
  opportunity.id as opportunity_id,
  stage.name as stage_name,
  coalesce(notification.unread_inbound_count, 0)::integer as unread_inbound_count,
  coalesce(notification.pending_suggestion_count, 0)::integer as pending_suggestion_count,
  coalesce(notification.total_count, 0)::integer as total_count,
  coalesce(notification.total_count, 0) > 0 as has_attention
from public.conversations conversation
join public.contacts contact on contact.id = conversation.contact_id
left join public.opportunities opportunity on opportunity.id = conversation.opportunity_id
left join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
left join public.inbox_notification_counts notification
  on notification.conversation_id = conversation.id;

revoke all on public.inbox_conversation_list from public, anon;
grant select on public.inbox_conversation_list to authenticated, service_role;

-- Flat opportunity projections avoid expensive nested PostgREST relations.
create or replace view public.lead_list
with (security_invoker = true)
as
select
  opportunity.id,
  opportunity.org_id,
  opportunity.status,
  opportunity.source,
  opportunity.version,
  opportunity.last_activity_at,
  opportunity.assigned_membership_id,
  contact.id as contact_id,
  contact.name as contact_name,
  contact.status as contact_status,
  phone.e164 as primary_phone,
  stage.name as stage_name,
  stage.code as stage_code,
  stage.position as stage_position
from public.opportunities opportunity
join public.contacts contact on contact.id = opportunity.contact_id
join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
left join lateral (
  select contact_phone.e164
  from public.contact_phones contact_phone
  where contact_phone.contact_id = contact.id
    and contact_phone.is_primary
    and contact_phone.status = 'active'
  limit 1
) phone on true;

revoke all on public.lead_list from public, anon;
grant select on public.lead_list to authenticated, service_role;

create or replace view public.kanban_opportunity_list
with (security_invoker = true)
as
select
  opportunity.id,
  opportunity.org_id,
  opportunity.status,
  opportunity.source,
  opportunity.last_activity_at,
  opportunity.pipeline_stage_id,
  opportunity.assigned_membership_id,
  opportunity.unit_quantity,
  opportunity.amount_scope,
  contact.name as contact_name,
  contact.status as contact_status,
  phone.e164 as primary_phone,
  score.score as latest_score,
  score.explanation as latest_score_explanation,
  score.created_at as latest_score_created_at
from public.opportunities opportunity
join public.contacts contact on contact.id = opportunity.contact_id
left join lateral (
  select contact_phone.e164
  from public.contact_phones contact_phone
  where contact_phone.contact_id = contact.id
    and contact_phone.is_primary
    and contact_phone.status = 'active'
  limit 1
) phone on true
left join lateral (
  select opportunity_score.score, opportunity_score.explanation, opportunity_score.created_at
  from public.opportunity_scores opportunity_score
  where opportunity_score.opportunity_id = opportunity.id
  order by opportunity_score.created_at desc
  limit 1
) score on true;

revoke all on public.kanban_opportunity_list from public, anon;
grant select on public.kanban_opportunity_list to authenticated, service_role;

-- Count and representative card for every active stage in one query.
create or replace view public.dashboard_kanban_snapshot
with (security_invoker = true)
as
with ranked_opportunities as (
  select
    opportunity.id,
    opportunity.org_id,
    opportunity.pipeline_stage_id,
    opportunity.assigned_membership_id,
    opportunity.stage_entered_at,
    contact.name as contact_name,
    count(*) over (
      partition by opportunity.org_id, opportunity.pipeline_stage_id
    ) as card_count,
    row_number() over (
      partition by opportunity.org_id, opportunity.pipeline_stage_id
      order by opportunity.last_activity_at desc, opportunity.id
    ) as card_rank
  from public.opportunities opportunity
  join public.contacts contact
    on contact.id = opportunity.contact_id
   and contact.status = 'active'
)
select
  stage.org_id,
  stage.id as stage_id,
  stage.code as stage_code,
  stage.name as stage_name,
  stage.position as stage_position,
  coalesce(opportunity.card_count, 0)::bigint as card_count,
  opportunity.id as card_id,
  opportunity.assigned_membership_id,
  opportunity.stage_entered_at,
  opportunity.contact_name
from public.pipeline_stages stage
left join ranked_opportunities opportunity
  on opportunity.org_id = stage.org_id
 and opportunity.pipeline_stage_id = stage.id
 and opportunity.card_rank = 1
where stage.is_active;

revoke all on public.dashboard_kanban_snapshot from public, anon;
grant select on public.dashboard_kanban_snapshot to authenticated, service_role;

-- The common authenticated path now resolves viewer state in one database call.
create or replace function public.current_viewer_context_v2()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  with selected_membership as materialized (
    select membership.*
    from public.memberships membership
    where membership.user_id = (select auth.uid())
    order by
      case membership.status
        when 'active' then 0
        when 'pending' then 1
        else 2
      end,
      membership.created_at
    limit 1
  ),
  platform_context as materialized (
    select context.role, context.status
    from public.current_platform_context() context
    limit 1
  ),
  access_context as materialized (
    select context.block_type, context.public_message
    from public.current_access_block() context
    limit 1
  )
  select jsonb_build_object(
    'profile', (
      select to_jsonb(profile)
      from public.profiles profile
      where profile.user_id = (select auth.uid())
      limit 1
    ),
    'membership', (
      select to_jsonb(membership)
      from selected_membership membership
    ),
    'organization', (
      select to_jsonb(organization)
      from public.organizations organization
      join selected_membership membership
        on membership.org_id = organization.id
       and membership.status = 'active'
      limit 1
    ),
    'operations', coalesce((
      select jsonb_agg(to_jsonb(operation) order by operation.is_default desc, operation.name)
      from public.operations operation
      join selected_membership membership
        on membership.org_id = operation.org_id
       and membership.status = 'active'
      where operation.status <> 'archived'
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(permission.permission order by permission.permission)
      from public.membership_permissions permission
      join selected_membership membership
        on membership.id = permission.membership_id
       and membership.status = 'active'
    ), '[]'::jsonb),
    'platform_role', (
      select context.role
      from platform_context context
    ),
    'access_block', (
      select jsonb_build_object(
        'type', context.block_type,
        'message', context.public_message
      )
      from access_context context
    )
  );
$$;

revoke all on function public.current_viewer_context_v2() from public, anon;
grant execute on function public.current_viewer_context_v2() to authenticated, service_role;

create or replace function public.internal_chat_notification_counts(
  p_org_id uuid
)
returns table (
  pedro integer,
  lionel integer,
  broker integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (
      where thread.thread_type <> 'broker_assistant'
        and thread.assistant_role <> 'lionel'
    )::integer as pedro,
    count(*) filter (
      where thread.thread_type <> 'broker_assistant'
        and thread.assistant_role = 'lionel'
    )::integer as lionel,
    count(*) filter (
      where thread.thread_type = 'broker_assistant'
    )::integer as broker
  from public.internal_threads thread
  left join public.internal_thread_reads read_state
    on read_state.thread_id = thread.id
   and read_state.user_id = (select auth.uid())
  where thread.org_id = p_org_id
    and thread.status not in ('resolved', 'archived')
    and (
      thread.requires_action
      or read_state.last_read_at is null
      or thread.updated_at > read_state.last_read_at
    );
$$;

revoke all on function public.internal_chat_notification_counts(uuid) from public, anon;
grant execute on function public.internal_chat_notification_counts(uuid) to authenticated, service_role;

create or replace function public.dashboard_metrics(
  p_org_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  new_leads bigint,
  appointments bigint,
  sales bigint,
  inbound_conversations bigint,
  responded_conversations bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.opportunities opportunity
      where opportunity.org_id = p_org_id
        and opportunity.created_at >= p_range_start
        and opportunity.created_at <= p_range_end
    ) as new_leads,
    (
      select count(*)
      from public.calls call
      where call.org_id = p_org_id
        and call.created_at >= p_range_start
        and call.created_at <= p_range_end
    ) as appointments,
    (
      select count(*)
      from public.sales sale
      where sale.org_id = p_org_id
        and sale.status <> 'cancelled'
        and sale.confirmed_at >= p_range_start
        and sale.confirmed_at <= p_range_end
    ) as sales,
    (
      select count(*)
      from public.conversations conversation
      where conversation.org_id = p_org_id
        and conversation.last_inbound_at >= p_range_start
        and conversation.last_inbound_at <= p_range_end
    ) as inbound_conversations,
    (
      select count(*)
      from public.conversations conversation
      where conversation.org_id = p_org_id
        and conversation.last_inbound_at >= p_range_start
        and conversation.last_inbound_at <= p_range_end
        and conversation.last_outbound_at is not null
        and conversation.last_outbound_at >= conversation.last_inbound_at
    ) as responded_conversations;
$$;

revoke all on function public.dashboard_metrics(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- One filtered and paginated feed replaces seven PostgREST requests and the
-- transfer of up to 560 rows for every Central navigation.
create or replace function public.central_feed_page(
  p_org_id uuid,
  p_operation_id uuid,
  p_view text,
  p_offset integer,
  p_limit integer
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with current_membership as materialized (
    select membership.id
    from public.memberships membership
    where membership.org_id = p_org_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
    limit 1
  ),
  latest_health as (
    select distinct on (health.component)
      health.id,
      health.component,
      health.status,
      health.checked_at,
      health.error_redacted
    from public.integration_health_checks health
    where health.org_id = p_org_id
    order by health.component, health.checked_at desc
  ),
  all_records as (
    select
      alert.id::text as id,
      'alert'::text as source,
      'attention'::text as record_group,
      alert.title,
      alert.body as description,
      alert.status,
      alert.category as meta,
      alert.created_at as occurred_at,
      alert.status = 'open' as requires_action,
      alert.severity as priority,
      null::text as href,
      7 as source_rank
    from public.alerts alert
    where alert.org_id = p_org_id
      and alert.status <> 'resolved'

    union all

    select
      notification.id::text,
      'notification',
      'attention',
      notification.title,
      notification.body,
      notification.status,
      'Notificação',
      notification.created_at,
      notification.status not in ('read', 'cancelled'),
      case when notification.status = 'read' then 'normal' else 'high' end,
      null::text,
      1
    from public.notifications notification
    join current_membership membership
      on membership.id = notification.recipient_membership_id
    where notification.org_id = p_org_id

    union all

    select
      escalation.id::text,
      'escalation',
      'ai',
      escalation.category,
      escalation.reason,
      escalation.status,
      'Escalada do Pedro',
      escalation.created_at,
      escalation.status = 'open',
      escalation.severity,
      null::text,
      6
    from public.escalations escalation
    where escalation.org_id = p_org_id
      and escalation.status <> 'resolved'

    union all

    select
      thread.id::text,
      'thread',
      'ai',
      thread.title,
      case
        when thread.requires_action then 'Aguardando uma decisão da equipe.'
        else 'Registro interno atualizado.'
      end,
      thread.status,
      case when thread.assistant_role = 'lionel' then 'Lionel' else 'Pedro' end,
      thread.updated_at,
      thread.requires_action,
      thread.priority,
      case
        when thread.assistant_role = 'lionel' then '/app/lionel?topico=' || thread.id::text
        else '/app/chat-pedro?topico=' || thread.id::text
      end,
      5
    from public.internal_threads thread
    where thread.org_id = p_org_id
      and thread.assistant_role in ('pedro', 'lionel')
      and thread.status <> 'archived'
      and (p_operation_id is null or thread.operation_id = p_operation_id)

    union all

    select
      call.id::text,
      'call',
      'calls',
      'Chamada em acompanhamento',
      case
        when call.format = 'video' then 'Videochamada'
        when call.format = 'phone' then 'Ligação'
        else 'Formato a combinar'
      end,
      call.status,
      'Agenda',
      call.starts_at,
      call.status in ('awaiting_manager', 'awaiting_distribution', 'unassigned_alerted'),
      case when call.status = 'unassigned_alerted' then 'critical' else 'high' end,
      '/app/agenda',
      4
    from public.calls call
    where call.org_id = p_org_id
      and call.status in ('awaiting_manager', 'awaiting_distribution', 'unassigned_alerted', 'assigned')

    union all

    select
      campaign.id::text,
      'campaign',
      'campaigns',
      campaign.name,
      case
        when campaign.status = 'review' then 'A campanha aguarda revisão antes do próximo passo.'
        else 'Campanha de reativação em acompanhamento.'
      end,
      campaign.status,
      'Campanha',
      campaign.updated_at,
      campaign.status in ('review', 'approved', 'paused'),
      case when campaign.status = 'review' then 'high' else 'normal' end,
      '/app/campanhas',
      3
    from public.campaigns campaign
    where campaign.org_id = p_org_id
      and campaign.status in ('review', 'approved', 'running', 'paused')

    union all

    select
      health.id::text,
      'integration',
      'integrations',
      health.component,
      coalesce(health.error_redacted, 'Verificação concluída sem erro registrado.'),
      health.status,
      'Integração',
      health.checked_at,
      health.status not in ('healthy', 'ok'),
      case when health.status in ('healthy', 'ok') then 'normal' else 'high' end,
      '/app/configuracoes/whatsapp',
      2
    from latest_health health
  ),
  filtered_records as (
    select
      record.*,
      date_trunc('minute', record.occurred_at)::text
        || '|'
        || lower(regexp_replace(record.title || '|' || record.description, '\s+', ' ', 'g'))
        as fingerprint,
      (
        case when record.requires_action then 100 else 0 end
        + case record.priority
            when 'critical' then 30
            when 'high' then 20
            when 'warning' then 10
            else 0
          end
        + record.source_rank
      ) as record_score
    from all_records record
    where case p_view
      when 'history' then true
      when 'ai' then record.record_group = 'ai'
      when 'calls' then record.record_group = 'calls'
      when 'campaigns' then record.record_group = 'campaigns'
      when 'integrations' then record.record_group = 'integrations'
      else record.requires_action
    end
  ),
  deduplicated_records as (
    select distinct on (record.fingerprint)
      record.id,
      record.source,
      record.record_group,
      record.title,
      record.description,
      record.status,
      record.meta,
      record.occurred_at,
      record.requires_action,
      record.priority,
      record.href
    from filtered_records record
    order by record.fingerprint, record.record_score desc, record.occurred_at desc
  ),
  page_records as (
    select record.*, count(*) over () as total_count
    from deduplicated_records record
    order by record.occurred_at desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  select jsonb_build_object(
    'total', coalesce(
      max(page.total_count),
      (select count(*) from deduplicated_records),
      0
    ),
    'actionableTotal', (
      select count(*) from all_records record where record.requires_action
    ),
    'unresolvedAi', (
      select count(*)
      from all_records record
      where record.source = 'thread' and record.requires_action
    ),
    'unhealthyIntegrations', (
      select count(*)
      from latest_health health
      where health.status not in ('healthy', 'ok')
    ),
    'records', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'source', page.source,
          'group', page.record_group,
          'title', page.title,
          'description', page.description,
          'status', page.status,
          'meta', page.meta,
          'timestamp', page.occurred_at,
          'requiresAction', page.requires_action,
          'priority', page.priority,
          'href', page.href
        )
        order by page.occurred_at desc
      ),
      '[]'::jsonb
    )
  )
  from page_records page;
$$;

revoke all on function public.central_feed_page(uuid, uuid, text, integer, integer) from public, anon;
grant execute on function public.central_feed_page(uuid, uuid, text, integer, integer) to authenticated, service_role;

-- Indexes mirror the filters and sort orders used by the optimized contracts.
create index if not exists conversations_org_updated_idx
  on public.conversations (org_id, updated_at desc);

create index if not exists conversations_org_inbound_idx
  on public.conversations (org_id, last_inbound_at)
  include (last_outbound_at);

create index if not exists opportunities_org_activity_idx
  on public.opportunities (org_id, last_activity_at desc);

create index if not exists opportunities_org_created_idx
  on public.opportunities (org_id, created_at);

create index if not exists calls_org_created_idx
  on public.calls (org_id, created_at);

create index if not exists calls_org_active_schedule_idx
  on public.calls (org_id, starts_at)
  where status in ('awaiting_manager', 'awaiting_distribution', 'unassigned_alerted', 'assigned');

create index if not exists sales_org_confirmed_idx
  on public.sales (org_id, confirmed_at)
  where status <> 'cancelled';

create index if not exists alerts_org_open_created_idx
  on public.alerts (org_id, created_at desc)
  where status <> 'resolved';

create index if not exists campaigns_org_status_updated_idx
  on public.campaigns (org_id, status, updated_at desc);
