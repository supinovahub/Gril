begin;

create table public.membership_call_settings (
  membership_id uuid primary key,
  org_id uuid not null,
  operation_id uuid not null,
  can_receive_calls boolean not null default false,
  is_preferred_receiver boolean not null default false,
  receive_urgent_call_alerts boolean not null default false,
  temporary_unavailable_from timestamptz,
  temporary_unavailable_until timestamptz,
  unavailable_reason text,
  version integer not null default 1 check (version>0),
  updated_at timestamptz not null default now(),
  foreign key (membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  check (temporary_unavailable_until is null or temporary_unavailable_from is not null),
  check (temporary_unavailable_until is null or temporary_unavailable_until>temporary_unavailable_from)
);

create unique index membership_call_settings_operation_membership_idx on public.membership_call_settings(operation_id,membership_id);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  membership_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Sao_Paulo',
  valid_from date not null default current_date,
  valid_until date,
  capacity smallint not null default 1 check (capacity between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  unique (id,org_id),
  check (end_time>start_time),
  check (valid_until is null or valid_until>=valid_from)
);

create index availability_rules_lookup_idx on public.availability_rules(operation_id,membership_id,weekday,start_time,end_time) where active;

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  membership_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  availability text not null check (availability in ('available','unavailable')),
  reason text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  foreign key (membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  check (ends_at>starts_at)
);

create index availability_exceptions_lookup_idx on public.availability_exceptions(membership_id,starts_at,ends_at);

create table public.call_holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  opportunity_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  preferred_format text not null default 'unknown' check (preferred_format in ('video','phone','unknown')),
  status text not null default 'active' check (status in ('active','confirmed','expired','cancelled','escalated')),
  expires_at timestamptz not null,
  lead_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete restrict,
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete restrict,
  unique (id,org_id),
  check (ends_at=starts_at+interval '20 minutes'),
  check (expires_at<=starts_at)
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,
  hold_id uuid not null,
  opportunity_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  status text not null default 'awaiting_distribution' check (status in ('awaiting_distribution','awaiting_manager','distributing','assigned','unassigned_alerted','completed','no_show','cancelled')),
  format text not null default 'unknown' check (format in ('video','phone','unknown')),
  assigned_membership_id uuid,
  video_link text,
  nominal_membership_id uuid,
  nominal_substitution_allowed boolean not null default false,
  reschedule_count smallint not null default 0 check (reschedule_count between 0 and 20),
  version integer not null default 1 check (version>0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete restrict,
  foreign key (hold_id,org_id) references public.call_holds(id,org_id) on delete restrict,
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete restrict,
  foreign key (assigned_membership_id,org_id) references public.memberships(id,org_id) on delete restrict,
  foreign key (nominal_membership_id,org_id) references public.memberships(id,org_id) on delete restrict,
  unique (id,org_id),
  check (ends_at=starts_at+interval '20 minutes'),
  check (blocked_until=starts_at+interval '30 minutes'),
  check ((status='assigned' and assigned_membership_id is not null) or status<>'assigned')
);

create index calls_schedule_idx on public.calls(operation_id,starts_at,status);
create index calls_assignee_schedule_idx on public.calls(assigned_membership_id,starts_at) where assigned_membership_id is not null and status in ('assigned','completed');

create table public.call_offers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,
  recipient_membership_id uuid not null,
  round smallint not null check (round>0),
  offer_type text not null check (offer_type in ('preferred','sequential','broadcast','nominal')),
  status text not null default 'scheduled' check (status in ('scheduled','pending','accepted','declined','expired','lost_race','cancelled')),
  sent_at timestamptz,
  expires_at timestamptz not null,
  provider_response jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (call_id,org_id) references public.calls(id,org_id) on delete cascade,
  foreign key (recipient_membership_id,org_id) references public.memberships(id,org_id) on delete cascade,
  unique (call_id,recipient_membership_id,round),
  unique (id,org_id),
  check ((status='pending' and sent_at is not null) or status<>'pending')
);

create index call_offers_recipient_idx on public.call_offers(recipient_membership_id,status,expires_at);

create table public.call_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,
  membership_id uuid not null,
  offer_id uuid,
  assignment_type text not null check (assignment_type in ('accepted','manager','nominal')),
  active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  foreign key (call_id,org_id) references public.calls(id,org_id) on delete restrict,
  foreign key (membership_id,org_id) references public.memberships(id,org_id) on delete restrict,
  foreign key (offer_id,org_id) references public.call_offers(id,org_id) on delete restrict,
  unique (id,org_id),
  check ((active and revoked_at is null) or (not active and revoked_at is not null))
);

create unique index call_assignments_one_active_call_idx on public.call_assignments(call_id) where active;

create table public.call_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,
  result text not null check (result in ('start_negotiation','lost','no_show','no_result','reschedule')),
  reason text,
  context text,
  next_action text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  foreign key (call_id,org_id) references public.calls(id,org_id) on delete restrict,
  unique (call_id)
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  operation_id uuid not null,
  stage_code text not null check (stage_code in ('negotiation','proposal','documentation','payment','won')),
  name text not null,
  version integer not null default 1 check (version>0),
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  foreign key (operation_id,org_id) references public.operations(id,org_id) on delete cascade,
  unique (operation_id,stage_code,version),
  unique (id,org_id)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null,
  position smallint not null check (position>0),
  label text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (template_id,org_id) references public.checklist_templates(id,org_id) on delete cascade,
  unique (template_id,position)
);

create table public.opportunity_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null,
  template_id uuid not null,
  template_version integer not null,
  items_snapshot jsonb not null,
  completion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (opportunity_id,org_id) references public.opportunities(id,org_id) on delete cascade,
  foreign key (template_id,org_id) references public.checklist_templates(id,org_id) on delete restrict,
  unique (opportunity_id,template_id)
);

create table public.call_settings_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,membership_id uuid not null,can_receive_calls boolean not null,is_preferred_receiver boolean not null default false,
  receive_urgent_call_alerts boolean not null default false,actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.call_creation_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  operation_id uuid not null,opportunity_id uuid not null,starts_at timestamptz not null,format text not null,
  lead_confirmed boolean not null,expected_opportunity_version integer not null,actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  call_id uuid,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.call_distribution_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  offer_count smallint not null default 0,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.call_offer_accept_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,offer_id uuid not null,expected_call_version integer not null,actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  assignment_id uuid,result text,processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create table public.call_result_requests (
  id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete restrict,
  call_id uuid not null,result text not null,reason text,context text,next_action text,expected_call_version integer not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),call_result_id uuid,
  processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);

create trigger membership_call_settings_set_updated_at before update on public.membership_call_settings for each row execute function private.set_updated_at();
create trigger availability_rules_set_updated_at before update on public.availability_rules for each row execute function private.set_updated_at();
create trigger calls_set_updated_at before update on public.calls for each row execute function private.set_updated_at();
create trigger opportunity_checklists_set_updated_at before update on public.opportunity_checklists for each row execute function private.set_updated_at();

commit;
