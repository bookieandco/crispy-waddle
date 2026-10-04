-- Accepted screenplay structure for Director long-form orchestration.
-- Only explicitly accepted ingest proposals become canonical screenplay blueprints.

create table if not exists public.director_screenplay_blueprints (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_artifact_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  source_proposal_id uuid not null references public.director_screenplay_ingest_proposals(id) on delete restrict,
  version integer not null check (version > 0),
  blueprint jsonb not null,
  evidence_ids text[] not null default '{}',
  accepted_at timestamptz not null default now(),
  accepted_by_user_id uuid not null references auth.users(id) on delete restrict,
  unique(project_id, version),
  unique(project_id, source_proposal_id),
  check (jsonb_typeof(blueprint)='object')
);

create index if not exists director_screenplay_blueprints_project_idx
  on public.director_screenplay_blueprints(project_id, version desc);

alter table public.director_screenplay_blueprints enable row level security;
revoke all on public.director_screenplay_blueprints from public,anon,authenticated;
grant select,insert on public.director_screenplay_blueprints to service_role;

drop policy if exists director_screenplay_blueprints_service_role_only
  on public.director_screenplay_blueprints;
create policy director_screenplay_blueprints_service_role_only
  on public.director_screenplay_blueprints
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_screenplay_blueprints is
'Explicitly accepted screenplay structure and lineage for Director shot orchestration. Acceptance does not approve generated shots, renders, publication, or spend.';
