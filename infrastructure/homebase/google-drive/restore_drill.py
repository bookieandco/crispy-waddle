#!/usr/bin/env python3
"""GOOGLE-HOMEBASE.7: isolated PostgreSQL restore drill, never production.

The source database is never connected to. Run only on an OWNER-CONTROLLED,
trusted worker. No public hosted GitHub Actions runner may ingest private dumps.
"""

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import backup

IMAGE = "postgres:17-alpine"
HEX64 = re.compile(r"^[a-f0-9]{64}$")
SNAPSHOT = re.compile(r"^[a-f0-9]{8,64}$")


class RestoreError(RuntimeError):
    pass


def validate_receipt(receipt: dict) -> tuple[str, str]:
    if (not isinstance(receipt, dict)
            or receipt.get("schema") != "jhadina.google-homebase.db-backup.v1"
            or receipt.get("scope") != "POSTGRES_ONLY"
            or receipt.get("source_kind") != "LOCAL_HOMEBASE_COMPOSE"
            or receipt.get("hosted_supabase_data_covered") is not False
            or receipt.get("remote_byte_restore_verified") is not True
            or receipt.get("restic_encrypted") is not True):
        raise RestoreError("This is not a verified encrypted PostgreSQL backup receipt")
    snapshot = receipt.get("snapshot_id")
    sha = receipt.get("sha256")
    if not isinstance(snapshot, str) or not SNAPSHOT.fullmatch(snapshot):
        raise RestoreError("Invalid immutable snapshot ID")
    if not isinstance(sha, str) or not HEX64.fullmatch(sha):
        raise RestoreError("Invalid expected SHA256")
    return snapshot, sha


def safe_run(args: list[str], *, stdout=None, timeout=300) -> subprocess.CompletedProcess:
    return subprocess.run(args, stdout=stdout if stdout is not None else subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, check=False, timeout=timeout)


def trusted_host(env: dict[str, str]) -> None:
    if env.get("GITHUB_ACTIONS", "").lower() == "true":
        raise RestoreError("Private database restore is forbidden on hosted GitHub Actions")
    if env.get("JHADINA_RESTORE_TRUST_DOMAIN") != "OWNER_CONTROLLED":
        raise RestoreError("OWNER_CONTROLLED trust domain must be explicitly declared")
    if env.get("JHADINA_RESTORE_APPROVED") != "YES":
        raise RestoreError("An explicit local restore authorization is required")


def verify_download(repository: str, snapshot: str, expected: str, output: Path) -> None:
    h = hashlib.sha256()
    with output.open("xb") as stream:
        os.chmod(output, 0o600)
        result = safe_run(["restic", "-r", repository, "dump", snapshot,
                           "/jhadina-postgres.dump"], stdout=stream, timeout=600)
    if result.returncode or output.stat().st_size < 16:
        raise RestoreError("Restic download failed or snapshot is empty")
    with output.open("rb") as stream:
        if stream.read(5) != b"PGDMP":
            raise RestoreError("Downloaded artifact is not pg_dump custom format")
        stream.seek(0)
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    if h.hexdigest() != expected:
        raise RestoreError("Restored snapshot SHA256 mismatch; no docker import allowed")


def restore_into_disposable_postgres(dump: Path, *, required_tables: frozenset[str] | None = None) -> int:
    if shutil.which("docker") is None:
        raise RestoreError("Docker is not installed on the authorized owner-controlled worker")
    if safe_run(["docker", "image", "inspect", IMAGE], timeout=30).returncode:
        raise RestoreError("PostgreSQL 17-alpine image must already exist locally; no implicit pull")
    name = "jhadina-drill-" + secrets.token_hex(6)
    started = False
    try:
        # Ephemeral, network-isolated, no exposed ports. Its database is NEVER
        # the canonical / production database and cannot reach the network.
        rc = safe_run(["docker", "run", "--detach", "--rm",
                       "--pull=never", "--network=none", "--cap-drop=NET_RAW",
                       "--security-opt=no-new-privileges", "--pids-limit=256",
                       "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE],
                      timeout=60)
        if rc.returncode:
            raise RestoreError("Disposable offline PostgreSQL container failed to start")
        started = True
        for attempt in range(30):
            if safe_run(["docker", "exec", name, "pg_isready", "-U", "postgres"], timeout=10).returncode == 0:
                break
            time.sleep(1)
        else:
            raise RestoreError("Isolated PostgreSQL never became ready")
        if safe_run(["docker", "cp", str(dump), name + ":/tmp/canary.dump"], timeout=120).returncode:
            raise RestoreError("Could not copy snapshot to disposable container")
        if safe_run(["docker", "exec", name, "createdb", "-U", "postgres", "jhadina_canary"], timeout=30).returncode:
            raise RestoreError("Disposable empty canary database could not be created")
        restore_cmd = ["docker", "exec", name, "pg_restore", "--no-owner", "--no-acl",
                       "--exit-on-error", "-U", "postgres", "-d", "jhadina_canary", "/tmp/canary.dump"]
        if safe_run(restore_cmd, timeout=900).returncode:
            raise RestoreError("pg_restore failed on the disposable PostgreSQL instance")
        query = ["docker", "exec", name, "psql", "-U", "postgres", "-d", "jhadina_canary", "-At", "-c",
                 "SELECT count(*) FROM pg_catalog.pg_class WHERE relkind IN ('r','p') AND relnamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname LIKE 'pg_%' OR nspname='information_schema')"]
        check = subprocess.run(query, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30)
        if check.returncode:
            raise RestoreError("Disposable database verification query failed")
        try:
            count = int(check.stdout.decode().strip())
        except ValueError:
            raise RestoreError("Unexpected PostgreSQL verification result") from None
        if count < 1:
            raise RestoreError("Restored database contains no application tables")
        if required_tables is not None:
            if not required_tables or any(
                    not re.fullmatch(r"[a-z_][a-z_0-9]{0,62}", table)
                    for table in required_tables):
                raise RestoreError("Invalid required-table certification set")
            # Read schema names from the disposable network-isolated restore,
            # not the original production database or pg_restore TOC text.
            schema_probe = subprocess.run(
                ["docker", "exec", name, "psql", "-U", "postgres",
                 "-d", "jhadina_canary", "-At", "-v", "ON_ERROR_STOP=1", "-c",
                 "SELECT tablename FROM pg_catalog.pg_tables "
                 "WHERE schemaname='public' ORDER BY tablename"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=30,
                check=False,
            )
            if schema_probe.returncode:
                raise RestoreError("Isolated restored schema probe failed")
            actual = set(schema_probe.stdout.decode("utf-8").splitlines())
            if not required_tables.issubset(actual):
                raise RestoreError("Required Shadow ledger tables absent after restore")
        return count
    finally:
        if started:
            safe_run(["docker", "rm", "--force", name], timeout=30)


def drill(receipt_path: Path, env: dict[str, str]) -> dict:
    trusted_host(env)
    if receipt_path.is_symlink() or not receipt_path.is_file():
        raise RestoreError("Explicit local backup receipt file required")
    if receipt_path.stat().st_mode & 0o077:
        raise RestoreError("Backup receipt must be owner-only (chmod 600)")
    snapshot, expected = validate_receipt(json.loads(receipt_path.read_text(encoding="utf-8")))
    repository = backup.repository_from_env(env)
    backup.require_password_file(env)
    backup.require_binary("restic")
    backup.require_binary("rclone")
    backup.remote_check(env)
    with tempfile.TemporaryDirectory(prefix="jh-restore-", dir=env.get("JHADINA_RESTORE_STAGING_ROOT") or None) as tmp:
        root = Path(tmp)
        os.chmod(root, 0o700)
        dump = root / "jhadina-postgres.dump"
        verify_download(repository, snapshot, expected, dump)
        count = restore_into_disposable_postgres(dump)
    return {
        "schema": "jhadina.google-homebase.db-restore-drill.v1",
        "source_snapshot_id": snapshot,
        "source_kind": "LOCAL_HOMEBASE_COMPOSE",
        "hosted_supabase_data_covered": False,
        "source_sha256": expected,
        "isolated_network": True,
        "production_database_modified": False,
        "restored_application_table_count": count,
        "postgres_database_restore_tested": True,
        "other_subsystems_restored": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        os.umask(0o077)
        print(json.dumps(drill(args.receipt, dict(os.environ)), sort_keys=True))
        return 0
    except (RestoreError, backup.BackupError, OSError, subprocess.TimeoutExpired, ValueError) as exc:
        print("GOOGLE_HOMEBASE_RESTORE_BLOCKED: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
