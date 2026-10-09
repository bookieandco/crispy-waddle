#!/usr/bin/env bash
# SHARK-RECOVERY.LIVE.7 hermetic storage preflight; no Docker/Pod/DB.
set -euo pipefail
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
SCRIPT="$(cd "$(dirname "$0")" && pwd)/shark-shadow-runpod-bootstrap.sh"
mkdir -p "$ROOT/bin"
cat > "$ROOT/bin/findmnt" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *"TARGET"* ]]; then
  echo "${SHARK_TEST_MOUNT_TARGET:-/}"
else
  echo "${SHARK_TEST_MOUNT_FS:-overlay}"
fi
SH
chmod +x "$ROOT/bin/findmnt"

run_probe() {
  env \
    PATH="$ROOT/bin:$PATH" \
    SHARK_SHADOW_DATA_DIR="$ROOT/empty-$1" \
    SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES \
    SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY \
    SHARK_SHADOW_SETUP_ONLY=YES \
    SHARK_SHADOW_STORAGE_ADMISSION_DRY_RUN=YES \
    SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED="$2" \
    SHARK_TEST_MOUNT_TARGET="$3" \
    SHARK_TEST_MOUNT_FS="$4" \
    bash "$SCRIPT" > "$ROOT/stdout" 2> "$ROOT/stderr"
}

if run_probe noapproval NO /mnt/shadow ext4; then
  echo "SHADOW_STORAGE_MISSING_APPROVAL_NOT_BLOCKED" >&2; exit 1
fi
if run_probe root YES / ext4; then
  echo "SHADOW_STORAGE_ROOT_MOUNT_NOT_BLOCKED" >&2; exit 1
fi
if run_probe overlay YES /mnt/shadow overlay; then
  echo "SHADOW_STORAGE_EPHEMERAL_MOUNT_NOT_BLOCKED" >&2; exit 1
fi
run_probe verified YES /mnt/shadow ext4
grep -Fq 'SHADOW_STORAGE_MOUNT_PROBE:ext4:/mnt/shadow' "$ROOT/stdout"
[[ ! -e "$ROOT/empty-verified/postgres/PG_VERSION" ]] || {
  echo "SHADOW_STORAGE_PROBE_INITIALIZED_POSTGRES" >&2; exit 1;
}
echo "SHADOW_PERSISTENT_STORAGE_TESTS_PASSED:4"
