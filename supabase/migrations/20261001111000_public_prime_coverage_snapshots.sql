-- LOCAL-GOV.PRIME-COVERAGE — durable national prime-discovery coverage receipts.

create table if not exists public.jhadina_public_prime_coverage_snapshots (
  id text primary key,
  observed_at timestamptz not null,
  status text not null check (status in ('FULL','PARTIAL','BLOCKED')),
  source_coverage_pct double precision not null check (source_coverage_pct >= 0 and source_coverage_pct <= 100),
  active_adapter_coverage_pct double precision not null check (active_adapter_coverage_pct >= 0 and active_adapter_coverage_pct <= 100),
  prime_observation_coverage_pct double precision not null check (prime_observation_coverage_pct >= 0 and prime_observation_coverage_pct <= 100),
  metrics jsonb not null,
  coverage_debt text[] not null default array[]::text[],
  missing_jurisdiction_levels text[] not null default array[]::text[],
  external_contact_authorized boolean not null default false,
  bid_submission_authorized boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_public_prime_coverage_snapshots_observed_idx
  on public.jhadina_public_prime_coverage_snapshots (observed_at desc);

alter table public.jhadina_public_prime_coverage_snapshots enable row level security;
revoke all on table public.jhadina_public_prime_coverage_snapshots from anon, authenticated;
grant all on table public.jhadina_public_prime_coverage_snapshots to service_role;
