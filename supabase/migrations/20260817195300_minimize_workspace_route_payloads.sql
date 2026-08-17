begin;

create or replace function public.campaigns_workspace_bootstrap_v2(
  p_archived boolean default false,
  p_org_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with payload as materialized (
    select public.campaigns_workspace_bootstrap(p_archived, p_org_id) as value
  ),
  contact_stats as materialized (
    select
      contact.value ->> 'campaign_id' as campaign_id,
      contact.value ->> 'status' as status,
      count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(
      coalesce(payload.value -> 'contacts', '[]'::jsonb)
    ) contact(value)
    group by contact.value ->> 'campaign_id', contact.value ->> 'status'
  )
  select
    (payload.value - 'contacts')
    || jsonb_build_object(
      'contactStats',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'campaign_id', campaign_id,
              'status', status,
              'count', total
            )
            order by campaign_id, status
          )
          from contact_stats
        ),
        '[]'::jsonb
      )
    )
  from payload;
$$;

revoke all on function public.campaigns_workspace_bootstrap_v2(boolean, uuid) from public, anon;
grant execute on function public.campaigns_workspace_bootstrap_v2(boolean, uuid) to authenticated, service_role;

create or replace function public.audit_workspace_page(
  p_page integer default 1,
  p_page_size integer default 30,
  p_org_id uuid default null
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
  permission_gate as materialized (
    select (
      private.has_org_role(target.org_id, array['owner', 'manager']::text[])
      or private.has_org_permission(target.org_id, 'reports.view')
    ) as allowed
    from target
    where exists (select 1 from access)
  ),
  bounds as materialized (
    select
      greatest(coalesce(p_page, 1), 1) as page,
      least(greatest(coalesce(p_page_size, 30), 1), 100) as page_size
  ),
  total as materialized (
    select count(*)::integer as value
    from audit.events event
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and event.org_id = target.org_id
  ),
  event_rows as materialized (
    select
      jsonb_build_object(
        'id', event.id,
        'operation_id', event.operation_id,
        'actor_user_id', event.actor_user_id,
        'actor_type', event.actor_type,
        'action', event.action,
        'entity_type', event.entity_type,
        'entity_id', event.entity_id,
        'metadata', event.metadata,
        'occurred_at', event.occurred_at
      ) as value,
      event.occurred_at
    from audit.events event
    cross join target
    cross join permission_gate
    cross join bounds
    where permission_gate.allowed
      and event.org_id = target.org_id
    order by event.occurred_at desc
    limit (select page_size from bounds)
    offset (select (page - 1) * page_size from bounds)
  )
  select jsonb_build_object(
    'authorized', coalesce((select allowed from permission_gate), false),
    'totalCount', coalesce((select value from total), 0),
    'events', coalesce((select jsonb_agg(value order by occurred_at desc) from event_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.audit_workspace_page(integer, integer, uuid) from public, anon;
grant execute on function public.audit_workspace_page(integer, integer, uuid) to authenticated, service_role;

create or replace function public.reports_workspace_summary(
  p_org_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set jit = off
as $$
  with payload as materialized (
    select public.reports_workspace_bootstrap(p_org_id) as value
  ),
  opportunity_groups as materialized (
    select item.value ->> 'status' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'opportunities', '[]'::jsonb)) item(value)
    group by item.value ->> 'status'
  ),
  campaign_groups as materialized (
    select item.value ->> 'status' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'campaignContacts', '[]'::jsonb)) item(value)
    group by item.value ->> 'status'
  ),
  call_groups as materialized (
    select item.value ->> 'status' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'calls', '[]'::jsonb)) item(value)
    group by item.value ->> 'status'
  ),
  result_groups as materialized (
    select item.value ->> 'result' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'results', '[]'::jsonb)) item(value)
    group by item.value ->> 'result'
  ),
  execution_groups as materialized (
    select item.value ->> 'mode' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'executions', '[]'::jsonb)) item(value)
    group by item.value ->> 'mode'
  ),
  usage_groups as materialized (
    select item.value ->> 'usage_type' as name, count(*)::integer as total
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'usage', '[]'::jsonb)) item(value)
    group by item.value ->> 'usage_type'
  ),
  usage_totals as materialized (
    select coalesce(sum((item.value ->> 'estimated_cost_brl')::numeric), 0) as projected_cost
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'usage', '[]'::jsonb)) item(value)
  ),
  result_totals as materialized (
    select count(*) filter (where item.value ->> 'result' <> 'no_result')::integer as completed
    from payload
    cross join lateral jsonb_array_elements(coalesce(payload.value -> 'results', '[]'::jsonb)) item(value)
  )
  select jsonb_build_object(
    'authorized', coalesce((payload.value ->> 'authorized')::boolean, false),
    'opportunityCount', jsonb_array_length(coalesce(payload.value -> 'opportunities', '[]'::jsonb)),
    'campaignContactCount', jsonb_array_length(coalesce(payload.value -> 'campaignContacts', '[]'::jsonb)),
    'completedResultCount', coalesce((select completed from result_totals), 0),
    'projectedCost', coalesce((select projected_cost from usage_totals), 0),
    'settings', payload.value -> 'settings',
    'capacity', coalesce(payload.value -> 'capacity', '[]'::jsonb),
    'groups', jsonb_build_object(
      'opportunities', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from opportunity_groups), '[]'::jsonb),
      'campaigns', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from campaign_groups), '[]'::jsonb),
      'calls', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from call_groups), '[]'::jsonb),
      'results', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from result_groups), '[]'::jsonb),
      'executions', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from execution_groups), '[]'::jsonb),
      'usage', coalesce((select jsonb_agg(jsonb_build_array(name, total) order by name) from usage_groups), '[]'::jsonb)
    )
  )
  from payload;
$$;

revoke all on function public.reports_workspace_summary(uuid) from public, anon;
grant execute on function public.reports_workspace_summary(uuid) to authenticated, service_role;

commit;
