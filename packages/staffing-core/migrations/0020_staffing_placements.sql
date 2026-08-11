create table if not exists public.staffing_placements (
  id text primary key,
  organization_id uuid not null,
  application_id text not null references public.staffing_applications(id),
  job_id text not null,
  candidate_id text not null,
  agency_id text not null,
  employer_id text not null,
  contract_id text not null,
  commercial_agreement_id text not null,
  split_basis_points integer not null check (split_basis_points between 0 and 10000),
  start_date date not null,
  hourly_bill_rate numeric(14,2) not null check (hourly_bill_rate > 0),
  status text not null check (status in ('PENDING','ACTIVE','ENDED','CANCELLED')),
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists staffing_placements_application_active_idx on public.staffing_placements (application_id) where status in ('PENDING','ACTIVE');
create index if not exists staffing_placements_org_status_idx on public.staffing_placements (organization_id,status);

alter table public.staffing_placements enable row level security;
create policy "staffing placements organization access" on public.staffing_placements
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
