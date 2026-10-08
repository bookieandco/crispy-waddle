#!/usr/bin/env python3
"""Bounded, encrypted export of ONE current-object MinIO bucket to Google Drive.

This is NOT an atomic bucket snapshot, replication, object version history, or
MinIO API rehydration. Run only on an owner-controlled host; no hosted CI and no
live provider migration. mc accesses ONLY an explicitly configured loopback
MinIO endpoint via a private process environment variable.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

import backup

ALIAS = "jhadina-local-minio"
BUCKET_RE = re.compile(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\Z")
MAX_OBJECTS = 1000
MAX_BYTES = 128 * 1024 * 1024


class ObjectBackupError(RuntimeError):
    pass


def source_bucket(env: dict[str, str]) -> str:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise ObjectBackupError("Refusing private object backup on GitHub Actions")
    if (env.get("JHADINA_OBJECT_BACKUP_TRUST_DOMAIN") != "OWNER_CONTROLLED"
            or env.get("JHADINA_OBJECT_BACKUP_APPROVED") != "YES"):
        raise ObjectBackupError("Approved owner-controlled execution is required")
    bucket = env.get("JHADINA_MINIO_BUCKET", "")
    if (not BUCKET_RE.fullmatch(bucket) or ".." in bucket
            or bucket.startswith("xn--") or bucket.endswith(".") or bucket.startswith(".")):
        raise ObjectBackupError("A valid explicit MinIO bucket is required")
    secret_url = env.get(f"MC_HOST_{ALIAS}", "")
    try:
        url = urlsplit(secret_url)
        host = url.hostname
        port = url.port
    except ValueError:
        raise ObjectBackupError("Malformed private MinIO alias URL") from None
    if (url.scheme != "http" or host != "127.0.0.1" or port != 9000
            or not url.username or not url.password or url.path not in ("", "/")
            or url.query or url.fragment):
        raise ObjectBackupError("MinIO must be accessed through the private 127.0.0.1:9000 alias")
    return bucket


def object_path(key: str) -> PurePosixPath:
    if (not isinstance(key, str) or not key or "\\" in key
            or any(ord(c) < 32 for c in key)):
        raise ObjectBackupError("Invalid MinIO object key")
    parts = key.split("/")
    if any(s in {"", ".", ".."} for s in parts):
        raise ObjectBackupError("Unsafe MinIO object key")
    return PurePosixPath(*parts)


def run(args: list[str], *, cwd: Path | None = None, timeout: int = 180,
        capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, timeout=timeout, check=False)


def inventory(bucket: str, max_objects: int = MAX_OBJECTS,
              max_bytes: int = MAX_BYTES) -> dict[str, int]:
    if not (1 <= max_objects <= MAX_OBJECTS and 1 <= max_bytes <= MAX_BYTES):
        raise ObjectBackupError("Invalid conservative object/byte backup cap")
    p = run(["mc", "ls", "--recursive", "--json", f"{ALIAS}/{bucket}"], capture=True, timeout=90)
    if p.returncode != 0 or len(p.stdout) > 2_000_000:
        raise ObjectBackupError("MinIO inventory unavailable or too large")
    objects: dict[str, int] = {}
    size_total = 0
    for line in p.stdout.splitlines():
        try:
            item = json.loads(line)
        except ValueError:
            raise ObjectBackupError("Malformed mc object listing") from None
        if item.get("status") == "error" or item.get("type") == "error":
            raise ObjectBackupError("MinIO inventory reported an error")
        if item.get("type") not in ("file", "object"):
            continue
        key = item.get("key")
        key = str(object_path(key))
        size = item.get("size")
        if not isinstance(size, int) or isinstance(size, bool) or size < 0:
            raise ObjectBackupError("Invalid MinIO object length")
        if key in objects:
            raise ObjectBackupError("Duplicate MinIO object key")
        objects[key] = size
        size_total += size
        if len(objects) > max_objects or size_total > max_bytes:
            raise ObjectBackupError("MinIO bucket exceeds bounded one-bucket backup cap")
    if not objects:
        raise ObjectBackupError("Bucket empty: do not certify object recovery")
    return objects


def snapshot_manifest(folder: Path, expected: dict[str, int]) -> tuple[str, int]:
    found: dict[str, tuple[int, str]] = {}
    for item in folder.rglob("*"):
        if item.is_symlink():
            raise ObjectBackupError("Symlink in materialized object snapshot")
        if item.is_dir():
            continue
        if not item.is_file():
            raise ObjectBackupError("Unexpected object filesystem entry")
        name = item.relative_to(folder).as_posix()
        if name not in expected:
            raise ObjectBackupError("Unexpected file in object mirror")
        size = item.stat().st_size
        if size != expected[name]:
            raise ObjectBackupError("Object size changed during export")
        h = hashlib.sha256()
        with item.open("rb") as stream:
            for part in iter(lambda: stream.read(1024 * 1024), b""):
                h.update(part)
        found[name] = (size, h.hexdigest())
    if set(found) != set(expected):
        raise ObjectBackupError("Missing object in materialized snapshot")
    manifest = [[key, found[key][0], found[key][1]] for key in sorted(found)]
    fingerprint = hashlib.sha256(json.dumps(manifest, separators=(",", ":"),
                                            ensure_ascii=False).encode()).hexdigest()
    return fingerprint, sum(v[0] for v in found.values())


def archive_objects(env: dict[str, str], backup_root: Path) -> dict:
    bucket = source_bucket(env)
    repository = backup.repository_from_env(env)
    backup.require_password_file(env)
    for name in ("restic", "rclone", "mc"):
        backup.require_binary(name)
    backup.remote_check(env)
    before = inventory(bucket)
    if backup_root.is_symlink():
        raise ObjectBackupError("Backup root must not be symlinked")
    backup_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    staging = backup_root / "staging"
    if staging.is_symlink():
        raise ObjectBackupError("Backup staging must not be symlinked")
    staging.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="minio-", dir=staging) as tmp:
        work = Path(tmp)
        bucket_dir = work / "bucket"
        bucket_dir.mkdir()
        mirrored = run(["mc", "mirror", "--overwrite", f"{ALIAS}/{bucket}",
                        str(bucket_dir)], timeout=600)
        if mirrored.returncode:
            raise ObjectBackupError("Read-only MinIO bucket mirror failed")
        expected_hash, size = snapshot_manifest(bucket_dir, before)
        # Detect listing-level churn. Consistency is still NOT atomic/transactional.
        if inventory(bucket) != before:
            raise ObjectBackupError("Bucket key/size inventory changed during export")
        written = run(["restic", "-r", repository, "backup", "bucket",
                       "--tag", "jhadina-homebase:minio-current",
                       "--json"], cwd=work, timeout=900, capture=True)
        if written.returncode:
            raise ObjectBackupError("Encrypted Restic object write failed")
        snapshot = backup.snapshot_id_from_json(written.stdout)
        restored = work / "restored"
        restored.mkdir()
        result = run(["restic", "-r", repository, "restore", snapshot,
                      "--target", str(restored)], cwd=work, timeout=900)
        if result.returncode:
            raise ObjectBackupError("Encrypted object restore from Drive failed")
        restored_hash, restored_size = snapshot_manifest(restored / "bucket", before)
        if restored_hash != expected_hash or restored_size != size:
            raise ObjectBackupError("Restored object content differs from source")
        receipt = {
            "schema": "jhadina.google-homebase.object-backup.v1",
            "scope": "ONE_MINIO_BUCKET_CURRENT_OBJECTS",
            "bucket": bucket,
            "snapshot_id": snapshot,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "object_count": len(before),
            "size_bytes": size,
            "sha256_object_manifest": expected_hash,
            "restic_encrypted": True,
            "remote_bytes_restored_verified": True,
            "minio_api_rehydrate_tested": False,
            "version_history_covered": False,
            "atomic_source_snapshot": False,
            "production_data_modified": False,
            "google_drive_remote_deletion_performed": False,
        }
        receipts = backup_root / "receipts"
        if receipts.is_symlink():
            raise ObjectBackupError("Receipts directory must not be symlinked")
        receipts.mkdir(mode=0o700, exist_ok=True)
        path = receipts / f"objects-{snapshot}.json"
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            json.dump(receipt, fp, sort_keys=True, indent=2)
            fp.write("\n")
        return receipt


def main() -> int:
    try:
        os.umask(0o077)
        print(json.dumps(archive_objects(dict(os.environ),
                                         Path(os.environ.get("JHADINA_BACKUP_ROOT",
                                                             "/srv/jhadina-backups"))),
                         sort_keys=True))
        return 0
    except (ObjectBackupError, backup.BackupError, OSError,
            subprocess.TimeoutExpired, ValueError) as exc:
        print("GOOGLE_HOMEBASE_OBJECT_BACKUP_BLOCKED: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
