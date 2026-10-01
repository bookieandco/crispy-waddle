-- LOCAL-GOV.5A — provider shortlists for evidence-backed public work packages.

create table if not exists public.jhadina_public_package_provider_candidates (
  package_id text not null references public.jhadina_public_work_packages(id) on delete cascade,
  provider_id text not null,
  legal_name text not null,
  country text,
  naics_codes text[] not null default array[]::text[],
  keywords text[] not null default array[]::text[],
  award_count integer,
  previous_win_similarity jsonb,
  evidence jsonb not null default '[]'::jsonb,
  assessment_status text not null check (assessment_status in ('candidate','review_required','blocked')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  reasons text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  discovered_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (package_id, provider_id)
);

create index if not exists jhadina_public_package_provider_candidates_score_idx
  on public.jhadina_public_package_provider_candidates (package_id, assessment_status, score desc);

alter table public.jhadina_public_package_provider_candidates enable row level security;
revoke all on table public.jhadina_public_package_provider_candidates from anon, authenticated;
grant all on table public.jhadina_public_package_provider_candidates to service_role;
