#!/usr/bin/env python3
"""SHARK-LIVE.COMMISSION.01–.04: fail-closed local recovery/commissioning proof.

No external host, cloud persistence, Telegram API, RPC, AI or live trades.
A local SQLite snapshot/restore is NOT an encrypted off-host backup receipt.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

import shark_live_intelligence as worker

SCHEMA = "SHARK-LIVE-COMMISSION-01-04"
EXPECTED_TABLES = ("tokens", "outbox", "cycles")
MAX_TOKENS = worker.MAX_RETAINED
MAX_CYCLES = 200000
MAX_OUTBOX = 200000
DELIVERIES = {"ATTEMPTED", "ACKNOWLEDGED", "UNCERTAIN_NO_RETRY", "DISABLED"}


def _secure_file(path: str, *, must_exist: bool) -> Path:
    target = Path(path)
    if (not target.is_absolute() or target.is_symlink() or
            not target.parent.is_dir() or target.parent.stat().st_mode & 0o022 or
            (target.exists() and (not target.is_file() or target.stat().st_mode & 0o077))):
        raise ValueError("commission_path_insecure")
    if must_exist and not target.is_file():
        raise ValueError("commission_missing_source")
    if not must_exist and target.exists():
        raise ValueError("commission_would_overwrite")
    return target


def _fp(db: sqlite3.Connection) -> str:
    digest = hashlib.sha256()
    for table, columns, limit in (
        ("tokens", ("mint", "first_discovered", "last_checked", "study_json", "risk_json", "status", "last_seen"), MAX_TOKENS),
        ("outbox", ("event_key", "mint", "created_at", "delivery"), MAX_OUTBOX),
        ("cycles", ("id", "available_at", "receipt_digest", "new_tokens", "checked", "graded"), MAX_CYCLES),
    ):
        count = db.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
        if not 0 <= count <= limit:
            raise ValueError("commission_data_limit")
        digest.update((table + ":" + str(count)).encode())
        for row in db.execute("SELECT " + ",".join(columns) + " FROM " + table + " ORDER BY 1"):
            digest.update(json.dumps(row, separators=(",", ":"), allow_nan=False).encode())
    return digest.hexdigest()


def audit_db(db: sqlite3.Connection) -> dict:
    check = db.execute("PRAGMA quick_check").fetchone()
    if not check or check[0] != "ok":
        raise ValueError("commission_integrity_failure")
    for table in EXPECTED_TABLES:
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is None:
            raise ValueError("commission_schema_missing")
    for mint, study_raw, status, risk_raw in db.execute(
            "SELECT mint, study_json, status, risk_json FROM tokens"):
        if not worker._valid_mint(mint):
            raise ValueError("commission_mint_invalid")
        if not isinstance(status, str) or len(status) > 80:
            raise ValueError("commission_status_invalid")
        risks = json.loads(risk_raw)
        if not isinstance(risks, list) or any(x not in worker.RESEARCH_FLAGS for x in risks):
            raise ValueError("commission_nonpublic_or_invalid_risk")
        if study_raw:
            study = worker.paper.check_study(json.loads(study_raw))
            if study["mint"] != mint:
                raise ValueError("commission_study_mint_mismatch")
    for key, mint, delivery in db.execute("SELECT event_key, mint, delivery FROM outbox"):
        if not isinstance(key, str) or len(key) != 64 or any(c not in "0123456789abcdef" for c in key):
            raise ValueError("commission_outbox_key_invalid")
        if not worker._valid_mint(mint) or delivery not in DELIVERIES:
            raise ValueError("commission_outbox_invalid")
    for stamp, receipt in db.execute("SELECT available_at, receipt_digest FROM cycles"):
        worker._utc(stamp)
        if not isinstance(receipt, str) or len(receipt) != 64:
            raise ValueError("commission_cycle_receipt_invalid")
    result = worker._read_summary(db)
    return {
        "status": "LOCAL_INTEGRITY_CHECKED_NOT_PROVIDER_ATTESTED",
        "fingerprint": _fp(db),
        "totalPublicMints": result["observedPublicTokens"],
        "priceOnlyCases": result["priceOnlyPaperMarks"],
        "noTrade": True,
    }


def _backup(source: sqlite3.Connection, dest: Path) -> None:
    """SQLite online backup, no overwrite, mode 0600, synced before publication."""
    _secure_file(str(dest), must_exist=False)
    fd, temp_name = tempfile.mkstemp(dir=dest.parent, prefix=".shark-commission-")
    os.close(fd)
    tmp = Path(temp_name)
    try:
        with sqlite3.connect(str(tmp)) as target:
            source.backup(target)
            target.commit()
            audit_db(target)
        with tmp.open("rb") as f:
            os.fsync(f.fileno())
        os.link(tmp, dest)  # fails rather than overwrites an existing snapshot
        dirfd = os.open(dest.parent, os.O_RDONLY)
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)
    finally:
        tmp.unlink(missing_ok=True)


def restore_drill(source_db: sqlite3.Connection) -> dict:
    """A source DB backup and restore to a *different* exclusive temp path."""
    source_audit = audit_db(source_db)
    with tempfile.TemporaryDirectory(prefix="shark-recover-") as directory:
        dest = Path(directory)
        snapshot = dest / "snapshot.sqlite3"
        restored = dest / "restored.sqlite3"
        _backup(source_db, snapshot)
        with sqlite3.connect(str(snapshot)) as snapshot_db:
            snapshot_audit = audit_db(snapshot_db)
            _backup(snapshot_db, restored)
        with sqlite3.connect(str(restored)) as restored_db:
            restored_audit = audit_db(restored_db)
        if not (source_audit["fingerprint"] == snapshot_audit["fingerprint"]
                == restored_audit["fingerprint"]):
            raise ValueError("commission_restore_fingerprint_mismatch")
    return {
        "schema": SCHEMA, "status": "LOCAL_SNAPSHOT_RESTORE_PROVEN",
        "sourceRecords": source_audit["totalPublicMints"],
        "studiedOutcomes": source_audit["priceOnlyCases"],
        "sourceFingerprint": source_audit["fingerprint"],
        "restoredFingerprint": restored_audit["fingerprint"],
        "offHostEncryptedBackupVerified": False,
        "productionHostCommissioned": False,
        "providerFeedVerified": False,
        "privateTelegramDeliveryVerified": False,
        "canTrade": False,
    }


def notifications_ready(*, explicit_owner_ack: bool) -> dict:
    """No message sent. Operator must separately choose a private canary."""
    env = os.environ
    ready = (
        explicit_owner_ack and env.get("ENABLE_SHARK_PUBLIC_ALERTS") == "true"
        and env.get("TELEGRAM_ALLOWED_USER_ID", "").isascii()
        and env.get("TELEGRAM_ALLOWED_USER_ID", "").isdecimal()
        and 0 < len(env.get("TELEGRAM_ALLOWED_USER_ID", "")) <= 20
        and bool(env.get("TELEGRAM_BOT_TOKEN"))
    )
    return {
        "schema": SCHEMA, "status": "NOTIFICATION_CREDENTIAL_PRECHECK_ONLY" if ready
        else "NOTIFICATION_DISABLED_OR_UNVERIFIED",
        "enabledWithExplicitOwnerConsent": bool(ready),
        "messageSent": False, "chatInspected": False,
        "canTrade": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["recovery-drill", "backup", "notify-preflight"], required=True)
    parser.add_argument("--state", help="Absolute owner-private SQLite path")
    parser.add_argument("--backup", help="Exclusive new local snapshot path")
    parser.add_argument("--approve-notification-check", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.mode == "notify-preflight":
            print(json.dumps(notifications_ready(
                explicit_owner_ack=args.approve_notification_check), sort_keys=True))
            return 0
        if not args.state:
            raise ValueError("commission_state_path_required")
        _secure_file(args.state, must_exist=True)
        with worker.local_database(args.state) as db:
            if args.mode == "recovery-drill" and not args.backup:
                print(json.dumps(restore_drill(db), sort_keys=True))
                return 0
            if args.mode == "backup" and args.backup:
                target = _secure_file(args.backup, must_exist=False)
                _backup(db, target)
                print(json.dumps({
                    "schema": SCHEMA,
                    "status": "LOCAL_OWNER_ONLY_BACKUP_CREATED",
                    "offHostEncryptedBackupVerified": False,
                    "canTrade": False,
                }, sort_keys=True))
                return 0
            raise ValueError("commission_mode_arguments_invalid")
    except (ValueError, TypeError, KeyError, OSError, sqlite3.Error, json.JSONDecodeError):
        print("SHARK_COMMISSION_FAIL_CLOSED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
