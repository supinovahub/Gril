begin;

-- A current, explicit user decision restores normal inbound production, but
-- only for recipients whose active phone is present in ai_test_allowlist.
-- Keeping the organization switch separate from the list means adding a test
-- number never enables automatic replies by itself.
alter table public.organization_settings
  drop constraint if exists organization_settings_inbound_no_production_check,
  drop constraint if exists organization_settings_inbound_ai_mode_check;

alter table public.organization_settings
  add constraint organization_settings_inbound_ai_mode_check
    check (inbound_ai_mode in ('off', 'shadow', 'assisted', 'production'));

-- The dashboard is the normal entry point, but the database also refuses a
-- transition to production while the organization has no active test number.
-- All pre-existing readiness gates remain mandatory.
create or replace function private.enforce_ai_production_readiness()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile jsonb;
  v_run public.regression_runs%rowtype;
begin
  if new.ai_global_mode <> 'production'
     and new.inbound_ai_mode <> 'production' then
    return new;
  end if;

  if new.ai_global_mode <> 'production'
     or new.inbound_ai_mode <> 'production' then
    raise exception 'production_inbound_modes_must_match' using errcode = '22023';
  end if;

  if old.ai_global_mode = 'production'
     and old.inbound_ai_mode = 'production' then
    return new;
  end if;

  if not exists (
    select 1
    from public.ai_test_allowlist a
    where a.org_id = new.org_id
      and a.active
  ) then
    raise exception 'production_allowlist_empty' using errcode = '22023';
  end if;

  v_profile := coalesce(new.institutional_profile, '{}'::jsonb);
  if nullif(trim(v_profile->>'company_name'), '') is null
     or nullif(trim(v_profile->>'creci'), '') is null
     or nullif(trim(v_profile->>'privacy_contact'), '') is null
     or nullif(trim(v_profile->>'source_name'), '') is null
     or nullif(trim(v_profile->>'valid_until'), '') is null then
    raise exception 'production_institutional_profile_incomplete' using errcode = '22023';
  end if;

  if not exists (
       select 1
       from public.persona_versions pv
       join public.personas p on p.id = pv.persona_id
       where p.org_id = new.org_id and pv.status = 'published'
     )
     or not exists (
       select 1
       from public.rule_versions rv
       join public.rule_sets rs on rs.id = rv.rule_set_id
       where rs.org_id = new.org_id and rv.status = 'published'
     )
     or not exists (
       select 1 from public.qualification_definitions q
       where q.org_id = new.org_id and q.active and q.required
     )
     or not exists (
       select 1 from public.projects p
       where p.org_id = new.org_id
         and p.status = 'active'
         and p.recommendable
         and (p.valid_until is null or p.valid_until >= current_date)
     ) then
    raise exception 'production_knowledge_or_rules_incomplete' using errcode = '22023';
  end if;

  if not exists (
       select 1 from public.model_profiles m
       where m.org_id = new.org_id
         and m.status = 'active'
         and m.is_default
         and m.integration_account_id is not null
     )
     or new.fallback_model_profile_id is null
     or not exists (
       select 1 from public.model_profiles m
       where m.id = new.fallback_model_profile_id
         and m.org_id = new.org_id
         and m.integration_account_id is not null
     ) then
    raise exception 'production_models_incomplete' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.whatsapp_connections w
    where w.org_id = new.org_id
      and w.status = 'active'
      and w.inbound_enabled
      and w.last_health_at >= now() - interval '15 minutes'
      and w.last_error_redacted is null
  ) then
    raise exception 'production_channel_unhealthy' using errcode = '22023';
  end if;

  select * into v_run
  from public.regression_runs
  where org_id = new.org_id and status = 'passed'
  order by completed_at desc nulls last
  limit 1;

  if not found
     or v_run.total_cases < 100
     or v_run.passed_cases::numeric / greatest(v_run.total_cases, 1) < 0.90
     or v_run.critical_failures <> 0 then
    raise exception 'production_regression_gate_failed' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_ai_production_readiness()
  from public, anon, authenticated, service_role;

drop trigger if exists organization_settings_production_gate
  on public.organization_settings;
create trigger organization_settings_production_gate
before update of ai_global_mode, inbound_ai_mode on public.organization_settings
for each row execute function private.enforce_ai_production_readiness();

-- Keep the reactivation release contract intact while restoring the final
-- allowlist defense for normal inbound production.
create or replace function private.enforce_pedro_inbound_allowlist()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_conversation public.conversations%rowtype;
begin
  if new.direction <> 'outbound' or new.sender_type <> 'ai' then
    return new;
  end if;

  select * into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if not found or v_conversation.ai_mode <> 'production' then
    return new;
  end if;

  if v_conversation.journey = 'inbound' then
    if not private.is_ai_inbound_recipient_allowlisted(
      v_conversation.org_id,
      v_conversation.operation_id,
      v_conversation.contact_id
    ) then
      raise exception 'production_recipient_not_allowlisted' using errcode = '22023';
    end if;
    return new;
  end if;

  if v_conversation.journey = 'reactivation' then
    if not private.is_reactivation_production_allowed(v_conversation.id) then
      raise exception 'reactivation_production_not_released' using errcode = '22023';
    end if;
    return new;
  end if;

  raise exception 'production_journey_not_allowed' using errcode = '22023';
end;
$$;

revoke all on function private.enforce_pedro_inbound_allowlist()
  from public, anon, authenticated, service_role;

commit;
