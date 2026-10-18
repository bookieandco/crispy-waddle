#!/usr/bin/env python3
"""SHARK-HISTORY-SALVAGE.08-.10: inspect local evidence and stage a NEW paper ledger.

Read-only by default and always: never initializes PostgreSQL, runs Docker,
starts a Pod, reads Supabase, imports old history, or authorizes real trading.
Reuses the existing salvage scanner and Google Homebase receipt schemas.
"""
from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

import shark_history_salvage_inventory as scanner

HEX64 = __import__("re").compile(r"^[0-9a-f]{64}$")
EPHEMERAL = frozenset({"overlay", "tmpfs", "ramfs", "aufs", "squashfs", "devtmpfs"})


class SalvageGateError(ValueError):
    pass


def private_json(path: Path) -> dict[str, Any]:
    """Read only a non-symlink, owner-only, bounded JSON receipt."""
    if not path.is_absolute() or path.is_symlink():
        raise SalvageGateError("PRIVATE_ABSOLUTE_RECEIPT_REQUIRED")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        m = os.fstat(fd)
        if not stat.S_ISREG(m.st_mode) or m.st_mode & 0o077 or m.st_size > 3_000_000:
            raise SalvageGateError("RECEIPT_OWNER_PERMISSIONS_OR_SIZE_INVALID")
        with os.fdopen(os.dup(fd), "rb") as file:
            raw = file.read(3_000_001)
    finally:
        os.close(fd)
    if len(raw) > 3_000_000:
        raise SalvageGateError("RECEIPT_OVERSIZED")
    try:
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise SalvageGateError("RECEIPT_JSON_INVALID") from None
    if not isinstance(data, dict):
        raise SalvageGateError("RECEIPT_OBJECT_REQUIRED")
    return data


def review_archive(root: Path, snapshot: dict[str, Any]) -> dict[str, Any]:
    """Independently re-hash owner-local originals without modifying them."""
    if snapshot.get("schema") != "SHARK-HISTORY-SALVAGE-DISCOVERY.v1" or (
            snapshot.get("originalLedgerRecovered") is not False or
            snapshot.get("originalProvenanceVerified") is not False or
            snapshot.get("writeOperationsPerformed") is not False):
        raise SalvageGateError("DISCOVERY_RECEIPT_UNTRUSTED")
    if not isinstance(snapshot.get("entries"), list):
        raise SalvageGateError("DISCOVERY_ENTRIES_REQUIRED")
    try:
        current = scanner.inventory(root)
    except (scanner.SalvageInventoryError, OSError) as error:
        raise SalvageGateError("DISCOVERY_SOURCE_UNAVAILABLE") from error
    if snapshot.get("rootFingerprint") != current["rootFingerprint"]:
        raise SalvageGateError("DISCOVERY_ROOT_IDENTITY_CHANGED")
    if snapshot.get("filesExamined") != current["filesExamined"] or (
            snapshot.get("bytesExamined") != current["bytesExamined"]):
        raise SalvageGateError("DISCOVERY_FILE_COUNTS_CHANGED")
    fields = ("id", "kind", "origin", "sha256", "bytes", "sourceRef",
              "originalProvenanceVerified", "mayUpdateForwardLearning",
              "canExecute", "canAuthorizeLive")
    def canonical(entries: list[dict]) -> list[tuple]:
        if len(entries) > scanner.MAX_FILES or any(not isinstance(e, dict) for e in entries):
            raise SalvageGateError("DISCOVERY_ENTRY_INVALID")
        ids = [e.get("id") for e in entries]
        if len(set(ids)) != len(ids):
            raise SalvageGateError("DISCOVERY_DUPLICATE_ID")
        return sorted(tuple(e.get(k) for k in fields) for e in entries)
    if canonical(snapshot["entries"]) != canonical(current["entries"]):
        raise SalvageGateError("DISCOVERY_SOURCE_BYTES_CHANGED")
    candidates = [
        {"id": e["id"], "kind": e["kind"], "sha256": e["sha256"], "bytes": e["bytes"]}
        for e in current["entries"]
        if e["kind"] in ("ORIGINAL_DB_CANDIDATE", "ORIGINAL_EXPORT_CANDIDATE")
    ]
    return {
        "schema": "SHARK-HISTORY-SALVAGE-REVIEW.v1",
        "status": "ORIGINAL_CANDIDATES_UNVERIFIED" if candidates else "NO_ORIGINAL_CANDIDATE_IN_SCOPED_ROOT",
        "candidateCount": len(candidates),
        "candidateHashes": candidates,
        "scopedFiles": current["filesExamined"],
        "originalLedgerRecovered": False,
        "originalProvenanceVerified": False,
        "allowedToImportLearning": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def assess_backup_restore(
    review: dict[str, Any], backup: dict[str, Any], restored: dict[str, Any]
) -> dict[str, Any]:
    """Cross-check existing Google Homebase Restic and offline restore receipts.

    Proves at most *restored backup bytes* for a scoped candidate. The existing
    general Homebase receipt is NOT proof of original SHARK pod/volume lineage,
    historical decisions or restored SHARK row parity.
    """
    reasons: list[str] = []
    if review.get("schema") != "SHARK-HISTORY-SALVAGE-REVIEW.v1" or (
            review.get("originalLedgerRecovered") is not False or
            review.get("originalProvenanceVerified") is not False or
            review.get("canExecute") is not False):
        raise SalvageGateError("RECOVERY_REVIEW_INVALID")
    candidates = review.get("candidateHashes")
    if not isinstance(candidates, list) or review.get("candidateCount") != len(candidates):
        raise SalvageGateError("RECOVERY_CANDIDATES_INVALID")
    digest = backup.get("sha256")
    if not isinstance(digest, str) or not HEX64.fullmatch(digest) or not any(
            isinstance(c, dict) and c.get("kind") == "ORIGINAL_DB_CANDIDATE"
            and c.get("sha256") == digest for c in candidates):
        reasons.append("NO_EXACT_MATCHING_PG_DUMP_CANDIDATE")
    if backup.get("schema") == "jhadina.shadow.google-drive-backup.v1":
        # Dedicated SHADOW backup + offline semantic restore receipts are
        # different from generic Homebase Compose receipts. Neither schema
        # can prove historical source Pod/Volume ownership by itself.
        from shark_history_shadow_receipts import validate_shadow_receipt_pair
        reasons.extend(validate_shadow_receipt_pair(backup, restored))
        return {
            "schema": "SHARK-HISTORY-SALVAGE-RESTORE-CHECK.v1",
            "status": ("RESTORED_CONTENT_EXTERNAL_LINEAGE_AUDIT_REQUIRED"
                       if not reasons else "BLOCKED"),
            "reasonCodes": sorted(reasons),
            "historicalPodVolumeIdentityVerified": False,
            "historicalDecisionRowsVerified": False,
            "originalLedgerRecovered": False,
            "mayImportLearning": False,
            "canExecute": False,
            "canAuthorizeLive": False,
        }
    if (backup.get("schema") != "jhadina.google-homebase.db-backup.v1" or
            backup.get("scope") != "POSTGRES_ONLY" or
            backup.get("source_kind") != "LOCAL_HOMEBASE_COMPOSE" or
            backup.get("hosted_supabase_data_covered") is not False or
            backup.get("remote_byte_restore_verified") is not True or
            backup.get("restic_encrypted") is not True):
        reasons.append("RESTIC_ENCRYPTION_AND_OFFSITE_RECEIPT_UNVERIFIED")
    snap = backup.get("snapshot_id")
    if not isinstance(snap, str) or not __import__("re").fullmatch("[0-9a-f]{8,64}", snap):
        reasons.append("IMMUTABLE_SNAPSHOT_ID_REQUIRED")
    if (restored.get("schema") != "jhadina.google-homebase.db-restore-drill.v1" or
            restored.get("source_snapshot_id") != snap or
            restored.get("source_sha256") != digest or
            restored.get("source_kind") != "LOCAL_HOMEBASE_COMPOSE" or
            restored.get("hosted_supabase_data_covered") is not False or
            restored.get("isolated_network") is not True or
            restored.get("production_database_modified") is not False or
            restored.get("postgres_database_restore_tested") is not True or
            type(restored.get("restored_application_table_count")) is not int or
            restored.get("restored_application_table_count", 0) < 1):
        reasons.append("ISOLATED_RESTORE_CONTENT_NOT_VERIFIED")
    return {
        "schema": "SHARK-HISTORY-SALVAGE-RESTORE-CHECK.v1",
        "status": "RESTORED_CONTENT_EXTERNAL_LINEAGE_AUDIT_REQUIRED" if not reasons else "BLOCKED",
        "reasonCodes": sorted(reasons),
        "historicalPodVolumeIdentityVerified": False,
        "historicalDecisionRowsVerified": False,
        "originalLedgerRecovered": False,
        "mayImportLearning": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def roots_separate(old: Path, new: Path) -> bool:
    if not old.is_absolute() or not new.is_absolute():
        return False
    a, b = old.resolve(strict=False), new.resolve(strict=False)
    if a == Path("/") or b == Path("/") or a == b:
        return False
    return a not in b.parents and b not in a.parents


def fresh_start_preflight(
    *, old_root: Path, new_root: Path, owner_approval: str,
    mount_probe=None, running_in_ci: bool = False
) -> dict[str, Any]:
    """Verify conditions for *staging* a separate empty paper-only PGDATA.

    The actual bootstrap belongs to PR #1149, which must be reviewed/merged
    separately; this function NEVER creates directories or restarts services.
    """
    reasons: list[str] = []
    if running_in_ci:
        reasons.append("OWNER_CONTROLLED_HOST_REQUIRED")
    if owner_approval != "YES_NEW_PAPER_HISTORY_NOT_RECOVERED":
        reasons.append("EXPLICIT_NEW_HISTORY_APPROVAL_REQUIRED")
    if not roots_separate(old_root, new_root):
        reasons.append("OLD_NEW_ROOT_ISOLATION_REQUIRED")
    if new_root.is_symlink() or any(parent.is_symlink() for parent in new_root.parents):
        reasons.append("NEW_ROOT_SYMLINK_REJECTED")
    if new_root.exists() and (not new_root.is_dir() or any(new_root.iterdir())):
        reasons.append("NEW_ROOT_MUST_BE_EMPTY")
    ancestor = new_root
    while not ancestor.exists() and ancestor != ancestor.parent:
        ancestor = ancestor.parent
    if not ancestor.is_dir() or ancestor.is_symlink():
        reasons.append("NEW_ROOT_ANCESTOR_INVALID")
    if not reasons:
        try:
            probe = mount_probe or (lambda p: subprocess.run(
                ["findmnt", "-T", str(p), "-no", "TARGET,FSTYPE,SOURCE"],
                text=True, capture_output=True, check=True, timeout=10
            ).stdout)
            details = str(probe(ancestor)).strip().split()
            if len(details) < 3 or details[0] == "/" or details[1] in EPHEMERAL:
                reasons.append("DEDICATED_PERSISTENT_MOUNT_UNVERIFIED")
        except (OSError, subprocess.SubprocessError):
            reasons.append("DEDICATED_PERSISTENT_MOUNT_UNVERIFIED")
    return {
        "schema": "SHARK-HISTORY-FRESH-PRESTART.v1",
        "status": "READY_FOR_OWNER_STAGING_REVIEW" if not reasons else "BLOCKED",
        "reasonCodes": sorted(reasons),
        "label": "NEW_HISTORY_NOT_RECOVERED",
        "bootstrapLedgerLabel": "NEW_EMPTY_RESEARCH_ONLY",
        "originalPreserved": True,
        "startupExecuted": False,
        "independentBackupRestored": False,
        "workerCommissioned": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def write_private_receipt(path: Path, data: dict[str, Any],
                          protected_roots: tuple[Path, ...]) -> None:
    """Allow a new immutable receipt OUTSIDE both original and fresh ledgers."""
    if not path.is_absolute() or path.is_symlink() or not path.parent.is_dir():
        raise SalvageGateError("RECEIPT_OUTSIDE_SOURCE_REQUIRED")
    if any(parent.is_symlink() for parent in path.parents):
        raise SalvageGateError("RECEIPT_PARENT_SYMLINK_REJECTED")
    resolved = path.resolve(strict=False)
    for root in protected_roots:
        source = root.resolve(strict=False)
        if resolved == source or source in resolved.parents:
            raise SalvageGateError("RECEIPT_MUST_NOT_MODIFY_LEDGER_ROOT")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        json.dump(data, file, sort_keys=True)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    cmd = parser.add_subparsers(dest="mode", required=True)
    c = cmd.add_parser("review")
    c.add_argument("--root", type=Path, required=True)
    c.add_argument("--inventory", type=Path, required=True)
    c.add_argument("--out", type=Path)
    r = cmd.add_parser("verify-restore")
    for name in ("review", "backup", "restore"):
        r.add_argument("--" + name, type=Path, required=True)
    r.add_argument("--out", type=Path)
    p = cmd.add_parser("fresh-preflight")
    p.add_argument("--old-root", type=Path, required=True)
    p.add_argument("--new-root", type=Path, required=True)
    p.add_argument("--owner-approval", required=True)
    p.add_argument("--out", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "review":
            result = review_archive(args.root, private_json(args.inventory))
        elif args.mode == "verify-restore":
            result = assess_backup_restore(private_json(args.review),
                                           private_json(args.backup),
                                           private_json(args.restore))
        else:
            result = fresh_start_preflight(
                old_root=args.old_root, new_root=args.new_root,
                owner_approval=args.owner_approval,
                running_in_ci=os.getenv("GITHUB_ACTIONS", "").lower() == "true")
        if args.out:
            forbidden = ((args.root,) if args.mode == "review"
                         else (args.old_root, args.new_root) if args.mode == "fresh-preflight"
                         else ())
            write_private_receipt(args.out, result, forbidden)
        print(json.dumps(result, sort_keys=True))
        return 0 if result["status"] not in ("BLOCKED",) else 3
    except (OSError, ValueError, scanner.SalvageInventoryError) as exc:
        print("SHARK_HISTORY_SALVAGE_PRESTART_BLOCKED:" + type(exc).__name__, file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
