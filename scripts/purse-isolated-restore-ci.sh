#!/usr/bin/env bash
# JH-PURSE-ISOLATED-RESTORE.CI.01
# Synthetic GitHub Actions fixture only. Never touches, copies or certifies SWLC production.
set -euo pipefail

EXPECTED_SOURCE='postgresql://jhadina:jhadina@localhost:5432/jhadina_test'
if [[ "${CI:-}" != "true" || "${DATABASE_URL:-}" != "$EXPECTED_SOURCE" ]]; then
  echo 'Refusing restore rehearsal outside the pinned ephemeral CI database' >&2
  exit 30
fi
for binary in docker pg_dump pg_restore pg_isready psql sha256sum; do
  command -v "$binary" >/dev/null || { echo "Missing $binary" >&2; exit 31; }
done

TEMP_DIR="$(mktemp -d)"
RESTORE_CONTAINER="purse-restore-fixture-${GITHUB_RUN_ID:-local}"
RESTORE_PORT=5544
RESTORE_URL="postgresql://jhadina:jhadina@127.0.0.1:${RESTORE_PORT}/jhadina_test"
ROOT_URL="postgresql://jhadina:jhadina@127.0.0.1:${RESTORE_PORT}/postgres"
cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    docker logs "$RESTORE_CONTAINER" 2>&1 | tail -30 || true
  fi
  docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Backup only synthetic data created by the existing Side Hustle Postgres CI service.
PGPASSWORD=jhadina pg_dump --format=custom --no-owner \
  --dbname="$DATABASE_URL" --file="$TEMP_DIR/synthetic-source.dump"
test -s "$TEMP_DIR/synthetic-source.dump"
BACKUP_DIGEST="$(sha256sum "$TEMP_DIR/synthetic-source.dump" | awk '{print $1}')"
echo "Synthetic fixture dump checksum: $BACKUP_DIGEST"

# A separate PostgreSQL container/cluster; never a Supabase instance or billable resource.
docker run --detach --rm --name "$RESTORE_CONTAINER" \
  --publish "127.0.0.1:${RESTORE_PORT}:5432" \
  --env POSTGRES_USER=jhadina --env POSTGRES_PASSWORD=jhadina \
  --env POSTGRES_DB=jhadina_test postgres:16-alpine >/dev/null
READY=0
for i in $(seq 1 45); do
  if PGPASSWORD=jhadina pg_isready -q -d "$RESTORE_URL"; then READY=1; break; fi
  sleep 1
done
if [[ "$READY" != 1 ]]; then echo 'Isolated restore Postgres did not become ready' >&2; exit 32; fi

# Cluster-level roles are deliberately outside pg_dump. Recreate only test roles.
PGPASSWORD=jhadina psql "$ROOT_URL" -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
SQL

PGPASSWORD=jhadina pg_restore --no-owner --exit-on-error \
  --dbname="$RESTORE_URL" "$TEMP_DIR/synthetic-source.dump" >/dev/null

# Exact sorted synthetic records must survive the restore into an independent cluster.
fingerprint() {
  local dsn="$1"
  PGPASSWORD=jhadina psql "$dsn" -X -A -t -q -v ON_ERROR_STOP=1 \
    -c "SELECT user_id::text || '|' || id || '|' || amount::text
          FROM public.jhadina_side_hustle_work_orders
         ORDER BY user_id, id;" | sha256sum | awk '{print $1}'
}
SOURCE_FP="$(fingerprint "$DATABASE_URL")"
RESTORED_FP="$(fingerprint "$RESTORE_URL")"
if [[ "$SOURCE_FP" != "$RESTORED_FP" ]]; then
  echo 'Source/restored work-order data fingerprint mismatch' >&2
  exit 33
fi
ROW_COUNT="$(PGPASSWORD=jhadina psql "$RESTORE_URL" -X -A -t -q -v ON_ERROR_STOP=1 \
  -c 'select count(*) from public.jhadina_side_hustle_work_orders;')"
if [[ ! "$ROW_COUNT" =~ ^[0-9]+$ || "$ROW_COUNT" -lt 2 ]]; then
  echo 'Restored synthetic test population missing' >&2
  exit 34
fi

# Prove public/anon privileges and owner isolation still work after restoration.
PGPASSWORD=jhadina psql "$RESTORE_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/purse-commercial-isolated-rls-smoke.sql >/dev/null

# Verify the other four schema entities survived along with owner-predicate RLS.
PGPASSWORD=jhadina psql "$RESTORE_URL" -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $verify$
DECLARE
  n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'jhadina_side_hustle_work_orders',
    'jhadina_side_hustle_commercial_receipts',
    'jhadina_side_hustle_commerce_records',
    'jhadina_side_hustle_commissioning_evidence',
    'jhadina_digital_product_studio_records'
  ] LOOP
    IF to_regclass('public.'||n) IS NULL THEN
      RAISE EXCEPTION 'Synthetic restore missing required table: %',n;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
      WHERE s.nspname='public' AND c.relname=n AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Synthetic restore lost RLS: %',n;
    END IF;
    IF has_table_privilege('anon','public.'||n,'SELECT') THEN
      RAISE EXCEPTION 'Synthetic restore exposed an owner table: %',n;
    END IF;
  END LOOP;
END $verify$;
SQL

echo 'PASS: isolated-cluster synthetic dump/restore, record digest, RLS and table shape.'
echo 'NOT CERTIFIED: production SWLC backup, owner identity, actual JWT, deployment or DDL.'
