-- LOCAL-GOV.FINAL — durable production certification receipts.

create table if not exists public.jhadina_public_production_certifications (
  id text primary key,
  observed_at timestamptz not null,
  certification text not null check (certification in (
    'BLOCKED','RUNTIME_CERTIFIED','LIVE_REFERENCE_CERTIFIED','NATIONAL_COVERAGE_CERTIFIED'
  )),
  runtime_integrity text not null check (runtime_integrity in ('PASS','BLOCKED')),
  live_reference_ingestion text not null check (live_reference_ingestion in ('PASS','BLOCKED')),
  national_coverage text not null check (national_coverage in ('PASS','PARTIAL')),
  metrics jsonb not null,
  blockers text[] not null default array[]::text[],
  live_blockers text[] not null default array[]::text[],
  coverage_debt text[] not null default array[]::text[],
  warnings text[] not null default array[]::text[],
  external_action_authorized boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_production_certifications_time_idx
  on public.jhadina_public_production_certifications (observed_at desc);

alter table public.jhadina_public_production_certifications enable row level security;
revoke all on table public.jhadina_public_production_certifications from anon, authenticated;
grant all on table public.jhadina_public_production_certifications to service_role;
