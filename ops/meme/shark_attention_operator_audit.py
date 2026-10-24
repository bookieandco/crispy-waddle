#!/usr/bin/env python3
"""SHARK-ATTENTION.COMMISSION.12: read-only audit of the *existing* SHARK ledger.

No daemon, collection, Telegram, source changes, database creation, notification,
simulated winning trades, wallet, keys, RPC access or monetary authority.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sqlite3
import stat
from urllib.parse import quote
import shark_live_commission as canonical
import shark_live_intelligence as worker

SCHEMA = "SHARK-ATTENTION-EXISTING-LEDGER-READONLY-V1"

def inspect_existing_ledger(path: str, *, audit_at: str) -> dict:
    now = worker._utc(audit_at)
    target = Path(path)
    if not target.is_absolute() or target.is_symlink() or not target.is_file():
        raise ValueError("attention_existing_ledger_required")
    parent = target.parent
    if not parent.is_dir() or parent.is_symlink():
        raise ValueError("attention_ledger_parent_invalid")
    if parent.stat().st_mode & 0o022:
        raise ValueError("attention_parent_world_or_group_writable")
    meta = target.stat(follow_symlinks=False)
    if not stat.S_ISREG(meta.st_mode) or meta.st_mode & 0o077 or meta.st_uid != os.geteuid():
        raise ValueError("attention_ledger_not_private_owner_file")
    # URI mode=ro prevents absent storage from being silently created.
    uri = "file:" + quote(str(target), safe="/") + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=1.0) as db:
        db.execute("PRAGMA query_only=ON")
        db.execute("PRAGMA busy_timeout=1000")
        audit = canonical.audit_db(db)
        total_cycles = db.execute("SELECT COUNT(*) FROM cycles").fetchone()[0]
        latest = db.execute(
            "SELECT available_at FROM cycles ORDER BY available_at DESC LIMIT 1"
        ).fetchone()
        pending = db.execute(
            "SELECT COUNT(*) FROM outbox WHERE delivery = 'UNCERTAIN_NO_RETRY'"
        ).fetchone()[0]
        if latest and worker._utc(latest[0]) > now:
            raise ValueError("attention_ledger_future_cycle")
    return {
        "schema": SCHEMA,
        "status": "EXISTING_PUBLIC_SHARK_LEDGER_READ_ONLY",
        "fingerprint": audit["fingerprint"],
        "totalPublicMints": audit["totalPublicMints"],
        "priceOnlyCases": audit["priceOnlyCases"],
        "cycleCount": total_cycles,
        "lastCycleAt": latest[0] if latest else None,
        "uncertainAlertAttempts": pending,
        "missingCyclesInvented": False,
        "sourceOriginAuthenticated": False,
        "continuousHostCommissioned": False,
        "offHostRecoveryVerified": False,
        "ownerDeliveryVerified": False,
        "canNotify": False,
        "canTrade": False,
    }

def main() -> int:
    parser = argparse.ArgumentParser(description="Read existing private SHARK research ledger only")
    parser.add_argument("--state", required=True)
    parser.add_argument("--audit-at", required=True, help="UTC ISO-8601 audit timestamp")
    args = parser.parse_args()
    print(json.dumps(inspect_existing_ledger(args.state, audit_at=args.audit_at), sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
