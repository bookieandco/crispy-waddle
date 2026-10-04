-- Automatic rough-cut proposals assembled from selected Director takes.
-- A proposal may be generated automatically, but canonical Workstation materialization still
-- requires the selected generated assets to carry durable editing-approval receipts.

create table if not exists public.director_edit_assembly_proposals (
  id text primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  production_run_id text not null,
  plan_id text not null,
  timeline_revision bigint,
  proposal jsonb not null,
  selected_asset_ids text[] not null default '{}',
  required_approval_asset_ids text[] not null default '{}',
  status text not null check (status in (
    'proposed','awaiting_asset_approval','materialized','stale','blocked'
  )),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  materialized_at timestamptz,
  unique(project_id,plan_id)
);

create index if not exists director_edit_assembly_project_idx
  on public.director_edit_assembly_proposals(project_id,updated_at desc);

alter table public.director_edit_assembly_proposals enable row level security;
revoke all on public.director_edit_assembly_proposals from public,anon,authenticated;
grant select,insert,update on public.director_edit_assembly_proposals to service_role;

drop policy if exists director_edit_assembly_proposals_service_role_only
  on public.director_edit_assembly_proposals;
create policy director_edit_assembly_proposals_service_role_only
  on public.director_edit_assembly_proposals
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_edit_assembly_proposals is
'Automatic rough-cut proposal built from evidence-selected takes. Proposal generation is automatic; canonical timeline materialization remains revision-fenced and requires editing-asset approval receipts.';
