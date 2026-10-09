#!/usr/bin/env bash
set -euo pipefail

ROOT="${JHADINA_GPU_ROOT:-/workspace/jhadina}"
REPO="${ROOT}/crispy-waddle"
STATE_ROOT="${SHARK_SHADOW_DATA_DIR:-${ROOT}/shark-shadow}"
PGDATA="${STATE_ROOT}/postgres"
PGSOCKET="${STATE_ROOT}/socket"
PGLOG="${STATE_ROOT}/postgres.log"
SERVICE_LOG="${STATE_ROOT}/shadow-service.log"
PID_FILE="${STATE_ROOT}/shadow-service.pid"
PGPORT="${SHARK_SHADOW_POSTGRES_PORT:-55432}"
HEALTH_PORT="${SHARK_SHADOW_HEALTH_PORT:-8094}"
SOURCE_REF="${SHARK_SHADOW_SOURCE_REF:-main}"
PGUSER_NAME="${SHARK_SHADOW_POSTGRES_USER:-jhadina_shadow_pg}"
PGDATABASE_NAME="${SHARK_SHADOW_POSTGRES_DB:-jhadina_shadow}"

# SHADOW-REPAIR.1: decide whether this is the ORIGINAL ledger before changing
# permissions, installing dependencies, running migrations or starting services.
# Never mistake a newly initialized empty ledger for recovered history.
shadow_ledger_admission() {
  if [[ "$STATE_ROOT" != /* || "$STATE_ROOT" == "/" || "$STATE_ROOT" == "/workspace" ]]; then
    echo "SHADOW_LEDGER_STATE_ROOT_UNSAFE" >&2
    return 6
  fi
  if [[ -L "$STATE_ROOT" || -L "$PGDATA" ]]; then
    echo "SHADOW_LEDGER_SYMLINK_REJECTED" >&2
    return 6
  fi
  if [[ -f "$PGDATA/PG_VERSION" ]]; then
    # A fresh research ledger may restart only when a private genesis marker
    # binds this exact PGDATA, AND actual encrypted remote backup and isolated
    # restore receipts have been reviewed on the owner-controlled worker.
    if [[ "${SHARK_SHADOW_FRESH_LEDGER_RESTART_APPROVED:-}" == "YES" ]]; then
      if ! python3 "$(dirname "$0")/shark-shadow-fresh-ledger-genesis.py" verify \
        --state-root "$STATE_ROOT" \
        --backup-receipt "${SHARK_SHADOW_FRESH_BACKUP_RECEIPT:-}" \
        --restore-receipt "${SHARK_SHADOW_FRESH_RESTORE_RECEIPT:-}" >/dev/null; then
        echo "SHADOW_FRESH_LEDGER_RESTART_RECEIPTS_INVALID_NO_MUTATION" >&2
        return 6
      fi
      echo "SHADOW_LEDGER_FRESH_RESTART_ADMITTED"
      return 0
    fi
    # Existing PostgreSQL may contain unique learning history. This bootstrap
    # must not apply migrations, kill the old worker, or restart PostgreSQL
    # until the operator supplies an independently verified COPY receipt.
    # Approval flags alone cannot bypass the receipt's scope and digest checks.
    if [[ "${SHARK_SHADOW_EXISTING_LEDGER_APPROVED:-}" != "RECOVERED_CLONE_ONLY" ]]; then
      echo "SHADOW_LEDGER_EXISTING_RECOVERY_RECEIPT_REQUIRED_NO_MUTATION" >&2
      return 6
    fi
    if ! python3 "$(dirname "$0")/shark-shadow-recovered-clone-admission.py" \
      --receipt "${SHARK_SHADOW_RECOVERED_CLONE_RECEIPT:-}" \
      --state-root "$STATE_ROOT"; then
      echo "SHADOW_LEDGER_RECOVERED_CLONE_ATTESTATION_FAILED" >&2
      return 6
    fi
    echo "SHADOW_LEDGER_EXISTING_RECOVERED_CLONE_ADMITTED"
    return 0
  fi
  if [[ -e "$PGDATA" ]]; then
    echo "SHADOW_LEDGER_INCOMPLETE_DATA_DIRECTORY_NO_INIT" >&2
    return 6
  fi
  if [[ "${SHARK_SHADOW_FRESH_LEDGER_APPROVED:-}" != "YES"
      || "${SHARK_SHADOW_FRESH_LEDGER_LABEL:-}" != "NEW_EMPTY_RESEARCH_ONLY"
      || "${SHARK_SHADOW_SETUP_ONLY:-}" != "YES" ]]; then
    echo "SHADOW_LEDGER_MISSING_PGDATA_RECOVERY_REQUIRED_NO_INIT" >&2
    return 6
  fi
  # A state tree containing any log, receipt or other file is NOT proven empty.
  if [[ -d "$STATE_ROOT" && -n "$(find "$STATE_ROOT" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "SHADOW_LEDGER_NONEMPTY_STATE_WITHOUT_PGDATA_NO_INIT" >&2
    return 6
  fi
  echo "SHADOW_LEDGER_EXPLICIT_NEW_EMPTY_RESEARCH_LEDGER"
}
ADMISSION="$(shadow_ledger_admission)" || exit 6
echo "$ADMISSION"
if [[ "${SHARK_SHADOW_ADMISSION_DRY_RUN:-}" == "YES" ]]; then
  exit 0
fi

# SHARK-RECOVERY.LIVE.7: a new research ledger must not run from a disposable
# container root. Neither an owner flag nor /workspace in the path proves
# persistence; demand an actual separate filesystem mount before PostgreSQL
# initialization/migration or the background worker can start.
if [[ "${SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED:-}" != "YES" ]]; then
  echo "SHADOW_PERSISTENT_STORAGE_APPROVAL_REQUIRED_NO_START" >&2
  exit 6
fi
if ! command -v findmnt >/dev/null 2>&1; then
  echo "SHADOW_PERSISTENT_STORAGE_MOUNT_PROBE_UNAVAILABLE" >&2
  exit 6
fi
MOUNT_PROBE="$STATE_ROOT"
while [[ ! -e "$MOUNT_PROBE" && "$MOUNT_PROBE" != "/" ]]; do
  MOUNT_PROBE="$(dirname "$MOUNT_PROBE")"
done
STORAGE_TARGET="$(findmnt -T "$MOUNT_PROBE" -no TARGET 2>/dev/null || true)"
STORAGE_FS="$(findmnt -T "$MOUNT_PROBE" -no FSTYPE 2>/dev/null || true)"
if [[ -z "$STORAGE_TARGET" || "$STORAGE_TARGET" == "/" || -z "$STORAGE_FS" ]]; then
  echo "SHADOW_PERSISTENT_STORAGE_DEDICATED_MOUNT_REQUIRED" >&2
  exit 6
fi
case "$STORAGE_FS" in
  overlay|tmpfs|ramfs|squashfs|aufs)
    echo "SHADOW_PERSISTENT_STORAGE_EPHEMERAL_FS_REJECTED" >&2
    exit 6 ;;
esac
# A separate mount is a necessary condition, NOT proof of guaranteed backup
# retention. It must still have independent snapshots/restore receipts.
echo "SHADOW_STORAGE_MOUNT_PROBE:$STORAGE_FS:$STORAGE_TARGET"
if [[ "${SHARK_SHADOW_STORAGE_ADMISSION_DRY_RUN:-}" == "YES" ]]; then
  exit 0
fi

# No state-root creation (and certainly no PGDATA) before the mount probe.
mkdir -p "$STATE_ROOT" "$PGSOCKET"

if [[ ! -d "$REPO/.git" ]]; then
  git clone https://github.com/bookieandco/crispy-waddle.git "$REPO"
fi
git -C "$REPO" fetch origin "$SOURCE_REF"
git -C "$REPO" checkout "$SOURCE_REF"
git -C "$REPO" pull --ff-only origin "$SOURCE_REF"

# Do not initialize/migrate a fresh money-data ledger from a moving main ref.
# This is separate from the paper-only authority guard and deliberately
# precedes package installation or modification of PostgreSQL state.
EXPECTED_SOURCE_COMMIT="${SHARK_SHADOW_EXPECTED_COMMIT_SHA:-}"
ACTUAL_SOURCE_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
if [[ "${SHARK_SHADOW_FRESH_LEDGER_APPROVED:-}" == "YES"
   || "${SHARK_SHADOW_FRESH_LEDGER_RESTART_APPROVED:-}" == "YES" ]]; then
  if [[ ! "$EXPECTED_SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ||
        "$ACTUAL_SOURCE_COMMIT" != "$EXPECTED_SOURCE_COMMIT" ]]; then
    echo "SHADOW_FRESH_LEDGER_EXACT_SOURCE_COMMIT_REQUIRED_NO_DB_MUTATION" >&2
    exit 6
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "RUNPOD_SHADOW_NODE_INSTALLER_UNAVAILABLE" >&2
    exit 2
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nodejs npm
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "RUNPOD_SHADOW_NODE_VERSION_TOO_OLD:$NODE_MAJOR" >&2
  exit 2
fi

if ! command -v corepack >/dev/null 2>&1; then
  npm install -g corepack@0.34.0
fi
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@8.15.9 --activate
fi

find_pg_bin() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return
  fi
  find /usr/lib/postgresql -type f -name "$name" 2>/dev/null | sort -V | tail -n1
}

INITDB="$(find_pg_bin initdb || true)"
PG_CTL="$(find_pg_bin pg_ctl || true)"
PSQL="$(find_pg_bin psql || true)"
CREATEDB="$(find_pg_bin createdb || true)"

if [[ -z "$INITDB" || -z "$PG_CTL" || -z "$PSQL" || -z "$CREATEDB" ]]; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "RUNPOD_SHADOW_POSTGRES_INSTALLER_UNAVAILABLE" >&2
    exit 2
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-client
  INITDB="$(find_pg_bin initdb)"
  PG_CTL="$(find_pg_bin pg_ctl)"
  PSQL="$(find_pg_bin psql)"
  CREATEDB="$(find_pg_bin createdb)"
fi

if ! id "$PGUSER_NAME" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "$PGUSER_NAME"
fi
# Existing PGDATA retains its original ownership, bytes and metadata.
# Do not recursively chown a potentially valuable historical ledger.
if [[ "$ADMISSION" == "SHADOW_LEDGER_EXPLICIT_NEW_EMPTY_RESEARCH_LEDGER" ]]; then
  chown "$PGUSER_NAME":"$PGUSER_NAME" "$STATE_ROOT" "$PGSOCKET"
else
  chown "$PGUSER_NAME":"$PGUSER_NAME" "$PGSOCKET"
fi

if [[ "$ADMISSION" == "SHADOW_LEDGER_EXPLICIT_NEW_EMPTY_RESEARCH_LEDGER" ]]; then
  runuser -u "$PGUSER_NAME" -- "$INITDB" -D "$PGDATA" --auth-local=trust --auth-host=trust --encoding=UTF8 --no-locale
  cat >> "$PGDATA/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = $PGPORT
unix_socket_directories = '$PGSOCKET'
max_connections = 40
shared_buffers = 128MB
EOF
fi

if ! runuser -u "$PGUSER_NAME" -- "$PG_CTL" -D "$PGDATA" status >/dev/null 2>&1; then
  runuser -u "$PGUSER_NAME" -- "$PG_CTL" -D "$PGDATA" -l "$PGLOG" -o "-h 127.0.0.1 -p $PGPORT -k $PGSOCKET" start
fi

for attempt in $(seq 1 30); do
  if "$PSQL" "postgresql://$PGUSER_NAME@127.0.0.1:$PGPORT/postgres" -Atqc 'select 1' >/dev/null 2>&1; then
    break
  fi
  [[ "$attempt" == "30" ]] && { echo "RUNPOD_SHADOW_POSTGRES_START_TIMEOUT" >&2; exit 3; }
  sleep 1
done

if ! "$PSQL" "postgresql://$PGUSER_NAME@127.0.0.1:$PGPORT/postgres" -Atqc "select 1 from pg_database where datname='$PGDATABASE_NAME'" | grep -q 1; then
  "$CREATEDB" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER_NAME" "$PGDATABASE_NAME"
fi

export SHARK_SHADOW_DATABASE_URL="postgresql://$PGUSER_NAME@127.0.0.1:$PGPORT/$PGDATABASE_NAME"
"$PSQL" "$SHARK_SHADOW_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO/packages/money-core/migrations/032_shark_shadow_runpod_final.sql"
"$PSQL" "$SHARK_SHADOW_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO/packages/money-core/migrations/033_shark_shadow_grade_review.sql"
"$PSQL" "$SHARK_SHADOW_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$REPO/packages/money-core/migrations/034_shark_shadow_grade_corrections.sql"

cd "$REPO"
pnpm install --frozen-lockfile

if [[ "$ADMISSION" == "SHADOW_LEDGER_EXPLICIT_NEW_EMPTY_RESEARCH_LEDGER" ]]; then
  # The first boot prepares and migrates a real empty Postgres but DOES NOT
  # start paper decisions before a real Restic/Drive backup + isolated restore.
  python3 "$REPO/scripts/shark-shadow-fresh-ledger-genesis.py" create --state-root "$STATE_ROOT"
  echo "SHADOW_FRESH_PAPER_DB_PREPARED_BACKUP_REQUIRED_NOT_COMMISSIONED"
  exit 0
fi
if [[ "${SHARK_SHADOW_SETUP_ONLY:-}" == "YES" ]]; then
  echo "SHADOW_POSTGRES_PREPARED_WORKER_NOT_COMMISSIONED"
  exit 0
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ "$OLD_PID" =~ ^[0-9]+$ ]] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    kill "$OLD_PID" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      kill -0 "$OLD_PID" >/dev/null 2>&1 || break
      sleep 0.5
    done
  fi
fi

nohup env   SHARK_SHADOW_DATABASE_URL="$SHARK_SHADOW_DATABASE_URL"   SHARK_SHADOW_HEALTH_PORT="$HEALTH_PORT"   SHARK_SHADOW_INTERVAL_SECONDS="${SHARK_SHADOW_INTERVAL_SECONDS:-300}"   SHARK_SHADOW_USER_ID="${SHARK_SHADOW_USER_ID:-runpod-shadow}"   SHARK_SHADOW_COFFER_ID="${SHARK_SHADOW_COFFER_ID:-runpod-paper}"   SHARK_SHADOW_CHARTER_ID="${SHARK_SHADOW_CHARTER_ID:-runpod-paper-charter}"   pnpm --filter @jhadina/money-core shadow:runpod:serve   >>"$SERVICE_LOG" 2>&1 &
SERVICE_PID=$!
echo "$SERVICE_PID" > "$PID_FILE"

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$HEALTH_PORT/health" > "$STATE_ROOT/health.json"; then
    node - "$STATE_ROOT/health.json" "$STATE_ROOT/runtime-receipt.json" "$SOURCE_REF" "$STATE_ROOT" <<'JS'
const fs=require('fs')
const cp=require('child_process')
const [healthPath,receiptPath,sourceRef,stateRoot]=process.argv.slice(2)
const health=JSON.parse(fs.readFileSync(healthPath,'utf8'))
let mount=null
try{mount=cp.execFileSync('findmnt',['-T',stateRoot,'-no','SOURCE,FSTYPE,TARGET'],{encoding:'utf8'}).trim()||null}catch{}
const receipt={
  status:'ready',
  sourceRef,
  stateRoot,
  mount,
  health,
  observedAt:new Date().toISOString(),
  authority:'SHADOW_LEARNING_ONLY',
  canExecute:false,
  canSign:false,
  canBroadcast:false,
  canAuthorizeLive:false,
}
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2))
process.stdout.write(JSON.stringify(receipt)+'\\n')
JS
    echo "RUNPOD_SHADOW_READY:pid=$SERVICE_PID:health_port=$HEALTH_PORT"
    exit 0
  fi
  if ! kill -0 "$SERVICE_PID" >/dev/null 2>&1; then
    echo "RUNPOD_SHADOW_SERVICE_EARLY_EXIT" >&2
    tail -n 120 "$SERVICE_LOG" >&2 || true
    exit 4
  fi
  sleep 2
done

echo "RUNPOD_SHADOW_HEALTH_TIMEOUT" >&2
tail -n 120 "$SERVICE_LOG" >&2 || true
exit 5
