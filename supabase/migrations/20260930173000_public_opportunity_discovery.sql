-- LOCAL-GOV.2 — global public procurement discovery inbox.
-- Background discovery is intentionally not user-owned. Authenticated users
-- adopt discoveries into canonical user-scoped Opportunity rows through the
-- application boundary.

create table if not exists public.jhadina_public_jurisdictions (
  id text primary key,
  level text not null check (level in ('state','county')),
  state_code text not null,
  state_fips text not null,
  county_geoid text,
  name text not null,
  normalized_name text not null,
  latitude double precision,
  longitude double precision,
  source_url text not null,
  source_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_jurisdictions_state_idx
  on public.jhadina_public_jurisdictions (state_code, level, normalized_name);

create table if not exists public.jhadina_public_source_discovery_jobs (
  id text primary key,
  jurisdiction_id text not null references public.jhadina_public_jurisdictions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','discovered','adapter_required','active','blocked')),
  target_kinds text[] not null default array[]::text[],
  source_refs text[] not null default array[]::text[],
  last_attempt_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_source_discovery_jobs_status_idx
  on public.jhadina_public_source_discovery_jobs (status, updated_at);

create table if not exists public.jhadina_public_opportunity_inbox (
  id text primary key,
  source_id text not null,
  external_id text,
  state_code text not null,
  county_name text,
  locality text,
  stage text not null,
  title text not null,
  source_url text not null,
  content_digest text not null,
  payload jsonb not null,
  captured_at timestamptz not null,
  last_seen_at timestamptz not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists jhadina_public_opportunity_inbox_source_idx
  on public.jhadina_public_opportunity_inbox (source_id, last_seen_at desc);

create index if not exists jhadina_public_opportunity_inbox_geo_idx
  on public.jhadina_public_opportunity_inbox (state_code, county_name, last_seen_at desc);

create table if not exists public.jhadina_public_source_state (
  source_id text primary key,
  status text not null check (status in ('healthy','degraded','failed','disabled')),
  checkpoint jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  observations integer not null default 0 check (observations >= 0),
  last_run_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.jhadina_public_jurisdictions enable row level security;
alter table public.jhadina_public_source_discovery_jobs enable row level security;
alter table public.jhadina_public_opportunity_inbox enable row level security;
alter table public.jhadina_public_source_state enable row level security;

revoke all on table public.jhadina_public_jurisdictions from anon, authenticated;
revoke all on table public.jhadina_public_source_discovery_jobs from anon, authenticated;
revoke all on table public.jhadina_public_opportunity_inbox from anon, authenticated;
revoke all on table public.jhadina_public_source_state from anon, authenticated;

grant all on table public.jhadina_public_jurisdictions to service_role;
grant all on table public.jhadina_public_source_discovery_jobs to service_role;
grant all on table public.jhadina_public_opportunity_inbox to service_role;
grant all on table public.jhadina_public_source_state to service_role;
