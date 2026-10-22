#!/usr/bin/env python3
"""Owner-only SHARK PAPER genesis and restart identity gate.

Initial creation is called only after an explicitly approved new, empty
PostgreSQL initdb + migrations. Subsequent restarts require the same PGDATA
inode and a separate completed encrypted-Drive/isolated-restore receipt.
Original unmarked PGDATA always remains blocked. No background worker, DB
queries, provider calls, trades or file deletions are performed here.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path

SCHEMA = "jhadina.shadow.paper-genesis.v1"
HEX = re.compile(r"[0-9a-f]{64}\Z")
SNAP = re.compile(r"[0-9a-f]{8,64}\Z")
ROWS = ("market_samples", "decisions", "executions", "observations",
        "lessons", "calibrations", "memories", "sync_records", "runtime_state")


class FreshGenesisError(ValueError):
    pass


def state_identity(raw: str) -> dict:
    root = Path(raw)
    if not root.is_absolute() or root == Path("/") or root.is_symlink():
        raise FreshGenesisError("FRESH_ROOT_UNSAFE")
    pgdata = root / "postgres"
    version = pgdata / "PG_VERSION"
    if pgdata.is_symlink() or version.is_symlink() or not pgdata.is_dir():
        raise FreshGenesisError("FRESH_PGDATA_NOT_REGULAR")
    meta = pgdata.stat(follow_symlinks=False)
    info = version.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > 32:
        raise FreshGenesisError("FRESH_VERSION_INVALID")
    major = version.read_text(encoding="ascii").strip()
    if not major.isdigit() or len(major) > 2:
        raise FreshGenesisError("FRESH_VERSION_INVALID")
    return {"state_root": str(root), "pgdata_dev": meta.st_dev,
            "pgdata_ino": meta.st_ino, "pg_version": major,
            "pg_version_sha256": hashlib.sha256(version.read_bytes()).hexdigest()}


def private_read(path: Path) -> dict:
    if not path.is_absolute() or path.is_symlink():
        raise FreshGenesisError("FRESH_PRIVATE_ABSOLUTE_RECEIPT_REQUIRED")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        m = os.fstat(fd)
        if not stat.S_ISREG(m.st_mode) or (m.st_mode & 0o077) or m.st_size > 100_000:
            raise FreshGenesisError("FRESH_RECEIPT_PRIVATE_AND_BOUNDED_REQUIRED")
        data = os.read(fd, m.st_size + 1)
    finally:
        os.close(fd)
    if len(data) > 100_000:
        raise FreshGenesisError("FRESH_RECEIPT_OVERSIZED")
    try:
        parsed = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise FreshGenesisError("FRESH_RECEIPT_JSON_INVALID") from None
    if not isinstance(parsed, dict):
        raise FreshGenesisError("FRESH_RECEIPT_OBJECT_REQUIRED")
    return parsed


def genesis_path(root: str) -> Path:
    return Path(root) / ".shadow-fresh-genesis.json"


def create_genesis(root: str) -> dict:
    ident = state_identity(root)
    marker = genesis_path(root)
    payload = {"schema": SCHEMA, **ident,
               "history_label": "NEW_EMPTY_RESEARCH_ONLY",
               "original_history_recovered": False,
               "created_from_empty_initdb": True,
               "can_execute": False, "can_sign": False,
               "can_broadcast": False, "can_authorize_live": False}
    fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(payload, out, sort_keys=True)
        out.write("\n")
        out.flush()
        os.fsync(out.fileno())
    return payload


def backup_restore_gate(backup: dict, restored: dict) -> None:
    snap, digest = backup.get("snapshot_id"), backup.get("sha256")
    if (backup.get("schema") != "jhadina.shadow.google-drive-backup.v1"
            or backup.get("source_kind") != "LOCAL_SHADOW_UNIX_SOCKET"
            or backup.get("scope") != "SHADOW_POSTGRES_ONLY"
            or backup.get("restic_path") != "shadow-postgres-restic-v1"
            or backup.get("encrypted_at_rest") is not True
            or backup.get("remote_bytes_restored_verified") is not True
            or backup.get("active_database_modified") is not False
            or backup.get("live_trading_authorized") is not False
            or not isinstance(snap, str) or not SNAP.fullmatch(snap)
            or not isinstance(digest, str) or not HEX.fullmatch(digest)):
        raise FreshGenesisError("FRESH_ENCRYPTED_OFFSITE_BACKUP_REQUIRED")
    counts = restored.get("restored_ledger_counts")
    if (not isinstance(counts, dict)
            or any(type(counts.get(key)) is not int or counts[key] < 0 for key in ROWS)):
        raise FreshGenesisError("FRESH_ISOLATED_RESTORE_ROWS_INVALID")
    if (restored.get("schema") != "jhadina.shadow.google-drive-restore.v2"
            or restored.get("snapshot_id") != snap
            or restored.get("sha256") != digest
            or restored.get("required_shadow_tables_verified") is not True
            or restored.get("semantic_integrity_verified") is not True
            or restored.get("restored_grade_review_table_present") is not True
            or type(restored.get("restored_table_count")) is not int
            or restored["restored_table_count"] < len(ROWS)
            or restored.get("network_isolated") is not True
            or restored.get("active_database_modified") is not False
            or restored.get("swlc_synced") is not False
            or restored.get("live_trading_authorized") is not False
            or restored.get("source_vs_restored_snapshot_row_parity_verified") is not False):
        raise FreshGenesisError("FRESH_INDEPENDENT_OFFSITE_RESTORE_REQUIRED")


def verify_restart(root: str, backup_path: str, restore_path: str) -> dict:
    actual = state_identity(root)
    marker = private_read(genesis_path(root))
    if (marker.get("schema") != SCHEMA
            or any(marker.get(key) != value for key, value in actual.items())
            or marker.get("history_label") != "NEW_EMPTY_RESEARCH_ONLY"
            or marker.get("created_from_empty_initdb") is not True
            or marker.get("original_history_recovered") is not False
            or any(marker.get(key) is not False for key in (
                "can_execute", "can_sign", "can_broadcast", "can_authorize_live"))):
        raise FreshGenesisError("FRESH_ORIGINAL_DATA_MUST_NOT_BE_ADMITTED")
    backup_restore_gate(private_read(Path(backup_path)), private_read(Path(restore_path)))
    return {"schema": "jhadina.shadow.paper-restart-gate.v1",
            "state": "SOURCE_ONLY_RESTART_ADMITTED",
            "original_history_recovered": False, "backed_up_source_host": "OWNER_ATTESTED",
            "can_execute": False, "can_authorize_live": False}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["create", "verify"])
    parser.add_argument("--state-root", required=True)
    parser.add_argument("--backup-receipt")
    parser.add_argument("--restore-receipt")
    args = parser.parse_args()
    try:
        if args.command == "create":
            result = create_genesis(args.state_root)
        else:
            result = verify_restart(args.state_root,
                                    args.backup_receipt or "",
                                    args.restore_receipt or "")
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, FreshGenesisError, UnicodeError):
        print("SHARK_FRESH_LEDGER_ADMISSION_BLOCKED", file=sys.stderr)
        return 6


if __name__ == "__main__":
    raise SystemExit(main())
