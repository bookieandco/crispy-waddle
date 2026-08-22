create table if not exists public.overage_jurisdictions (
  jurisdiction_id text primary key,
  state_code text not null,
  county_code text,
  name text not null,
  level text not null check (level in ('STATE','COUNTY','PARISH','BOROUGH','CITY','DISTRICT')),
  timezone text,
  rule_profile_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.overage_sources (
  source_id text primary key,
  jurisdiction_id text not null references public.overage_jurisdictions(jurisdiction_id) on delete cascade,
  authority_id text not null,
  authority_role text not null,
  fund_families text[] not null default '{}',
  source_url text not null,
  source_type text not null check (source_type in ('API','HTML','PDF','CSV','PORTAL','COURT','REQUEST','MANUAL')),
  state text not null check (state in ('DISCOVERED','REGISTERED','LIVE','HEALTHY','STALE','BROKEN','MANUAL','NOT_AVAILABLE','UNKNOWN')),
  freshness_sla_hours integer,
  last_verified_at timestamptz,
  last_successful_run_at timestamptz,
  connector_version text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overage_jurisdictions_state_idx on public.overage_jurisdictions(state_code);
create index if not exists overage_sources_jurisdiction_idx on public.overage_sources(jurisdiction_id);
create index if not exists overage_sources_state_idx on public.overage_sources(state);
create index if not exists overage_sources_authority_idx on public.overage_sources(authority_role);

alter table public.overage_jurisdictions enable row level security;
alter table public.overage_sources enable row level security;

create policy "overage jurisdictions service role only" on public.overage_jurisdictions as restrictive for all to service_role using (true) with check (true);
create policy "overage sources service role only" on public.overage_sources as restrictive for all to service_role using (true) with check (true);
