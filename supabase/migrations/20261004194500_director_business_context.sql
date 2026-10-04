-- Business Factory -> Director project lineage.
-- This stores why/what Director should make. It grants no publish, paid-media, or spend authority.

create table if not exists public.director_project_business_context (
  project_id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  opportunity_id text not null,
  side_hustle_family text not null,
  production_format text not null,
  source_ref text not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(plan)='object')
);

create index if not exists director_project_business_context_opportunity_idx
  on public.director_project_business_context(owner_user_id, opportunity_id, updated_at desc);

alter table public.director_project_business_context enable row level security;
revoke all on public.director_project_business_context from public, anon, authenticated;
grant select, insert, update on public.director_project_business_context to service_role;

drop policy if exists director_project_business_context_service_role_only
  on public.director_project_business_context;
create policy director_project_business_context_service_role_only
  on public.director_project_business_context
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_project_business_context is
'Opportunity/Business Factory production lineage for one Director project. Planning context only; publication and paid-media authority remain external.';
