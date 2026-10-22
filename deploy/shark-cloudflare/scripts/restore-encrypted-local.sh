#!/usr/bin/env bash
# Offline ONLY. Decrypt owner-supplied SHARK public SQL archive to a private
# temporary file, restore to Python :memory:, unlink the plaintext pathname.
# No Cloudflare, Drive or Telegram access; NEVER off-host proof alone.
set -euo pipefail
umask 077
if [[ "${SHARK_CF_RESTORE_CONFIRM:-}" != "ISOLATED-OFFLINE-SQL-RESTORE-ONLY" ]]; then
  echo SHARK_CF_RESTORE_OWNER_CONFIRMATION_REQUIRED >&2
  exit 1
fi
if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: restore-encrypted-local.sh <archive.age> <age-identity-file> <expected-ciphertext-sha256> [source-fingerprint.json]" >&2
  exit 1
fi
CIPHER="$1"; IDENTITY="$2"; EXPECTED="$3"
[[ -f "$CIPHER" && ! -L "$CIPHER" && -f "$IDENTITY" && ! -L "$IDENTITY" ]] || {
  echo SHARK_CF_RESTORE_INPUT_INVALID >&2; exit 1;
}
[[ "$EXPECTED" =~ ^[0-9a-f]{64}$ ]] || { echo SHARK_CF_RESTORE_HASH_INVALID >&2; exit 1; }
if [[ $# -eq 4 ]]; then
  [[ -f "$4" && ! -L "$4" ]] || { echo SHARK_CF_FINGERPRINT_FILE_INVALID >&2; exit 1; }
fi
command -v age >/dev/null && command -v sha256sum >/dev/null && command -v python3 >/dev/null || {
  echo SHARK_CF_RESTORE_LOCAL_TOOLS_MISSING >&2; exit 1;
}
ACTUAL="$(sha256sum "$CIPHER" | cut -d' ' -f1)"
[[ "$EXPECTED" == "$ACTUAL" ]] || { echo SHARK_CF_CIPHERTEXT_SHA_MISMATCH >&2; exit 1; }
TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -f "$TMP/public-only.sql"; rmdir "$TMP" 2>/dev/null || true' EXIT
age --decrypt --identity "$IDENTITY" --output "$TMP/public-only.sql" "$CIPHER" >/dev/null
[[ -s "$TMP/public-only.sql" ]] || { echo SHARK_CF_RESTORE_DECRYPT_EMPTY >&2; exit 1; }
SCRIPT="$(cd "$(dirname "$0")" && pwd)/release_acceptance.py"
if [[ $# -eq 4 ]]; then
  python3 -B "$SCRIPT" --mode restore --input "$TMP/public-only.sql" --expected "$4" \
    --confirm ISOLATED-OFFLINE-SQL-RESTORE-ONLY
else
  python3 -B "$SCRIPT" --mode restore --input "$TMP/public-only.sql" \
    --confirm ISOLATED-OFFLINE-SQL-RESTORE-ONLY
fi
# rm unlinks plaintext, NOT secure physical erase on SSD.
