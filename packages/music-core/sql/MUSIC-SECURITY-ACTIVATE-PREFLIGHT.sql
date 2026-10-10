-- MUSIC-SECURITY.ACTIVATE.26
-- Run against a recovered database as a READ-ONLY preflight, before applying
-- the reviewed Music policy scripts. Raises an error if permissive/unknown
-- pre-existing Music catalog policies might defeat owner isolation.
-- NEVER assume a newly added permissive policy overrides another permissive
-- policy: PostgreSQL combines them using OR.
do $music_preflight$
declare
  violations text;
begin
  select string_agg(format('%I.%I:%I %s', schemaname, tablename, policyname, cmd), ', ')
    into violations
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'music_sources','music_artists','music_albums','music_tracks',
      'music_playlists','music_assets','music_artwork','music_lyrics',
      'music_listening_events','music_playback_checkpoints'
    )
    and (
      -- The named managed policies are the only policies eligible for review.
      policyname not in (
        'music_owner_select','music_owner_insert','music_owner_update',
        'music_owner_delete','music_owner_unapproved_insert',
        'music_owner_unapproved_update',
        'music checkpoint select own','music checkpoint insert own',
        'music checkpoint update own'
      )
      or 'public' = any(roles)
      or 'anon' = any(roles)
    );
  if violations is not null then
    raise exception 'Music RLS preflight refused: audit unexpected policies %', violations;
  end if;
end $music_preflight$;

-- Storage policy names are shared across every bucket; inventory and review
-- storage.objects policy expressions manually before applying any storage
-- changes. A global permissive policy could bypass music-owned restrictions.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='storage' and tablename='objects'
order by policyname;

-- Verify the current Music tables are real and their policies are known.
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'music_%'
  and c.relkind in ('r','p')
order by c.relname;
