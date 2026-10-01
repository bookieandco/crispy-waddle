-- LOCAL-GOV.3 — durable procurement-source commissioning.

alter table public.jhadina_public_source_discovery_jobs
  add column if not exists priority smallint not null default 50,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists last_error text,
  add column if not exists candidate_count integer not null default 0 check (candidate_count >= 0),
  add column if not exists verified_source_count integer not null default 0 check (verified_source_count >= 0);

update public.jhadina_public_source_discovery_jobs j
   set priority = case when x.level = 'state' then 10 else 50 end
  from public.jhadina_public_jurisdictions x
 where x.id = j.jurisdiction_id;

create index if not exists jhadina_public_source_discovery_jobs_queue_idx
  on public.jhadina_public_source_discovery_jobs (status, priority, attempt_count, updated_at);

create table if not exists public.jhadina_public_procurement_sources (
  id text primary key,
  jurisdiction_id text not null references public.jhadina_public_jurisdictions(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  source_kinds text[] not null default array[]::text[],
  adapter_kind text not null,
  discovery_provider text not null,
  verification_status text not null
    check (verification_status in ('candidate','official_owner_verified','official_portal_verified','rejected')),
  official_owner_url text,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  evidence_refs text[] not null default array[]::text[],
  blockers text[] not null default array[]::text[],
  adapter_status text not null default 'adapter_required'
    check (adapter_status in ('adapter_required','active','degraded','disabled')),
  discovered_at timestamptz not null,
  verified_at timestamptz,
  last_seen_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (jurisdiction_id, source_url)
);

create index if not exists jhadina_public_procurement_sources_jurisdiction_idx
  on public.jhadina_public_procurement_sources (jurisdiction_id, verification_status, adapter_status);

create index if not exists jhadina_public_procurement_sources_url_idx
  on public.jhadina_public_procurement_sources (source_url);

alter table public.jhadina_public_procurement_sources enable row level security;
revoke all on table public.jhadina_public_procurement_sources from anon, authenticated;
grant all on table public.jhadina_public_procurement_sources to service_role;
