create table if not exists public.placement_referral_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  worker_id uuid not null,
  agency_id uuid not null,
  job_id uuid not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('REQUESTED','GRANTED','DECLINED','REVOKED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists placement_referral_consents_worker_idx
  on public.placement_referral_consents (organization_id, worker_id, status);

create index if not exists placement_referral_consents_job_idx
  on public.placement_referral_consents (organization_id, job_id, status);

alter table public.placement_referral_consents enable row level security;

create policy "placement consent organization access"
  on public.placement_referral_consents
  for select using (public.placement_is_org_member(organization_id));

create policy "placement consent worker or agency insert"
  on public.placement_referral_consents
  for insert with check (public.placement_is_org_member(organization_id));

create policy "placement consent organization update"
  on public.placement_referral_consents
  for update using (public.placement_is_org_member(organization_id))
  with check (public.placement_is_org_member(organization_id));
