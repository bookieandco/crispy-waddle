#!/usr/bin/env python3
"""SHARK owner-host operations: verifiable mount probe and real offsite snapshot/restore.

The probe is read-only. Backup/restore changes ONLY an explicitly approved
owner-controlled Google Drive encrypted Restic destination and appends a
private audit receipt. It never provisions, starts, pays for a host/Pod,
migrates Supabase, imports recovered history or places trades.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import shutil
import stat
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SHADOW_DRIVE = ROOT / "infrastructure" / "homebase" / "google-drive"
EPHEMERAL = frozenset({"overlay", "tmpfs", "ramfs", "aufs", "squashfs", "devtmpfs"})
MIN_FREE_BYTES = 1024**3


class HostCommissionError(RuntimeError):
    pass


def safe_root(path: Path) -> Path:
    if not path.is_absolute() or path == Path("/") or path.is_symlink():
        raise HostCommissionError("EXISTING_OWNER_HOST_ROOT_REQUIRED")
    if any(p.is_symlink() for p in path.parents):
        raise HostCommissionError("SYMLINKED_HOST_PATH_REJECTED")
    if not path.is_dir():
        raise HostCommissionError("HOST_STATE_DIRECTORY_MISSING")
    return path


def probe_host(state_root: Path, *, env: dict[str, str], run=None,
               usage=None) -> dict[str, Any]:
    state_root = safe_root(state_root)
    if env.get("GITHUB_ACTIONS", "").lower() == "true" or (
            env.get("JHADINA_HOMEBASE_TRUST_DOMAIN") != "OWNER_CONTROLLED"
            or env.get("SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED") != "YES"):
        raise HostCommissionError("OWNER_HOST_AND_STORAGE_APPROVAL_REQUIRED")
    execute = run or subprocess.run
    result = execute(["findmnt", "-T", str(state_root), "-no", "TARGET,FSTYPE,SOURCE"],
                     text=True, capture_output=True, timeout=10, check=False)
    if result.returncode:
        raise HostCommissionError("OWNER_HOST_MOUNT_PROBE_FAILED")
    fields = result.stdout.strip().split()
    if len(fields) < 3 or fields[0] == "/" or fields[1] in EPHEMERAL:
        raise HostCommissionError("DEDICATED_NON_EPHEMERAL_MOUNT_REQUIRED")
    target = Path(fields[0])
    if not target.is_absolute() or target != state_root and target not in state_root.parents:
        raise HostCommissionError("MOUNT_DOES_NOT_COVER_STATE_ROOT")
    disk = (usage or shutil.disk_usage)(state_root)
    if disk.free < MIN_FREE_BYTES:
        raise HostCommissionError("INSUFFICIENT_PERSISTENT_STORAGE_SPACE")
    pgdata = state_root / "postgres"
    if pgdata.is_symlink():
        raise HostCommissionError("SYMLINKED_PGDATA_REJECTED")
    digest = hashlib.sha256(str(state_root).encode("utf-8")).hexdigest()
    return {
        "schema": "shark.fresh.owner-host-probe.v1",
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "rootFingerprint": digest,
        "mountTargetFingerprint": hashlib.sha256(str(target).encode()).hexdigest(),
        "filesystemType": fields[1],
        "freeBytes": disk.free,
        "freshPGDataPresent": (pgdata / "PG_VERSION").is_file(),
        "persistentMountObserved": True,
        # One point-in-time filesystem snapshot can NEVER prove 24x7 uptime.
        "continuousUptimeVerified": False,
        "workerGoogleOAuthVerified": False,
        "realBackupAndIsolatedRestoreVerified": False,
        "forwardLearningCyclesVerified": False,
        "sourceIsProductionWorker": "OWNER_ATTESTED_NOT_EXTERNALLY_PROVEN",
        "canExecute": False,
        "canAuthorizeLive": False,
    }


def append_private_receipt(path: Path, value: dict, state_root: Path) -> None:
    if not path.is_absolute() or path.is_symlink() or not path.parent.is_dir():
        raise HostCommissionError("PRIVATE_AUDIT_DESTINATION_REQUIRED")
    if any(p.is_symlink() for p in path.parents):
        raise HostCommissionError("SYMLINKED_AUDIT_PARENT_REJECTED")
    resolved = path.resolve(strict=False)
    source = state_root.resolve(strict=False)
    if source == resolved or source in resolved.parents:
        raise HostCommissionError("AUDIT_RECEIPT_MUST_BE_OUTSIDE_DATABASE")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(value, stream, sort_keys=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def actual_backup_and_restore(state_root: Path, *, env: dict[str, str],
                              provider=None, audit_root: Path) -> dict[str, Any]:
    probe = probe_host(state_root, env=env)
    if (env.get("SHARK_FRESH_REAL_BACKUP_RESTORE_APPROVED") != "YES"
            or env.get("SHADOW_DRIVE_BACKUP_APPROVED") != "YES"
            or env.get("JHADINA_RESTORE_TRUST_DOMAIN") != "OWNER_CONTROLLED"
            or env.get("JHADINA_RESTORE_APPROVED") != "YES"):
        raise HostCommissionError("EXPLICIT_REAL_REMOTE_RESTORE_APPROVAL_REQUIRED")
    if not probe["freshPGDataPresent"]:
        raise HostCommissionError("NO_INITIALIZED_FRESH_PGDATA")
    if env.get("SHARK_SHADOW_DATA_DIR") != str(state_root):
        raise HostCommissionError("BACKUP_SOURCE_MUST_MATCH_FRESH_LEDGER_ROOT")
    marker_path = state_root / ".shadow-fresh-genesis.json"
    if marker_path.is_symlink() or not marker_path.is_file():
        raise HostCommissionError("FRESH_LEDGER_GENESIS_REQUIRED")
    marker_info = marker_path.stat(follow_symlinks=False)
    if marker_info.st_mode & 0o077 or marker_info.st_size > 8192:
        raise HostCommissionError("FRESH_LEDGER_PRIVATE_GENESIS_REQUIRED")
    try:
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HostCommissionError("FRESH_LEDGER_GENESIS_CORRUPT") from None
    pgdata = state_root / "postgres"
    pginfo = pgdata.stat(follow_symlinks=False)
    version = (pgdata / "PG_VERSION").read_bytes()
    if (marker.get("schema") != "jhadina.shadow.paper-genesis.v1"
            or marker.get("state_root") != str(state_root)
            or marker.get("pgdata_dev") != pginfo.st_dev
            or marker.get("pgdata_ino") != pginfo.st_ino
            or marker.get("pg_version_sha256") != hashlib.sha256(version).hexdigest()
            or marker.get("history_label") != "NEW_EMPTY_RESEARCH_ONLY"
            or marker.get("original_history_recovered") is not False
            or marker.get("created_from_empty_initdb") is not True
            or any(marker.get(k) is not False for k in
                   ("can_execute", "can_sign", "can_broadcast", "can_authorize_live"))):
        raise HostCommissionError("FRESH_LEDGER_GENESIS_NOT_VERIFIED")
    if provider is None:
        # Import only after the owner-controlled host + approval checks pass.
        sys.path.insert(0, str(SHADOW_DRIVE))
        import shadow_backup as provider
    source = provider.source_settings(env)
    repository = provider.scoped_repository(env)
    backup_root = Path(env.get("JHADINA_BACKUP_ROOT", "/srv/jhadina-backups")) / "shadow"
    if not backup_root.is_absolute() or backup_root == state_root or state_root in backup_root.parents:
        raise HostCommissionError("SHADOW_BACKUP_ROOT_MUST_BE_INDEPENDENT")
    backup_receipt = provider.archive(repository, source, backup_root)
    # The actual backup writer must return the established Restic v1 receipt,
    # never only a synthetic test canary or an arbitrary export.
    if (backup_receipt.get("schema") != "jhadina.shadow.google-drive-backup.v1"
            or backup_receipt.get("encrypted_at_rest") is not True
            or backup_receipt.get("remote_bytes_restored_verified") is not True
            or backup_receipt.get("live_trading_authorized") is not False):
        raise HostCommissionError("ACTUAL_ENCRYPTED_BACKUP_RECEIPT_INVALID")
    restore_receipt = provider.recovery_drill(repository, backup_receipt, env)
    if (restore_receipt.get("schema") != "jhadina.shadow.google-drive-restore.v2"
            or restore_receipt.get("snapshot_id") != backup_receipt.get("snapshot_id")
            or restore_receipt.get("sha256") != backup_receipt.get("sha256")
            or restore_receipt.get("semantic_integrity_verified") is not True
            or restore_receipt.get("network_isolated") is not True
            or restore_receipt.get("active_database_modified") is not False
            or restore_receipt.get("live_trading_authorized") is not False):
        raise HostCommissionError("ACTUAL_ISOLATED_SHADOW_RESTORE_FAILED")
    final = {
        "schema": "shark.fresh.owner-real-backup-and-restore.v1",
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "hostProbe": probe,
        "backupSnapshotId": backup_receipt["snapshot_id"],
        "backupSHA256": backup_receipt["sha256"],
        "encryptedOffsiteBytesVerified": True,
        "isolatedDatabaseRestoreVerified": True,
        "restoredTableCount": restore_receipt.get("restored_table_count"),
        "restoredLedgerCounts": restore_receipt.get("restored_ledger_counts"),
        "machineDriveOAuthCheckInvoked": True,
        "productionCommissioned": False,
        "forwardLearningCyclesVerified": False,
        "canExecute": False,
        "canAuthorizeLive": False,
    }
    append_private_receipt(audit_root, final, state_root)
    return final


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("probe", "backup-and-restore"))
    parser.add_argument("--state-root", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        env = dict(os.environ)
        if args.operation == "probe":
            result = probe_host(args.state_root, env=env)
            append_private_receipt(args.receipt, result, args.state_root)
        else:
            result = actual_backup_and_restore(args.state_root, env=env,
                                               audit_root=args.receipt)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (HostCommissionError, OSError, subprocess.TimeoutExpired,
            subprocess.SubprocessError, ValueError, ImportError) as err:
        print("SHARK_OWNER_HOST_COMMISSION_BLOCKED:" + type(err).__name__,
              file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
