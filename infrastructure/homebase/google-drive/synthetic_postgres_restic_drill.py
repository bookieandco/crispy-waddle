#!/usr/bin/env python3
"""LIVE.3 — real, synthetic-only PostgreSQL + local encrypted Restic recovery.

Runs using a fresh, network-isolated disposable PostgreSQL instance and local
temporary Restic repository. No Google Drive, Supabase, user database, external
database, permanent recovery key, private credentials, or billable GPU.
Designed for a tightly scoped GitHub Actions integration test, not production.
"""
from __future__ import annotations

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
import restore_drill

IMAGE = "postgres:17-alpine"


class SyntheticRestoreError(RuntimeError):
    pass


def check_admission(env: dict[str, str]) -> None:
    if env.get("JHADINA_SYNTHETIC_PG_APPROVED") != "SYNTHETIC-ONLY":
        raise SyntheticRestoreError("Explicit synthetic-only test approval required")
    if env.get("DOCKER_HOST", "") not in ("", "unix:///var/run/docker.sock"):
        raise SyntheticRestoreError("Remote Docker endpoints are forbidden")
    if env.get("DOCKER_CONTEXT", "") not in ("", "default"):
        raise SyntheticRestoreError("Only local default Docker context is allowed")
    for key in ("RESTIC_REPOSITORY", "GOOGLE_HOMEBASE_RCLONE_REMOTE",
                "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PGHOST", "PGSERVICE"):
        if env.get(key):
            raise SyntheticRestoreError("Inherited provider configuration forbidden")


def call(args: list[str], *, timeout: int = 90, stdout=None,
         input_bytes: bytes | None = None, env=None) -> subprocess.CompletedProcess:
    return subprocess.run(
        args,
        stdout=stdout if stdout is not None else subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        input=input_bytes,
        check=False, timeout=timeout, env=env,
    )


def prepare_source(dump: Path, marker: str, *, sleep=time.sleep) -> None:
    if not re.fullmatch(r"[0-9a-f]{32}", marker):
        raise SyntheticRestoreError("Bad synthetic canary marker")
    name = "jhadina-synthetic-source-" + secrets.token_hex(6)
    started = False
    clean = False
    try:
        started_rc = call(["docker", "run", "--detach", "--rm", "--pull=never",
                           "--network=none", "--cap-drop=NET_RAW",
                           "--security-opt=no-new-privileges",
                           "--pids-limit=256", "--name", name,
                           "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE],
                          timeout=60)
        if started_rc.returncode:
            raise SyntheticRestoreError("Isolated synthetic source container failed")
        started = True
        for _ in range(40):
            if call(["docker", "exec", name, "pg_isready", "-U", "postgres"],
                    timeout=8).returncode == 0:
                break
            sleep(0.5)
        else:
            raise SyntheticRestoreError("Synthetic PostgreSQL source did not become ready")

        sql = ("CREATE TABLE public.jhadina_synthetic_canary "
               "(id INTEGER PRIMARY KEY, marker TEXT NOT NULL);"
               f"INSERT INTO public.jhadina_synthetic_canary VALUES(1,'{marker}');")
        if call(["docker", "exec", name, "psql", "-U", "postgres",
                 "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
                timeout=30).returncode:
            raise SyntheticRestoreError("Synthetic fixture table could not be created")
        with dump.open("xb") as fp:
            os.chmod(dump, 0o600)
            result = call(["docker", "exec", name, "pg_dump", "-Fc", "-U",
                           "postgres", "-d", "postgres"], stdout=fp, timeout=90)
        if result.returncode or dump.stat().st_size < 16:
            raise SyntheticRestoreError("Synthetic pg_dump failed")
        with dump.open("rb") as fp:
            if fp.read(5) != b"PGDMP":
                raise SyntheticRestoreError("Generated pg_dump format invalid")
    finally:
        if started:
            clean = call(["docker", "rm", "--force", name], timeout=30).returncode == 0
        if started and not clean:
            raise SyntheticRestoreError("Synthetic Docker source cleanup failed")


def run_synthetic(*, env: dict[str, str]) -> dict:
    check_admission(env)
    if shutil.which("docker") is None or shutil.which("restic") is None:
        raise SyntheticRestoreError("Docker and Restic are required on the synthetic worker")
    if call(["docker", "image", "inspect", IMAGE], timeout=30).returncode:
        raise SyntheticRestoreError("Synthetic image must be pre-pulled explicitly")
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="jh-synthetic-pg-restic-") as temp:
        work = Path(temp)
        os.chmod(work, 0o700)
        dump = work / "jhadina-postgres.dump"
        marker = secrets.token_hex(16)
        prepare_source(dump, marker)
        h = hashlib.sha256()
        with dump.open("rb") as fp:
            for block in iter(lambda: fp.read(1024 * 1024), b""):
                h.update(block)
        digest = h.hexdigest()
        password = work / "one-time-passphrase"
        fd = os.open(password, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            fp.write(secrets.token_urlsafe(48))
        repository = work / "restic-repository"
        local_env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                     "HOME": str(work),
                     "RESTIC_PASSWORD_FILE": str(password)}
        repo_string = str(repository)
        if call(["restic", "-r", repo_string, "init"],
                env=local_env, timeout=90).returncode:
            raise SyntheticRestoreError("Ephemeral encrypted repository init failed")
        with dump.open("rb") as fp:
            saved = subprocess.run(
                ["restic", "-r", repo_string, "backup", "--stdin",
                 "--stdin-filename", "jhadina-postgres.dump", "--json"],
                stdin=fp, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                env=local_env, timeout=180, check=False,
            )
        if saved.returncode:
            raise SyntheticRestoreError("Synthetic encrypted Restic upload failed")
        snapshot = backup.snapshot_id_from_json(saved.stdout)
        output = work / "retrieved.dump"
        with output.open("xb") as fp:
            rc = call(["restic", "-r", repo_string, "dump", snapshot,
                       "/jhadina-postgres.dump"],
                      stdout=fp, env=local_env, timeout=180)
        if rc.returncode:
            raise SyntheticRestoreError("Synthetic encrypted Restic download failed")
        if output.read_bytes() != dump.read_bytes():
            raise SyntheticRestoreError("Recovered synthetic bytes differ from source")
        if hashlib.sha256(output.read_bytes()).hexdigest() != digest:
            raise SyntheticRestoreError("Restored SHA256 failed")
        # The real restore helper creates a *second* disposable PG container,
        # imports the actual dumped schema/data, then deletes that container.
        restored_tables = restore_drill.restore_into_disposable_postgres(
            output, expected_synthetic_marker=marker
        )
        if restored_tables < 1:
            raise SyntheticRestoreError("Real isolated pg_restore produced no application tables")
    return {
        "schema": "jhadina.google-homebase.synthetic-pg-restic-drill.v1",
        "synthetic_only": True,
        "actual_postgresql_dump_and_isolated_restore_verified": True,
        "local_ephemeral_restic_encryption_roundtrip_verified": True,
        "synthetic_restored_application_table_count": restored_tables,
        "synthetic_exact_row_contents_restored_verified": True,
        "source_sha256": digest,
        "machine_google_drive_oauth_verified": False,
        "production_backup_restored": False,
        "supabase_live_data_covered": False,
        "offsite_drive_backup_verified": False,
        "long_term_password_recovery_verified": False,
        "production_authority_changed": False,
    }


def main() -> int:
    try:
        result = run_synthetic(env=dict(os.environ))
        print(json.dumps(result, sort_keys=True))
        return 0
    except (SyntheticRestoreError, backup.BackupError, restore_drill.RestoreError,
            subprocess.TimeoutExpired, OSError, ValueError) as error:
        # Do not emit caller environment, process stderr, or secret paths.
        print("GOOGLE_HOMEBASE_SYNTHETIC_PG_BLOCKED: synthetic drill failed",
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
