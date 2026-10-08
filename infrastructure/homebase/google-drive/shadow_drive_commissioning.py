#!/usr/bin/env python3
"""SHADOW-GDRIVE.5-.9: evidence-only local recovery gate, no remote mutation.

Run only on an already-approved owner-controlled worker. This tool NEVER
connects to Google, starts Pods, copies private data, restarts databases or
acknowledges the SWLC queue. It judges locally captured private operation
receipts, not intent, mocked tests, or phone/ChatGPT OAuth.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import stat
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import shadow_backup

FOLDER_ID = re.compile(r"[A-Za-z0-9_-]{10,128}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")


class ShadowDriveGateError(RuntimeError):
    pass


def load_private(path: Path | None) -> dict | None:
    if path is None:
        return None
    if path.is_symlink() or not path.is_file() or path.stat().st_mode & 0o077:
        raise ShadowDriveGateError("Private owner-only non-symlink receipt file required")
    if path.stat().st_size > 256_000:
        raise ShadowDriveGateError("Receipt exceeds bounded metadata size")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ShadowDriveGateError("Receipt must be a JSON object")
    return value


def fresh_iso(raw: object, *, now: datetime, max_hours: int = 72) -> bool:
    try:
        if not isinstance(raw, str):
            return False
        t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return (t.tzinfo is not None and now-t >= timedelta(0)
                and now-t <= timedelta(hours=max_hours))
    except ValueError:
        return False


def assess(*, env: dict[str, str], backup_receipt: dict | None = None,
           restore_receipt: dict | None = None, monitor_receipt: dict | None = None,
           sync_receipt: dict | None = None, p2_receipt: dict | None = None,
           now: datetime | None = None) -> dict:
    current = now or datetime.now(timezone.utc)
    folder = env.get("GOOGLE_HOMEBASE_BACKUP_FOLDER_ID", "")
    trusted = (env.get("GITHUB_ACTIONS", "").lower() != "true"
               and env.get("JHADINA_HOMEBASE_TRUST_DOMAIN") == "OWNER_CONTROLLED"
               and env.get("SHADOW_DRIVE_BACKUP_APPROVED") == "YES")
    scoped = bool(FOLDER_ID.fullmatch(folder))
    snapshot = False
    if backup_receipt is not None:
        # The same immutable contract used by the real Shadow backup writer.
        try:
            shadow_backup.validated_receipt_dict(backup_receipt)
            snapshot = bool(fresh_iso(backup_receipt.get("completed_at"), now=current)
                            and backup_receipt.get("remote_bytes_restored_verified") is True)
        except shadow_backup.ShadowBackupError:
            snapshot = False
    restore = bool(snapshot and restore_receipt
                   and restore_receipt.get("schema") == "jhadina.shadow.google-drive-restore.v1"
                   and restore_receipt.get("snapshot_id") == backup_receipt.get("snapshot_id")
                   and restore_receipt.get("sha256") == backup_receipt.get("sha256")
                   and restore_receipt.get("required_shadow_tables_verified") is True
                   and restore_receipt.get("network_isolated") is True
                   and restore_receipt.get("active_database_modified") is False
                   and restore_receipt.get("live_trading_authorized") is False)
    scheduled = bool(monitor_receipt
                     and monitor_receipt.get("schema") == "jhadina.shadow.google-drive-monitor.v1"
                     and monitor_receipt.get("scheduleEnabled") is True
                     and monitor_receipt.get("latestSnapshotFresh") is True
                     and monitor_receipt.get("failureAlertDelivered") is True
                     and monitor_receipt.get("pruneExecuted") is False
                     and fresh_iso(monitor_receipt.get("observedAt"), now=current, max_hours=36))
    imported = bool(sync_receipt
                    and sync_receipt.get("schema") == "jhadina.shadow.sync-redacted.v1"
                    and sync_receipt.get("swlcHealthy") is True
                    and isinstance(sync_receipt.get("acknowledged"), int)
                    and sync_receipt["acknowledged"] > 0
                    and isinstance(sync_receipt.get("rejected"), int)
                    and sync_receipt["rejected"] == 0)
    strict = bool(p2_receipt
                  and p2_receipt.get("authority") == "CERTIFICATION_ONLY"
                  and p2_receipt.get("operationalPassed") is True
                  and p2_receipt.get("realWorldProfitabilityProven") is False
                  and p2_receipt.get("liveTradingAuthorized") is False)
    checks = {
        "approved_existing_worker": trusted,
        "exact_private_destination_id_configured": scoped,
        "encrypted_snapshot_and_byte_restore": snapshot,
        "isolated_shadow_tables_restored": restore,
        "scheduled_backups_and_alert_delivered": scheduled,
        "swlc_import_acknowledged": imported,
        "p2_shadow_operational_certification": strict,
    }
    return {
        "schema": "jhadina.shadow.google-drive-commissioning-gate.v1",
        "evaluatedAt": current.isoformat(),
        # Local JSON receipts are not cryptographic proof of provider
        # operations or delivered notifications. Independent provider-backed
        # attestation is mandatory before production readiness can be true.
        "receiptContractPassed": all(checks.values()),
        "ready": False,
        "checks": checks,
        "blocked": [k for k, value in checks.items() if not value],
        "providerOperationsExecuted": False,
        "realMoneyAuthorized": False,
        "liveShadowServiceMovedToDrive": False,
        "sourceReceiptsIndependentlyAuthenticated": False,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backup-receipt", type=Path)
    ap.add_argument("--restore-receipt", type=Path)
    ap.add_argument("--monitor-receipt", type=Path)
    ap.add_argument("--sync-receipt", type=Path)
    ap.add_argument("--p2-receipt", type=Path)
    args = ap.parse_args()
    try:
        # No identity switches, cloud APIs or file copy: receipt inspection only.
        os.umask(0o077)
        receipt_args = {k: load_private(getattr(args, k))
                        for k in ("backup_receipt", "restore_receipt", "monitor_receipt",
                                  "sync_receipt", "p2_receipt")}
        print(json.dumps(assess(env=dict(os.environ), **receipt_args), sort_keys=True))
        return 0
    except (ShadowDriveGateError, OSError, ValueError, json.JSONDecodeError):
        print("SHADOW_DRIVE_COMMISSION_BLOCKED: invalid private receipt", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
