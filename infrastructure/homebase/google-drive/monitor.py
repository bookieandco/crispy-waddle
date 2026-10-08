#!/usr/bin/env python3
"""GOOGLE-HOMEBASE.8 backup receipt watchdog; read-only and fail closed."""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path


class MonitorError(RuntimeError):
    pass


def check_backups(receipts: Path, *, at: datetime, max_age_hours: float = 36) -> dict:
    if not max_age_hours > 0 or max_age_hours > 168:
        raise MonitorError("max_age_hours must be within (0, 168]")
    if receipts.is_symlink() or not receipts.is_dir():
        raise MonitorError("Private receipt directory unavailable")
    verified = []
    for path in receipts.glob("*.json"):
        if path.is_symlink() or not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if (data.get("schema") != "jhadina.google-homebase.db-backup.v1"
                    or data.get("remote_byte_restore_verified") is not True
                    or data.get("restic_encrypted") is not True
                    or data.get("scope") != "POSTGRES_ONLY"):
                continue
            stamp = datetime.fromisoformat(data["completed_at"].replace("Z", "+00:00"))
            if stamp.tzinfo is None or stamp > at + timedelta(minutes=5):
                continue
            snapshot = data["snapshot_id"]
            if path.name != snapshot + ".json":
                continue
            verified.append((stamp, snapshot))
        except (ValueError, KeyError, TypeError, OSError, AttributeError):
            continue
    if not verified:
        return {"schema":"jhadina.google-homebase.backup-watch.v1",
                "healthy":False,"reason":"NO_VERIFIED_BACKUP_RECEIPT"}
    stamp, snapshot = max(verified)
    age = (at - stamp).total_seconds()/3600
    return {"schema":"jhadina.google-homebase.backup-watch.v1",
            "healthy":age <= max_age_hours,
            "reason":"LATEST_RECEIPT_FRESH" if age <= max_age_hours else "VERIFIED_BACKUP_STALE",
            "latest_snapshot_id":snapshot,"age_hours":round(age,2)}


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--receipts",type=Path,default=Path("/srv/jhadina-backups/receipts"))
    ap.add_argument("--max-age-hours",type=float,default=36)
    args=ap.parse_args()
    try:
        result=check_backups(args.receipts,at=datetime.now(timezone.utc),max_age_hours=args.max_age_hours)
        print(json.dumps(result,sort_keys=True))
        return 0 if result["healthy"] else 3
    except (MonitorError,OSError) as err:
        print("GOOGLE_HOMEBASE_WATCH_BLOCKED: "+str(err),file=sys.stderr)
        return 2


if __name__=="__main__":
    raise SystemExit(main())
