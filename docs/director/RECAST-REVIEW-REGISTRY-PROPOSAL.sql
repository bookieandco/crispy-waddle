-- RECAST REVIEW REGISTRY — SOURCE PROPOSAL ONLY (NOT A MIGRATION)
-- DO NOT APPLY without exact project environment, data-api/RLS audit,
-- security review, reviewer identity/capability proof and owner approval.
-- This is intentionally in docs/, not supabase/migrations/.
-- No extension, secret key, GPU account, storage bucket or public API is created.

create table if not exists public.director_recast_review_receipts (
  id uuid primary key,
  project_id text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check(kind in ('media-probe','tracking','voice','rights')),
  source_video_asset_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  character_image_asset_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  source_audio_asset_id uuid not null references public.jhadina_artifacts(id) on delete restrict,
  source_video_sha256 text not null check (source_video_sha256 ~ '^[a-f0-9]{64}$'),
  character_image_sha256 text not null check (character_image_sha256 ~ '^[a-f0-9]{64}$'),
  source_audio_sha256 text not null check (source_audio_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_by_user_id uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > reviewed_at),
  status text not null check(status in ('approved','rejected')),
  method text not null check(method in ('trusted-media-probe','human-review')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (reviewed_at <= created_at),
  check ((kind='media-probe' and method='trusted-media-probe')
      or (kind<>'media-probe' and method='human-review'))
);

create index if not exists director_recast_review_by_selection_idx
  on public.director_recast_review_receipts
  (project_id,owner_user_id,source_video_asset_id,character_image_asset_id,source_audio_asset_id,created_at desc,id desc);

alter table public.director_recast_review_receipts enable row level security;
revoke all on public.director_recast_review_receipts from public,anon,authenticated,service_role;
grant select,insert on public.director_recast_review_receipts to service_role;

drop policy if exists director_recast_review_service_only
  on public.director_recast_review_receipts;
create policy director_recast_review_service_only
  on public.director_recast_review_receipts for select
  to service_role using (true);

-- Privileged writers still require the independent authenticated reviewer
-- checks implemented in the future server-side review service. The public
-- Data API roles remain fully revoked; INSERT is service-role-only.
drop policy if exists director_recast_review_service_insert
  on public.director_recast_review_receipts;
create policy director_recast_review_service_insert
  on public.director_recast_review_receipts for insert
  to service_role with check (true);

-- SECURITY INVOKER trigger checks reviewer membership and project/source lineage;
-- service_role may BYPASSRLS; rely on explicit grants and triggers, not RLS alone.
-- it cannot itself prove consent, scanner output or human attentiveness.
-- Do not deploy until those independently verified server capabilities exist.
create or replace function public.assert_director_recast_review_receipt()
returns trigger language plpgsql security invoker set search_path=public as $$
declare
  reviewer_role text;
  source_owner uuid;
begin
  select role into reviewer_role
  from public.director_project_memberships
  where project_id=new.project_id and user_id=new.reviewed_by_user_id;
  -- The DB append clock, not client-supplied reviewed_at, defines revocation
  -- precedence. The insert cannot impersonate an earlier/latest append.
  if new.created_at < transaction_timestamp() - interval '60 seconds'
      or new.created_at > transaction_timestamp() + interval '60 seconds'
      or new.reviewed_at > new.created_at
      or new.reviewed_at < new.created_at - interval '10 minutes'
      or new.expires_at <= new.created_at
      or new.expires_at > new.created_at + interval '30 minutes' then
    raise exception 'Director Recast immutable append/review clock invalid';
  end if;
  if reviewer_role not in ('owner','editor') or reviewer_role is null then
    raise exception 'Director Recast authorized reviewer required';
  end if;
  select owner_user_id into source_owner
  from public.jhadina_artifacts where id=new.source_video_asset_id;
  if source_owner is distinct from new.owner_user_id then
    raise exception 'Director Recast owner/source mismatch';
  end if;
  if not exists (
    select 1 from public.director_project_inputs
    where project_id=new.project_id and owner_user_id=new.owner_user_id
      and artifact_id=new.source_video_asset_id and role='footage'
  ) or not exists (
    select 1 from public.director_project_inputs
    where project_id=new.project_id and owner_user_id=new.owner_user_id
      and artifact_id=new.character_image_asset_id and role='reference'
  ) or not exists (
    select 1 from public.director_project_inputs
    where project_id=new.project_id and owner_user_id=new.owner_user_id
      and artifact_id=new.source_audio_asset_id and role='audio'
  ) then
    raise exception 'Director Recast source media must be bound to the project';
  end if;
  if not exists (
    select 1 from public.jhadina_artifacts
    where id=new.source_video_asset_id
      and sha256=new.source_video_sha256
      and status='clean'
  ) or not exists (
    select 1 from public.jhadina_artifacts
    where id=new.character_image_asset_id
      and owner_user_id=new.owner_user_id
      and sha256=new.character_image_sha256
      and status='clean'
  ) or not exists (
    select 1 from public.jhadina_artifacts
    where id=new.source_audio_asset_id
      and owner_user_id=new.owner_user_id
      and sha256=new.source_audio_sha256
      and status='clean'
  ) then
    raise exception 'Director Recast immutable media hash mismatch';
  end if;
  return new;
end
$$;

drop trigger if exists director_recast_review_lineage_guard
  on public.director_recast_review_receipts;
create trigger director_recast_review_lineage_guard
before insert on public.director_recast_review_receipts
for each row execute function public.assert_director_recast_review_receipt();

create or replace function public.reject_director_recast_review_mutation()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  raise exception 'Director Recast review receipts are append-only';
end
$$;

drop trigger if exists director_recast_review_immutable
  on public.director_recast_review_receipts;
create trigger director_recast_review_immutable
before update or delete on public.director_recast_review_receipts
for each row execute function public.reject_director_recast_review_mutation();

-- Production prerequisites NOT supplied by this proposal:
-- 1) new explicit review POST endpoint requiring Supabase getUser() and
--    requireDirectorProjectAuthority(...,capability='approve'), per-kind
--    evidence schema, verified digest and independently reviewed data.
-- 2) No generic "approve-all" RPC; review records must be distinct receipts
--    from actual independently validated track/audio/media rights operations.
-- 3) Media probe must use an admitted local immutable file verified by hash.
-- 4) SQL must be generated with Supabase CLI, audited with db advisors and
--    staged/verified in a disposable branch before production promotion.
-- 5) Existing user-submitted IDs/consent reference strings NEVER suffice.

-- STAGING VERIFICATION REQUIRED: assert table privileges (anon/authenticated
-- no access, service_role SELECT/INSERT only), trigger immutability, foreign
-- asset/project rejection, expired receipt rejection at the API, and SHA
-- changes after admission. Confirm schema against actual project first.
