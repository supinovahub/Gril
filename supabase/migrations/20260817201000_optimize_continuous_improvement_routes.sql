begin;

create or replace function public.learnings_workspace_bootstrap(
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
  permission_gate as materialized (
    select target.org_id
    from target
    where target.org_id is not null
      and (select private.has_org_permission(target.org_id, 'ai.manage'))
  )
  select jsonb_build_object(
    'authorized', exists(select 1 from permission_gate),
    'newSignalCount', coalesce((
      select count(*)::integer
      from public.ai_feedback_signals signal
      cross join permission_gate gate
      where signal.org_id = gate.org_id
        and signal.status = 'new'
    ), 0),
    'activeCaseCount', coalesce((
      select count(*)::integer
      from public.regression_cases regression_case
      cross join permission_gate gate
      where regression_case.org_id = gate.org_id
        and regression_case.active
    ), 0),
    'suggestions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at desc)
      from (
        select
          suggestion.id,
          suggestion.source,
          suggestion.observed_response,
          suggestion.human_observation,
          suggestion.suggested_change,
          suggestion.scope,
          suggestion.status,
          suggestion.candidate_kind,
          suggestion.conflict_details,
          suggestion.target_skill_module_id,
          suggestion.feedback_cluster_id,
          suggestion.draft_rule_version_id,
          suggestion.created_at
        from public.learning_suggestions suggestion
        cross join permission_gate gate
        where suggestion.org_id = gate.org_id
        order by suggestion.created_at desc
        limit 80
      ) item
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at desc)
      from (
        select
          run.id,
          run.rule_version_id,
          run.status,
          run.total_cases,
          run.passed_cases,
          run.critical_failures,
          run.created_at
        from public.regression_runs run
        cross join permission_gate gate
        where run.org_id = gate.org_id
        order by run.created_at desc
        limit 30
      ) item
    ), '[]'::jsonb),
    'clusters', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.last_seen_at desc)
      from (
        select
          cluster.id,
          cluster.title,
          cluster.failure_family,
          cluster.root_cause_layer,
          cluster.severity,
          cluster.confidence,
          cluster.status,
          cluster.observed_pattern,
          cluster.proposed_change,
          cluster.target_skill_code,
          cluster.target_skill_module_id,
          cluster.occurrence_count,
          cluster.evidence_count,
          cluster.last_seen_at
        from public.ai_feedback_clusters cluster
        cross join permission_gate gate
        where cluster.org_id = gate.org_id
        order by cluster.last_seen_at desc
        limit 50
      ) item
    ), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.name)
      from (
        select
          module.id,
          module.code,
          module.name,
          module.category,
          module.description,
          module.status,
          module.created_at
        from public.ai_skill_modules module
        cross join permission_gate gate
        where module.org_id = gate.org_id
          and module.status = 'active'
        order by module.name
      ) item
    ), '[]'::jsonb),
    'skillVersions', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.module_id, item.version desc)
      from (
        select distinct on (version.module_id)
          version.id,
          version.module_id,
          version.version,
          version.status,
          version.instructions,
          version.trigger_config,
          version.created_at,
          version.published_at
        from public.ai_skill_versions version
        join public.ai_skill_modules module
          on module.id = version.module_id
         and module.org_id = version.org_id
         and module.status = 'active'
        cross join permission_gate gate
        where version.org_id = gate.org_id
        order by version.module_id, version.version desc
      ) item
    ), '[]'::jsonb),
    'drafts', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.version desc)
      from (
        select version.id, version.version, version.status, version.created_at
        from public.rule_versions version
        cross join permission_gate gate
        where version.org_id = gate.org_id
          and version.status = 'draft'
        order by version.version desc
      ) item
    ), '[]'::jsonb),
    'reviewRuns', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at desc)
      from (
        select
          review.id,
          review.source,
          review.status,
          review.signal_count,
          review.finding_count,
          review.model_returned,
          review.error_redacted,
          review.created_at,
          review.completed_at
        from public.ai_review_runs review
        cross join permission_gate gate
        where review.org_id = gate.org_id
        order by review.created_at desc
        limit 12
      ) item
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.learnings_workspace_bootstrap(uuid) from public, anon;
grant execute on function public.learnings_workspace_bootstrap(uuid) to authenticated, service_role;

commit;
