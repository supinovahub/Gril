-- Route-aware bootstraps let a client transition fetch authorization context
-- and screen data in one round trip. The optional organization is only a hint
-- for contractual support; workspace_access_context still authorizes it.
create or replace function public.inbox_workspace_bootstrap(
  p_org_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = ''
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
        order by conversation.has_attention desc, conversation.updated_at desc, conversation.id
      )
      from conversations conversation
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.inbox_workspace_bootstrap(uuid, integer) from public, anon;
grant execute on function public.inbox_workspace_bootstrap(uuid, integer) to authenticated, service_role;

create or replace function public.dashboard_workspace_bootstrap(
  p_period text,
  p_now timestamptz,
  p_org_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
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
    select operation.id, operation.name, operation.is_default, operation.timezone
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
  period_context as materialized (
    select
      coalesce((
        select operation.timezone
        from operations operation
        order by operation.is_default desc, operation.name
        limit 1
      ), 'America/Sao_Paulo') as timezone,
      case p_period
        when 'today' then 1
        when '30d' then 30
        else 7
      end as day_count
  ),
  period_range as materialized (
    select
      (
        (
          (p_now at time zone period.timezone)::date
          - (period.day_count - 1)
        )::timestamp at time zone period.timezone
      ) as range_start,
      p_now as range_end,
      period.timezone
    from period_context period
  ),
  workspace as materialized (
    select public.dashboard_workspace_v2(
      target.org_id,
      period.range_start,
      period.range_end,
      p_now
    ) as payload
    from target
    cross join period_range period
  )
  select coalesce((select payload from workspace), '{}'::jsonb) || jsonb_build_object(
    'authenticated', (select auth.uid()) is not null,
    'authorized', exists(select 1 from access),
    'organizationId', (select org_id from target),
    'memberRole', (select membership_role from access limit 1),
    'canManageTeam', coalesce((
      select
        access.membership_role = 'owner'
        or (
          access.membership_role = 'manager'
          and exists (
            select 1
            from public.membership_permissions permission
            where permission.membership_id = access.membership_id
              and permission.permission = 'team.manage'
          )
        )
      from access
      limit 1
    ), false),
    'timezone', (select timezone from period_range),
    'operations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', operation.id,
          'name', operation.name,
          'isDefault', operation.is_default,
          'timezone', operation.timezone
        )
        order by operation.is_default desc, operation.name
      )
      from operations operation
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.dashboard_workspace_bootstrap(text, timestamptz, uuid) from public, anon;
grant execute on function public.dashboard_workspace_bootstrap(text, timestamptz, uuid) to authenticated, service_role;
