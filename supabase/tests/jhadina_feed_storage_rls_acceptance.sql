-- JH-UX2.STORAGE.05 isolated Postgres acceptance only.
-- Run after ephemeral_bootstrap.sql and UNAPPLIED proposal, never on Swlc.
\set ON_ERROR_STOP on
INSERT INTO public.jhadina_feed_connections
 (user_id,provider,source_account,source_kind,capability,state)
VALUES
 ('11111111-1111-4111-8111-111111111111','bluesky','alice.bsky.social','public_author','public_read','healthy'),
 ('22222222-2222-4222-8222-222222222222','bluesky','bob.bsky.social','public_author','public_read','healthy');
INSERT INTO public.jhadina_feed_items
 (user_id,provider,source_account,external_id,title,summary,occurred_at,url,provenance)
VALUES
 ('11111111-1111-4111-8111-111111111111','bluesky','alice.bsky.social','a1','Alice post','Verified fixture',now(),'https://bsky.app/profile/alice.bsky.social/post/a1','["bluesky:test"]'::jsonb),
 ('22222222-2222-4222-8222-222222222222','bluesky','bob.bsky.social','b1','Bob post','Verified fixture',now(),'https://bsky.app/profile/bob.bsky.social/post/b1','["bluesky:test"]'::jsonb);
INSERT INTO public.jhadina_feed_sync_runs (user_id,provider,source_account,status)
VALUES
 ('11111111-1111-4111-8111-111111111111','bluesky','alice.bsky.social','succeeded'),
 ('22222222-2222-4222-8222-222222222222','bluesky','bob.bsky.social','succeeded');

DO $$
DECLARE table_name text;
BEGIN
 FOR table_name IN SELECT unnest(array['jhadina_feed_connections','jhadina_feed_items','jhadina_feed_sync_runs'])
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=table_name AND c.relrowsecurity)
   THEN RAISE EXCEPTION 'RLS_NOT_ENABLED:%',table_name;END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=table_name
      AND cmd='SELECT' AND 'authenticated'=ANY(roles)) <> 1
   THEN RAISE EXCEPTION 'MISSING_SINGLE_OWNER_READ_POLICY:%',table_name;END IF;
  IF has_table_privilege('anon','public.'||table_name,'SELECT')
     OR has_table_privilege('authenticated','public.'||table_name,'INSERT')
     OR has_table_privilege('authenticated','public.'||table_name,'UPDATE')
     OR has_table_privilege('authenticated','public.'||table_name,'DELETE')
   THEN RAISE EXCEPTION 'UNEXPECTED_CLIENT_WRITE_OR_ANON_READ:%',table_name;END IF;
 END LOOP;
END $$;
-- Test owners under the effective authenticated role, not the postgres superuser.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.jhadina_feed_connections)<>1
   OR (SELECT count(*) FROM public.jhadina_feed_items)<>1
   OR (SELECT count(*) FROM public.jhadina_feed_sync_runs)<>1
 THEN RAISE EXCEPTION 'OWNER_A_VISIBILITY_FAILED';END IF;
 IF EXISTS(SELECT 1 FROM public.jhadina_feed_items WHERE user_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'OWNER_A_LEAK';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.jhadina_feed_connections)<>1
   OR (SELECT count(*) FROM public.jhadina_feed_items)<>1
   OR (SELECT count(*) FROM public.jhadina_feed_sync_runs)<>1
 THEN RAISE EXCEPTION 'OWNER_B_VISIBILITY_FAILED';END IF;
 IF EXISTS(SELECT 1 FROM public.jhadina_feed_items WHERE user_id='11111111-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'OWNER_B_LEAK';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.jhadina_feed_connections)<>0
   OR (SELECT count(*) FROM public.jhadina_feed_items)<>0
   OR (SELECT count(*) FROM public.jhadina_feed_sync_runs)<>0
 THEN RAISE EXCEPTION 'NULL_AUTH_UID_LEAK';END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 -- Cross-owner FK prevents even a privileged ingestion worker from attaching
 -- an item to another owner's registered source.
 BEGIN
  INSERT INTO public.jhadina_feed_items
    (user_id,provider,source_account,external_id,title,summary,occurred_at,url)
  VALUES ('11111111-1111-4111-8111-111111111111','bluesky','bob.bsky.social','wrong-source','bad','bad',now(),'https://bsky.app/example');
  RAISE EXCEPTION 'EXPECTED_CROSS_OWNER_FK';
 EXCEPTION WHEN foreign_key_violation THEN NULL;END;
 -- Duplicate owner/provider/external identifier is rejected.
 BEGIN
  INSERT INTO public.jhadina_feed_items
    (user_id,provider,source_account,external_id,title,summary,occurred_at,url)
  VALUES ('11111111-1111-4111-8111-111111111111','bluesky','alice.bsky.social','a1','duplicate','duplicate',now(),'https://bsky.app/example');
  RAISE EXCEPTION 'EXPECTED_DUPLICATE_REJECTION';
 EXCEPTION WHEN unique_violation THEN NULL;END;
END $$;
-- Anonymous role has no table access; no pretending that denied SELECT returns 0.
SET ROLE anon;
DO $$
BEGIN
 IF has_table_privilege(current_user,'public.jhadina_feed_items','SELECT')
 THEN RAISE EXCEPTION 'ANONYMOUS_READ_GRANTED';END IF;
END $$;
RESET ROLE;
SELECT 'JH-UX2.STORAGE.05: PASS two-owner/anon/RLS/permissions/FK/unique' as acceptance;
