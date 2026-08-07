begin;

alter table public.conversation_access_grants
  add column revoked_by uuid references auth.users(id) on delete set null;

comment on column public.conversation_access_grants.revoked_by is
  'User who revoked the operational conversation access grant.';

commit;
