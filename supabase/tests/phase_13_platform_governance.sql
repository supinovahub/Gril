begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(25);

select extensions.has_table('public', 'access_requests', 'public access request workflow exists');
select extensions.has_table('private', 'platform_principals', 'platform principals are private');
select extensions.has_table('private', 'platform_account_invitations', 'platform invitations are private');
select extensions.has_table('private', 'organization_creation_preauthorizations', 'organization preauthorizations are private');
select extensions.has_table('private', 'contractual_support_grants', 'contractual support grants are private');
select extensions.has_table('private', 'platform_notifications', 'platform notifications are private');
select extensions.has_table('private', 'platform_push_subscriptions', 'platform push subscriptions are private');

select extensions.ok(
  exists(select 1 from pg_constraint where conname = 'organizations_status_check'),
  'organization lifecycle status is constrained'
);
select extensions.ok(
  exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'access_requests_one_open_per_user_idx'),
  'only one open access request per user is enforced'
);
select extensions.ok(
  exists(
    select 1 from pg_constraint
    where conrelid = 'private.organization_join_codes'::regclass and contype = 'u'
  ),
  'organization join codes are unique'
);
select extensions.ok(
  not exists(select 1 from public.invitation_links where kind = 'general' and status = 'active'),
  'general invitation links are removed'
);

select extensions.has_function('public', 'lookup_organization_join_code', array['text'], 'join code lookup exists');
select extensions.has_function('public', 'submit_access_request', array['text','text','text','text','text','text','text','text','text','integer','text'], 'request submission exists');
select extensions.has_function('public', 'decide_access_request', array['uuid','text','text','uuid[]','text','text','text'], 'request decision exists');
select extensions.has_function('public', 'rotate_organization_join_code', array['text','text','text'], 'join code rotation exists');
select extensions.has_function('public', 'platform_control_snapshot', array[]::text[], 'platform control snapshot exists');
select extensions.has_function('public', 'platform_control_organization', array['uuid','text','text','text','text'], 'organization control exists');
select extensions.has_function('public', 'platform_control_user', array['uuid','text','text','text','text'], 'user control exists');
select extensions.has_function('public', 'platform_manage_support_grant', array['uuid','text','text','text','timestamp with time zone','text'], 'support grant control exists');
select extensions.has_function('public', 'revoke_external_support_access', array['text'], 'tenant support revocation exists');
select extensions.has_function('private', 'valid_typed_confirmation', array['text'], 'encoding-safe typed confirmation exists');

select extensions.ok(
  position('approve_30_days' in pg_get_functiondef('public.decide_access_request(uuid,text,text,uuid[],text,text,text)'::regprocedure)) > 0,
  'organization requests support permanent and temporary approval'
);
select extensions.ok(
  position('approval_expires_at is null' in lower(pg_get_functiondef('private.process_organization_bootstrap_request()'::regprocedure))) > 0,
  'permanent approval can bootstrap an organization'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.access_requests'::regclass),
  'access requests use RLS'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.lookup_organization_join_code(text)', 'execute')
  and not has_function_privilege('anon', 'public.lookup_organization_join_code(text)', 'execute'),
  'join code lookup is authenticated only'
);

select * from extensions.finish();
rollback;
