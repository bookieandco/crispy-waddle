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
admitted existing_database_no_explicit_new SHARK_SHADOW_DATA_DIR="$TMP/existing"
[[ "$(cat "$TMP/existing/postgres/PG_VERSION")" == "17" ]] || exit 1
ln -s "$TMP/existing" "$TMP/link"
denied symlinked_root SHARK_SHADOW_DATA_DIR="$TMP/link"
denied unsafe_root SHARK_SHADOW_DATA_DIR="/"
denied relative_root SHARK_SHADOW_DATA_DIR="relative/state"
echo "SHADOW_ADMISSION_TESTS_PASSED:$case_no"
