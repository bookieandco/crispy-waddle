-- GOVERNMENT-DEMAND-RADAR.1 — derived buyer demand, recompete, and Q&A intelligence.

create table if not exists public.jhadina_government_demand_profiles (
  id text primary key,
  buyer text not null,
  observation_count integer not null default 0 check (observation_count >= 0),
  award_count integer not null default 0 check (award_count >= 0),
  naics_codes text[] not null default array[]::text[],
  psc_codes text[] not null default array[]::text[],
  recurring_keywords text[] not null default array[]::text[],
  observed_vehicles text[] not null default array[]::text[],
  incumbent_names text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  refreshed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_government_demand_profiles_observation_idx
  on public.jhadina_government_demand_profiles (observation_count desc, award_count desc);

create table if not exists public.jhadina_government_recompete_watches (
  observation_id text primary key,
  buyer text not null,
  title text not null,
  incumbent_name text,
  performance_end_date date not null,
  watch_start_date date not null,
  days_until_watch integer not null,
  status text not null check (status in ('watch_later','watch_now','past_due')),
  evidence_refs text[] not null default array[]::text[],
  refreshed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_government_recompete_watches_status_idx
  on public.jhadina_government_recompete_watches (status, watch_start_date);

create table if not exists public.jhadina_government_solicitation_qa_signals (
  notice_id text primary key,
  question_count integer not null default 0 check (question_count >= 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  topics text[] not null default array[]::text[],
  unresolved_topics text[] not null default array[]::text[],
  engagement_signal text not null check (engagement_signal in ('none','observed','material')),
  competition_inference_authorized boolean not null default false,
  reasons text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  refreshed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.jhadina_government_demand_profiles enable row level security;
alter table public.jhadina_government_recompete_watches enable row level security;
alter table public.jhadina_government_solicitation_qa_signals enable row level security;

revoke all on table public.jhadina_government_demand_profiles from anon, authenticated;
revoke all on table public.jhadina_government_recompete_watches from anon, authenticated;
revoke all on table public.jhadina_government_solicitation_qa_signals from anon, authenticated;

grant all on table public.jhadina_government_demand_profiles to service_role;
grant all on table public.jhadina_government_recompete_watches to service_role;
grant all on table public.jhadina_government_solicitation_qa_signals to service_role;
