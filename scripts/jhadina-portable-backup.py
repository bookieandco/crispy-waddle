#!/usr/bin/env python3
"""Create an encrypted logical backup of portable Jhadina PostgreSQL.

The plaintext pg_dump exists only as a temporary local file and is deleted
before this command returns. The encryption passphrase is read from a file and
is never printed or persisted in the manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path("/workspace/jhadina-portable")
SECRETS = ROOT / "secrets"
DEFAULT_OUTPUT = ROOT / "backups"
ADMIN_PASSWORD_FILE = SECRETS / "postgres-admin.password"
POSTGRES_BIN = Path("/usr/lib/postgresql/17/bin")
ADMIN_USER = "jhadina_admin"
DATABASE = "jhadina"
CRITICAL_TABLES = (
    "jhadina_memory_candidates",
    "jhadina_memories",
    "jhadina_reasoning_events",
    "jhadina_timeline_events",
    "money_coffers",
    "money_wallet_connections",
    "money_signer_leases",
    "money_market_connector_admissions",
    "money_purse_charters",
    "money_shark_runtime_ingress",
    "money_shark_coffer_runtime_runs",
    "money_dex_execution_attempts",
    "jhadina_portable_migration_ledger",
)


def fail(code: str, detail: str = "") -> "None":
    print(code if not detail else f"{code}:{detail}", file=sys.stderr, flush=True)
    raise SystemExit(2)


def run(
    args: list[str],
    *,
    env: dict[str, str] | None = None,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        env=env,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        check=True,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def pg_env(password: str) -> dict[str, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    return env


def psql_scalar(password: str, sql: str) -> str:
    result = run(
        [
            str(POSTGRES_BIN / "psql"),
            "-h",
            "127.0.0.1",
            "-p",
            "5432",
            "-U",
            ADMIN_USER,
            "-d",
            DATABASE,
            "-v",
            "ON_ERROR_STOP=1",
            "--tuples-only",
            "--no-align",
            "-c",
            sql,
        ],
        env=pg_env(password),
        capture=True,
    )
    return result.stdout.strip()


def row_count_digest(password: str) -> str:
    lines: list[str] = []
    for table in CRITICAL_TABLES:
        exists = psql_scalar(password, f"SELECT to_regclass('public.{table}');")
        if exists != table:
            fail("PORTABLE_BACKUP_CRITICAL_TABLE_MISSING", table)
        count = psql_scalar(password, f'SELECT count(*) FROM public."{table}";')
        lines.append(f"{table}={count}")
    canonical = "\n".join(sorted(lines)) + "\n"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def source_revision() -> str:
    repo = ROOT / "repo"
    if not (repo / ".git").exists():
        return "unknown"
    try:
        return run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture=True).stdout.strip()
    except Exception:
        return "unknown"


def create_backup(passphrase_file: Path, output_dir: Path) -> dict[str, object]:
    if not ADMIN_PASSWORD_FILE.exists():
        fail("PORTABLE_BACKUP_ADMIN_PASSWORD_MISSING")
    if not passphrase_file.exists() or passphrase_file.stat().st_size < 20:
        fail("PORTABLE_BACKUP_PASSPHRASE_REQUIRED")
    for binary in (POSTGRES_BIN / "pg_dump", Path("/usr/bin/gpg")):
        if not binary.exists():
            fail("PORTABLE_BACKUP_BINARY_MISSING", str(binary))

    output_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(output_dir, 0o700)
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    base = f"jhadina-{stamp}"
    plaintext = output_dir / f"{base}.dump"
    encrypted = output_dir / f"{base}.dump.gpg"
    manifest = output_dir / f"{base}.manifest.json"

    password = ADMIN_PASSWORD_FILE.read_text().strip()
    if len(password) < 20:
        fail("PORTABLE_BACKUP_ADMIN_PASSWORD_INVALID")

    try:
        run(
            [
                str(POSTGRES_BIN / "pg_dump"),
                "-h",
                "127.0.0.1",
                "-p",
                "5432",
                "-U",
                ADMIN_USER,
                "-d",
                DATABASE,
                "--format=custom",
                "--compress=9",
                "--no-owner",
                "--file",
                str(plaintext),
            ],
            env=pg_env(password),
        )
        if not plaintext.exists() or plaintext.stat().st_size == 0:
            fail("PORTABLE_BACKUP_DUMP_EMPTY")

        dump_hash = sha256(plaintext)
        counts_digest = row_count_digest(password)

        run(
            [
                "/usr/bin/gpg",
                "--batch",
                "--yes",
                "--pinentry-mode",
                "loopback",
                "--symmetric",
                "--cipher-algo",
                "AES256",
                "--passphrase-file",
                str(passphrase_file),
                "--output",
                str(encrypted),
                str(plaintext),
            ]
        )
        if not encrypted.exists() or encrypted.stat().st_size == 0:
            fail("PORTABLE_BACKUP_ENCRYPTED_EMPTY")

        payload: dict[str, object] = {
            "kind": "JHADINA_PORTABLE_POSTGRES_BACKUP",
            "version": 1,
            "passed": True,
            "authority": "BACKUP_EVIDENCE_ONLY",
            "canExecute": False,
            "database": DATABASE,
            "postgresMajor": 17,
            "sourceRevision": source_revision(),
            "criticalTables": list(CRITICAL_TABLES),
            "criticalRowCountDigest": counts_digest,
            "dumpSha256": dump_hash,
            "encryptedSha256": sha256(encrypted),
            "encryptedBytes": encrypted.stat().st_size,
            "artifactPath": str(encrypted),
            "manifestPath": str(manifest),
            "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        manifest.write_text(json.dumps(payload, sort_keys=True, indent=2) + "\n")
        os.chmod(encrypted, 0o600)
        os.chmod(manifest, 0o600)

        # Keep only the newest three encrypted staging copies. These are
        # convenience copies only; same-volume copies never satisfy DR.
        manifests = sorted(output_dir.glob("jhadina-*.manifest.json"), reverse=True)
        for old_manifest in manifests[3:]:
            try:
                old = json.loads(old_manifest.read_text())
                old_path = Path(str(old.get("artifactPath", "")))
                if old_path.parent == output_dir:
                    old_path.unlink(missing_ok=True)
                old_manifest.unlink(missing_ok=True)
            except Exception:
                continue

        print(json.dumps(payload, sort_keys=True), flush=True)
        return payload
    finally:
        plaintext.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    backup = sub.add_parser("backup")
    backup.add_argument("--passphrase-file", required=True)
    backup.add_argument("--output-dir", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    if args.command == "backup":
        create_backup(Path(args.passphrase_file), Path(args.output_dir))
        return 0
    fail("PORTABLE_BACKUP_COMMAND_INVALID")


if __name__ == "__main__":
    raise SystemExit(main())
