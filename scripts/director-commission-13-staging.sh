#!/usr/bin/env bash
# DISPOSABLE staging only. No SWLC credentials, no live database/branch changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="director-stage-$$"
if [ -n "$(printenv SUPABASE_DB_PASSWORD || true)" ]; then echo "LIVE_CREDENTIALS_FORBIDDEN"; exit 10; fi
command -v docker >/dev/null || { echo "DOCKER_REQUIRED"; exit 11; }
docker run -d --name "$CONTAINER" --network none \
  -e POSTGRES_PASSWORD=disposable-only postgres:17-alpine >/dev/null
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for i in $(seq 1 90); do
  if docker exec "$CONTAINER" pg_isready -U postgres -q >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.jhadina_artifacts(id uuid PRIMARY KEY);
CREATE TABLE public.director_project_memberships(
  project_id text NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL,PRIMARY KEY(project_id,user_id));
CREATE TABLE public.director_generated_editing_assets(id text PRIMARY KEY);
ALTER TABLE public.director_project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_generated_editing_assets ENABLE ROW LEVEL SECURITY;
INSERT INTO auth.users(id) VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
INSERT INTO director_project_memberships(project_id,user_id,role) VALUES
  ('isolated-project','00000000-0000-4000-8000-000000000001','owner'),
  ('isolated-project','00000000-0000-4000-8000-000000000002','viewer');
SQL
FILES="20261003221000_director_durable_workstation_timeline.sql
20261004193000_director_workstation_project_inputs.sql
20261004210000_director_screenplay_ingest_proposals.sql
20261004221000_director_screenplay_blueprints.sql
20261004224500_director_watch_jobs.sql
20261004231500_director_watch_sources_idle_scheduler.sql
20261005000500_director_take_qc_watch_jobs.sql
20261005020000_director_project_final_qc_evidence.sql
20261005023000_director_watch_commissioning_receipts.sql
20261005024500_director_business_canary_receipts.sql"
for name in $FILES; do
  file="$ROOT/supabase/migrations/$name"
  test -f "$file" || { echo "DIRECTOR_STAGING_SOURCE_MISSING:$name"; exit 12; }
  echo "STAGING_SOURCE:$name:$(sha256sum "$file" | cut -c1-16)"
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 < "$file" >/dev/null
done
# Replay deliberately limited to the idempotent CREATE clauses, without
# ALTERs adding one-time constraints; the production migration is NEVER replayed.
for name in $FILES; do
  case "$name" in *take_qc_watch_jobs.sql|*watch_sources_idle_scheduler.sql) continue ;; esac
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
    < "$ROOT/supabase/migrations/$name" >/dev/null
done
docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE missing integer;
BEGIN
 SELECT count(*) INTO missing FROM (VALUES
  ('director_workstation_timelines'),('director_workstation_timeline_events'),
  ('director_project_inputs'),('director_screenplay_ingest_proposals'),
  ('director_screenplay_blueprints'),('director_watch_jobs'),
  ('director_watch_sources'),('director_watch_commissioning_receipts'),
  ('director_project_final_qc_evidence'),('director_project_final_qc_receipts')
 ) required(name) WHERE to_regclass('public.'||name) IS NULL;
 IF missing<>0 THEN RAISE EXCEPTION 'MISSING_TABLES:%',missing; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname LIKE 'director_%'
      AND c.relkind='r' AND NOT c.relrowsecurity) THEN
  RAISE EXCEPTION 'RLS_DISABLED'; END IF;
 IF has_table_privilege('anon','public.director_workstation_timelines','SELECT')
  OR has_table_privilege('authenticated','public.director_workstation_timelines','SELECT')
  OR has_table_privilege('anon','public.director_watch_jobs','SELECT')
  OR has_table_privilege('authenticated','public.director_project_inputs','SELECT')
  OR has_table_privilege('service_role','public.director_workstation_timeline_events','UPDATE')
 THEN RAISE EXCEPTION 'TABLE_GRANT_DRIFT'; END IF;
 IF has_function_privilege('anon',
   'public.save_director_workstation_timeline(text,uuid,bigint,text,jsonb,text,timestamptz)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.save_director_workstation_timeline(text,uuid,bigint,text,jsonb,text,timestamptz)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.save_director_workstation_timeline(text,uuid,bigint,text,jsonb,text,timestamptz)','EXECUTE')
 THEN RAISE EXCEPTION 'RPC_EXECUTE_GRANT_DRIFT'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE rev bigint; cnt integer;
BEGIN
 SELECT revision INTO rev FROM public.save_director_workstation_timeline(
  'isolated-project','00000000-0000-4000-8000-000000000001',0,'init',
  '{"projectId":"isolated-project","tracks":[]}'::jsonb,'init');
 IF rev<>1 THEN RAISE EXCEPTION 'INIT_REVISION_INCORRECT'; END IF;
 SELECT revision INTO rev FROM public.save_director_workstation_timeline(
  'isolated-project','00000000-0000-4000-8000-000000000001',0,'init',
  '{"projectId":"isolated-project","tracks":[]}'::jsonb,'idempotent');
 IF rev<>1 THEN RAISE EXCEPTION 'RETRY_MUTATED_REVISION'; END IF;
 BEGIN
  PERFORM public.save_director_workstation_timeline(
   'isolated-project','00000000-0000-4000-8000-000000000001',0,'stale',
   '{"projectId":"isolated-project"}','stale');
  RAISE EXCEPTION 'STALE_WRITE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'DIRECTOR_TIMELINE_STALE_REVISION%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.save_director_workstation_timeline(
   'isolated-project','00000000-0000-4000-8000-000000000002',1,'viewer',
   '{"projectId":"isolated-project"}','viewer');
  RAISE EXCEPTION 'VIEWER_WRITE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'DIRECTOR_TIMELINE_EDIT_AUTHORITY_REQUIRED%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.save_director_workstation_timeline(
   'isolated-project','00000000-0000-4000-8000-000000000003',1,'nonmember',
   '{"projectId":"isolated-project"}','nonmember');
  RAISE EXCEPTION 'NONMEMBER_WRITE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'DIRECTOR_TIMELINE_EDIT_AUTHORITY_REQUIRED%' THEN RAISE; END IF;
 END;
 SELECT revision INTO rev FROM public.save_director_workstation_timeline(
  'isolated-project','00000000-0000-4000-8000-000000000001',1,'owner-edit',
  '{"projectId":"isolated-project","tracks":[{"id":"video-1"}]}'::jsonb,'edit');
 SELECT count(*) INTO cnt FROM public.director_workstation_timeline_events;
 IF rev<>2 OR cnt<>2 THEN RAISE EXCEPTION 'EVENT_LEDGER_INVALID'; END IF;
END $$;
RESET ROLE;
SQL
echo 'DIRECTOR_COMMISSION_13_POSTGRES17_DISPOSABLE_PASS'
echo 'LIVE_DATABASE_UNCHANGED; NO_RESTORE_PROOF; NO_PRODUCTION_DDL_AUTHORITY'
