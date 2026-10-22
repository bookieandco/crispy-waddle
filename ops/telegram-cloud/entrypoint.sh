#!/bin/sh
# Railway owner worker — deliberately held by default. No Telegram login.
set -eu
umask 077
if [ "${TELEGRAM_CLOUD_PROCESS_MODE:-hold}" != "hold" ]; then
  echo "TELEGRAM_CLOUD_PRODUCTION_ENTRYPOINT_HELD"
  exit 1
fi
if [ "${TELEGRAM_CLOUD_MOUNT:-}" != "/var/lib/jhadina-telegram" ] ||
   [ "${TELEGRAM_PRIVATE_DIR:-}" != "/var/lib/jhadina-telegram/private" ]; then
  echo "TELEGRAM_CLOUD_STORAGE_CONFIG_DENIED"
  exit 1
fi
# Must be an actual Railway volume; no accidental ephemeral session storage.
if [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != "/var/lib/jhadina-telegram" ]; then
  echo "TELEGRAM_CLOUD_RAILWAY_VOLUME_REQUIRED"
  exit 1
fi
python /opt/jhadina/ops/telegram-cloud/host.py prepare
# Always drop root before the inert hold process. No sockets, polling or read.
exec gosu jhadina python -u /opt/jhadina/ops/telegram-cloud/host.py hold
