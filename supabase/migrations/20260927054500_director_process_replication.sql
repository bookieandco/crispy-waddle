-- Director Process Replication: durable Ask Jhadina -> Study -> Recipe -> Director project envelope.
-- Service-role only. Identity is verified in the Ask HTTP boundary; these rows grant no execution/publication authority.

create table if not exists public.director_process_replication_jobs (
  id text primary key,
  owner_user_id uuid not null,
  client_request_id text not null,
  project_id text not null,
  objective text not null check (char_length(objective) between 1 and 12000),
  source_urls jsonb not null default '[]'::jsonb,
  source_artifact_refs jsonb not null default '[]'::jsonb,
  study_ids jsonb not null default '[]'::jsonb,
  improve_before_execute boolean not null default true,
  editable_delivery boolean not null default true check (editable_delivery = true),
  target_duration_seconds numeric,
  target_kind text not null check (target_kind in ('ad','short','episode','film','video')),
  status text not null check (status in ('queued','studying','recipe_ready','executing','review','completed','blocked','failed')),
  phase text not null,
  reference_recipe jsonb,
  improved_recipe jsonb,
  stage_plan jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, client_request_id)
);

create index if not exists director_process_replication_owner_updated_idx
  on public.director_process_replication_jobs(owner_user_id, updated_at desc);
create index if not exists director_process_replication_project_idx
  on public.director_process_replication_jobs(project_id, updated_at desc);

alter table public.director_process_replication_jobs enable row level security;
revoke all on public.director_process_replication_jobs from anon, authenticated;
grant select, insert, update, delete on public.director_process_replication_jobs to service_role;

comment on table public.director_process_replication_jobs is
'Durable planning/runtime envelope for Ask Jhadina process replication. Does not grant provider, publishing, spending, or timeline mutation authority.';

create table if not exists public.director_production_projects (
  id text primary key,
  owner_user_id uuid not null,
  version integer not null default 1 check (version > 0),
  title text not null,
  status text not null check (status in ('development','preproduction','production','post','review','final')),
  snapshot jsonb not null default '{}'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_production_projects_owner_updated_idx
  on public.director_production_projects(owner_user_id, updated_at desc);

alter table public.director_production_projects enable row level security;
revoke all on public.director_production_projects from anon, authenticated;
grant select, insert, update, delete on public.director_production_projects to service_role;

comment on table public.director_production_projects is
'Versioned Director production source-of-truth envelope. Snapshot references subsystem-owned artifacts; it is not a replacement authority for those records.';
