begin;

create or replace function public.campaigns_workspace_bootstrap(
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
    select private.has_org_permission(target.org_id, 'campaigns.manage') as allowed
    from target
    where exists (select 1 from access)
  ),
  campaign_rows as materialized (
    select
      to_jsonb(campaign) || jsonb_build_object(
        'whatsapp_connections',
        case
          when connection.id is null then null
          else jsonb_build_object(
            'name', connection.name,
            'phone_e164', connection.phone_e164,
            'provider', connection.provider
          )
        end
      ) as value,
      campaign.created_at
    from public.campaigns campaign
    left join public.whatsapp_connections connection on connection.id = campaign.connection_id
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and campaign.org_id = target.org_id
      and (
        (p_archived and campaign.status = 'archived' and campaign.archived_at is not null)
        or
        (not p_archived and campaign.status <> 'archived' and campaign.archived_at is null)
      )
  ),
  connection_rows as materialized (
    select jsonb_build_object(
      'id', connection.id,
      'name', connection.name,
      'phone_e164', connection.phone_e164,
      'provider', connection.provider
    ) as value
    from public.whatsapp_connections connection
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and connection.org_id = target.org_id
      and connection.status = 'active'
      and connection.campaign_enabled
  ),
  contact_rows as materialized (
    select
      jsonb_build_object(
        'id', campaign_contact.id,
        'campaign_id', campaign_contact.campaign_id,
        'status', campaign_contact.status,
        'contacts', jsonb_build_object('name', contact.name)
      ) as value
    from public.campaign_contacts campaign_contact
    join public.contacts contact on contact.id = campaign_contact.contact_id
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and campaign_contact.org_id = target.org_id
  ),
  import_rows as materialized (
    select
      jsonb_build_object(
        'id', campaign_import.id,
        'campaign_id', campaign_import.campaign_id,
        'total_rows', campaign_import.total_rows,
        'valid_rows', campaign_import.valid_rows,
        'duplicate_rows', campaign_import.duplicate_rows,
        'error_rows', campaign_import.error_rows,
        'status', campaign_import.status,
        'created_at', campaign_import.created_at,
        'mapping', campaign_import.mapping,
        'file_sha256', campaign_import.file_sha256
      ) as value,
      campaign_import.created_at
    from public.campaign_imports campaign_import
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and campaign_import.org_id = target.org_id
  ),
  issue_rows as materialized (
    select
      jsonb_build_object(
        'import_id', import_row.import_id,
        'row_number', import_row.row_number,
        'status', import_row.status,
        'error_code', import_row.error_code,
        'normalized_name', import_row.normalized_name,
        'normalized_phone', import_row.normalized_phone
      ) as value,
      import_row.row_number
    from public.campaign_import_rows import_row
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and import_row.org_id = target.org_id
      and import_row.status in ('error', 'duplicate')
    order by import_row.row_number
    limit 100
  ),
  wave_rows as materialized (
    select
      jsonb_build_object(
        'id', wave.id,
        'campaign_id', wave.campaign_id,
        'wave_number', wave.wave_number,
        'released_count', wave.released_count,
        'suppressed_count', wave.suppressed_count,
        'status', wave.status,
        'released_at', wave.released_at
      ) as value,
      wave.wave_number
    from public.campaign_waves wave
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and wave.org_id = target.org_id
  ),
  template_rows as materialized (
    select jsonb_build_object(
      'id', template.id,
      'connection_id', template.connection_id,
      'external_name', template.external_name,
      'language', template.language
    ) as value
    from public.whatsapp_message_templates template
    cross join target
    cross join permission_gate
    where permission_gate.allowed
      and template.org_id = target.org_id
      and template.enabled
      and template.purpose = 'campaign'
      and template.provider_status = 'APPROVED'
  )
  select jsonb_build_object(
    'authorized', coalesce((select allowed from permission_gate), false),
    'campaigns', coalesce((select jsonb_agg(value order by created_at desc) from campaign_rows), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(value) from connection_rows), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(value) from contact_rows), '[]'::jsonb),
    'imports', coalesce((select jsonb_agg(value order by created_at desc) from import_rows), '[]'::jsonb),
    'importIssues', coalesce((select jsonb_agg(value order by row_number) from issue_rows), '[]'::jsonb),
    'waves', coalesce((select jsonb_agg(value order by wave_number desc) from wave_rows), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(value) from template_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.campaigns_workspace_bootstrap(boolean, uuid) from public, anon;
grant execute on function public.campaigns_workspace_bootstrap(boolean, uuid) to authenticated, service_role;

create or replace function public.audit_workspace_bootstrap(
  p_limit integer default 250,
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
  event_rows as materialized (
    select jsonb_build_object(
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
    where permission_gate.allowed
      and event.org_id = target.org_id
    order by event.occurred_at desc
    limit least(greatest(coalesce(p_limit, 250), 1), 500)
  )
  select jsonb_build_object(
    'authorized', coalesce((select allowed from permission_gate), false),
    'events', coalesce((select jsonb_agg(value order by occurred_at desc) from event_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.audit_workspace_bootstrap(integer, uuid) from public, anon;
grant execute on function public.audit_workspace_bootstrap(integer, uuid) to authenticated, service_role;

create or replace function public.privacy_workspace_bootstrap(
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
  permissions as materialized (
    select
      private.has_org_permission(target.org_id, 'contacts.manage') as can_manage_contacts,
      private.has_org_role(target.org_id, array['owner']::text[]) as can_view_policies
    from target
    where exists (select 1 from access)
  ),
  allowed_operations as materialized (
    select operation.id
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
  visible_opportunities as materialized (
    select opportunity.contact_id
    from public.opportunities opportunity
    join allowed_operations operation on operation.id = opportunity.operation_id
    cross join target
    cross join access
    where opportunity.org_id = target.org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
  ),
  request_rows as materialized (
    select
      to_jsonb(privacy_request) || jsonb_build_object(
        'contacts', jsonb_build_object('name', contact.name)
      ) as value,
      privacy_request.created_at
    from public.privacy_requests privacy_request
    join public.contacts contact on contact.id = privacy_request.contact_id
    cross join target
    cross join permissions
    where permissions.can_manage_contacts
      and privacy_request.org_id = target.org_id
  ),
  policy_rows as materialized (
    select to_jsonb(policy) as value
    from public.retention_policies policy
    cross join target
    cross join permissions
    where permissions.can_view_policies
      and policy.org_id = target.org_id
  ),
  contact_rows as materialized (
    select jsonb_build_object('id', contact.id, 'name', contact.name) as value,
      contact.name
    from public.contacts contact
    cross join target
    where contact.org_id = target.org_id
      and contact.status = 'active'
      and exists (
        select 1
        from visible_opportunities opportunity
        where opportunity.contact_id = contact.id
      )
    order by contact.name
    limit 500
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'requests', coalesce((select jsonb_agg(value order by created_at desc) from request_rows), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(value) from policy_rows), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(value order by name) from contact_rows), '[]'::jsonb)
  );
$$;

revoke all on function public.privacy_workspace_bootstrap(uuid) from public, anon;
grant execute on function public.privacy_workspace_bootstrap(uuid) to authenticated, service_role;

create or replace function public.reports_workspace_bootstrap(
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
  permissions as materialized (
    select
      private.has_org_permission(target.org_id, 'campaigns.manage') as can_manage_campaigns,
      private.has_org_permission(target.org_id, 'pipeline.manage') as can_manage_pipeline,
      private.has_org_permission(target.org_id, 'ai.manage') as can_manage_ai,
      (
        private.has_org_role(target.org_id, array['owner']::text[])
        or private.has_org_permission(target.org_id, 'finance.view')
      ) as can_view_finance
    from target
    where exists (select 1 from access)
  ),
  allowed_operations as materialized (
    select operation.id
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
  visible_opportunities as materialized (
    select opportunity.*
    from public.opportunities opportunity
    join allowed_operations operation on operation.id = opportunity.operation_id
    cross join target
    cross join access
    where opportunity.org_id = target.org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
  ),
  visible_conversations as materialized (
    select conversation.id
    from public.conversations conversation
    join allowed_operations operation on operation.id = conversation.operation_id
    cross join target
    cross join access
    where conversation.org_id = target.org_id
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
  visible_calls as materialized (
    select call.*
    from public.calls call
    cross join target
    cross join access
    cross join permissions
    where call.org_id = target.org_id
      and (
        permissions.can_manage_pipeline
        or call.assigned_membership_id = access.membership_id
        or exists (
          select 1
          from public.call_offers offer
          where offer.call_id = call.id
            and offer.recipient_membership_id = access.membership_id
        )
      )
  ),
  opportunity_rows as materialized (
    select jsonb_build_object(
      'id', opportunity.id,
      'status', opportunity.status,
      'pipeline_stages', jsonb_build_object('code', stage.code, 'name', stage.name)
    ) as value
    from visible_opportunities opportunity
    join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
  ),
  campaign_contact_rows as materialized (
    select jsonb_build_object('status', campaign_contact.status) as value
    from public.campaign_contacts campaign_contact
    cross join target
    cross join permissions
    where permissions.can_manage_campaigns
      and campaign_contact.org_id = target.org_id
  ),
  call_rows as materialized (
    select jsonb_build_object(
      'id', call.id,
      'status', call.status,
      'assigned_membership_id', call.assigned_membership_id
    ) as value
    from visible_calls call
  ),
  result_rows as materialized (
    select jsonb_build_object('result', result.result) as value
    from public.call_results result
    join visible_calls call on call.id = result.call_id
  ),
  execution_rows as materialized (
    select jsonb_build_object('mode', execution.mode, 'status', execution.status) as value
    from public.ai_executions execution
    cross join target
    cross join permissions
    where execution.org_id = target.org_id
      and (
        permissions.can_manage_ai
        or (
          execution.conversation_id is not null
          and exists (
            select 1
            from visible_conversations conversation
            where conversation.id = execution.conversation_id
          )
        )
      )
  ),
  usage_rows as materialized (
    select jsonb_build_object(
      'usage_type', usage.usage_type,
      'input_tokens', usage.input_tokens,
      'output_tokens', usage.output_tokens,
      'provider_currency', usage.provider_currency,
      'provider_cost_original', usage.provider_cost_original,
      'fx_rate_to_brl', usage.fx_rate_to_brl,
      'estimated_cost_brl', usage.estimated_cost_brl
    ) as value
    from public.usage_ledger usage
    cross join target
    cross join permissions
    where permissions.can_view_finance
      and usage.org_id = target.org_id
  ),
  capacity_rows as materialized (
    select jsonb_build_object(
      'active_count', capacity.active_count,
      'proactive_paused', capacity.proactive_paused,
      'updated_at', capacity.updated_at
    ) as value
    from public.operation_capacity capacity
    join allowed_operations operation on operation.id = capacity.operation_id
    cross join target
    where capacity.org_id = target.org_id
  ),
  settings_row as materialized (
    select jsonb_build_object(
      'ai_monthly_budget_brl', settings.ai_monthly_budget_brl
    ) as value
    from public.organization_settings settings
    cross join target
    where settings.org_id = target.org_id
      and exists (select 1 from access)
    limit 1
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'opportunities', coalesce((select jsonb_agg(value) from opportunity_rows), '[]'::jsonb),
    'campaignContacts', coalesce((select jsonb_agg(value) from campaign_contact_rows), '[]'::jsonb),
    'calls', coalesce((select jsonb_agg(value) from call_rows), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(value) from result_rows), '[]'::jsonb),
    'executions', coalesce((select jsonb_agg(value) from execution_rows), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(value) from usage_rows), '[]'::jsonb),
    'capacity', coalesce((select jsonb_agg(value) from capacity_rows), '[]'::jsonb),
    'settings', (select value from settings_row)
  );
$$;

revoke all on function public.reports_workspace_bootstrap(uuid) from public, anon;
grant execute on function public.reports_workspace_bootstrap(uuid) to authenticated, service_role;

commit;
