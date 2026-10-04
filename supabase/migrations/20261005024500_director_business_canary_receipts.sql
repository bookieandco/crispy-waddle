-- End-to-end Business Factory -> Director -> Social-readiness certification receipts.
-- Readiness never grants generation, creative approval, publication, spend, or wagering authority.

create table if not exists public.director_business_canary_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  plan_id text not null,
  opportunity_id text not null,
  format text not null,
  furthest_verified_phase text not null,
  next_boundary text not null,
  production_ready_for_social_proposal boolean not null,
  phase_receipts jsonb not null,
  authority text not null default 'DIRECTOR_BUSINESS_CANARY_CERTIFICATION',
  certified_at timestamptz not null default now(),
  check (jsonb_typeof(phase_receipts)='array')
);

create index if not exists director_business_canary_project_idx
  on public.director_business_canary_receipts(project_id,certified_at desc);

create index if not exists director_business_canary_owner_idx
  on public.director_business_canary_receipts(owner_user_id,certified_at desc);

alter table public.director_business_canary_receipts enable row level security;
revoke all on public.director_business_canary_receipts from public,anon,authenticated;
grant select,insert on public.director_business_canary_receipts to service_role;

drop policy if exists director_business_canary_receipts_service_role_only
  on public.director_business_canary_receipts;
create policy director_business_canary_receipts_service_role_only
  on public.director_business_canary_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_business_canary_receipts is
'Point-in-time read-only evidence of how far a Business Factory production reached through Director. Social-ready means eligible to request a Social proposal only; publication approval remains separate.';
