-- Durable Workstation screenplay-ingest proposals.
-- Parsed scene structure remains proposal-only until the owner/editor accepts it.

create table if not exists public.director_screenplay_ingest_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  artifact_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  proposal jsonb not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected','superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,artifact_id,status)
);

create index if not exists director_screenplay_ingest_project_idx
  on public.director_screenplay_ingest_proposals(project_id,created_at desc);

alter table public.director_screenplay_ingest_proposals enable row level security;
revoke all on public.director_screenplay_ingest_proposals from public,anon,authenticated;
grant select,insert,update on public.director_screenplay_ingest_proposals to service_role;

drop policy if exists director_screenplay_ingest_proposals_service_role_only
  on public.director_screenplay_ingest_proposals;
create policy director_screenplay_ingest_proposals_service_role_only
  on public.director_screenplay_ingest_proposals
  as restrictive for all to service_role
  using (true) with check (true);
