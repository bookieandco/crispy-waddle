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



def check_object_archive(receipts: Path, bucket: str, *, at: datetime,
                         max_age_hours: float = 36) -> dict:
    """Object BYTE archive freshness only, not a MinIO API restore certificate."""
    import re
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket) or ".." in bucket:
        raise MonitorError("Valid exact bucket name required")
    if not (0 < max_age_hours <= 168):
        raise MonitorError("max_age_hours must be within (0, 168]")
    if receipts.is_symlink() or not receipts.is_dir():
        raise MonitorError("Private receipt directory unavailable")
    verified = []
    for path in receipts.glob("objects-*.json"):
        if path.is_symlink() or not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if (data.get("schema") != "jhadina.google-homebase.object-backup.v1"
                    or data.get("scope") != "ONE_MINIO_BUCKET_CURRENT_OBJECTS"
                    or data.get("bucket") != bucket
                    or data.get("restic_encrypted") is not True
                    or data.get("remote_bytes_restored_verified") is not True
                    or data.get("minio_api_rehydrate_tested") is not False
                    or type(data.get("object_count")) is not int
                    or data["object_count"] <= 0):
                continue
            fingerprint = data.get("sha256_object_manifest")
            if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
                continue
            stamp = datetime.fromisoformat(data["completed_at"].replace("Z", "+00:00"))
            if stamp.tzinfo is None or stamp > at + timedelta(minutes=5):
                continue
            snapshot = data["snapshot_id"]
            if (not isinstance(snapshot, str)
                    or not re.fullmatch(r"[0-9a-f]{8,64}", snapshot)
                    or path.name != f"objects-{snapshot}.json"):
                continue
            verified.append((stamp, snapshot))
        except (ValueError, KeyError, TypeError, OSError, AttributeError):
            continue
    if not verified:
        return {"schema": "jhadina.google-homebase.object-watch.v1",
                "healthy": False, "bucket": bucket,
                "reason": "NO_VERIFIED_OBJECT_BYTE_ARCHIVE"}
    stamp, snapshot = max(verified)
    age = (at - stamp).total_seconds() / 3600
    return {"schema": "jhadina.google-homebase.object-watch.v1",
            "healthy": age <= max_age_hours,
            "bucket": bucket,
            "reason": "OBJECT_BYTE_ARCHIVE_FRESH" if age <= max_age_hours else "OBJECT_BYTE_ARCHIVE_STALE",
            "latest_snapshot_id": snapshot,
            "age_hours": round(age, 2),
            "minio_api_restore_certified": False}



def check_nats_archive(receipts: Path, stream: str, *, at: datetime,
                       max_age_hours: float = 36) -> dict:
    """Stream archive freshness, not NATS consumer delivery recovery."""
    import re
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,62}", stream):
        raise MonitorError("Valid exact JetStream name required")
    if not (0 < max_age_hours <= 168):
        raise MonitorError("max_age_hours must be within (0, 168]")
    if receipts.is_symlink() or not receipts.is_dir():
        raise MonitorError("Private receipt directory unavailable")
    verified = []
    for path in receipts.glob("nats-*.json"):
        if path.is_symlink() or not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if (data.get("schema") != "jhadina.google-homebase.jetstream-backup.v1"
                    or data.get("scope") != "ONE_NATS_STREAM_WITH_CONSUMER_SNAPSHOT"
                    or data.get("stream") != stream
                    or data.get("encrypted_with_restic") is not True
                    or data.get("remote_bytes_restored_verified") is not True
                    or data.get("nats_archive_offline_validated") is not True):
                continue
            digest = data.get("sha256_archive_manifest")
            snapshot = data.get("snapshot_id")
            if (not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest)
                    or not isinstance(snapshot, str)
                    or not re.fullmatch(r"[0-9a-f]{8,64}", snapshot)
                    or path.name != f"nats-{snapshot}.json"):
                continue
            stamp = datetime.fromisoformat(data["completed_at"].replace("Z", "+00:00"))
            if stamp.tzinfo is None or stamp > at + timedelta(minutes=5):
                continue
            verified.append((stamp, snapshot))
        except (ValueError, KeyError, TypeError, OSError, AttributeError):
            continue
    if not verified:
        return {"schema": "jhadina.google-homebase.nats-watch.v1",
                "healthy": False, "stream": stream,
                "reason": "NO_VERIFIED_NATS_ARCHIVE"}
    stamp, snapshot = max(verified)
    age = (at - stamp).total_seconds() / 3600
    return {"schema": "jhadina.google-homebase.nats-watch.v1",
            "healthy": age <= max_age_hours,
            "stream": stream,
            "reason": "NATS_ARCHIVE_FRESH" if age <= max_age_hours else "NATS_ARCHIVE_STALE",
            "latest_snapshot_id": snapshot,
            "age_hours": round(age, 2),
            "nats_consumer_recovery_certified": False}


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--receipts",type=Path,default=Path("/srv/jhadina-backups/receipts"))
    ap.add_argument("--max-age-hours",type=float,default=36)
    ap.add_argument("--require-object-bucket", help="Exact MinIO bucket whose byte archive must be fresh")
    ap.add_argument("--require-nats-stream", help="Exact NATS stream whose encrypted archive must be fresh")
    args=ap.parse_args()
    try:
        result=check_backups(args.receipts,at=datetime.now(timezone.utc),max_age_hours=args.max_age_hours)
        if args.require_object_bucket or args.require_nats_stream:
            combined={"schema":"jhadina.google-homebase.combined-watch.v1",
                      "healthy":result["healthy"],
                      "postgres":result,
                      "complete_minio_recovery_certified":False,
                      "nats_consumer_recovery_certified":False}
            if args.require_object_bucket:
                obj=check_object_archive(args.receipts,args.require_object_bucket,
                                         at=datetime.now(timezone.utc),
                                         max_age_hours=args.max_age_hours)
                combined["object_byte_archive"]=obj
                combined["healthy"]=combined["healthy"] and obj["healthy"]
            if args.require_nats_stream:
                nats=check_nats_archive(args.receipts,args.require_nats_stream,
                                        at=datetime.now(timezone.utc),
                                        max_age_hours=args.max_age_hours)
                combined["nats_archive"]=nats
                combined["healthy"]=combined["healthy"] and nats["healthy"]
            result=combined
        print(json.dumps(result,sort_keys=True))
        return 0 if result["healthy"] else 3
    except (MonitorError,OSError) as err:
        print("GOOGLE_HOMEBASE_WATCH_BLOCKED: "+str(err),file=sys.stderr)
        return 2


if __name__=="__main__":
    raise SystemExit(main())
