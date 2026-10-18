#!/usr/bin/env bash
# Manual D1 PUBLIC-only snapshot. No off-host transfer or restore claims.
set -euo pipefail
umask 077
if [[ "${SHARK_CF_BACKUP_CONFIRM:-}" != "EXPORT-SHARK-PUBLIC-ONLY" ]]; then
  echo "SHARK_CF_EXPORT_NOT_AUTHORIZED" >&2; exit 1
fi
if [[ $# -ne 3 ]]; then
  echo "Usage: export-encrypted.sh <approved-config> <age-public-recipient> <new-output.age>" >&2
  exit 1
fi
CONFIG="$1"; RECIPIENT="$2"; DEST="$3"
[[ -f "$CONFIG" && ! -L "$CONFIG" ]] || { echo "SHARK_CF_CONFIG_INVALID" >&2; exit 1; }
[[ "$RECIPIENT" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$ ]] || { echo "SHARK_CF_AGE_RECIPIENT_INVALID" >&2; exit 1; }
[[ ! -e "$DEST" && ! -L "$DEST" ]] || { echo "SHARK_CF_WOULD_OVERWRITE" >&2; exit 1; }
command -v age >/dev/null && command -v npx >/dev/null || { echo "SHARK_CF_TOOLS_MISSING" >&2; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -f "$TMP/public.sql"; rmdir "$TMP" 2>/dev/null || true' EXIT
# REMOTE public-only research D1 export; this requires separate owner approval.
npx wrangler d1 export jhadina-shark-public-free --config "$CONFIG" --remote \
  --output "$TMP/public.sql" --skip-confirmation >/dev/null
[[ -s "$TMP/public.sql" ]] || { echo "SHARK_CF_EMPTY_EXPORT" >&2; exit 1; }
( set -o noclobber
  age -r "$RECIPIENT" -o "$DEST" "$TMP/public.sql" >/dev/null )
chmod 600 "$DEST"
echo "SHARK_CF_LOCAL_CIPHERTEXT_CREATED_NOT_OFFHOST_RESTORED"
sha256sum "$DEST" | cut -d' ' -f1
