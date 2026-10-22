-- Applied 2026-10-22 UTC via the approved Jhadina Supabase migration mechanism.
-- Only expands public-source provider allowlist to GitHub. Existing owner RLS and grants unchanged.
alter table public.jhadina_feed_connections
 drop constraint jhadina_feed_connections_provider_check;
alter table public.jhadina_feed_connections
 add constraint jhadina_feed_connections_provider_check
 check (provider in ('youtube','facebook_page','instagram_professional','tiktok_creator',
                    'reddit','bluesky','mastodon','github'));
