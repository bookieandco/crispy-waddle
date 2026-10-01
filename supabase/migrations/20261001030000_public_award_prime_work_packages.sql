-- LOCAL-GOV.5 — awarded-prime intelligence and evidence-backed subcontract packages.

create table if not exists public.jhadina_public_awards (
  id text primary key,
  opportunity_id text,
  inbox_id text not null,
  source_id text not null,
  external_id text,
  title text not null,
  buyer text not null,
  state_code text not null,
  county_name text,
  locality text,
  awarded_prime_name text not null,
  awarded_prime_ref text,
  award_amount double precision,
  currency text,
  naics_code text,
  psc_code text,
  scope_text text,
  award_date date,
  source_url text not null,
  captured_at timestamptz not null,
  evidence_refs text[] not null default array[]::text[],
  payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_awards_prime_idx
  on public.jhadina_public_awards (awarded_prime_ref, awarded_prime_name, state_code);

create index if not exists jhadina_public_awards_buyer_idx
  on public.jhadina_public_awards (buyer, state_code, captured_at desc);

create table if not exists public.jhadina_public_prime_profiles (
  provider_id text primary key,
  provider_name text not null,
  award_count integer not null default 0 check (award_count >= 0),
  total_observed_award_value double precision,
  states text[] not null default array[]::text[],
  buyers text[] not null default array[]::text[],
  naics_codes text[] not null default array[]::text[],
  psc_codes text[] not null default array[]::text[],
  capability_keywords text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

create table if not exists public.jhadina_public_work_packages (
  id text primary key,
  award_id text references public.jhadina_public_awards(id) on delete cascade,
  opportunity_id text not null,
  awarded_prime_name text,
  awarded_prime_ref text,
  label text not null,
  description text,
  category text,
  geography text,
  estimated_value_min double precision,
  estimated_value_max double precision,
  currency text,
  required_licenses text[] not null default array[]::text[],
  required_certifications text[] not null default array[]::text[],
  requirement jsonb not null,
  evidence_refs text[] not null default array[]::text[],
  status text not null check (status in ('candidate','review_required','blocked')),
  blockers text[] not null default array[]::text[],
  human_review_required boolean not null default true,
  automatic_prime_contact_authorized boolean not null default false check (automatic_prime_contact_authorized = false),
  automatic_provider_outreach_authorized boolean not null default false check (automatic_provider_outreach_authorized = false),
  bid_submission_authorized boolean not null default false check (bid_submission_authorized = false),
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_work_packages_opportunity_idx
  on public.jhadina_public_work_packages (opportunity_id, status);

create index if not exists jhadina_public_work_packages_award_idx
  on public.jhadina_public_work_packages (award_id);

alter table public.jhadina_public_awards enable row level security;
alter table public.jhadina_public_prime_profiles enable row level security;
alter table public.jhadina_public_work_packages enable row level security;

revoke all on table public.jhadina_public_awards from anon, authenticated;
revoke all on table public.jhadina_public_prime_profiles from anon, authenticated;
revoke all on table public.jhadina_public_work_packages from anon, authenticated;

grant all on table public.jhadina_public_awards to service_role;
grant all on table public.jhadina_public_prime_profiles to service_role;
grant all on table public.jhadina_public_work_packages to service_role;
