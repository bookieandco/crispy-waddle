-- DIRECTOR-PRODUCTION.FINAL durable production truth and quality receipts.
-- These records are planning/QC state only. They do not grant provider, publication,
-- spending, or timeline-mutation authority.

create table if not exists public.director_production_asset_packages (
  id text not null,
  project_id text not null,
  owner_user_id uuid not null,
  version integer not null check (version > 0),
  kind text not null,
  source_fingerprint text not null,
  package jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version)
);

create index if not exists director_production_asset_packages_project_idx
  on public.director_production_asset_packages(owner_user_id, project_id, updated_at desc);

alter table public.director_production_asset_packages enable row level security;
revoke all on public.director_production_asset_packages from anon, authenticated;
grant select, insert, update, delete on public.director_production_asset_packages to service_role;
create policy director_production_asset_packages_service_role_only
  on public.director_production_asset_packages
  as restrictive for all to service_role using (true) with check (true);

create table if not exists public.director_world_state_versions (
  id text not null,
  project_id text not null,
  owner_user_id uuid not null,
  version integer not null check (version > 0),
  world_kind text not null check (world_kind in ('fictional','simulated-real','real-digital-twin','live-physical')),
  state jsonb not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (id, version)
);

create index if not exists director_world_state_versions_project_idx
  on public.director_world_state_versions(owner_user_id, project_id, version desc);

alter table public.director_world_state_versions enable row level security;
revoke all on public.director_world_state_versions from anon, authenticated;
grant select, insert, update, delete on public.director_world_state_versions to service_role;
create policy director_world_state_versions_service_role_only
  on public.director_world_state_versions
  as restrictive for all to service_role using (true) with check (true);

create table if not exists public.director_creative_directives (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null,
  scope text not null check (scope in ('project','act','scene','shot','character','asset','wardrobe','track','clip','audio','grade')),
  scope_ref text not null,
  key text not null,
  mode text not null check (mode in ('pin','forbid','prefer','allow')),
  value jsonb,
  created_by text not null check (created_by in ('user','jhadina','system')),
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists director_creative_directives_project_idx
  on public.director_creative_directives(owner_user_id, project_id, scope, scope_ref, created_at desc);

alter table public.director_creative_directives enable row level security;
revoke all on public.director_creative_directives from anon, authenticated;
grant select, insert, update, delete on public.director_creative_directives to service_role;
create policy director_creative_directives_service_role_only
  on public.director_creative_directives
  as restrictive for all to service_role using (true) with check (true);

create table if not exists public.director_production_quality_runs (
  id text primary key,
  owner_user_id uuid not null,
  project_id text not null,
  fixture_kind text not null check (fixture_kind in ('commercial-30s','branded-short-8-13m','episode-22-30m','feature-55-70m')),
  status text not null check (status in ('collecting','blocked','failed','passed')),
  provider_id text,
  model_id text,
  final_master_asset_id text,
  evidence jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  quality_claim boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, fixture_kind, project_id)
);

create index if not exists director_production_quality_runs_owner_idx
  on public.director_production_quality_runs(owner_user_id, fixture_kind, updated_at desc);

alter table public.director_production_quality_runs enable row level security;
revoke all on public.director_production_quality_runs from anon, authenticated;
grant select, insert, update, delete on public.director_production_quality_runs to service_role;
create policy director_production_quality_runs_service_role_only
  on public.director_production_quality_runs
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_production_asset_packages is
'Versioned reusable characters, wardrobe, products, props, furniture, vehicles and set packages. Canonical references remain authoritative over derived model payloads.';
comment on table public.director_world_state_versions is
'Append-only Director world-state snapshots for object ownership/location, character/world relations and scene continuity.';
comment on table public.director_creative_directives is
'Durable user/Jhadina/system creative locks. User directives retain precedence in Director creative-control resolution.';
comment on table public.director_production_quality_runs is
'Four-production quality certification evidence. quality_claim may become true only after deterministic Director production-quality QC passes.';


create table if not exists public.director_production_final_programs (
  id text primary key,
  owner_user_id uuid not null,
  source_project_id text not null,
  character_id text not null,
  product_id text,
  status text not null check (status in ('planned','launching','rendering','awaiting-quality-evidence','blocked','failed','passed')),
  fixtures jsonb not null default '[]'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_production_final_programs_owner_idx
  on public.director_production_final_programs(owner_user_id, updated_at desc);

alter table public.director_production_final_programs enable row level security;
revoke all on public.director_production_final_programs from anon, authenticated;
grant select, insert, update, delete on public.director_production_final_programs to service_role;
create policy director_production_final_programs_service_role_only
  on public.director_production_final_programs
  as restrictive for all to service_role using (true) with check (true);

comment on table public.director_production_final_programs is
'Durable DIRECTOR-PRODUCTION.FINAL four-fixture program state. A passed row requires the persisted four-production quality matrix to pass; launch/render state alone is never a quality claim.';
