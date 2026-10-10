-- MUSIC-SECURITY.25: READ-ONLY SQL for manual operator recheck after SWLC recovery.
-- Never substitute an ACTIVE_HEALTHY dashboard label for genuine SQL success.
select current_database() as database_name, pg_is_in_recovery() as in_recovery;

-- Catalog table visibility and tenant RLS state (any false blocks deployment).
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
  and c.relname in (
   'music_sources','music_artists','music_albums','music_tracks',
   'music_playlists','music_assets','music_artwork','music_lyrics',
   'music_listening_events','music_playback_checkpoints'
  )
order by c.relname;

-- Review every existing policy before applying a new one; permissive OR
-- compositions can silently override newly written restrictive policies.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename like 'music_%')
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Bucket must be private; enforce file size and MIME configuration.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'music-owned';

-- Check effective table-level grants (not a replacement for two-user live RLS tests).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'music_%'
  and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;
