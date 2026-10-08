#!/usr/bin/env bash
# Hermetic admission regression tests only; no provider, network, or PostgreSQL.
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")" && pwd)/shark-shadow-runpod-bootstrap.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
case_no=0
pass() { case_no=$((case_no + 1)); echo "SHADOW_ADMISSION_PASS:$case_no:$1"; }
denied() {
  local label="$1"
  shift
  if env SHARK_SHADOW_ADMISSION_DRY_RUN=YES "$@" bash "$SCRIPT" >/dev/null 2>"$TMP/error"; then
    echo "SHADOW_ADMISSION_UNEXPECTED_SUCCESS:$label" >&2
    exit 1
  fi
  pass "$label"
}
admitted() {
  local label="$1"
  shift
  if ! env SHARK_SHADOW_ADMISSION_DRY_RUN=YES "$@" bash "$SCRIPT" >"$TMP/out" 2>"$TMP/error"; then
    echo "SHADOW_ADMISSION_UNEXPECTED_FAILURE:$label" >&2
    exit 1
  fi
  pass "$label"
}

denied missing_unapproved SHARK_SHADOW_DATA_DIR="$TMP/missing"
admitted explicit_new_empty SHARK_SHADOW_DATA_DIR="$TMP/new-empty" \
  SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES \
  SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY
[[ ! -e "$TMP/new-empty/postgres" ]] || { echo "UNEXPECTED_POSTGRES_INIT" >&2; exit 1; }
denied missing_partial_approval SHARK_SHADOW_DATA_DIR="$TMP/missing" \
  SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES
mkdir -p "$TMP/incomplete/postgres"
echo questionable > "$TMP/incomplete/postgres/partial"
denied incomplete_even_with_approval SHARK_SHADOW_DATA_DIR="$TMP/incomplete" \
  SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES \
  SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY
mkdir -p "$TMP/orphan"
echo original-data-warning >"$TMP/orphan/postgres.log"
denied orphan_receipts_protected SHARK_SHADOW_DATA_DIR="$TMP/orphan" \
  SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES \
  SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY
mkdir -p "$TMP/existing/postgres"
printf '17\n' > "$TMP/existing/postgres/PG_VERSION"
denied existing_database_without_clone_receipt SHARK_SHADOW_DATA_DIR="$TMP/existing"
env TMP="$TMP" python3 - <<'PY'
import json,os,pathlib
root=pathlib.Path(os.environ["TMP"])
rows=dict(market_samples=6,decisions=3,executions=3,observations=1,lessons=1,
          calibrations=1,memories=1,sync_records=1,runtime_state=1)
payload=dict(
    schema="jhadina.shadow.recovered-clone-admission.v1",
    environment="PAPER_ONLY",
    source_kind="AUTHENTIC_HISTORICAL_SHADOW",
    original_state_root=str(root/"original"),
    restored_clone_state_root=str(root/"existing"),
    isolated_restore_verified=True,original_preserved=True,owner_reviewed=True,
    source_vs_restored_snapshot_row_parity_verified=True,
    source_sha256="a"*64,restored_sha256="a"*64,
    source_rows=rows,restored_rows=rows,
    orphan_observations=0,orphan_lessons=0,authority_violations=0,
    can_execute=False,can_sign=False,can_broadcast=False,can_authorize_live=False,
    verified_at="2026-10-08T00:00:00Z")
receipt=root/"clone-receipt.json"
receipt.write_text(json.dumps(payload))
receipt.chmod(0o600)
PY
admitted existing_clone_with_exact_target_and_private_receipt \
  SHARK_SHADOW_DATA_DIR="$TMP/existing" \
  SHARK_SHADOW_EXISTING_LEDGER_APPROVED=RECOVERED_CLONE_ONLY \
  SHARK_SHADOW_RECOVERED_CLONE_RECEIPT="$TMP/clone-receipt.json"
denied existing_wrong_target SHARK_SHADOW_DATA_DIR="$TMP/original" \
  SHARK_SHADOW_EXISTING_LEDGER_APPROVED=RECOVERED_CLONE_ONLY \
  SHARK_SHADOW_RECOVERED_CLONE_RECEIPT="$TMP/clone-receipt.json"
[[ "$(cat "$TMP/existing/postgres/PG_VERSION")" == "17" ]] || exit 1
ln -s "$TMP/existing" "$TMP/link"
denied symlinked_root SHARK_SHADOW_DATA_DIR="$TMP/link"
denied unsafe_root SHARK_SHADOW_DATA_DIR="/"
denied relative_root SHARK_SHADOW_DATA_DIR="relative/state"
echo "SHADOW_ADMISSION_TESTS_PASSED:$case_no"
