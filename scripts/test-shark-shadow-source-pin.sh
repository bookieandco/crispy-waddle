#!/usr/bin/env bash
# No provider/network/DB calls: owner-host source pin regression with faked
# ONLY git and findmnt. Requires exact source before any SHARK state creation.
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")" && pwd)/shark-shadow-runpod-bootstrap.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/fake-bin" "$TMP/work/crispy-waddle/.git" "$TMP/volume"

cat > "$TMP/fake-bin/git" <<'FAKEGIT'
#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" rev-parse HEAD "* ]]; then
  printf '%s\n' "${PIN_TEST_HEAD_SHA:?}"
  exit 0
fi
exit 0
FAKEGIT
cat > "$TMP/fake-bin/findmnt" <<'FAKEMOUNT'
#!/usr/bin/env bash
set -euo pipefail
case "${*: -1}" in
  TARGET) printf '%s\n' "${PIN_TEST_MOUNT:?}";;
  FSTYPE) printf 'ext4\n';;
  *) exit 2;;
esac
FAKEMOUNT
chmod 0700 "$TMP/fake-bin/git" "$TMP/fake-bin/findmnt"

STATE="$TMP/volume/new-paper"
EXPECTED="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
ACTUAL="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
if env PATH="$TMP/fake-bin:$PATH" \
    PIN_TEST_HEAD_SHA="$ACTUAL" PIN_TEST_MOUNT="$TMP/volume" \
    JHADINA_GPU_ROOT="$TMP/work" SHARK_SHADOW_DATA_DIR="$STATE" \
    SHARK_SHADOW_SOURCE_REF=main \
    SHARK_SHADOW_FRESH_LEDGER_APPROVED=YES \
    SHARK_SHADOW_FRESH_LEDGER_LABEL=NEW_EMPTY_RESEARCH_ONLY \
    SHARK_SHADOW_SETUP_ONLY=YES SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED=YES \
    SHARK_SHADOW_EXPECTED_COMMIT_SHA="$EXPECTED" \
    bash "$SCRIPT" > "$TMP/stdout" 2> "$TMP/stderr"; then
  echo "SHADOW_SOURCE_PIN_UNEXPECTED_ACCEPTANCE" >&2
  exit 1
fi
grep -Fq 'SHADOW_FRESH_LEDGER_EXACT_SOURCE_COMMIT_REQUIRED_NO_DB_MUTATION' "$TMP/stderr"
[[ ! -e "$STATE" ]] || {
  echo "SHADOW_SOURCE_PIN_MISMATCH_CREATED_STATE" >&2
  exit 1
}
[[ ! -e "$STATE/postgres" ]] || {
  echo "SHADOW_SOURCE_PIN_MISMATCH_INITIALIZED_DB" >&2
  exit 1
}
echo SHADOW_SOURCE_PIN_NO_STATE_MUTATION_PASSED
