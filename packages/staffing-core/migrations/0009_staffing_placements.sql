create table if not exists public.staffing_placements (
  id text primary key,
  organization_id uuid not null,
  application_id text not null unique references public.staffing_applications(id),
  job_id text not null references public.staffing_marketplace_jobs(id),
  worker_id uuid not null,
  employer_id uuid not null,
  agency_id uuid,
  status text not null check (status in ('PENDING','ACTIVE','COMPLETED','CANCELLED')),
  start_date date not null,
  end_date date,
  pay_rate numeric(14,2) not null check (pay_rate > 0),
  currency text not null check (char_length(currency) = 3),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (end_date is null or end_date >= start_date)
);

create index if not exists staffing_placements_org_status_idx
  on public.staffing_placements (organization_id, status, start_date);

alter table public.staffing_placements enable row level security;

create policy "staffing placements organization access" on public.staffing_placements
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
