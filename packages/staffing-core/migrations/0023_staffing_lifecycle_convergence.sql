-- STAFFING-AUDIT.6
-- Forward migration for environments that already applied 0005-0022.
-- Canonical states are shared with packages/staffing-core/src/lifecycle.ts.

alter table public.staffing_jobs
  drop constraint if exists staffing_jobs_status_check;
alter table public.staffing_jobs
  add constraint staffing_jobs_status_check
  check (status in ('DRAFT','PUBLISHED','PAUSED','CLOSED'));

alter table public.staffing_marketplace_jobs
  drop constraint if exists staffing_marketplace_jobs_status_check;
alter table public.staffing_marketplace_jobs
  add constraint staffing_marketplace_jobs_status_check
  check (status in ('DRAFT','PUBLISHED','PAUSED','CLOSED'));

alter table public.staffing_applications
  add column if not exists candidate_id text;

update public.staffing_applications
set candidate_id = worker_id::text
where candidate_id is null;

alter table public.staffing_applications
  drop constraint if exists staffing_applications_status_check;
alter table public.staffing_applications
  add constraint staffing_applications_status_check
  check (status in (
    'SUBMITTED','ADVANCING','ADVANCED','REFERRED','ON_HOLD','INTERVIEW',
    'INTERVIEW_SCHEDULED','INTERVIEW_FAILED','PLACEMENT_READY','PLACED',
    'REJECTED','DECLINED','WITHDRAWN','HIRED'
  ));

alter table public.staffing_placements
  add column if not exists candidate_id text,
  add column if not exists contract_id text,
  add column if not exists commercial_agreement_id text,
  add column if not exists split_basis_points integer,
  add column if not exists hourly_bill_rate numeric(14,2),
  add column if not exists created_by text;

update public.staffing_placements
set candidate_id = worker_id::text
where candidate_id is null;

alter table public.staffing_placements
  drop constraint if exists staffing_placements_status_check;
alter table public.staffing_placements
  add constraint staffing_placements_status_check
  check (status in ('PENDING','ACTIVE','COMPLETED','CANCELLED'));

alter table public.staffing_placements
  drop constraint if exists staffing_placements_split_basis_points_check;
alter table public.staffing_placements
  add constraint staffing_placements_split_basis_points_check
  check (split_basis_points is null or split_basis_points between 0 and 10000);

alter table public.staffing_placements
  drop constraint if exists staffing_placements_hourly_bill_rate_check;
alter table public.staffing_placements
  add constraint staffing_placements_hourly_bill_rate_check
  check (hourly_bill_rate is null or hourly_bill_rate > 0);

alter table public.staffing_timesheets
  drop constraint if exists staffing_timesheets_status_check;
alter table public.staffing_timesheets
  add constraint staffing_timesheets_status_check
  check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','BILLABLE'));


-- Staffing Core owns commercial agreement persistence. Earlier source code
-- depended on tables that existed only in Placement Core migrations.
create table if not exists public.staffing_agency_contracts (
  id text primary key,
  organization_id uuid not null,
  agency_id text not null,
  name text not null,
  status text not null check (status in ('DRAFT','PENDING_SIGNATURE','ACTIVE','SUSPENDED','EXPIRED','TERMINATED')),
  effective_at timestamptz not null,
  expires_at timestamptz,
  auto_renew boolean not null default false,
  version integer not null check (version > 0),
  document_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staffing_commercial_agreements (
  id text primary key,
  contract_id text not null references public.staffing_agency_contracts(id) on delete cascade,
  agency_id text not null,
  employer_id text,
  fee_basis text not null check (fee_basis in ('BILLING_TOTAL','GROSS_SPREAD','WORKER_PAY','FLAT_PER_PLACEMENT')),
  platform_fee_percent numeric(8,6),
  agency_share_percent numeric(8,6),
  platform_share_percent numeric(8,6),
  flat_placement_fee numeric(14,2),
  currency text not null check (char_length(currency)=3),
  effective_at timestamptz not null,
  expires_at timestamptz,
  priority integer not null default 0,
  check (platform_fee_percent is null or platform_fee_percent between 0 and 1),
  check (agency_share_percent is null or agency_share_percent between 0 and 1),
  check (platform_share_percent is null or platform_share_percent between 0 and 1),
  check (flat_placement_fee is null or flat_placement_fee >= 0)
);

create index if not exists staffing_contract_org_status_idx
  on public.staffing_agency_contracts (organization_id,status,expires_at);
create index if not exists staffing_commercial_agreement_lookup_idx
  on public.staffing_commercial_agreements (agency_id,employer_id,effective_at,expires_at,priority);

alter table public.staffing_agency_contracts enable row level security;
alter table public.staffing_commercial_agreements enable row level security;

drop policy if exists "staffing agency contracts organization access" on public.staffing_agency_contracts;
create policy "staffing agency contracts organization access" on public.staffing_agency_contracts
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));

drop policy if exists "staffing commercial agreements organization access" on public.staffing_commercial_agreements;
create policy "staffing commercial agreements organization access" on public.staffing_commercial_agreements
for all using (
  exists (
    select 1 from public.staffing_agency_contracts c
    where c.id=contract_id and public.placement_is_org_member(c.organization_id)
  )
)
with check (
  exists (
    select 1 from public.staffing_agency_contracts c
    where c.id=contract_id and public.placement_is_org_member(c.organization_id)
  )
);
