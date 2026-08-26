-- DirectorOS generated editing assets and explicit editing approvals.
-- Assets are durable outputs; approval is a separate governance decision.
-- The current app identity model is not yet consistently auth.uid()-backed,
-- so these internal tables are service_role-only. Server routes must authenticate
-- the caller before using the privileged client.

create table if not exists public.director_generated_editing_assets (
  id text primary key,
  project_id text not null,
  generation_job_id text not null,
  provider_id text not null,
  media_type text not null,
  uri text not null,
  mime_type text,
  sha256 text,
  model_id text,
  workflow_id text,
  workflow_version integer,
  loras jsonb,
  prompt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists director_generated_editing_assets_project_idx
  on public.director_generated_editing_assets (project_id, created_at desc);

create index if not exists director_generated_editing_assets_job_idx
  on public.director_generated_editing_assets (generation_job_id, created_at desc);

create table if not exists public.director_editing_asset_approvals (
  asset_id text primary key references public.director_generated_editing_assets(id) on delete cascade,
  approval_id text not null,
  approved_at timestamptz not null default now()
);

alter table public.director_generated_editing_assets enable row level security;
alter table public.director_editing_asset_approvals enable row level security;

create policy director_generated_editing_assets_service_role_only
  on public.director_generated_editing_assets as restrictive for all
  to service_role using (true) with check (true);

create policy director_editing_asset_approvals_service_role_only
  on public.director_editing_asset_approvals as restrictive for all
  to service_role using (true) with check (true);

revoke all on public.director_generated_editing_assets from anon, authenticated;
revoke all on public.director_editing_asset_approvals from anon, authenticated;
