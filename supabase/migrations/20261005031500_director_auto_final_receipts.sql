-- DIRECTOR-AUTO.FINAL project-scoped closure receipts.
-- Certification is evidence-only and grants no creative, publication, spend or wagering authority.

create table if not exists public.director_auto_final_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  plan_id text not null,
  format text not null,
  admissible boolean not null,
  reasons text[] not null default '{}',
  evidence jsonb not null,
  authority text not null default 'DIRECTOR_AUTO_FINAL_CERTIFICATION',
  certified_at timestamptz not null default now(),
  check (jsonb_typeof(evidence)='object')
);

create index if not exists director_auto_final_project_idx
  on public.director_auto_final_receipts(project_id,certified_at desc);

create index if not exists director_auto_final_owner_idx
  on public.director_auto_final_receipts(owner_user_id,certified_at desc);

alter table public.director_auto_final_receipts enable row level security;
revoke all on public.director_auto_final_receipts from public,anon,authenticated;
grant select,insert on public.director_auto_final_receipts to service_role;

drop policy if exists director_auto_final_receipts_service_role_only on public.director_auto_final_receipts;
create policy director_auto_final_receipts_service_role_only
  on public.director_auto_final_receipts
  as restrictive for all to service_role
  using (true) with check (true);

comment on table public.director_auto_final_receipts is
'Point-in-time DIRECTOR-AUTO.FINAL evidence across production autopilot, Watch commissioning, final QC and Business Factory canary. Never grants approval, publication, wagering or spend authority.';
