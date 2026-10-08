-- Add commercial placement metadata to the canonical placement table
-- created in 0009. This migration must not redefine a second placement model.

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
  drop constraint if exists staffing_placements_split_basis_points_check;
alter table public.staffing_placements
  add constraint staffing_placements_split_basis_points_check
  check (split_basis_points is null or split_basis_points between 0 and 10000);

alter table public.staffing_placements
  drop constraint if exists staffing_placements_hourly_bill_rate_check;
alter table public.staffing_placements
  add constraint staffing_placements_hourly_bill_rate_check
  check (hourly_bill_rate is null or hourly_bill_rate > 0);

create unique index if not exists staffing_placements_application_active_idx
  on public.staffing_placements (application_id)
  where status in ('PENDING','ACTIVE');

create index if not exists staffing_placements_org_status_idx
  on public.staffing_placements (organization_id,status);

alter table public.staffing_placements enable row level security;
drop policy if exists "staffing placements organization access" on public.staffing_placements;
create policy "staffing placements organization access" on public.staffing_placements
for all using (public.placement_is_org_member(organization_id))
with check (public.placement_is_org_member(organization_id));
