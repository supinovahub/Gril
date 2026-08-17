-- Resolve the authenticated workspace context once per request instead of
-- re-running correlated RLS helper functions for every row in every join.
create or replace function private.workspace_access_context(p_org_id uuid)
returns table (
  requesting_user_id uuid,
  membership_id uuid,
  membership_role text,
  support_read boolean,
  support_write boolean,
  can_manage_team boolean,
  can_manage_pipeline boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as materialized (
    select auth.uid() as user_id
  ),
  support as materialized (
    select
      coalesce(bool_or(true), false) as can_read,
      coalesce(bool_or(grant_record.access_level = 'full'), false) as can_write
    from actor
    join private.platform_principals principal
      on principal.user_id = actor.user_id
     and principal.active
    join private.contractual_support_grants grant_record
      on grant_record.org_id = p_org_id
     and grant_record.active
     and grant_record.revoked_at is null
     and (grant_record.expires_at is null or grant_record.expires_at > now())
    left join private.account_controls account_control
      on account_control.user_id = actor.user_id
    where actor.user_id is not null
      and not coalesce(account_control.suspended, false)
  ),
  active_membership as materialized (
    select membership.id, membership.role
    from actor
    join public.memberships membership
      on membership.user_id = actor.user_id
     and membership.org_id = p_org_id
     and membership.status = 'active'
    join public.organizations organization
      on organization.id = membership.org_id
     and organization.status = 'active'
    left join public.profiles profile
      on profile.user_id = membership.user_id
    left join private.account_controls account_control
      on account_control.user_id = membership.user_id
    where not coalesce(account_control.suspended, false)
      and (
        membership.role = 'owner'
        or profile.whatsapp_e164 is not null
      )
    limit 1
  )
  select
    actor.user_id,
    membership.id,
    membership.role,
    support.can_read,
    support.can_write,
    (
      support.can_write
      or membership.role = 'owner'
      or (
        membership.role = 'manager'
        and exists (
          select 1
          from public.membership_permissions permission
          where permission.membership_id = membership.id
            and permission.permission = 'team.manage'
        )
      )
    ) as can_manage_team,
    (
      support.can_write
      or membership.role = 'owner'
      or (
        membership.role = 'manager'
        and exists (
          select 1
          from public.membership_permissions permission
          where permission.membership_id = membership.id
            and permission.permission = 'pipeline.manage'
        )
      )
    ) as can_manage_pipeline
  from actor
  left join active_membership membership on true
  cross join support
  where actor.user_id is not null
    and (membership.id is not null or support.can_read);
$$;

revoke all on function private.workspace_access_context(uuid) from public, anon, authenticated;

-- Same viewer contract as v2, but every returned row is anchored to auth.uid()
-- inside a locked-down SECURITY DEFINER function. This avoids the RLS cascade
-- that previously made the common authenticated path take up to 1.3 seconds.
create or replace function public.current_viewer_context_v3()
returns jsonb
language sql
volatile
security definer
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
  active_access as materialized (
    select access.*
    from selected_membership membership
    cross join lateral private.workspace_access_context(membership.org_id) access
    where membership.status = 'active'
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
      join active_access access on true
      limit 1
    ),
    'operations', coalesce((
      select jsonb_agg(to_jsonb(operation) order by operation.is_default desc, operation.name)
      from public.operations operation
      join selected_membership membership
        on membership.org_id = operation.org_id
       and membership.status = 'active'
      join active_access access on true
      where operation.status <> 'archived'
        and (
          access.support_read
          or access.membership_role in ('owner', 'manager')
          or exists (
            select 1
            from public.membership_operations operation_scope
            where operation_scope.membership_id = access.membership_id
              and operation_scope.operation_id = operation.id
          )
        )
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

revoke all on function public.current_viewer_context_v3() from public, anon;
grant execute on function public.current_viewer_context_v3() to authenticated, service_role;

-- A page-sized Inbox contract. Base tables are read as the function owner, but
-- the visible operation/conversation/contact sets reproduce the existing RLS
-- rules from one materialized access context tied to auth.uid().
create or replace function public.inbox_conversation_page(
  p_org_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  operation_id uuid,
  status text,
  ownership text,
  ai_mode text,
  last_inbound_at timestamptz,
  last_message_preview text,
  updated_at timestamptz,
  contact_name text,
  opportunity_id uuid,
  stage_name text,
  unread_inbound_count integer,
  pending_suggestion_count integer,
  total_count integer,
  has_attention boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with access as materialized (
    select *
    from private.workspace_access_context(p_org_id)
  ),
  allowed_operations as materialized (
    select operation.id
    from public.operations operation
    cross join access
    where operation.org_id = p_org_id
      and operation.status <> 'archived'
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or exists (
          select 1
          from public.membership_operations operation_scope
          where operation_scope.membership_id = access.membership_id
            and operation_scope.operation_id = operation.id
        )
      )
  ),
  visible_opportunities as materialized (
    select opportunity.*
    from public.opportunities opportunity
    join allowed_operations operation on operation.id = opportunity.operation_id
    cross join access
    where opportunity.org_id = p_org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
  ),
  visible_contacts as materialized (
    select distinct opportunity.contact_id
    from visible_opportunities opportunity
  ),
  visible_conversations as materialized (
    select conversation.*
    from public.conversations conversation
    join allowed_operations operation on operation.id = conversation.operation_id
    cross join access
    where conversation.org_id = p_org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or (
          conversation.assigned_membership_id = access.membership_id
          and exists (
            select 1
            from public.conversation_access_grants access_grant
            where access_grant.conversation_id = conversation.id
              and access_grant.membership_id = access.membership_id
              and access_grant.starts_at <= now()
              and (access_grant.expires_at is null or access_grant.expires_at > now())
              and access_grant.revoked_at is null
          )
        )
      )
  ),
  conversation_details as materialized (
    select
      conversation.*,
      contact.name as contact_name,
      opportunity.id as visible_opportunity_id,
      stage.name as stage_name
    from visible_conversations conversation
    join visible_contacts visible_contact on visible_contact.contact_id = conversation.contact_id
    join public.contacts contact on contact.id = conversation.contact_id
    left join visible_opportunities opportunity on opportunity.id = conversation.opportunity_id
    left join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
  ),
  unread_counts as materialized (
    select message.conversation_id, count(*)::integer as unread_inbound_count
    from public.messages message
    join conversation_details conversation on conversation.id = message.conversation_id
    cross join access
    left join public.conversation_read_states read_state
      on read_state.conversation_id = conversation.id
     and read_state.user_id = access.requesting_user_id
    where message.direction = 'inbound'
      and message.created_at > coalesce(
        read_state.last_read_inbound_at,
        '-infinity'::timestamptz
      )
    group by message.conversation_id
  ),
  pending_counts as materialized (
    select suggestion.conversation_id, count(*)::integer as pending_suggestion_count
    from public.ai_suggestions suggestion
    join conversation_details conversation on conversation.id = suggestion.conversation_id
    where suggestion.status = 'pending'
    group by suggestion.conversation_id
  ),
  rows_with_counts as (
    select
      conversation.id,
      conversation.operation_id,
      conversation.status,
      conversation.ownership,
      conversation.ai_mode,
      conversation.last_inbound_at,
      conversation.last_message_preview,
      conversation.updated_at,
      conversation.contact_name,
      conversation.visible_opportunity_id as opportunity_id,
      conversation.stage_name,
      coalesce(unread.unread_inbound_count, 0)::integer as unread_inbound_count,
      coalesce(pending.pending_suggestion_count, 0)::integer as pending_suggestion_count
    from conversation_details conversation
    left join unread_counts unread on unread.conversation_id = conversation.id
    left join pending_counts pending on pending.conversation_id = conversation.id
  )
  select
    row.id,
    row.operation_id,
    row.status,
    row.ownership,
    row.ai_mode,
    row.last_inbound_at,
    row.last_message_preview,
    row.updated_at,
    row.contact_name,
    row.opportunity_id,
    row.stage_name,
    row.unread_inbound_count,
    row.pending_suggestion_count,
    (row.unread_inbound_count + row.pending_suggestion_count)::integer as total_count,
    (row.unread_inbound_count + row.pending_suggestion_count) > 0 as has_attention
  from rows_with_counts row
  order by
    ((row.unread_inbound_count + row.pending_suggestion_count) > 0) desc,
    row.updated_at desc,
    row.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.inbox_conversation_page(uuid, integer) from public, anon;
grant execute on function public.inbox_conversation_page(uuid, integer) to authenticated, service_role;

-- One round trip for all business data needed by the overview. Each source is
-- filtered from the same access context before aggregation, preventing both
-- RLS multiplication and five parallel network round trips.
create or replace function public.dashboard_workspace_v2(
  p_org_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_now timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with access as materialized (
    select *
    from private.workspace_access_context(p_org_id)
  ),
  allowed_operations as materialized (
    select operation.id
    from public.operations operation
    cross join access
    where operation.org_id = p_org_id
      and operation.status <> 'archived'
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or exists (
          select 1
          from public.membership_operations operation_scope
          where operation_scope.membership_id = access.membership_id
            and operation_scope.operation_id = operation.id
        )
      )
  ),
  visible_opportunities as materialized (
    select opportunity.*
    from public.opportunities opportunity
    join allowed_operations operation on operation.id = opportunity.operation_id
    cross join access
    where opportunity.org_id = p_org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
  ),
  visible_contacts as materialized (
    select distinct opportunity.contact_id
    from visible_opportunities opportunity
  ),
  visible_conversations as materialized (
    select conversation.*
    from public.conversations conversation
    join allowed_operations operation on operation.id = conversation.operation_id
    cross join access
    where conversation.org_id = p_org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or (
          conversation.assigned_membership_id = access.membership_id
          and exists (
            select 1
            from public.conversation_access_grants access_grant
            where access_grant.conversation_id = conversation.id
              and access_grant.membership_id = access.membership_id
              and access_grant.starts_at <= p_now
              and (access_grant.expires_at is null or access_grant.expires_at > p_now)
              and access_grant.revoked_at is null
          )
        )
      )
  ),
  conversation_details as materialized (
    select conversation.*, contact.name as contact_name
    from visible_conversations conversation
    join visible_contacts visible_contact on visible_contact.contact_id = conversation.contact_id
    join public.contacts contact on contact.id = conversation.contact_id
  ),
  unread_counts as materialized (
    select message.conversation_id, count(*)::integer as unread_inbound_count
    from public.messages message
    join conversation_details conversation on conversation.id = message.conversation_id
    cross join access
    left join public.conversation_read_states read_state
      on read_state.conversation_id = conversation.id
     and read_state.user_id = access.requesting_user_id
    where message.direction = 'inbound'
      and message.created_at > coalesce(
        read_state.last_read_inbound_at,
        '-infinity'::timestamptz
      )
    group by message.conversation_id
  ),
  pending_counts as materialized (
    select suggestion.conversation_id, count(*)::integer as pending_suggestion_count
    from public.ai_suggestions suggestion
    join conversation_details conversation on conversation.id = suggestion.conversation_id
    where suggestion.status = 'pending'
    group by suggestion.conversation_id
  ),
  attention_rows as materialized (
    select
      conversation.id,
      conversation.contact_name,
      conversation.last_inbound_at,
      conversation.updated_at,
      coalesce(unread.unread_inbound_count, 0)::integer as unread_inbound_count,
      coalesce(pending.pending_suggestion_count, 0)::integer as pending_suggestion_count
    from conversation_details conversation
    left join unread_counts unread on unread.conversation_id = conversation.id
    left join pending_counts pending on pending.conversation_id = conversation.id
    where coalesce(unread.unread_inbound_count, 0) + coalesce(pending.pending_suggestion_count, 0) > 0
    order by
      coalesce(pending.pending_suggestion_count, 0) desc,
      coalesce(unread.unread_inbound_count, 0) desc,
      conversation.updated_at desc
    limit 3
  ),
  visible_calls as materialized (
    select call.*
    from public.calls call
    cross join access
    where call.org_id = p_org_id
      and (
        access.can_manage_pipeline
        or call.assigned_membership_id = access.membership_id
        or exists (
          select 1
          from public.call_offers offer
          where offer.call_id = call.id
            and offer.recipient_membership_id = access.membership_id
        )
      )
  ),
  ranked_kanban as materialized (
    select
      opportunity.id,
      opportunity.pipeline_stage_id,
      opportunity.assigned_membership_id,
      opportunity.stage_entered_at,
      contact.name as contact_name,
      count(*) over (partition by opportunity.pipeline_stage_id) as card_count,
      row_number() over (
        partition by opportunity.pipeline_stage_id
        order by opportunity.last_activity_at desc, opportunity.id
      ) as card_rank
    from visible_opportunities opportunity
    join public.contacts contact
      on contact.id = opportunity.contact_id
     and contact.status = 'active'
  ),
  kanban_rows as materialized (
    select
      stage.id,
      stage.code,
      stage.name,
      stage.position,
      coalesce(opportunity.card_count, 0)::bigint as card_count,
      opportunity.id as card_id,
      opportunity.assigned_membership_id,
      opportunity.stage_entered_at,
      opportunity.contact_name
    from public.pipeline_stages stage
    cross join access
    left join ranked_kanban opportunity
      on opportunity.pipeline_stage_id = stage.id
     and opportunity.card_rank = 1
    where stage.org_id = p_org_id
      and stage.is_active
  ),
  agenda_rows as materialized (
    select
      call.id,
      call.format,
      call.opportunity_id,
      call.starts_at,
      coalesce(contact.name, opportunity.title, 'Lead') as display_name
    from visible_calls call
    left join visible_opportunities opportunity on opportunity.id = call.opportunity_id
    left join public.contacts contact on contact.id = opportunity.contact_id
    where call.status in (
      'awaiting_manager',
      'awaiting_distribution',
      'distributing',
      'unassigned_alerted',
      'assigned',
      'rescheduled'
    )
      and call.starts_at >= p_now
    order by call.starts_at
    limit 3
  ),
  visible_team as materialized (
    select membership.id, membership.user_id
    from public.memberships membership
    cross join access
    where membership.org_id = p_org_id
      and membership.status = 'active'
      and (
        membership.user_id = access.requesting_user_id
        or access.can_manage_team
      )
  ),
  metric_values as materialized (
    select
      (select count(*) from visible_opportunities opportunity
        where opportunity.created_at >= p_range_start and opportunity.created_at <= p_range_end) as new_leads,
      (select count(*) from visible_calls call
        where call.created_at >= p_range_start and call.created_at <= p_range_end) as appointments,
      (select count(*) from public.sales sale
        join visible_opportunities opportunity on opportunity.id = sale.opportunity_id
        where sale.org_id = p_org_id
          and sale.status <> 'cancelled'
          and sale.confirmed_at >= p_range_start
          and sale.confirmed_at <= p_range_end) as sales,
      (select count(*) from visible_conversations conversation
        where conversation.last_inbound_at >= p_range_start and conversation.last_inbound_at <= p_range_end) as inbound_conversations,
      (select count(*) from visible_conversations conversation
        where conversation.last_inbound_at >= p_range_start
          and conversation.last_inbound_at <= p_range_end
          and conversation.last_outbound_at is not null
          and conversation.last_outbound_at >= conversation.last_inbound_at) as responded_conversations
  )
  select jsonb_build_object(
    'metrics', (
      select jsonb_build_object(
        'newLeads', metric.new_leads,
        'appointments', metric.appointments,
        'sales', metric.sales,
        'inboundConversations', metric.inbound_conversations,
        'respondedConversations', metric.responded_conversations
      )
      from metric_values metric
    ),
    'kanban', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', stage.id,
          'code', stage.code,
          'name', stage.name,
          'count', stage.card_count,
          'cards', case
            when stage.card_id is null then '[]'::jsonb
            else jsonb_build_array(jsonb_build_object(
              'id', stage.card_id,
              'name', stage.contact_name,
              'assignedMembershipId', stage.assigned_membership_id,
              'stageEnteredAt', stage.stage_entered_at
            ))
          end
        )
        order by stage.position
      )
      from kanban_rows stage
    ), '[]'::jsonb),
    'attentionItems', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attention.id,
          'name', attention.contact_name,
          'pendingSuggestionCount', attention.pending_suggestion_count,
          'unreadInboundCount', attention.unread_inbound_count,
          'waitingSince', coalesce(attention.last_inbound_at, attention.updated_at)
        )
        order by attention.pending_suggestion_count desc, attention.unread_inbound_count desc, attention.updated_at desc
      )
      from attention_rows attention
    ), '[]'::jsonb),
    'agendaItems', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', agenda.id,
          'format', agenda.format,
          'opportunityId', agenda.opportunity_id,
          'name', agenda.display_name,
          'startsAt', agenda.starts_at
        )
        order by agenda.starts_at
      )
      from agenda_rows agenda
    ), '[]'::jsonb),
    'team', jsonb_build_object(
      'namesByMembership', coalesce((
        select jsonb_object_agg(
          membership.id::text,
          coalesce(profile.full_name, 'Equipe')
        )
        from visible_team membership
        left join public.profiles profile on profile.user_id = membership.user_id
      ), '{}'::jsonb)
    )
  );
$$;

revoke all on function public.dashboard_workspace_v2(uuid, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_workspace_v2(uuid, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
