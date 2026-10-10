-- MUSIC-SECURITY.21: ADMISSION SCRIPT ONLY — DO NOT AUTO-APPLY.
-- Database unavailable 2026-10-09. Review/backup/verify existing policies before use.
-- The music_* base schema defines user_id TEXT and no RLS. Without these policies
-- an authenticated Data API client could read/write another user's library.
--
-- Owner/operator actions BEFORE running:
-- (1) Restore SWLC from disk-full outage and prove a real writable Postgres SQL query;
-- (2) inspect all existing pg_policies for music_* and storage.objects;
-- (3) reconcile existing named policies, grants, auth roles and indexes;
-- (4) ensure service_role remains exclusively server-side, never NEXT_PUBLIC.
-- This script deliberately does NOT configure PUBLIC anonymous music access.

begin;

alter table public.music_sources enable row level security;
alter table public.music_artists enable row level security;
alter table public.music_albums enable row level security;
alter table public.music_tracks enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_assets enable row level security;
alter table public.music_artwork enable row level security;
alter table public.music_lyrics enable row level security;
alter table public.music_listening_events enable row level security;

-- Revoke ambient privileges explicitly before restoring authenticated-only access.
revoke all on public.music_sources, public.music_artists, public.music_albums,
 public.music_tracks, public.music_playlists, public.music_assets,
 public.music_artwork, public.music_lyrics, public.music_listening_events
 from anon, public;

grant select, insert, update, delete on
 public.music_artists, public.music_albums, public.music_tracks,
 public.music_playlists, public.music_artwork, public.music_lyrics,
 public.music_listening_events to authenticated;
grant select, insert, update on public.music_sources to authenticated;
-- User-facing clients may read admitted audio assets, but must never mint rights
-- grants by inserting assets with provenance.playbackAuthorized=true.
grant select on public.music_assets to authenticated;

-- Policy names intentionally scoped to Jhadina Music. Only these managed
-- policy names are replaced; other pre-existing policies require manual audit.
do $$
declare t text;
begin
  foreach t in array ARRAY[
    'music_artists','music_albums','music_tracks','music_playlists',
    'music_artwork','music_lyrics','music_listening_events'
  ] loop
    execute format('drop policy if exists music_owner_select on public.%I', t);
    execute format('drop policy if exists music_owner_insert on public.%I', t);
    execute format('drop policy if exists music_owner_update on public.%I', t);
    execute format('drop policy if exists music_owner_delete on public.%I', t);
    execute format('create policy music_owner_select on public.%I for select to authenticated using (user_id = (select auth.uid())::text)', t);
    execute format('create policy music_owner_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid())::text)', t);
    execute format('create policy music_owner_update on public.%I for update to authenticated using (user_id = (select auth.uid())::text) with check (user_id = (select auth.uid())::text)', t);
    execute format('create policy music_owner_delete on public.%I for delete to authenticated using (user_id = (select auth.uid())::text)', t);
  end loop;
end $$;

drop policy if exists music_owner_select on public.music_sources;
drop policy if exists music_owner_unapproved_insert on public.music_sources;
drop policy if exists music_owner_unapproved_update on public.music_sources;
create policy music_owner_select on public.music_sources
 for select to authenticated using (user_id = (select auth.uid())::text);
-- A client may import *unapproved metadata only*. It cannot grant listening rights.
create policy music_owner_unapproved_insert on public.music_sources
 for insert to authenticated with check (
   user_id = (select auth.uid())::text and authorized = false
 );
create policy music_owner_unapproved_update on public.music_sources
 for update to authenticated using (
   user_id = (select auth.uid())::text and authorized = false
 ) with check (
   user_id = (select auth.uid())::text and authorized = false
 );

drop policy if exists music_owner_select on public.music_assets;
create policy music_owner_select on public.music_assets
 for select to authenticated using (user_id = (select auth.uid())::text);
-- No INSERT/UPDATE/DELETE policies or grants for authenticated on music_assets.
-- Only independently vetted operator-owned ingestion is allowed to add media.

-- Optional hard lock against table owners bypassing RLS; service_role (BYPASSRLS)
-- still requires explicit server-side authorization and managed credentials.
alter table public.music_sources force row level security;
alter table public.music_artists force row level security;
alter table public.music_albums force row level security;
alter table public.music_tracks force row level security;
alter table public.music_playlists force row level security;
alter table public.music_assets force row level security;
alter table public.music_artwork force row level security;
alter table public.music_lyrics force row level security;
alter table public.music_listening_events force row level security;

commit;

-- MANUAL SECURITY ACCEPTANCE (do not mark passed from this SQL file alone):
-- 1. Two real JWT-backed users: A cannot SELECT/UPDATE/DELETE B rows.
-- 2. Client attempts to INSERT authorized=true source MUST fail.
-- 3. Client attempts to INSERT music_assets with playbackAuthorized=true MUST fail.
-- 4. Owner's metadata-only Spotify/YouTube imports still work.
-- 5. Operator-vetted asset INSERT via secured privileged backend works.
-- 6. Anonymous requests cannot read music tables.
