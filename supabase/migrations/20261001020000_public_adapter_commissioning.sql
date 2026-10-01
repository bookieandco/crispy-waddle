-- LOCAL-GOV.4 — read-only adapter shadow trials and certification.

alter table public.jhadina_public_procurement_sources
  add column if not exists adapter_key text,
  add column if not exists adapter_version text,
  add column if not exists access_review_status text not null default 'pending'
    check (access_review_status in ('pending','approved_public_official','approved_platform','blocked')),
  add column if not exists access_reviewed_at timestamptz,
  add column if not exists last_adapter_trial_at timestamptz,
  add column if not exists certified_at timestamptz;

create index if not exists jhadina_public_procurement_sources_adapter_queue_idx
  on public.jhadina_public_procurement_sources (adapter_status, verification_status, access_review_status, last_adapter_trial_at);

create table if not exists public.jhadina_public_adapter_trials (
  id text primary key,
  source_id text not null references public.jhadina_public_procurement_sources(id) on delete cascade,
  adapter_key text not null,
  adapter_version text not null,
  observed_at timestamptz not null,
  source_digest text not null,
  http_status integer not null,
  parse_succeeded boolean not null,
  observation_count integer not null default 0 check (observation_count >= 0),
  stable_external_id_count integer not null default 0 check (stable_external_id_count >= 0),
  duplicate_external_id_count integer not null default 0 check (duplicate_external_id_count >= 0),
  provenance_complete boolean not null default false,
  access_review_approved boolean not null default false,
  error_code text,
  evidence_refs text[] not null default array[]::text[],
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists jhadina_public_adapter_trials_source_idx
  on public.jhadina_public_adapter_trials (source_id, adapter_key, adapter_version, observed_at desc);

create table if not exists public.jhadina_public_adapter_certifications (
  source_id text primary key references public.jhadina_public_procurement_sources(id) on delete cascade,
  adapter_key text not null,
  adapter_version text not null,
  status text not null check (status in ('ACTIVE_READ_ONLY','SHADOW','BLOCKED')),
  trial_count integer not null default 0 check (trial_count >= 0),
  successful_trials integer not null default 0 check (successful_trials >= 0),
  observation_count integer not null default 0 check (observation_count >= 0),
  stable_external_id_coverage double precision not null default 0
    check (stable_external_id_coverage >= 0 and stable_external_id_coverage <= 1),
  blockers text[] not null default array[]::text[],
  evidence_refs text[] not null default array[]::text[],
  certified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.jhadina_public_adapter_trials enable row level security;
alter table public.jhadina_public_adapter_certifications enable row level security;

revoke all on table public.jhadina_public_adapter_trials from anon, authenticated;
revoke all on table public.jhadina_public_adapter_certifications from anon, authenticated;

grant all on table public.jhadina_public_adapter_trials to service_role;
grant all on table public.jhadina_public_adapter_certifications to service_role;
