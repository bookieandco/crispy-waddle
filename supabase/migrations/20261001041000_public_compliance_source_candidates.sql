-- LOCAL-GOV.6A — durable official-source discovery for state compliance packs.

create table if not exists public.jhadina_public_compliance_source_candidates (
  id text primary key,
  state_code text not null references public.jhadina_public_compliance_packs(state_code) on delete cascade,
  source_name text not null,
  source_url text not null,
  topics text[] not null default array[]::text[],
  discovery_provider text not null,
  government_domain boolean not null default false,
  state_relevant boolean not null default false,
  official_source_verified boolean not null default false,
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence_refs text[] not null default array[]::text[],
  blockers text[] not null default array[]::text[],
  observed_at timestamptz not null,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (state_code, source_url)
);

create index if not exists jhadina_public_compliance_source_candidates_state_idx
  on public.jhadina_public_compliance_source_candidates (state_code, official_source_verified, confidence desc);

alter table public.jhadina_public_compliance_source_candidates enable row level security;
revoke all on table public.jhadina_public_compliance_source_candidates from anon, authenticated;
grant all on table public.jhadina_public_compliance_source_candidates to service_role;
