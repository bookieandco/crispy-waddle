#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/17/bin"
if [[ -x "$PG_BIN/pg_dump" && -x "$PG_BIN/pg_restore" && -x "$PG_BIN/psql" ]]; then
  echo "$PG_BIN" >> "$GITHUB_PATH"
  "$PG_BIN/pg_dump" --version | grep -q '17\.'
  "$PG_BIN/pg_restore" --version | grep -q '17\.'
  exit 0
fi

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg
sudo install -d -m 0755 /usr/share/keyrings
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc   | sudo tee /usr/share/keyrings/postgresql-pgdg.asc >/dev/null

. /etc/os-release
test -n "${VERSION_CODENAME:-}"
echo "deb [signed-by=/usr/share/keyrings/postgresql-pgdg.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main"   | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null

sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends postgresql-client-17
echo "$PG_BIN" >> "$GITHUB_PATH"

"$PG_BIN/psql" --version | grep -q '17\.'
"$PG_BIN/pg_dump" --version | grep -q '17\.'
"$PG_BIN/pg_restore" --version | grep -q '17\.'
echo "POSTGRESQL17_CLIENT_READY"
