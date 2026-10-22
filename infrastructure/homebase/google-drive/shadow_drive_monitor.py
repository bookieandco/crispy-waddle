#!/usr/bin/env python3
"""SHADOW-GDRIVE.8: read-only stale encrypted backup receipt watchdog.

Read-only local check. Run by an independently commissioned owner-controlled
scheduler. A failing exit code can trigger an existing alert manager, but a
return code alone is NOT proof that an iPhone alert was delivered.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import shadow_backup


class ShadowMonitorError(RuntimeError):
    pass


def status(root: Path, *, now: datetime | None = None, max_age_hours: int = 36) -> dict:
    current = now or datetime.now(timezone.utc)
    if max_age_hours < 1 or max_age_hours > 168:
        raise ShadowMonitorError("Invalid backup freshness threshold")
    folder = root / "receipts"
    if root.is_symlink() or folder.is_symlink() or not folder.is_dir():
        return {"schema":"jhadina.shadow.google-drive-monitor.v1",
                "healthy":False,"reason":"PRIVATE_RECEIPT_DIRECTORY_MISSING",
                "latestSnapshotFresh":False,"scheduleEnabled":False,
                "failureAlertDelivered":False,"pruneExecuted":False,
                "observedAt":current.isoformat()}
    latest = None
    for path in folder.glob("shadow-*.json"):
        if not re.fullmatch(r"shadow-[0-9a-f]{8,64}\.json", path.name):
            continue
        if path.is_symlink() or not path.is_file() or path.stat().st_mode & 0o077:
            continue
        try:
            receipt = shadow_backup.validated_receipt(path)
            if path.name != "shadow-"+receipt["snapshot_id"]+".json":
                continue
            completed=datetime.fromisoformat(receipt["completed_at"].replace("Z","+00:00"))
            if completed.tzinfo is None or completed>current:
                continue
            if latest is None or completed>latest[0]:
                latest=(completed,receipt["snapshot_id"])
        except (ValueError,KeyError,OSError,shadow_backup.ShadowBackupError):
            continue
    if latest is None:
        return {"schema":"jhadina.shadow.google-drive-monitor.v1",
                "healthy":False,"reason":"NO_BYTE_VERIFIED_PRIVATE_SHADOW_SNAPSHOT",
                "latestSnapshotFresh":False,"scheduleEnabled":False,
                "failureAlertDelivered":False,"pruneExecuted":False,
                "observedAt":current.isoformat()}
    age=(current-latest[0]).total_seconds()/3600
    healthy=age<=max_age_hours
    return {"schema":"jhadina.shadow.google-drive-monitor.v1",
            "healthy":healthy,
            "reason":"FRESH_LOCAL_OFFSITE_RECEIPT" if healthy else "STALE_LOCAL_OFFSITE_RECEIPT",
            "latestSnapshotFresh":healthy,
            "latestSnapshotId":latest[1],
            "ageHours":round(age,2),
            "scheduleEnabled":False,
            "failureAlertDelivered":False,
            "pruneExecuted":False,
            "observedAt":current.isoformat()}


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backup-root",type=Path,
                    default=Path(os.environ.get("JHADINA_BACKUP_ROOT","/srv/jhadina-backups"))/"shadow")
    ap.add_argument("--max-age-hours",type=int,default=36)
    args=ap.parse_args()
    try:
        result=status(args.backup_root,max_age_hours=args.max_age_hours)
        print(json.dumps(result,sort_keys=True))
        return 0 if result["healthy"] else 3
    except (ShadowMonitorError,OSError):
        print("SHADOW_DRIVE_MONITOR_BLOCKED: invalid local receipt state",file=sys.stderr)
        return 2


if __name__=="__main__":
    raise SystemExit(main())
