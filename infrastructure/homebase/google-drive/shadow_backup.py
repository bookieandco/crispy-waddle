#!/usr/bin/env python3
"""Encrypted, read-only Shadow PostgreSQL offsite archive to a private Drive folder.

The iPhone and ChatGPT Drive connector are NOT the database host's OAuth.
Run only on the previously approved Shadow PostgreSQL host with a local Unix
socket. Never run the private dump on GitHub Actions or export via DVC.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import backup
import restore_drill

DUMP_NAME = "shadow-postgres.dump"
RESTIC_PATH = "shadow-postgres-restic-v1"
SNAPSHOT_RE = re.compile(r"[0-9a-f]{8,64}\Z")
DIGEST_RE = re.compile(r"[0-9a-f]{64}\Z")
NAME_RE = re.compile(r"[a-z_][a-z_0-9]{0,62}\Z")
PORT_RE = re.compile(r"[0-9]{2,5}\Z")
REQUIRED_TABLES = frozenset({
    "runpod_shadow_market_samples",
    "runpod_shark_shadow_decisions",
    "runpod_shark_shadow_executions",
    "runpod_shark_shadow_observations",
    "runpod_shark_shadow_lessons",
    "runpod_shark_shadow_calibrations",
    "runpod_shark_shadow_memory",
    "runpod_shark_shadow_sync_queue",
    "runpod_shark_shadow_runtime_state",
})


class ShadowBackupError(RuntimeError):
    pass


def source_settings(env: dict[str, str]) -> dict[str, str]:
    """Require an existing owner-approved LOCAL Shadow socket, not a URL."""
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise ShadowBackupError("Private Shadow backup forbidden on hosted GitHub Actions")
    if (env.get("JHADINA_HOMEBASE_TRUST_DOMAIN") != "OWNER_CONTROLLED"
            or env.get("SHADOW_DRIVE_BACKUP_APPROVED") != "YES"):
        raise ShadowBackupError("Owner-controlled host and explicit backup approval required")
    root = Path(env.get("SHARK_SHADOW_DATA_DIR", "/workspace/jhadina/shark-shadow"))
    if not root.is_absolute() or root.is_symlink() or not root.is_dir():
        raise ShadowBackupError("Shadow state directory must be an existing absolute non-symlink")
    socket_dir = root / "socket"
    if socket_dir.is_symlink() or not socket_dir.is_dir():
        raise ShadowBackupError("Local Shadow socket directory unavailable")
    raw_port = env.get("SHARK_SHADOW_POSTGRES_PORT", "55432")
    if not PORT_RE.fullmatch(raw_port) or not (1024 <= int(raw_port) <= 65535):
        raise ShadowBackupError("Invalid local Shadow PostgreSQL port")
    socket_file = socket_dir / (".s.PGSQL." + raw_port)
    if not socket_file.exists() or not stat.S_ISSOCK(socket_file.stat().st_mode):
        raise ShadowBackupError("No running Shadow PostgreSQL Unix socket")
    user = env.get("SHARK_SHADOW_POSTGRES_USER", "jhadina_shadow_pg")
    database = env.get("SHARK_SHADOW_POSTGRES_DB", "jhadina_shadow")
    if not NAME_RE.fullmatch(user) or not NAME_RE.fullmatch(database):
        raise ShadowBackupError("Invalid Shadow PostgreSQL local identity")
    if env.get("SHARK_SHADOW_DATABASE_URL", "").strip():
        # The server can use its connection URL, but exports must NOT infer
        # a backup destination/source from arbitrary URL credentials.
        pass
    return {"socket": str(socket_dir), "port": raw_port, "user": user, "database": database}


def scoped_repository(env: dict[str, str]) -> str:
    """Use the existing Homebase provider proof with a separate Shadow path."""
    scoped = {**env, "GOOGLE_HOMEBASE_RESTIC_PATH": RESTIC_PATH}
    backup.require_binary("restic")
    backup.require_binary("rclone")
    backup.require_password_file(scoped)
    backup.remote_check(scoped)
    return backup.repository_from_env(scoped)


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def restic_download(repository: str, snapshot: str, target: Path, expected: str) -> None:
    if not SNAPSHOT_RE.fullmatch(snapshot) or not DIGEST_RE.fullmatch(expected):
        raise ShadowBackupError("Verified exact snapshot and checksum required")
    with target.open("xb") as output:
        os.chmod(target, 0o600)
        result = subprocess.run(
            ["restic", "-r", repository, "dump", snapshot, "/" + DUMP_NAME],
            stdout=output, stderr=subprocess.DEVNULL, check=False, timeout=900,
        )
    if result.returncode or target.stat().st_size < 16:
        raise ShadowBackupError("Encrypted Shadow download failed")
    with target.open("rb") as stream:
        if stream.read(5) != b"PGDMP":
            raise ShadowBackupError("Restored Shadow dump header invalid")
    if digest_file(target) != expected:
        raise ShadowBackupError("Restored Shadow bytes failed SHA-256 verification")


def private_directory(path: Path) -> Path:
    if path.is_symlink():
        raise ShadowBackupError("Symlinked backup root forbidden")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def archive(repository: str, source: dict[str, str], root: Path) -> dict:
    backup.require_binary("pg_dump")
    backup.require_binary("psql")
    # Check the exact Shadow schema through the approved LOCAL Unix socket
    # before generating or uploading any sensitive database bytes.
    safe_env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                "HOME": os.environ.get("HOME", "/tmp"),
                "PGCONNECT_TIMEOUT": "10"}
    inspected = subprocess.run(
        ["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1",
         "-h", source["socket"], "-p", source["port"],
         "-U", source["user"], "-d", source["database"], "-c",
         "SELECT tablename FROM pg_catalog.pg_tables "
         "WHERE schemaname='public' ORDER BY tablename"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False,
        timeout=30, env=safe_env,
    )
    if inspected.returncode:
        raise ShadowBackupError("Local Shadow schema identity probe failed; no upload")
    present = set(inspected.stdout.decode("utf-8").splitlines())
    if not REQUIRED_TABLES.issubset(present):
        raise ShadowBackupError("Required Shadow ledger tables absent; no upload")
    private_directory(root)
    staging = private_directory(root / "staging")
    with tempfile.TemporaryDirectory(prefix="shadow-dump-", dir=staging) as temporary:
        dump = Path(temporary) / DUMP_NAME
        # Explicit local Unix socket: never accept remote PGHOST/PGSERVICE or
        # an arbitrary connection string. The canonical bootstrap uses local trust.
        with dump.open("xb") as output:
            os.chmod(dump, 0o600)
            result = subprocess.run(
                ["pg_dump", "-Fc", "--no-owner", "--no-acl",
                 "-h", source["socket"], "-p", source["port"],
                 "-U", source["user"], "-d", source["database"]],
                stdout=output, stderr=subprocess.DEVNULL, check=False,
                timeout=900, env=safe_env,
            )
        if result.returncode or dump.stat().st_size < 16:
            raise ShadowBackupError("Local Shadow logical dump failed; no upload")
        with dump.open("rb") as stream:
            if stream.read(5) != b"PGDMP":
                raise ShadowBackupError("Shadow dump header invalid; no upload")
        digest = digest_file(dump)
        with dump.open("rb") as stream:
            uploaded = backup.run_quiet(
                ["restic", "-r", repository, "backup", "--stdin",
                 "--stdin-filename", DUMP_NAME,
                 "--tag", "jhadina-shadow:postgres", "--json"],
                input_file=stream, timeout=1200,
            )
        if uploaded.returncode:
            raise ShadowBackupError("Encrypted Shadow upload failed")
        snapshot = backup.snapshot_id_from_json(uploaded.stdout)
        verified = Path(temporary) / "restored-shadow.dump"
        restic_download(repository, snapshot, verified, digest)
        receipt = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "source_kind": "LOCAL_SHADOW_UNIX_SOCKET",
            "scope": "SHADOW_POSTGRES_ONLY",
            "restic_path": RESTIC_PATH,
            "snapshot_id": snapshot,
            "sha256": digest,
            "size_bytes": dump.stat().st_size,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "encrypted_at_rest": True,
            "remote_bytes_restored_verified": True,
            "isolated_database_restore_verified": False,
            "active_database_modified": False,
            "swlc_synced": False,
            "live_trading_authorized": False,
        }
        receipts = private_directory(root / "receipts")
        output = receipts / ("shadow-" + snapshot + ".json")
        with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600),
                       "w", encoding="utf-8") as fp:
            json.dump(receipt, fp, sort_keys=True, indent=2)
            fp.write("\n")
    return receipt


def validated_receipt(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_mode & 0o077:
        raise ShadowBackupError("Owner-only regular receipt required")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if (payload.get("schema") != "jhadina.shadow.google-drive-backup.v1"
            or payload.get("source_kind") != "LOCAL_SHADOW_UNIX_SOCKET"
            or payload.get("scope") != "SHADOW_POSTGRES_ONLY"
            or payload.get("restic_path") != RESTIC_PATH
            or payload.get("encrypted_at_rest") is not True
            or payload.get("remote_bytes_restored_verified") is not True
            or payload.get("live_trading_authorized") is not False
            or not SNAPSHOT_RE.fullmatch(str(payload.get("snapshot_id", "")))
            or not DIGEST_RE.fullmatch(str(payload.get("sha256", "")))):
        raise ShadowBackupError("Invalid Shadow encrypted backup receipt")
    return payload


def recovery_drill(repository: str, receipt: dict, env: dict[str, str]) -> dict:
    restore_drill.trusted_host(env)
    with tempfile.TemporaryDirectory(prefix="shadow-rehydrate-") as td:
        root = Path(td)
        os.chmod(root, 0o700)
        dump = root / DUMP_NAME
        restic_download(repository, receipt["snapshot_id"], dump, receipt["sha256"])
        restored_tables = restore_drill.restore_into_disposable_postgres(
            dump, required_tables=REQUIRED_TABLES)
    return {
        "schema": "jhadina.shadow.google-drive-restore.v1",
        "snapshot_id": receipt["snapshot_id"],
        "sha256": receipt["sha256"],
        "required_shadow_tables_verified": True,
        "restored_table_count": restored_tables,
        "network_isolated": True,
        "active_database_modified": False,
        "live_trading_authorized": False,
        "all_learning_horizons_semantically_verified": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["doctor", "backup-db", "verify", "restore-drill"])
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--backup-root", type=Path,
                        default=Path(os.environ.get("JHADINA_BACKUP_ROOT", "/srv/jhadina-backups")) / "shadow")
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        env = dict(os.environ)
        if env.get("GITHUB_ACTIONS", "").lower() == "true":
            raise ShadowBackupError("Private Shadow backup and restore forbidden on hosted CI")
        if (env.get("JHADINA_HOMEBASE_TRUST_DOMAIN") != "OWNER_CONTROLLED"
                or env.get("SHADOW_DRIVE_BACKUP_APPROVED") != "YES"):
            raise ShadowBackupError("Explicit owner-controlled backup authorization required")
        source = source_settings(env) if args.command in ("doctor", "backup-db") else None
        repository = scoped_repository(env)
        if args.command == "doctor":
            backup.require_binary("pg_dump")
            result = {"schema": "jhadina.shadow.google-drive-doctor.v1",
                      "owner_controlled_local_socket_verified": True,
                      "machine_drive_oauth_and_encryption_remote_verified": True,
                      "actual_backup_taken": False,
                      "isolated_restore_verified": False}
        elif args.command == "backup-db":
            result = archive(repository, source, args.backup_root)
        else:
            if not args.receipt:
                raise ShadowBackupError("Exact private receipt required")
            receipt = validated_receipt(args.receipt)
            if args.command == "verify":
                with tempfile.TemporaryDirectory(prefix="shadow-byte-verify-") as td:
                    restic_download(repository, receipt["snapshot_id"],
                                    Path(td) / DUMP_NAME, receipt["sha256"])
                result = {"schema": "jhadina.shadow.google-drive-verification.v1",
                          "snapshot_id": receipt["snapshot_id"],
                          "remote_bytes_restored_verified": True,
                          "isolated_restore_verified": False}
            else:
                result = recovery_drill(repository, receipt, env)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ShadowBackupError, backup.BackupError, restore_drill.RestoreError,
            OSError, ValueError, subprocess.TimeoutExpired, json.JSONDecodeError):
        print("SHADOW_DRIVE_BACKUP_BLOCKED: check private local preflight/receipt",
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
