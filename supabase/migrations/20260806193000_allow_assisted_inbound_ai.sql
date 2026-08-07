begin;

-- The inbound allowlist is a production safety gate. Shadow and assisted
-- conversations must still be able to create model turns for homologation;
-- the final outbound trigger and worker claim guard continue to protect only
-- production executions.
create or replace function private.is_conversation_ai_eligible(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    join public.contacts ct on ct.id = c.contact_id
    join public.organization_settings os on os.org_id = c.org_id
    where c.id = p_conversation_id
      and c.status = 'active'
      and c.ownership = 'ai'
      and c.pause_reason is null
      and c.ai_mode <> 'off'
      and os.ai_global_mode = c.ai_mode
      and os.ai_global_mode <> 'off'
      and ct.status = 'active'
      and (
        c.journey <> 'inbound'
        or c.ai_mode <> 'production'
        or private.is_ai_inbound_recipient_allowlisted(c.org_id, c.operation_id, c.contact_id)
      )
      and not exists (
        select 1
        from public.opt_outs oo
        where oo.operation_id = c.operation_id
          and oo.contact_id = c.contact_id
          and oo.revoked_at is null
      )
      and not exists (
        select 1
        from public.contact_phones cp
        join public.suppression_entries se
          on se.operation_id = c.operation_id
         and se.phone_e164 = cp.e164
         and se.revoked_at is null
         and (se.expires_at is null or se.expires_at > now())
        where cp.contact_id = c.contact_id
          and cp.status = 'active'
      )
  );
$$;

revoke all on function private.is_conversation_ai_eligible(uuid)
  from public, anon, authenticated, service_role;

commit;
