create table if not exists public.staffing_timesheets (
  id text primary key,
  organization_id uuid not null,
  placement_id text not null references public.staffing_placements(id),
  worker_id uuid not null,
  period_start date not null,
  period_end date not null,
  regular_hours numeric(8,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(8,2) not null default 0 check (overtime_hours >= 0),
  status text not null check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (period_end >= period_start)
);

create unique index if not exists staffing_timesheets_placement_period_idx
  on public.staffing_timesheets (placement_id, period_start, period_end);

create index if not exists staffing_timesheets_org_status_idx
  on public.staffing_timesheets (organization_id, status, period_end desc);

alter table public.staffing_timesheets enable row level security;

create policy "staffing timesheets organization access" on public.staffing_timesheets
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
