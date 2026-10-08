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
