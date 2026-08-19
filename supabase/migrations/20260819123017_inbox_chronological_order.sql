-- Keep unread and pending counts as badges, but select the page and serialize
-- it strictly by latest conversation activity, matching WhatsApp's list.
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
set jit = off
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
  order by row.updated_at desc, row.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.inbox_conversation_page(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.inbox_conversation_page(uuid, integer)
  to service_role;

create or replace function public.inbox_workspace_bootstrap(
  p_org_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with target as materialized (
    select coalesce(
      p_org_id,
      (
        select membership.org_id
        from public.memberships membership
        where membership.user_id = (select auth.uid())
          and membership.status = 'active'
        order by membership.created_at
        limit 1
      )
    ) as org_id
  ),
  access as materialized (
    select access.*
    from target
    cross join lateral private.workspace_access_context(target.org_id) access
  ),
  operations as materialized (
    select operation.id, operation.timezone
    from public.operations operation
    cross join target
    cross join access
    where operation.org_id = target.org_id
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
  conversations as materialized (
    select conversation.*
    from target
    cross join lateral public.inbox_conversation_page(target.org_id, p_limit) conversation
  )
  select jsonb_build_object(
    'authenticated', (select auth.uid()) is not null,
    'authorized', exists(select 1 from access),
    'organizationId', (select org_id from target),
    'memberRole', (select membership_role from access limit 1),
    'operations', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', operation.id, 'timezone', operation.timezone)
        order by operation.id
      )
      from operations operation
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(
        to_jsonb(conversation)
        order by conversation.updated_at desc, conversation.id
      )
      from conversations conversation
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.inbox_workspace_bootstrap(uuid, integer)
  from public, anon;
grant execute on function public.inbox_workspace_bootstrap(uuid, integer)
  to authenticated, service_role;
