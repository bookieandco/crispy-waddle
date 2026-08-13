create table if not exists public.staffing_agency_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  agency_id uuid not null,
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
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.staffing_agency_contracts(id),
  agency_id uuid not null,
  employer_id uuid,
  fee_basis text not null check (fee_basis in ('BILLING_TOTAL','GROSS_SPREAD','WORKER_PAY','FLAT_PER_PLACEMENT')),
  platform_fee_percent numeric(8,6),
  agency_share_percent numeric(8,6),
  platform_share_percent numeric(8,6),
  flat_placement_fee numeric(14,2),
  currency text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  priority integer not null default 0,
  check (platform_fee_percent is null or platform_fee_percent between 0 and 1),
  check (agency_share_percent is null or agency_share_percent between 0 and 1),
  check (platform_share_percent is null or platform_share_percent between 0 and 1),
  check (flat_placement_fee is null or flat_placement_fee >= 0)
);

create index if not exists staffing_contract_agency_idx on public.staffing_agency_contracts (organization_id, agency_id, status);
create index if not exists staffing_commercial_lookup_idx on public.staffing_commercial_agreements (agency_id, employer_id, effective_at, expires_at, priority);

alter table public.staffing_agency_contracts enable row level security;
alter table public.staffing_commercial_agreements enable row level security;

create policy "staffing agency contract organization access" on public.staffing_agency_contracts
  for all using (public.placement_is_org_member(organization_id))
  with check (public.placement_is_org_member(organization_id));

create policy "staffing commercial agreement organization access" on public.staffing_commercial_agreements
  for all using (
    exists (
      select 1 from public.staffing_agency_contracts c
      where c.id = contract_id and public.placement_is_org_member(c.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.staffing_agency_contracts c
      where c.id = contract_id and public.placement_is_org_member(c.organization_id)
    )
  );
