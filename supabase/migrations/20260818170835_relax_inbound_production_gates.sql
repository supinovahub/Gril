begin;

-- The owner explicitly removed institutional completeness, recent provider
-- health and regression results from the inbound production activation gate.
-- Recipient allowlisting remains a separate, mandatory defense at activation,
-- execution claim and final outbound insertion.
create or replace function private.enforce_ai_production_readiness()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
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

  -- Health checks remain observable, but their timestamp and last result no
  -- longer decide activation. A live inbound connection is still required.
  if not exists (
    select 1 from public.whatsapp_connections w
    where w.org_id = new.org_id
      and w.status = 'active'
      and w.inbound_enabled
  ) then
    raise exception 'production_channel_inactive' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_ai_production_readiness()
  from public, anon, authenticated, service_role;

commit;
