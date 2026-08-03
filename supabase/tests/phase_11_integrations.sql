begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
create temporary table _tap_results (n integer primary key, tap text not null) on commit drop;
grant select, insert on _tap_results to authenticated;
create temporary table _integration_ids (kind text primary key, id uuid not null) on commit drop;
grant select, insert on _integration_ids to service_role;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('18000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'integration-owner@invalid.test', '', now(), '{}', '{"full_name":"Integration Owner"}', now(), now()),
  ('18000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'integration-broker@invalid.test', '', now(), '{}', '{"full_name":"Integration Broker"}', now(), now());

update public.profiles set whatsapp_e164 = '+5511988000082'
where user_id = '18000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('28000000-0000-0000-0000-000000000001', 'Integration Gate Org', 'integration-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values ('38000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', 'Integration Gate Operation', 'integration-gate-op', true);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('48000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('48000000-0000-0000-0000-000000000002', '28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000002', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values ('48000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000001', '28000000-0000-0000-0000-000000000001');

set local role service_role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);

insert into _integration_ids (kind, id)
values (
  'openai',
  public.store_openai_integration(
    '28000000-0000-0000-0000-000000000001',
    '18000000-0000-0000-0000-000000000001',
    'sk-...gate', 'gate-openai-secret', 12, 3
  )
);

insert into _integration_ids (kind, id)
values (
  'uazapi_connection',
  public.store_whatsapp_integration(
    '28000000-0000-0000-0000-000000000001',
    '38000000-0000-0000-0000-000000000001',
    '18000000-0000-0000-0000-000000000001',
    'uazapi', 'Gate Uazapi', 'https://uazapi.invalid', 'gate-instance', null, null,
    '+5511999990050', 'Gate Profile', 'token-...gate', 'gate-uazapi-secret',
    '{"instance_status":"connected"}', 18
  )
);

reset role;

insert into _tap_results (n, tap)
select * from (
  select 1, extensions.is(
    (select count(*)::bigint from public.integration_accounts where org_id='28000000-0000-0000-0000-000000000001' and status='verified'),
    2::bigint,
    'owner self-service creates verified OpenAI and Uazapi accounts'
  )
  union all
  select 2, extensions.ok(
    not exists(
      select 1 from public.integration_accounts
      where org_id='28000000-0000-0000-0000-000000000001'
        and (metadata::text like '%gate-openai-secret%' or metadata::text like '%gate-uazapi-secret%')
    ),
    'public integration metadata never contains provider secrets'
  )
  union all
  select 3, extensions.is(
    (select count(*)::bigint from private.integration_secret_bindings b join public.integration_accounts a on a.id=b.integration_account_id where a.org_id='28000000-0000-0000-0000-000000000001'),
    2::bigint,
    'each integration has one private Vault binding'
  )
  union all
  select 4, extensions.is(
    (select count(*)::bigint
     from vault.decrypted_secrets s
     join private.integration_secret_bindings b on b.vault_secret_id=s.id
     join public.integration_accounts a on a.id=b.integration_account_id
     where a.org_id='28000000-0000-0000-0000-000000000001'
       and s.decrypted_secret in ('gate-openai-secret','gate-uazapi-secret')),
    2::bigint,
    'provider secrets are stored only in Vault'
  )
  union all
  select 5, extensions.ok(
    (select status='draft' and not inbound_enabled and not campaign_enabled
     from public.whatsapp_connections
     where id=(select id from _integration_ids where kind='uazapi_connection')),
    'new WhatsApp integration remains disabled until explicit activation'
  )
  union all
  select 6, extensions.ok(
    (select count(*)>0 from public.model_profiles
     where org_id='28000000-0000-0000-0000-000000000001'
       and integration_account_id=(select id from _integration_ids where kind='openai')
       and secret_reference='vault:'||(select id::text from _integration_ids where kind='openai')),
    'OpenAI profiles reference the verified account without embedding its key'
  )
  union all
  select 7, extensions.ok(
    not has_function_privilege('authenticated','public.store_openai_integration(uuid,uuid,text,text,integer,integer)','execute')
    and not has_function_privilege('authenticated','public.get_integration_secret(uuid)','execute')
    and not has_function_privilege('anon','public.revoke_integration_account(uuid,uuid,uuid)','execute')
    and not has_schema_privilege('authenticated','vault','usage'),
    'secret functions and Vault are service-role only'
  )
) integration_assertions
order by 1;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"18000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (8, extensions.is(
  (select count(*)::bigint from public.integration_accounts),
  2::bigint,
  'owner can read masked integration account metadata'
));

select set_config('request.jwt.claims', '{"sub":"18000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
insert into _tap_results (n, tap)
values (9, extensions.is(
  (select count(*)::bigint from public.integration_accounts),
  0::bigint,
  'broker cannot read or manage integration accounts'
));

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);
select public.revoke_integration_account(
  (select integration_account_id from public.whatsapp_connections where id=(select id from _integration_ids where kind='uazapi_connection')),
  '28000000-0000-0000-0000-000000000001',
  '18000000-0000-0000-0000-000000000001'
);

reset role;
insert into _tap_results (n, tap)
select * from (
  select 10, extensions.is(
    (select count(*)::bigint
     from vault.decrypted_secrets s
     join private.integration_secret_bindings b on b.vault_secret_id=s.id
     where b.integration_account_id=(select integration_account_id from public.whatsapp_connections where id=(select id from _integration_ids where kind='uazapi_connection'))),
    0::bigint,
    'revocation deletes the provider secret and private binding'
  )
  union all
  select 11, extensions.ok(
    (select status='revoked' and not inbound_enabled and not campaign_enabled and secret_reference is null
     from public.whatsapp_connections
     where id=(select id from _integration_ids where kind='uazapi_connection')),
    'revocation disables the WhatsApp connection'
  )
  union all
  select 12, extensions.is(
    (select status from public.integration_accounts where id=(select integration_account_id from public.whatsapp_connections where id=(select id from _integration_ids where kind='uazapi_connection'))),
    'revoked'::text,
    'revocation leaves an auditable revoked account record'
  )
) revocation_assertions
order by 1;

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
