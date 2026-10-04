-- Director Workstation project input bin.
-- Reuses clean Universal Artifact Core assets and binds them to one owner-scoped Director project.

create table if not exists public.director_project_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  artifact_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('script','reference','footage','audio','b_roll','notes')),
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, artifact_id, role)
);

create index if not exists director_project_inputs_project_idx
  on public.director_project_inputs(project_id, created_at desc);

alter table public.director_project_inputs enable row level security;
revoke all on public.director_project_inputs from public, anon, authenticated;
grant select, insert, delete on public.director_project_inputs to service_role;

drop policy if exists director_project_inputs_service_role_only on public.director_project_inputs;
create policy director_project_inputs_service_role_only
  on public.director_project_inputs
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_project_inputs is
'Clean, provenance-preserving Artifact Core inputs bound to a Director Workstation project. Binding grants no generation, publication, likeness, or spend authority.';
