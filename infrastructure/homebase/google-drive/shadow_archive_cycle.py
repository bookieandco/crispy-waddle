#!/usr/bin/env python3
"""Owner-controlled, opt-in Shadow offsite backup cycle and private local receipts.

A scheduler may invoke this entrypoint only AFTER the operator explicitly
commissions an existing trusted worker. This file installs no cron/systemd
unit, never provisions compute, and sends no data/alerts to third parties.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import backup
import restore_drill
import shadow_backup
import shadow_restore_audit


class ShadowCycleError(RuntimeError):
    pass


def run_cycle(*, env: dict[str, str], mode: str, root: Path) -> dict:
    if mode not in ("backup", "restore-drill"):
        raise ShadowCycleError("Unknown Shadow Drive cycle mode")
    if env.get("SHADOW_DRIVE_UNATTENDED_APPROVED") != "YES":
        raise ShadowCycleError("Unattended Shadow Drive snapshots require owner opt-in")
    source = shadow_backup.source_settings(env)
    # Require an existing approved worker, credentials and destination before
    # writing locally or remotely. Failure is a blocker, never a blind retry.
    repository = shadow_backup.scoped_repository(env)
    if mode == "restore-drill":
        restore_drill.trusted_host(env)
    receipt = shadow_backup.archive(repository, source, root)
    restoration = (shadow_backup.recovery_drill(repository, receipt, env)
                   if mode == "restore-drill" else None)
    result = {
        "schema": "jhadina.shadow.google-drive-cycle.v1",
        "mode": mode,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "status": "RESTORE_DRILL_PASSED" if restoration
                  and restoration["semantic_integrity_verified"]
                  else "ENCRYPTED_BYTES_VERIFIED",
        "snapshot_id": receipt["snapshot_id"],
        "sha256": receipt["sha256"],
        "semantic_restore_verified": bool(
            restoration and restoration["semantic_integrity_verified"]),
        "snapshot_byte_verified": True,
        "source_to_target_row_parity_verified": False,
        "alert_delivered": False,
        "swlc_synced": False,
        "live_trading_authorized": False,
    }
    journal = shadow_backup.private_directory(root / "cycle-journal")
    name = "cycle-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json"
    path = journal / name
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600),
                   "w", encoding="utf-8") as handle:
        json.dump(result, handle, sort_keys=True)
        handle.write("\n")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("backup", "restore-drill"), default="backup")
    parser.add_argument("--root", type=Path,
                        default=Path(os.getenv("JHADINA_BACKUP_ROOT", "/srv/jhadina-backups")) / "shadow")
    args = parser.parse_args(argv)
    os.umask(0o077)
    try:
        result = run_cycle(env=dict(os.environ), mode=args.mode, root=args.root)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ShadowCycleError, shadow_backup.ShadowBackupError, backup.BackupError,
            restore_drill.RestoreError, shadow_restore_audit.ShadowSemanticError,
            OSError, ValueError):
        # A nonzero service exit and owner-local journal produce observability.
        # An emailed/push-delivered alert is NOT asserted here.
        print("SHADOW_DRIVE_CYCLE_FAILED: review owner-controlled worker logs",
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
