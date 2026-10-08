#!/usr/bin/env python3
"""Encrypted Homebase PostgreSQL offsite snapshots via restic + rclone.

No Google API token is stored here. Configure an rclone remote scoped to the
Drive 01-BACKUPS folder. This utility never changes live database authority.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timezone


class BackupError(RuntimeError):
    pass


def repository_from_env(env: dict[str, str]) -> str:
    remote = env.get("GOOGLE_HOMEBASE_RCLONE_REMOTE", "").strip()
    prefix = env.get("GOOGLE_HOMEBASE_RESTIC_PATH", "homebase-postgres-restic-v1").strip()
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", remote):
        raise BackupError("GOOGLE_HOMEBASE_RCLONE_REMOTE must be a configured rclone remote name")
    if (not prefix or prefix.startswith("/") or "\\" in prefix or ":" in prefix
            or any(segment in {"", ".", ".."} for segment in prefix.split("/"))):
        raise BackupError("GOOGLE_HOMEBASE_RESTIC_PATH must be a safe relative path")
    return f"rclone:{remote}:{prefix}"


def require_password_file(env: dict[str, str]) -> Path:
    raw = env.get("RESTIC_PASSWORD_FILE", "")
    if not raw:
        raise BackupError("RESTIC_PASSWORD_FILE is required (never store the password in Git)")
    p = Path(raw).expanduser()
    if not p.is_absolute() or p.is_symlink() or not p.is_file():
        raise BackupError("RESTIC_PASSWORD_FILE must be an existing absolute regular file")
    mode = p.stat().st_mode
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise BackupError("RESTIC_PASSWORD_FILE must not have group/other permissions (chmod 600)")
    if p.stat().st_size == 0:
        raise BackupError("RESTIC_PASSWORD_FILE must not be empty")
    return p


def require_binary(name: str) -> None:
    if shutil.which(name) is None:
        raise BackupError(f"Required executable unavailable: {name}")


def run_quiet(argv: list[str], *, input_file=None, timeout=120) -> subprocess.CompletedProcess:
    # No shell interpolation and never display credential-bearing subprocess logs.
    # Long-running uploads must opt into the higher deadline explicitly.
    return subprocess.run(argv, stdin=input_file, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, check=False, timeout=timeout)


def remote_check(env: dict[str, str]) -> None:
    remote = env["GOOGLE_HOMEBASE_RCLONE_REMOTE"].strip()
    expected = env.get("GOOGLE_HOMEBASE_BACKUP_FOLDER_ID", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{10,128}", expected):
        raise BackupError("GOOGLE_HOMEBASE_BACKUP_FOLDER_ID must be the dedicated backup folder ID")
    # Config dump is held only in memory; it may contain OAuth tokens and MUST
    # never be logged, printed, stored in a receipt, or sent to GitHub.
    config = run_quiet(["rclone", "config", "dump"])
    if config.returncode:
        raise BackupError("Could not inspect the local rclone remote configuration")
    try:
        configured = json.loads(config.stdout).get(remote, {})
    except (ValueError, TypeError):
        raise BackupError("Malformed local rclone configuration") from None
    if not isinstance(configured, dict) or configured.get("type") != "drive" or configured.get("root_folder_id") != expected:
        raise BackupError("Google remote is not scoped to the approved private backup folder")
    if run_quiet(["rclone", "lsd", f"{remote}:"]).returncode != 0:
        raise BackupError("Google Drive rclone remote unavailable; authorize it on the worker")


def verify_restored_bytes(repository: str, snapshot: str, expected_sha256: str) -> bool:
    if not re.fullmatch(r"[0-9a-f]{8,64}", snapshot):
        raise BackupError("A concrete restic snapshot ID is required")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise BackupError("Expected SHA-256 must be exactly 64 lowercase hex characters")
    # Use an unlinked 0600 temporary file rather than unbounded memory. A hard
    # deadline prevents a failed remote from hanging the trusted worker.
    with tempfile.TemporaryFile(mode="w+b") as restored:
        result = subprocess.run(
            ["restic", "-r", repository, "dump", snapshot, "/jhadina-postgres.dump"],
            stdout=restored, stderr=subprocess.DEVNULL,
            check=False, timeout=600,
        )
        if result.returncode:
            raise BackupError("Encrypted snapshot could not be downloaded/restored")
        restored.seek(0)
        digest = hashlib.sha256()
        count = 0
        for chunk in iter(lambda: restored.read(1024 * 1024), b""):
            digest.update(chunk)
            count += len(chunk)
    if count == 0:
        raise BackupError("Encrypted snapshot was empty")
    return digest.hexdigest() == expected_sha256


def snapshot_id_from_json(data: bytes) -> str:
    for line in reversed(data.decode("utf-8", errors="replace").splitlines()):
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("message_type") == "summary":
            snapshot = payload.get("snapshot_id", "")
            if re.fullmatch(r"[0-9a-f]{8,64}", snapshot):
                return snapshot
    raise BackupError("Backup returned no verifiable snapshot ID; do not mark commissioned")


def archive_postgres(repository: str, env: dict[str, str], compose_file: Path,
                     local_env_file: Path, backup_root: Path) -> dict:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise BackupError("Private database backup is forbidden on hosted GitHub Actions")
    for path in (compose_file, local_env_file):
        if not path.is_file():
            raise BackupError(f"Required local file missing: {path}")
    require_binary("docker")
    if backup_root.is_symlink():
        raise BackupError("Refusing symlinked backup root")
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    staging = backup_root / "staging"
    if staging.is_symlink():
        raise BackupError("Refusing symlinked backup staging directory")
    staging.mkdir(mode=0o700, exist_ok=True)

    # pg_dump -Fc produces a consistent logical database snapshot; do NOT tar live PG files.
    with tempfile.TemporaryDirectory(prefix="pgdump-", dir=staging) as tmpdir:
        dump = Path(tmpdir) / "jhadina-postgres.dump"
        with dump.open("xb") as out:
            os.chmod(dump, 0o600)
            result = subprocess.run(
                ["docker", "compose", "--env-file", str(local_env_file),
                 "-f", str(compose_file), "exec", "-T", "postgres", "sh", "-c",
                 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
                stdout=out, stderr=subprocess.DEVNULL, check=False, timeout=900,
            )
        if result.returncode != 0 or dump.stat().st_size < 16:
            raise BackupError("PostgreSQL logical dump failed; no backup was published")
        with dump.open("rb") as stream:
            magic = stream.read(5)
        if magic != b"PGDMP":
            raise BackupError("PostgreSQL custom-format dump header invalid")
        digest = hashlib.sha256()
        with dump.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        expected = digest.hexdigest()
        with dump.open("rb") as stream:
            backup = run_quiet(
                ["restic", "-r", repository, "backup", "--stdin",
                 "--stdin-filename", "jhadina-postgres.dump", "--tag",
                 "jhadina-homebase:postgres", "--json"], input_file=stream, timeout=900,
            )
        if backup.returncode != 0:
            raise BackupError("Encrypted Drive backup failed; no success receipt issued")
        snapshot = snapshot_id_from_json(backup.stdout)
        if not verify_restored_bytes(repository, snapshot, expected):
            raise BackupError("Restored dump hash mismatch; no success receipt issued")
        receipt = {
            "schema": "jhadina.google-homebase.db-backup.v1",
            "backup_kind": "postgres_custom_logical_dump",
            "scope": "POSTGRES_ONLY",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_id": snapshot,
            "sha256": expected,
            "size_bytes": dump.stat().st_size,
            "restic_encrypted": True,
            "remote_byte_restore_verified": True,
            "postgres_database_restore_tested": False,
            "canonical_authority_changed": False,
        }
        receipts = backup_root / "receipts"
        if receipts.is_symlink():
            raise BackupError("Refusing symlinked receipts directory")
        receipts.mkdir(mode=0o700, exist_ok=True)
        output = receipts / f"{snapshot}.json"
        # Never overwrite a prior receipt; snapshots are immutable evidence.
        fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(receipt, handle, sort_keys=True, indent=2)
            handle.write("\n")
        return receipt


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["doctor", "init", "backup-db", "verify"])
    parser.add_argument("--snapshot", help="Exact restic snapshot ID for verify")
    parser.add_argument("--sha256", help="Expected dump SHA-256 for verify")
    parser.add_argument("--compose-file", default="infrastructure/homebase/docker-compose.yml")
    parser.add_argument("--env-file", default="infrastructure/homebase/.env")
    parser.add_argument("--backup-root", default=os.environ.get("JHADINA_BACKUP_ROOT", "/srv/jhadina-backups"))
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        env = dict(os.environ)
        if env.get("GITHUB_ACTIONS", "").lower() == "true":
            raise BackupError("Restic credentials and private database backups are forbidden on GitHub Actions")
        repository = repository_from_env(env)
        require_password_file(env)
        require_binary("restic")
        require_binary("rclone")
        if args.command in {"doctor", "init", "backup-db"}:
            remote_check(env)
        if args.command == "doctor":
            print(json.dumps({"status": "READY_TO_TEST", "remote_reachable": True,
                              "repository_configured": False,  # not validated by a remote reachability check
                              "database_restore_tested": False}))
        elif args.command == "init":
            if run_quiet(["restic", "-r", repository, "init"]).returncode != 0:
                raise BackupError("Restic init failed (repository may already exist)")
            print(json.dumps({"status": "REPOSITORY_INITIALIZED"}))
        elif args.command == "backup-db":
            receipt = archive_postgres(repository, env, Path(args.compose_file).resolve(),
                                       Path(args.env_file).resolve(), Path(args.backup_root).resolve())
            print(json.dumps(receipt, sort_keys=True))
        else:
            if not args.snapshot or not args.sha256:
                raise BackupError("verify requires --snapshot and --sha256")
            if not verify_restored_bytes(repository, args.snapshot, args.sha256):
                raise BackupError("Restored dump hash does not match expected SHA-256")
            print(json.dumps({"status": "RESTORED_BYTES_VERIFIED", "snapshot_id": args.snapshot,
                              "database_restore_tested": False}))
        return 0
    except (BackupError, OSError, subprocess.TimeoutExpired) as error:
        print(f"GOOGLE_HOMEBASE_BLOCKED: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
