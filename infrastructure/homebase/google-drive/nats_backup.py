#!/usr/bin/env python3
"""GOOGLE-HOMEBASE JetStream encrypted offsite stream snapshot (fail closed).

A snapshot with durable consumers is NOT a live NATS API recovery receipt.
No Google OAuth on iPhone. Run only on an authorized existing owner-controlled
worker with locally reachable NATS and a scoped Restic/rclone Google Drive remote.
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
from pathlib import Path
from urllib.parse import urlsplit

import backup

STREAM = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,62}\Z")
MAX_FILES = 64
MAX_BYTES = 128 * 1024 * 1024


class StreamBackupError(RuntimeError):
    pass


def stream_source(env: dict[str, str]) -> tuple[str, str]:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise StreamBackupError("Refusing NATS private stream backup on GitHub Actions")
    if env.get("JHADINA_NATS_BACKUP_TRUST_DOMAIN") != "OWNER_CONTROLLED":
        raise StreamBackupError("Owner-controlled NATS host is required")
    if env.get("JHADINA_NATS_BACKUP_APPROVED") != "YES":
        raise StreamBackupError("Explicit owner authorization for the exact stream is required")
    stream = env.get("JHADINA_NATS_BACKUP_STREAM", "")
    if not STREAM.fullmatch(stream):
        raise StreamBackupError("Explicit safe NATS stream name required")
    server = env.get("JHADINA_NATS_BACKUP_SERVER", "")
    try:
        parsed = urlsplit(server)
        port = parsed.port
    except ValueError:
        raise StreamBackupError("Invalid NATS URL") from None
    if (parsed.scheme != "nats" or parsed.hostname != "127.0.0.1" or port != 4222
            or parsed.username or parsed.password or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise StreamBackupError("NATS source must be exactly local 127.0.0.1:4222")
    return stream, server


def execute(args: list[str], cwd: Path, *, timeout: int = 180,
            capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd,
                          stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, timeout=timeout, check=False)


def archive_manifest(directory: Path) -> tuple[str, int, int]:
    if not directory.is_dir() or directory.is_symlink():
        raise StreamBackupError("A private snapshot directory is required")
    entries = []
    total = 0
    for path in directory.rglob("*"):
        if path.is_symlink():
            raise StreamBackupError("Symlink in NATS stream snapshot")
        if path.is_dir():
            continue
        if not path.is_file():
            raise StreamBackupError("Unexpected NATS snapshot entry")
        rel = path.relative_to(directory).as_posix()
        size = path.stat().st_size
        total += size
        if len(entries) >= MAX_FILES or total > MAX_BYTES:
            raise StreamBackupError("NATS stream snapshot exceeds conservative bounds")
        h = hashlib.sha256()
        with path.open("rb") as fp:
            for chunk in iter(lambda: fp.read(1024 * 1024), b""):
                h.update(chunk)
        entries.append((rel, size, h.hexdigest()))
    names = {entry[0] for entry in entries}
    if ("backup.json" not in names or
            not ({"stream.arc.s2", "stream.tar.s2"} & names)):
        raise StreamBackupError("NATS stream snapshot metadata or message archive missing")
    # Require NATS 2.15 archive format until older-server restore proof exists.
    if "stream.arc.s2" not in names:
        raise StreamBackupError("Older stream.tar.s2 requires separate compatibility proof")
    if total < 16:
        raise StreamBackupError("NATS snapshot appears empty")
    metadata_file = directory / "backup.json"
    try:
        data = json.loads(metadata_file.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not data:
            raise ValueError("empty NATS backup metadata")
    except (UnicodeError, ValueError, OSError):
        raise StreamBackupError("Malformed NATS stream backup metadata") from None
    canonical = json.dumps(sorted(entries), separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest(), total, len(entries)


def archive_stream(env: dict[str, str], backup_root: Path) -> dict:
    stream, server = stream_source(env)
    repository = backup.repository_from_env(env)
    backup.require_password_file(env)
    for binary in ("nats", "restic", "rclone"):
        backup.require_binary(binary)
    backup.remote_check(env)
    if backup_root.is_symlink():
        raise StreamBackupError("Backup root cannot be symlinked")
    backup_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    staging = backup_root / "staging"
    if staging.is_symlink():
        raise StreamBackupError("Backup staging cannot be symlinked")
    staging.mkdir(parents=True, exist_ok=True, mode=0o700)

    with tempfile.TemporaryDirectory(prefix="nats-", dir=staging) as tmp:
        work = Path(tmp)
        snapshot_dir = work / "nats-stream-backup"
        result = execute(["nats", "--server", server, "backup", "stream",
                          stream, str(snapshot_dir), "--consumers"], work, timeout=600)
        if result.returncode:
            raise StreamBackupError("NATS point-in-time stream snapshot failed")
        original_digest, size, count = archive_manifest(snapshot_dir)
        check = execute(["nats", "backup", "validate", str(snapshot_dir)], work, timeout=120)
        if check.returncode:
            raise StreamBackupError("NATS 2.15 snapshot validation failed")
        written = execute(["restic", "-r", repository, "backup", "nats-stream-backup",
                           "--tag", "jhadina-homebase:jetstream",
                           "--json"], work, timeout=900, capture=True)
        if written.returncode:
            raise StreamBackupError("Restic encrypted JetStream upload failed")
        snapshot = backup.snapshot_id_from_json(written.stdout)
        downloaded = work / "downloaded"
        downloaded.mkdir()
        retrieved = execute(["restic", "-r", repository, "restore", snapshot,
                             "--target", str(downloaded)], work, timeout=900)
        if retrieved.returncode:
            raise StreamBackupError("Restic encrypted JetStream download failed")
        restored = downloaded / "nats-stream-backup"
        restored_digest, restored_size, restored_count = archive_manifest(restored)
        if (original_digest != restored_digest or size != restored_size
                or count != restored_count):
            raise StreamBackupError("Recovered JetStream archive byte manifest mismatch")
        if execute(["nats", "backup", "validate", str(restored)], work, timeout=120).returncode:
            raise StreamBackupError("Recovered JetStream archive failed offline validation")
        receipt = {
            "schema": "jhadina.google-homebase.jetstream-backup.v1",
            "scope": "ONE_NATS_STREAM_WITH_CONSUMER_SNAPSHOT",
            "stream": stream,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_id": snapshot,
            "sha256_archive_manifest": original_digest,
            "size_bytes": size,
            "file_count": count,
            "encrypted_with_restic": True,
            "remote_bytes_restored_verified": True,
            "nats_archive_offline_validated": True,
            "nats_api_restore_tested": False,
            "consumer_positions_rehydrated_tested": False,
            "all_streams_covered": False,
            "production_queue_modified": False,
            "canonical_authority_changed": False,
        }
        receipts = backup_root / "receipts"
        if receipts.is_symlink():
            raise StreamBackupError("Receipts directory cannot be symlinked")
        receipts.mkdir(mode=0o700, exist_ok=True)
        output = receipts / f"nats-{snapshot}.json"
        fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            json.dump(receipt, fp, sort_keys=True, indent=2)
            fp.write("\n")
        return receipt


def main() -> int:
    try:
        os.umask(0o077)
        out = archive_stream(dict(os.environ),
                             Path(os.environ.get("JHADINA_BACKUP_ROOT", "/srv/jhadina-backups")))
        print(json.dumps(out, sort_keys=True))
        return 0
    except (StreamBackupError, backup.BackupError, OSError,
            subprocess.TimeoutExpired, ValueError) as err:
        print("GOOGLE_HOMEBASE_NATS_BACKUP_BLOCKED: " + str(err), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
