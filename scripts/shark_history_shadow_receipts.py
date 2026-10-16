"""Read-only verification of existing dedicated SHADOW Google Drive receipts.

This is an evidence RECONCILIATION helper, not a witness to underlying backup
execution, actual RunPod Pod ownership, live host identity or restored row parity.
No network calls, shell commands, writes or trade authority.
"""
from __future__ import annotations

import re
from typing import Any

HEX = re.compile(r"[a-f0-9]{64}\Z")
SNAP = re.compile(r"[a-f0-9]{8,64}\Z")
ROW_KEYS = ("market_samples", "decisions", "executions", "observations",
            "lessons", "calibrations", "memories", "sync_records", "runtime_state")
HORIZONS = frozenset(("15M", "1H", "4H", "24H", "3D", "7D"))


def validate_shadow_receipt_pair(backup: dict[str, Any],
                                 restored: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    snapshot, digest = backup.get("snapshot_id"), backup.get("sha256")
    if (backup.get("schema") != "jhadina.shadow.google-drive-backup.v1" or
            backup.get("source_kind") != "LOCAL_SHADOW_UNIX_SOCKET" or
            backup.get("scope") != "SHADOW_POSTGRES_ONLY" or
            backup.get("restic_path") != "shadow-postgres-restic-v1" or
            backup.get("encrypted_at_rest") is not True or
            backup.get("remote_bytes_restored_verified") is not True or
            backup.get("isolated_database_restore_verified") is not False or
            backup.get("active_database_modified") is not False or
            backup.get("swlc_synced") is not False or
            backup.get("live_trading_authorized") is not False or
            not isinstance(snapshot, str) or not SNAP.fullmatch(snapshot) or
            not isinstance(digest, str) or not HEX.fullmatch(digest)):
        problems.append("SHADOW_ENCRYPTED_BACKUP_RECEIPT_INVALID")
    counts = restored.get("restored_ledger_counts")
    if not isinstance(counts, dict) or any(
            type(counts.get(key)) is not int or counts[key] < 0 for key in ROW_KEYS):
        problems.append("SHADOW_RESTORED_AGGREGATES_INVALID")
    elif counts["market_samples"] < 1 or counts["decisions"] < 1:
        problems.append("SHADOW_HISTORICAL_DECISIONS_ABSENT")
    else:
        for field, count_key in (("restored_observation_horizons", "observations"),
                                 ("restored_lesson_horizons", "lessons")):
            h = restored.get(field)
            if (not isinstance(h, dict) or any(
                    key not in HORIZONS or type(value) is not int or value < 0
                    for key, value in h.items()) or
                    sum(h.values()) != counts[count_key]):
                problems.append("SHADOW_RESTORED_HORIZON_COUNTS_INVALID")
    if (restored.get("schema") != "jhadina.shadow.google-drive-restore.v2" or
            restored.get("snapshot_id") != snapshot or
            restored.get("sha256") != digest or
            restored.get("required_shadow_tables_verified") is not True or
            restored.get("semantic_integrity_verified") is not True or
            restored.get("restored_grade_review_table_present") is not True or
            restored.get("network_isolated") is not True or
            restored.get("active_database_modified") is not False or
            restored.get("swlc_synced") is not False or
            restored.get("live_trading_authorized") is not False or
            restored.get("source_vs_restored_snapshot_row_parity_verified") is not False or
            restored.get("all_learning_horizons_semantically_verified") is not False or
            type(restored.get("restored_table_count")) is not int or
            restored.get("restored_table_count", 0) < len(ROW_KEYS)):
        problems.append("SHADOW_ISOLATED_RESTORE_INVALID")
    return sorted(set(problems))
