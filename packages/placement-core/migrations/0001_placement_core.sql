-- PlacementOS first persistence boundary.
-- This migration is intentionally additive and framework-neutral.
-- Apply only to the intended PlacementOS Supabase project after project selection/review.

create table if not exists placement_organizations (
  id text primary key,
  type text not null check (type in ('STAFFING_AGENCY','EMPLOYER','PLATFORM','PARTNER')),
  legal_name text not null,
  display_name text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_memberships (
  id text primary key,
  user_id text not null,
  organization_id text not null references placement_organizations(id) on delete cascade,
  role text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists placement_jobs (
  id text primary key,
  employer_id text not null references placement_organizations(id),
  agency_id text references placement_organizations(id),
  title text not null,
  openings integer not null check (openings > 0),
  location text not null,
  pay_min numeric(12,2) not null check (pay_min >= 0),
  pay_max numeric(12,2) not null check (pay_max >= pay_min),
  currency text not null default 'USD',
  shift text not null,
  starts_at timestamptz not null,
  requirements jsonb not null default '[]'::jsonb,
  status text not null default 'DRAFT',
  source jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_referrals (
  id text primary key,
  worker_id text not null,
  job_id text not null references placement_jobs(id),
  agency_id text not null references placement_organizations(id),
  consent_id text not null,
  match jsonb not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_placements (
  id text primary key,
  referral_id text not null references placement_referrals(id),
  worker_id text not null,
  agency_id text not null references placement_organizations(id),
  employer_id text not null references placement_organizations(id),
  job_id text not null references placement_jobs(id),
  agreed_pay_rate numeric(12,2) not null check (agreed_pay_rate >= 0),
  currency text not null default 'USD',
  starts_at timestamptz not null,
  status text not null default 'PROPOSED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_assignments (
  id text primary key,
  placement_id text not null references placement_placements(id),
  schedule text not null,
  supervisor_id text,
  status text not null default 'SCHEDULED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_timesheets (
  id text primary key,
  assignment_id text not null references placement_assignments(id),
  worker_id text not null,
  period_start date not null,
  period_end date not null,
  hours numeric(8,2) not null check (hours >= 0),
  status text not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists placement_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id text,
  organization_id text references placement_organizations(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists placement_memberships_user_idx on placement_memberships(user_id, status);
create index if not exists placement_memberships_org_idx on placement_memberships(organization_id, status);
create index if not exists placement_jobs_employer_idx on placement_jobs(employer_id, status);
create index if not exists placement_jobs_agency_idx on placement_jobs(agency_id, status);
create index if not exists placement_referrals_job_idx on placement_referrals(job_id, status);
create index if not exists placement_referrals_worker_idx on placement_referrals(worker_id, status);
create index if not exists placement_placements_worker_idx on placement_placements(worker_id, status);
create index if not exists placement_assignments_placement_idx on placement_assignments(placement_id, status);
create index if not exists placement_timesheets_assignment_idx on placement_timesheets(assignment_id, status);
create index if not exists placement_audit_entity_idx on placement_audit_events(entity_type, entity_id, created_at desc);

-- Tenant helper: authenticated users can only operate in organizations where they have an active membership.
create or replace function placement_is_member(target_org text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from placement_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()::text
      and m.status = 'ACTIVE'
      and m.revoked_at is null
  );
$$;

alter table placement_organizations enable row level security;
alter table placement_memberships enable row level security;
alter table placement_jobs enable row level security;
alter table placement_referrals enable row level security;
alter table placement_placements enable row level security;
alter table placement_assignments enable row level security;
alter table placement_timesheets enable row level security;
alter table placement_audit_events enable row level security;

-- Organization visibility is membership-scoped.
drop policy if exists placement_org_select on placement_organizations;
create policy placement_org_select on placement_organizations
  for select using (placement_is_member(id));

-- Membership visibility is limited to the authenticated user's own memberships.
drop policy if exists placement_membership_select on placement_memberships;
create policy placement_membership_select on placement_memberships
  for select using (user_id = auth.uid()::text);

-- Jobs: employer members can see their jobs; agency members can see jobs explicitly assigned to their agency.
drop policy if exists placement_job_select on placement_jobs;
create policy placement_job_select on placement_jobs
  for select using (placement_is_member(employer_id) or (agency_id is not null and placement_is_member(agency_id)));

create policy placement_job_insert on placement_jobs
  for insert with check (placement_is_member(employer_id) and created_by = auth.uid()::text);

create policy placement_job_update on placement_jobs
  for update using (placement_is_member(employer_id) or (agency_id is not null and placement_is_member(agency_id)))
  with check (placement_is_member(employer_id) or (agency_id is not null and placement_is_member(agency_id)));

-- Referrals are visible to the participating agency and the employer attached to the job.
drop policy if exists placement_referral_select on placement_referrals;
create policy placement_referral_select on placement_referrals
  for select using (
    placement_is_member(agency_id)
    or exists (
      select 1 from placement_jobs j
      where j.id = job_id and placement_is_member(j.employer_id)
    )
  );

-- Placements inherit access from both participating organizations.
drop policy if exists placement_placement_select on placement_placements;
create policy placement_placement_select on placement_placements
  for select using (placement_is_member(agency_id) or placement_is_member(employer_id));

-- Assignments inherit access through their placement.
drop policy if exists placement_assignment_select on placement_assignments;
create policy placement_assignment_select on placement_assignments
  for select using (
    exists (
      select 1 from placement_placements p
      where p.id = placement_id
        and (placement_is_member(p.agency_id) or placement_is_member(p.employer_id))
    )
  );

-- Timesheets: worker access is self-scoped; agency/employer access is inherited from the assignment.
drop policy if exists placement_timesheet_select on placement_timesheets;
create policy placement_timesheet_select on placement_timesheets
  for select using (
    worker_id = auth.uid()::text
    or exists (
      select 1
      from placement_assignments a
      join placement_placements p on p.id = a.placement_id
      where a.id = assignment_id
        and (placement_is_member(p.agency_id) or placement_is_member(p.employer_id))
    )
  );

-- Audit events are append-only from application code; clients do not receive direct update/delete access.
drop policy if exists placement_audit_select on placement_audit_events;
create policy placement_audit_select on placement_audit_events
  for select using (actor_user_id = auth.uid()::text or (organization_id is not null and placement_is_member(organization_id)));

comment on table placement_audit_events is 'Append-only operational audit ledger for PlacementOS. Mutations must flow through governed server-side actions.';
