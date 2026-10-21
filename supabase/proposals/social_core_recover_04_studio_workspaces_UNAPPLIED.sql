-- SOCIAL-CORE.RECOVER.04 — REVIEW-ONLY / NOT APPLIED / NO MIGRATION HISTORY ENTRY.
-- Generate unique CLI migration AFTER exact-project migration-drift comparison.
-- No scheduled posting, provider credentials, approved receipts, or external work.
begin;

create table if not exists public.jhadina_social_studio_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null check (brand in (
    'pupsonstuff','atwood-bookie','bookieandco','jhadina-music',
    'jhadinatv','jhadina','overageos','truckeros'
  )),
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id,brand)
);
create index if not exists social_studio_workspaces_owner_updated_idx
  on public.jhadina_social_studio_workspaces (owner_user_id,updated_at desc);

alter table public.jhadina_social_studio_workspaces enable row level security;
revoke all on table public.jhadina_social_studio_workspaces
  from public,anon,authenticated;
-- Explicit Data API grants, separate from RLS, including the 2026-10-30 behavior change.
grant select,insert,update on table public.jhadina_social_studio_workspaces
  to authenticated;

create policy social_studio_workspace_select_owner
  on public.jhadina_social_studio_workspaces
  for select to authenticated
  using ((select auth.uid())=owner_user_id);
create policy social_studio_workspace_insert_owner
  on public.jhadina_social_studio_workspaces
  for insert to authenticated
  with check ((select auth.uid())=owner_user_id);
create policy social_studio_workspace_update_owner
  on public.jhadina_social_studio_workspaces
  for update to authenticated
  using ((select auth.uid())=owner_user_id)
  with check ((select auth.uid())=owner_user_id);
-- No DELETE grant/policy; owner copies persist until an approved retention flow.
-- No client UPDATE of approval/outbox tables or role-based bypass.

commit;

-- After isolated database verification, test:
-- 1. anonymous read/write denial; 2. owner A cannot read/modify owner B;
-- 3. insert revision 1; 4. exact revision update; 5. stale version 0 rows;
-- 6. concurrent duplicate insert -> unique conflict; 7. signed-out denial;
-- 8. source client and app claim refer to the same exact Supabase project.
-- Never set JHADINA_SOCIAL_STUDIO_STORAGE_ENABLED=true before these proofs.
