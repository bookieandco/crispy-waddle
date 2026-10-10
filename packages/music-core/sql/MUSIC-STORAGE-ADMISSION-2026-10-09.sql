-- MUSIC-SECURITY.22: Storage and resume policies, REVIEW BEFORE APPLY.
-- Prerequisite: independently verified writable SWLC PostgreSQL and existing
-- private Supabase Storage bucket `music-owned`. No bucket is created here.
-- Bucket must be private and must enforce an operator-reviewed size/MIME limit.
-- Policy OR-composition: inventory existing storage.objects policies first!
-- A permissive older policy can override these restrictions.

begin;

-- Keep the checkpoint table visible to its authenticated owner only.
alter table public.music_playback_checkpoints enable row level security;
alter table public.music_playback_checkpoints force row level security;
revoke all on public.music_playback_checkpoints from anon, public;
grant select, insert, update on public.music_playback_checkpoints to authenticated;
-- Existing policies from 002_music_playback_checkpoints.sql must be reviewed,
-- especially SELECT ownership requirements for UPDATE.

-- Private Storage object access is restricted by owner UUID folder and bucket.
-- These policies deliberately do not allow overwrite or DELETE from clients:
-- an owner should not silently replace already-admitted licensed audio bytes.
drop policy if exists jhadina_music_owner_read on storage.objects;
drop policy if exists jhadina_music_owner_create on storage.objects;
create policy jhadina_music_owner_read on storage.objects
 for select to authenticated
 using (
   bucket_id = 'music-owned'
   and (storage.foldername(name))[1] = (select auth.uid())::text
 );
create policy jhadina_music_owner_create on storage.objects
 for insert to authenticated
 with check (
   bucket_id = 'music-owned'
   and (storage.foldername(name))[1] = (select auth.uid())::text
   and storage.extension(name) in ('mp3','wav','flac','m4a','aac','ogg','opus')
 );
-- No UPDATE/DELETE policy introduced. A separate privileged rights review
-- must admit a corresponding music_assets row with playbackAuthorized=true.

commit;

-- DEPLOYMENT RECEIPTS, NOT CODE ASSUMPTIONS:
-- A can list/sign own object; A cannot list/sign B object; anon neither.
-- A cannot overwrite, move or delete a reviewed object with an ordinary token.
-- A cannot issue signed upload for another user folder.
-- Neither A nor B can INSERT an approved music_assets source directly.
-- Verify the bucket private flag and its file_size_limit/allowed_mime_types.
