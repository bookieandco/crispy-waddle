#!/usr/bin/env bash
# Real two-session SQL regression against the isolated CI PostgreSQL service.
# No calls to SWLC, providers, delivery channels, paid compute or Supabase.
set -euo pipefail

: "${DATABASE_URL:?Point DATABASE_URL at isolated CI postgres only}"
export PGPASSWORD="${PGPASSWORD:?Set the isolated test database password}"

psql -X -v ON_ERROR_STOP=1 -q "$DATABASE_URL" <<'SQL'
truncate table public.jhadina_safety_incidents cascade;
insert into public.jhadina_safety_incidents
  (incident_id,owner_id,protocol_id,dead_man_state,deadline_at)
values ('incident_concurrent','owner-test','protocol-test','armed','2026-10-12T11:00:00Z');
SQL

lock_log="$(mktemp)"
trap 'rm -f "$lock_log"' EXIT

# Session A holds the *incident* row lock for six seconds.
(
  PGAPPNAME=safety-deadman-lock-holder psql -X -v ON_ERROR_STOP=1 -qAt "$DATABASE_URL" <<'SQL'
begin;
select incident_id from public.jhadina_safety_incidents
where incident_id='incident_concurrent' for update;
select pg_sleep(6);
commit;
SQL
) >"$lock_log" 2>&1 &
holder_pid=$!

# Wait for A to reach pg_sleep, which occurs after it has acquired FOR UPDATE.
ready=0
for ((attempt=0;attempt<45;attempt++)); do
  if ! kill -0 "$holder_pid" 2>/dev/null; then
    cat "$lock_log" >&2
    echo "Lock holder exited before acquiring row lock" >&2
    exit 1
  fi
  active="$(psql -X -v ON_ERROR_STOP=1 -At "$DATABASE_URL" -c "
    select count(*) from pg_stat_activity
    where application_name='safety-deadman-lock-holder'
      and state='active' and query like '%pg_sleep(6)%'
  ")"
  if [[ "$active" == "1" ]]; then
    ready=1
    break
  fi
  sleep 0.1
done
if [[ "$ready" != 1 ]]; then
  cat "$lock_log" >&2
  echo "Lock holder did not reach the controlled lock window" >&2
  exit 1
fi

# Session B must skip the locked incident promptly rather than block or claim.
blocked_count="$(PGOPTIONS='-c statement_timeout=2000' psql -X -v ON_ERROR_STOP=1 -At "$DATABASE_URL" -c "
  select count(*) from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,50);
")"
if [[ "$blocked_count" != "0" ]]; then
  echo "Worker claimed incident while it was locked: $blocked_count" >&2
  exit 1
fi

wait "$holder_pid"
if [[ -s "$lock_log" ]] && grep -qi 'ERROR:' "$lock_log"; then
  cat "$lock_log" >&2
  exit 1
fi

# Now B can claim once, and a replay before expiration must claim zero.
first="$(psql -X -v ON_ERROR_STOP=1 -At "$DATABASE_URL" -c "
  select count(*) from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,50);
")"
repeat="$(psql -X -v ON_ERROR_STOP=1 -At "$DATABASE_URL" -c "
  select count(*) from public.claim_due_jhadina_safety_incidents(
    '2026-10-12T12:00:00Z'::timestamptz,120,50);
")"
persisted="$(psql -X -v ON_ERROR_STOP=1 -At "$DATABASE_URL" -c "
  select count(*) from public.jhadina_safety_deadman_leases
  where incident_id='incident_concurrent' and lease_id is not null;
")"
if [[ "$first" != "1" || "$repeat" != "0" || "$persisted" != "1" ]]; then
  echo "Lock/lease regression: first=$first replay=$repeat persisted=$persisted" >&2
  exit 1
fi
echo "SAFETY-DEADMAN two-session lock/replay regression PASSED"
