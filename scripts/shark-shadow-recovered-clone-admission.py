#!/usr/bin/env python3
"""SHARK-RECOVERY.LIVE: deny migrations on historical PostgreSQL unless a
private, reviewed, independently restored clone receipt matches this target.

The JSON is operator-attested evidence, not independent cryptographic proof:
the source-vs-restored hashes and row-parity must be established elsewhere.
A missing receipt always blocks.
"""
from __future__ import annotations

import argparse
import json
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

DIGEST = re.compile(r"[a-f0-9]{64}\Z")
REQUIRED = (
    "market_samples", "decisions", "executions", "observations",
    "lessons", "calibrations", "memories", "sync_records", "runtime_state",
)


class RecoveryAdmissionError(ValueError):
    pass


def absolute_private_file(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise RecoveryAdmissionError("SHADOW_CLONE_PRIVATE_RECEIPT_REQUIRED")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RecoveryAdmissionError("SHADOW_CLONE_RECEIPT_PERMISSIONS_INVALID")
    return path


def valid_recovered_clone(payload: object, state_root: str) -> dict:
    if not isinstance(payload, dict) or payload.get("schema") != "jhadina.shadow.recovered-clone-admission.v1":
        raise RecoveryAdmissionError("SHADOW_CLONE_ATTESTATION_SCHEMA_INVALID")
    destination = Path(state_root)
    source = Path(str(payload.get("original_state_root", "")))
    if (not destination.is_absolute() or destination.is_symlink()
            or not source.is_absolute() or source.is_symlink()
            or source == destination or source == Path("/")
            or payload.get("restored_clone_state_root") != str(destination)):
        raise RecoveryAdmissionError("SHADOW_CLONE_ISOLATION_NOT_PROVEN")
    if payload.get("environment") != "PAPER_ONLY" or payload.get("isolated_restore_verified") is not True:
        raise RecoveryAdmissionError("SHADOW_CLONE_RESTORE_NOT_VERIFIED")
    if payload.get("source_kind") != "AUTHENTIC_HISTORICAL_SHADOW":
        raise RecoveryAdmissionError("SHADOW_CLONE_AUTHENTIC_SOURCE_NOT_ATTESTED")
    if (payload.get("original_preserved") is not True
            or payload.get("owner_reviewed") is not True
            or payload.get("source_vs_restored_snapshot_row_parity_verified") is not True
            or payload.get("orphan_observations") != 0
            or payload.get("orphan_lessons") != 0
            or payload.get("authority_violations") != 0):
        raise RecoveryAdmissionError("SHADOW_CLONE_RECOVERY_INVARIANTS_FAILED")
    for key in ("can_execute", "can_sign", "can_broadcast", "can_authorize_live"):
        if payload.get(key) is not False:
            raise RecoveryAdmissionError("SHADOW_CLONE_LIVE_AUTHORITY_FORBIDDEN")
    source_digest = payload.get("source_sha256")
    restored_digest = payload.get("restored_sha256")
    if not isinstance(source_digest, str) or not DIGEST.fullmatch(source_digest) or source_digest != restored_digest:
        raise RecoveryAdmissionError("SHADOW_CLONE_DIGEST_PARITY_FAILED")
    source_rows = payload.get("source_rows")
    restored_rows = payload.get("restored_rows")
    if (not isinstance(source_rows, dict) or not isinstance(restored_rows, dict)
            or set(source_rows) != set(REQUIRED) or set(restored_rows) != set(REQUIRED)):
        raise RecoveryAdmissionError("SHADOW_CLONE_ROW_SCHEMA_INVALID")
    if any(type(source_rows[k]) is not int or source_rows[k] < 0
           or restored_rows[k] != source_rows[k] for k in REQUIRED):
        raise RecoveryAdmissionError("SHADOW_CLONE_ROW_PARITY_FAILED")
    if source_rows["decisions"] <= 0 or source_rows["market_samples"] <= 0:
        raise RecoveryAdmissionError("SHADOW_CLONE_HISTORICAL_HISTORY_ABSENT")
    checked = payload.get("verified_at")
    try:
        at = datetime.fromisoformat(checked.replace("Z", "+00:00"))
    except (ValueError, AttributeError, TypeError):
        raise RecoveryAdmissionError("SHADOW_CLONE_VERIFICATION_CLOCK_INVALID") from None
    if at.tzinfo is None or at > datetime.now(timezone.utc):
        raise RecoveryAdmissionError("SHADOW_CLONE_VERIFICATION_CLOCK_INVALID")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--state-root", required=True)
    args = parser.parse_args()
    try:
        path = absolute_private_file(args.receipt)
        valid_recovered_clone(json.loads(path.read_text(encoding="utf8")), args.state_root)
        print("SHADOW_RECOVERED_CLONE_SOURCE_AND_TARGET_ATTESTED")
        return 0
    except (RecoveryAdmissionError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"SHADOW_RECOVERY_ADMISSION_DENIED:{type(exc).__name__}", file=sys.stderr)
        return 6


if __name__ == "__main__":
    raise SystemExit(main())
