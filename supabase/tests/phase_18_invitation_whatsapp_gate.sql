begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(16);

create temporary table _tap_results (
  n integer primary key,
  tap text not null
) on commit drop;
grant select, insert on _tap_results to anon, authenticated;

insert into _tap_results values
  (1, extensions.ok(
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'profiles_whatsapp_e164_unique_idx'
    ),
    'profile WhatsApp is unique when present'
  )),
  (2, extensions.has_function(
    'public', 'invitation_preview', array['text'],
    'bounded invitation preview exists'
  )),
  (3, extensions.has_function(
    'public', 'update_member_whatsapp', array['uuid', 'text'],
    'authorized member WhatsApp update exists'
  ));

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('19000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'invite-owner@invalid.test', '', now(), '{}', '{"full_name":"Invite Owner"}', now(), now()),
  ('19000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'invite-recipient@invalid.test', '', now(), '{}', '{"full_name":"Invite Recipient"}', now(), now()),
  ('19000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'blocked-broker@invalid.test', '', now(), '{}', '{"full_name":"Blocked Broker"}', now(), now());

update public.profiles
set whatsapp_e164 = '+5511966666666'
where user_id = '19000000-0000-0000-0000-000000000002';

insert into public.organizations (id, name, slug)
values ('29000000-0000-0000-0000-000000000001', 'Invitation Gate Org', 'invitation-gate-org');

insert into public.operations (id, org_id, name, slug, is_default)
values (
  '39000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  'Invitation Operation',
  'invitation-operation',
  true
);

insert into public.memberships (id, org_id, user_id, role, status, approved_at)
values
  ('49000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('49000000-0000-0000-0000-000000000003', '29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000003', 'broker', 'active', now());

insert into public.membership_operations (membership_id, operation_id, org_id)
values (
  '49000000-0000-0000-0000-000000000003',
  '39000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001'
);

insert into public.invitation_links (
  id, org_id, operation_id, kind, email, role, token_hash,
  expires_at, max_uses, created_by
)
values (
  '59000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  '39000000-0000-0000-0000-000000000001',
  'individual',
  'invite-recipient@invalid.test',
  'broker',
  repeat('a', 64),
  now() + interval '7 days',
  1,
  '19000000-0000-0000-0000-000000000001'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

insert into _tap_results
select 4, extensions.is(invitation_status, 'active', 'anonymous preview reports active status')
from public.invitation_preview(repeat('a', 64));
insert into _tap_results
select 5, extensions.is(organization_name, 'Invitation Gate Org', 'anonymous preview exposes organization name')
from public.invitation_preview(repeat('a', 64));
insert into _tap_results
select 6, extensions.is(invited_email_masked, null, 'anonymous preview never exposes the invited email')
from public.invitation_preview(repeat('a', 64));
insert into _tap_results
select 7, extensions.is(operation_name, null, 'anonymous preview hides the broker operation')
from public.invitation_preview(repeat('a', 64));

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

insert into _tap_results
select 8, extensions.is(
  (select count(*)::bigint from public.organizations),
  0::bigint,
  'active broker without WhatsApp is blocked by RLS'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select public.update_member_whatsapp(
  '49000000-0000-0000-0000-000000000003',
  '+5511977777777'
);

insert into _tap_results
select 9, extensions.is(
  (select whatsapp_e164 from public.profiles where user_id = '19000000-0000-0000-0000-000000000003'),
  '+5511977777777',
  'owner can set the broker WhatsApp'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into _tap_results
select 10, extensions.ok(email_matches, 'authenticated matching email is recognized')
from public.invitation_preview(repeat('a', 64));
insert into _tap_results
select 11, extensions.is(operation_name, 'Invitation Operation', 'matching recipient sees the broker operation')
from public.invitation_preview(repeat('a', 64));

insert into public.invitation_claims (
  invitation_link_id, org_id, token_hash, user_id
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  repeat('a', 64),
  '19000000-0000-0000-0000-000000000002'
);

insert into _tap_results
select 12, extensions.ok(
  exists (
    select 1 from public.memberships
    where user_id = '19000000-0000-0000-0000-000000000002'
      and role = 'broker'
      and status = 'active'
  ),
  'individual invitation activates the broker immediately'
);

reset role;

insert into _tap_results values
  (13, extensions.is(
    (select status from public.invitation_links where id = '59000000-0000-0000-0000-000000000001'),
    'exhausted',
    'accepted invitation is exhausted atomically'
  )),
  (14, extensions.ok(
    exists (
      select 1 from public.notifications
      where recipient_membership_id = '49000000-0000-0000-0000-000000000001'
        and title = 'Convite aceito'
        and channel = 'app'
    ),
    'owner receives an in-app acceptance notification'
  )),
  (15, extensions.ok(
    exists (
      select 1 from audit.events
      where action = 'invitation.accepted'
        and entity_id = '59000000-0000-0000-0000-000000000001'
        and actor_user_id = '19000000-0000-0000-0000-000000000002'
    ),
    'invitation acceptance is audited'
  )),
  (16, extensions.ok(
    exists (
      select 1 from audit.events
      where action = 'profile.whatsapp_updated'
        and entity_id = '19000000-0000-0000-0000-000000000003'
        and actor_user_id = '19000000-0000-0000-0000-000000000001'
    ),
    'administrative WhatsApp change is audited'
  ));

select tap from _tap_results order by n;
select * from extensions.finish();

rollback;
