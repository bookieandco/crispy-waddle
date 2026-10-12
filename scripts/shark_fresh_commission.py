#!/usr/bin/env python3
"""SHARK-FRESH-COMMISSION.01-.05: truthful, read-only owner-host evidence gate.

Does not authenticate Google, run PostgreSQL, install packages, send trades,
start workers, bill RunPod or create new storage. Source-level metadata
alone NEVER certifies external provider operations or unattended operation.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

HEX = re.compile(r"[a-f0-9]{40}\Z")
SNAP = re.compile(r"[a-f0-9]{8,64}\Z")
HORIZONS = ("15M", "1H", "4H", "24H", "3D", "7D")
COUNTS = ("market_samples", "decisions", "executions", "observations",
          "lessons", "calibrations", "memories", "sync_records", "runtime_state")


class CommissionError(ValueError):
    pass


def private_receipt(path: Path | None) -> dict | None:
    if path is None:
        return None
    if not path.is_absolute() or path.is_symlink():
        raise CommissionError("OWNER_PRIVATE_RECEIPT_PATH_REQUIRED")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        statinfo = os.fstat(fd)
        if (not stat.S_ISREG(statinfo.st_mode) or statinfo.st_mode & 0o077
                or statinfo.st_size > 256_000):
            raise CommissionError("OWNER_PRIVATE_RECEIPT_INVALID")
        data = os.read(fd, 256_001)
    finally:
        os.close(fd)
    if len(data) > 256_000:
        raise CommissionError("OWNER_PRIVATE_RECEIPT_SIZE_LIMIT")
    try:
        item = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise CommissionError("OWNER_PRIVATE_JSON_INVALID") from None
    if not isinstance(item, dict):
        raise CommissionError("OWNER_PRIVATE_RECEIPT_OBJECT_REQUIRED")
    return item


def dt(value: object) -> datetime | None:
    try:
        if not isinstance(value, str):
            return None
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else None
    except ValueError:
        return None


def assess(*, source: dict | None = None, preflight: dict | None = None,
           genesis: dict | None = None, doctor: dict | None = None,
           backup: dict | None = None, restore: dict | None = None,
           first_health: dict | None = None, later_health: dict | None = None,
           now: datetime | None = None) -> dict:
    current = now or datetime.now(timezone.utc)
    reasons: dict[str, list[str]] = {
        ".01": [], ".02": [], ".03": [], ".04": [], ".05": [],
    }
    source = source or {}
    if (source.get("schema") != "shark.fresh.integration-source.v1"
            or not isinstance(source.get("commit"), str)
            or not HEX.fullmatch(source["commit"])
            or source.get("sourceReviewed") is not True
            or source.get("paperOnly") is not True):
        reasons[".01"].append("EXACT_SOURCE_INTEGRATION_REVIEW_REQUIRED")
    preflight = preflight or {}
    if (preflight.get("schema") != "SHARK-HISTORY-FRESH-PRESTART.v1"
            or preflight.get("status") != "READY_FOR_OWNER_STAGING_REVIEW"
            or preflight.get("label") != "NEW_HISTORY_NOT_RECOVERED"
            or preflight.get("startupExecuted") is not False
            or preflight.get("workerCommissioned") is not False
            or preflight.get("reasonCodes") != []):
        reasons[".02"].append("OWNER_HOST_PERSISTENT_MOUNT_PREFLIGHT_REQUIRED")
    genesis = genesis or {}
    if (genesis.get("schema") != "jhadina.shadow.paper-genesis.v1"
            or genesis.get("history_label") != "NEW_EMPTY_RESEARCH_ONLY"
            or genesis.get("created_from_empty_initdb") is not True
            or genesis.get("original_history_recovered") is not False
            or genesis.get("state_root") is None
            or not isinstance(genesis.get("pgdata_dev"), int)
            or not isinstance(genesis.get("pgdata_ino"), int)
            or any(genesis.get(k) is not False for k in
                   ("can_execute", "can_sign", "can_broadcast", "can_authorize_live"))):
        reasons[".03"].append("NONDESTRUCTIVE_FRESH_GENESIS_REQUIRED")
    doctor = doctor or {}
    if (doctor.get("schema") != "jhadina.shadow.google-drive-doctor.v1"
            or doctor.get("owner_controlled_local_socket_verified") is not True
            or doctor.get("machine_drive_oauth_and_encryption_remote_verified") is not True
            or doctor.get("actual_backup_taken") is not False
            or doctor.get("isolated_restore_verified") is not False):
        reasons[".04"].append("WORKER_MACHINE_GOOGLE_OAUTH_NOT_VERIFIED")
    backup, restore = backup or {}, restore or {}
    snap = backup.get("snapshot_id")
    digest = backup.get("sha256")
    if (backup.get("schema") != "jhadina.shadow.google-drive-backup.v1"
            or backup.get("scope") != "SHADOW_POSTGRES_ONLY"
            or backup.get("source_kind") != "LOCAL_SHADOW_UNIX_SOCKET"
            or backup.get("restic_path") != "shadow-postgres-restic-v1"
            or not isinstance(snap, str) or not SNAP.fullmatch(snap)
            or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest)
            or backup.get("encrypted_at_rest") is not True
            or backup.get("remote_bytes_restored_verified") is not True
            or backup.get("active_database_modified") is not False
            or backup.get("live_trading_authorized") is not False
            or (dt(backup.get("completed_at")) is None)
            or (dt(backup.get("completed_at")) is not None
                and not 0 <= (current - dt(backup["completed_at"])).total_seconds() <= 72 * 3600)):
        reasons[".04"].append("REAL_ENCRYPTED_SHADOW_BACKUP_REQUIRED")
    rows = restore.get("restored_ledger_counts")
    valid_counts = isinstance(rows, dict) and all(
        type(rows.get(k)) is int and rows[k] >= 0 for k in COUNTS)
    if (restore.get("schema") != "jhadina.shadow.google-drive-restore.v2"
            or restore.get("snapshot_id") != snap or restore.get("sha256") != digest
            or restore.get("semantic_integrity_verified") is not True
            or restore.get("required_shadow_tables_verified") is not True
            or restore.get("restored_grade_review_table_present") is not True
            or not valid_counts
            or type(restore.get("restored_table_count")) is not int
            or restore.get("restored_table_count", 0) < len(COUNTS)
            or restore.get("network_isolated") is not True
            or restore.get("active_database_modified") is not False
            or restore.get("swlc_synced") is not False
            or restore.get("live_trading_authorized") is not False):
        reasons[".04"].append("REAL_ISOLATED_SHADOW_RESTORE_REQUIRED")
    for name, receipt in (("first", first_health), ("later", later_health)):
        if not isinstance(receipt, dict) or receipt.get("status") not in ("ready", "healthy") or (
                receipt.get("authority") != "SHADOW_LEARNING_ONLY" or
                any(receipt.get(k) is not False for k in
                    ("canExecute", "canSign", "canBroadcast", "canAuthorizeLive"))):
            reasons[".05"].append(name.upper() + "_REAL_PAPER_HEALTH_MISSING")
    first = dt(first_health.get("observedAt")) if isinstance(first_health, dict) else None
    last = dt(later_health.get("observedAt")) if isinstance(later_health, dict) else None
    if not first or not last or not first < last <= current or (
            last-first).total_seconds() < 7 * 86400:
        reasons[".05"].append("ACTUAL_SEVEN_DAY_FORWARD_OBSERVATION_WINDOW_REQUIRED")
    cert = later_health.get("certification") if isinstance(later_health, dict) else None
    for key in ("observationCounts", "lessonCounts"):
        counts = cert.get(key) if isinstance(cert, dict) else None
        if not isinstance(counts, dict) or any(
                type(counts.get(h)) is not int or counts[h] < 1 for h in HORIZONS):
            reasons[".05"].append("GENUINE_SIX_HORIZON_" + key.upper() + "_REQUIRED")
    phases = {k: {"sourceChecksPassed": not v, "blockers": v}
              for k, v in reasons.items()}
    # These are self-attested private local receipts, not independently
    # verified running cloud/host state. No pure audit promotes production.
    return {
        "schema": "shark.fresh.commission-gate.v1",
        "phases": phases,
        "status": ("INDEPENDENT_HOST_AND_PROVIDER_ATTESTATION_REQUIRED"
                   if all(not r for r in reasons.values()) else "BLOCKED"),
        "allReceiptShapesPassed": all(not r for r in reasons.values()),
        "productionCommissioned": False,
        "originalLedgerRecovered": False,
        "swlcSupabaseRequiredForInitialPaper": False,
        "syntheticLearningPromoted": False,
        "realMoneyAuthorized": False,
        "canExecute": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    for name in ("source", "preflight", "genesis", "doctor", "backup",
                 "restore", "first-health", "later-health"):
        parser.add_argument("--" + name, type=Path)
    args = parser.parse_args()
    try:
        result = assess(**{name: private_receipt(getattr(args, name))
                           for name in ("source", "preflight", "genesis",
                                        "doctor", "backup", "restore")},
                        first_health=private_receipt(args.first_health),
                        later_health=private_receipt(args.later_health))
        print(json.dumps(result, sort_keys=True))
        return 0 if result["status"] != "BLOCKED" else 3
    except (OSError, CommissionError):
        print("SHARK_FRESH_COMMISSION_BLOCKED", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
