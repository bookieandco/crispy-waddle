#!/usr/bin/env bash
# Run ONLY against a disposable local PostgreSQL service in CI.
# This script rejects every non-loopback hostname and never uses production credentials.
set -euo pipefail
HOST="${PGHOST:-127.0.0.1}"
if [[ "$HOST" != "127.0.0.1" && "$HOST" != "localhost" ]]; then
  echo "DIRECTOR_UGC_MIGRATION_LOOPBACK_ONLY" >&2
  exit 1
fi
export PGHOST="$HOST"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-director_ugc_ci}"
export PGPASSWORD="${PGPASSWORD:-director-ci-local-fixture}"
test "$PGDATABASE" = "director_ugc_ci" || { echo "DIRECTOR_UGC_MIGRATION_FIXTURE_DB_REQUIRED" >&2; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  echo "DIRECTOR_POSTGRESQL_CLIENT_MISSING" >&2
  exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists auth;
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;
create table if not exists auth.users(id uuid primary key);
SQL

FILE="supabase/migrations/20261007230500_director_local_ugc_canary_receipts.sql"
# An unapplied source migration must parse, apply, and idempotently replay.
psql -X -v ON_ERROR_STOP=1 --single-transaction -f "$FILE"
psql -X -v ON_ERROR_STOP=1 --single-transaction -f "$FILE"

psql -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into auth.users(id) values('11111111-1111-1111-1111-111111111111');
insert into public.director_local_ugc_canary_receipts
  (project_id,owner_user_id,canary_id,next_boundary,admissible_to_advance,
   complete,snapshot_sha256,commissioning_decision,canary_state)
values
  ('director:ci-fixture','11111111-1111-1111-1111-111111111111',
   'fixture-1','RUNTIME_HEALTH_REQUIRED',false,false,repeat('a',64),'{}','{}');

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='director_local_ugc_canary_receipts'
      and c.relrowsecurity
  ) then
    raise exception 'DIRECTOR_UGC_RLS_DISABLED';
  end if;
  if not has_table_privilege('service_role','public.director_local_ugc_canary_receipts','SELECT')
    or not has_table_privilege('service_role','public.director_local_ugc_canary_receipts','INSERT')
    or has_table_privilege('service_role','public.director_local_ugc_canary_receipts','UPDATE')
    or has_table_privilege('service_role','public.director_local_ugc_canary_receipts','DELETE')
    or has_table_privilege('anon','public.director_local_ugc_canary_receipts','SELECT')
    or has_table_privilege('authenticated','public.director_local_ugc_canary_receipts','INSERT')
  then
    raise exception 'DIRECTOR_UGC_LEDGER_PRIVILEGES_INCORRECT';
  end if;
  if (select count(*) from public.director_local_ugc_canary_receipts
      where project_id='director:ci-fixture') != 1 then
    raise exception 'DIRECTOR_UGC_LEDGER_INSERT_FAILED';
  end if;
end $$;

do $$
begin
  begin
    insert into public.director_local_ugc_canary_receipts
      (project_id,owner_user_id,canary_id,next_boundary,
       admissible_to_advance,complete,snapshot_sha256,commissioning_decision,canary_state)
    values ('director:ci-fixture','11111111-1111-1111-1111-111111111111',
      'fixture-invalid','RUNTIME_HEALTH_REQUIRED',false,false,'not-a-sha','{}','{}');
    raise exception 'DIRECTOR_UGC_INVALID_SHA_ACCEPTED';
  exception when check_violation then null;
  end;

  begin
    insert into public.director_local_ugc_canary_receipts
      (project_id,owner_user_id,canary_id,next_boundary,
       admissible_to_advance,complete,snapshot_sha256,commissioning_decision,canary_state)
    values ('director:ci-fixture','11111111-1111-1111-1111-111111111111',
      'fixture-1','RUNTIME_HEALTH_REQUIRED',false,false,repeat('a',64),'{}','{}');
    raise exception 'DIRECTOR_UGC_DUPLICATE_SNAPSHOT_ACCEPTED';
  exception when unique_violation then null;
  end;
end $$;
rollback;
SQL
echo "DIRECTOR_UGC_MIGRATION_DISPOSABLE_POSTGRES_PASS"
