-- Keep every authenticated workspace navigation bounded to one fast database
-- round trip per screen. All SECURITY DEFINER contracts below resolve and
-- validate the caller through private.workspace_access_context before reading
-- base tables, preserving the existing organization and role boundaries.

begin;

create or replace function public.workspace_navigation_counts(
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
  inbox_count as materialized (
    select count(*)::integer as value
    from visible_conversations conversation
    cross join access
    left join public.conversation_read_states read_state
      on read_state.conversation_id = conversation.id
     and read_state.user_id = access.requesting_user_id
    where exists (
      select 1
      from public.messages message
      where message.conversation_id = conversation.id
        and message.direction = 'inbound'
        and message.created_at > coalesce(
          read_state.last_read_inbound_at,
          '-infinity'::timestamptz
        )
    )
    or exists (
      select 1
      from public.ai_suggestions suggestion
      where suggestion.conversation_id = conversation.id
        and suggestion.status = 'pending'
    )
  ),
  internal_counts as materialized (
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
    cross join target
    cross join access
    left join public.internal_thread_reads read_state
      on read_state.thread_id = thread.id
     and read_state.user_id = access.requesting_user_id
    where thread.org_id = target.org_id
      and thread.status not in ('resolved', 'archived')
      and (
        (
          thread.thread_type = 'broker_assistant'
          and thread.broker_membership_id = access.membership_id
        )
        or (
          thread.thread_type <> 'broker_assistant'
          and (
            access.support_read
            or access.membership_role in ('owner', 'manager')
            or exists (
              select 1
              from public.membership_permissions permission
              where permission.membership_id = access.membership_id
                and permission.permission = 'ai.manage'
            )
          )
        )
      )
      and (
        thread.requires_action
        or read_state.last_read_at is null
        or thread.updated_at > read_state.last_read_at
      )
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'inbox', coalesce((select value from inbox_count), 0),
    'pedro', coalesce((select pedro from internal_counts), 0),
    'lionel', coalesce((select lionel from internal_counts), 0),
    'broker', coalesce((select broker from internal_counts), 0)
  );
$$;

revoke all on function public.workspace_navigation_counts(uuid) from public, anon;
grant execute on function public.workspace_navigation_counts(uuid) to authenticated, service_role;

create or replace function public.agenda_workspace_bootstrap(
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
  visible_calls as materialized (
    select call.*
    from public.calls call
    cross join target
    cross join access
    where call.org_id = target.org_id
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
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'settings', (
      select to_jsonb(settings)
      from public.membership_call_settings settings
      cross join access
      where settings.membership_id = access.membership_id
      limit 1
    ),
    'rules', coalesce((
      select jsonb_agg(to_jsonb(rule) order by rule.weekday, rule.start_time)
      from public.availability_rules rule
      cross join access
      where rule.membership_id = access.membership_id
        and rule.active
    ), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(to_jsonb(future_exception) order by future_exception.starts_at)
      from (
        select availability_exception.*
        from public.availability_exceptions availability_exception
        cross join access
        where availability_exception.membership_id = access.membership_id
          and availability_exception.ends_at >= now()
        order by availability_exception.starts_at
        limit 20
      ) future_exception
    ), '[]'::jsonb),
    'calls', coalesce((
      select jsonb_agg(
        to_jsonb(call) || jsonb_build_object(
          'opportunities', case
            when opportunity.id is null then null
            else jsonb_build_object(
              'title', opportunity.title,
              'contacts', case
                when contact.id is null then null
                else jsonb_build_object('name', contact.name)
              end
            )
          end
        )
        order by call.starts_at
      )
      from (
        select visible_call.*
        from visible_calls visible_call
        order by visible_call.starts_at
        limit 50
      ) call
      left join visible_opportunities opportunity on opportunity.id = call.opportunity_id
      left join public.contacts contact on contact.id = opportunity.contact_id
    ), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(
        to_jsonb(offer) || jsonb_build_object(
          'calls', to_jsonb(call) || jsonb_build_object(
            'opportunities', case
              when opportunity.id is null then null
              else jsonb_build_object(
                'title', opportunity.title,
                'contacts', case
                  when contact.id is null then null
                  else jsonb_build_object('name', contact.name)
                end
              )
            end
          )
        )
        order by offer.expires_at
      )
      from public.call_offers offer
      join visible_calls call on call.id = offer.call_id
      cross join access
      left join visible_opportunities opportunity on opportunity.id = call.opportunity_id
      left join public.contacts contact on contact.id = opportunity.contact_id
      where offer.recipient_membership_id = access.membership_id
        and offer.status = 'pending'
    ), '[]'::jsonb),
    'opportunities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', opportunity.id,
          'title', opportunity.title,
          'version', opportunity.version,
          'contacts', jsonb_build_object('name', contact.name),
          'pipeline_stages', jsonb_build_object('code', stage.code, 'name', stage.name)
        )
        order by opportunity.last_activity_at desc
      )
      from (
        select opportunity.*
        from visible_opportunities opportunity
        where opportunity.status = 'open'
        order by opportunity.last_activity_at desc
        limit 50
      ) opportunity
      join public.contacts contact on contact.id = opportunity.contact_id
      join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.agenda_workspace_bootstrap(uuid) from public, anon;
grant execute on function public.agenda_workspace_bootstrap(uuid) to authenticated, service_role;

create or replace function public.kanban_workspace_bootstrap(
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
    join public.contacts contact
      on contact.id = opportunity.contact_id
     and contact.status = 'active'
    where opportunity.org_id = target.org_id
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'stages', coalesce((
      select jsonb_agg(to_jsonb(stage) order by stage.position)
      from public.pipeline_stages stage
      cross join target
      cross join access
      where stage.org_id = target.org_id
        and stage.is_active
    ), '[]'::jsonb),
    'opportunities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', opportunity.id,
          'status', opportunity.status,
          'source', opportunity.source,
          'last_activity_at', opportunity.last_activity_at,
          'pipeline_stage_id', opportunity.pipeline_stage_id,
          'assigned_membership_id', opportunity.assigned_membership_id,
          'unit_quantity', opportunity.unit_quantity,
          'amount_scope', opportunity.amount_scope,
          'contact_name', contact.name,
          'contact_status', contact.status,
          'primary_phone', phone.e164,
          'latest_score', score.score,
          'latest_score_explanation', score.explanation,
          'latest_score_created_at', score.created_at
        )
        order by opportunity.last_activity_at desc
      )
      from visible_opportunities opportunity
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
      ) score on true
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.kanban_workspace_bootstrap(uuid) from public, anon;
grant execute on function public.kanban_workspace_bootstrap(uuid) to authenticated, service_role;

create or replace function public.leads_workspace_bootstrap(
  p_archived boolean default false,
  p_search text default null,
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
  page_opportunities as materialized (
    select opportunity.*
    from public.opportunities opportunity
    join allowed_operations operation on operation.id = opportunity.operation_id
    cross join target
    cross join access
    join public.contacts contact on contact.id = opportunity.contact_id
    where opportunity.org_id = target.org_id
      and contact.status = case when p_archived then 'archived' else 'active' end
      and (
        nullif(btrim(p_search), '') is null
        or contact.name ilike '%' || left(btrim(p_search), 80) || '%'
      )
      and (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or opportunity.assigned_membership_id = access.membership_id
      )
    order by opportunity.last_activity_at desc
    limit 100
  ),
  can_manage_campaigns as materialized (
    select (
      access.support_read
      or access.membership_role = 'owner'
      or exists (
        select 1
        from public.membership_permissions permission
        where permission.membership_id = access.membership_id
          and permission.permission = 'campaigns.manage'
      )
    ) as value
    from access
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'opportunities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', opportunity.id,
          'status', opportunity.status,
          'source', opportunity.source,
          'version', opportunity.version,
          'last_activity_at', opportunity.last_activity_at,
          'assigned_membership_id', opportunity.assigned_membership_id,
          'contact_id', contact.id,
          'contact_name', contact.name,
          'contact_status', contact.status,
          'primary_phone', phone.e164,
          'stage_name', stage.name,
          'stage_code', stage.code,
          'stage_position', stage.position
        )
        order by opportunity.last_activity_at desc
      )
      from page_opportunities opportunity
      join public.contacts contact on contact.id = opportunity.contact_id
      join public.pipeline_stages stage on stage.id = opportunity.pipeline_stage_id
      left join lateral (
        select contact_phone.e164
        from public.contact_phones contact_phone
        where contact_phone.contact_id = contact.id
          and contact_phone.is_primary
          and contact_phone.status = 'active'
        limit 1
      ) phone on true
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', membership.id, 'role', membership.role)
        order by membership.created_at
      )
      from public.memberships membership
      cross join target
      cross join access
      where membership.org_id = target.org_id
        and membership.status = 'active'
        and (
          membership.user_id = access.requesting_user_id
          or access.can_manage_team
        )
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', campaign.id, 'name', campaign.name)
        order by campaign.created_at desc
      )
      from public.campaigns campaign
      cross join target
      cross join can_manage_campaigns permission
      where permission.value
        and campaign.org_id = target.org_id
        and campaign.status in ('draft', 'pending_approval', 'approved', 'paused')
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.leads_workspace_bootstrap(boolean, text, uuid) from public, anon;
grant execute on function public.leads_workspace_bootstrap(boolean, text, uuid) to authenticated, service_role;

create or replace function public.lead_contact_options(
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
  visible_contacts as materialized (
    select distinct opportunity.contact_id
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
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', contact.id,
      'name', contact.name,
      'contact_phones', coalesce(phone.rows, '[]'::jsonb)
    )
    order by contact.name
  ), '[]'::jsonb)
  from visible_contacts visible
  join public.contacts contact
    on contact.id = visible.contact_id
   and contact.status = 'active'
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'e164', contact_phone.e164,
        'is_primary', contact_phone.is_primary,
        'status', contact_phone.status
      )
      order by contact_phone.is_primary desc, contact_phone.created_at
    ) as rows
    from public.contact_phones contact_phone
    where contact_phone.contact_id = contact.id
  ) phone on true;
$$;

revoke all on function public.lead_contact_options(uuid) from public, anon;
grant execute on function public.lead_contact_options(uuid) to authenticated, service_role;

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
security definer
set search_path = ''
set jit = off
as $$
  with access as materialized (
    select access.*
    from private.workspace_access_context(p_org_id) access
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
  capabilities as materialized (
    select
      (
        access.support_read
        or access.membership_role = 'owner'
        or exists (
          select 1
          from public.membership_permissions permission
          where permission.membership_id = access.membership_id
            and permission.permission = 'campaigns.manage'
        )
      ) as can_view_campaigns,
      (
        access.support_read
        or access.membership_role in ('owner', 'manager')
      ) as can_view_health,
      (
        access.support_read
        or access.membership_role in ('owner', 'manager')
        or exists (
          select 1
          from public.membership_permissions permission
          where permission.membership_id = access.membership_id
            and permission.permission = 'ai.manage'
        )
      ) as can_view_internal
    from access
  ),
  latest_health as materialized (
    select distinct on (health.component)
      health.id,
      health.component,
      health.status,
      health.checked_at,
      health.error_redacted
    from public.integration_health_checks health
    cross join capabilities capability
    where capability.can_view_health
      and health.org_id = p_org_id
    order by health.component, health.checked_at desc
  ),
  all_records as materialized (
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
    cross join access
    where alert.org_id = p_org_id
      and alert.status <> 'resolved'
      and (
        alert.operation_id is null
        or exists (
          select 1 from allowed_operations operation where operation.id = alert.operation_id
        )
      )

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
    cross join access
    where notification.org_id = p_org_id
      and notification.recipient_membership_id = access.membership_id

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
    cross join access
    where escalation.org_id = p_org_id
      and escalation.status <> 'resolved'
      and exists (
        select 1 from allowed_operations operation where operation.id = escalation.operation_id
      )

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
    cross join access
    cross join capabilities capability
    where thread.org_id = p_org_id
      and thread.assistant_role in ('pedro', 'lionel')
      and thread.status <> 'archived'
      and (p_operation_id is null or thread.operation_id = p_operation_id)
      and (
        (
          thread.thread_type = 'broker_assistant'
          and thread.broker_membership_id = access.membership_id
        )
        or (
          thread.thread_type <> 'broker_assistant'
          and capability.can_view_internal
        )
      )
      and exists (
        select 1 from allowed_operations operation where operation.id = thread.operation_id
      )

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
    cross join access
    where call.org_id = p_org_id
      and call.status in ('awaiting_manager', 'awaiting_distribution', 'unassigned_alerted', 'assigned')
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
    cross join capabilities capability
    where capability.can_view_campaigns
      and campaign.org_id = p_org_id
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
  filtered_records as materialized (
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
  deduplicated_records as materialized (
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
  page_records as materialized (
    select record.*, count(*) over () as total_count
    from deduplicated_records record
    order by record.occurred_at desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from access),
    'total', coalesce(
      (select max(page.total_count) from page_records page),
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
    'records', coalesce((
      select jsonb_agg(
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
      )
      from page_records page
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.central_feed_page(uuid, uuid, text, integer, integer) from public, anon;
grant execute on function public.central_feed_page(uuid, uuid, text, integer, integer) to authenticated, service_role;

commit;
