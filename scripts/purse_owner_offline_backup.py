#!/usr/bin/env python3
"""Explicit owner-operated, READ-ONLY, locally encrypted Jhadina Postgres export.

This module does NOT contact the database when imported or in --dry-run mode.
Requires local pg_dump and age, an offline-held age private key, valid TLS,
explicit owner approval, and a pre-existing owner-controlled output directory.
No plaintext dump is persisted; no cloud upload, billing, deployment, DDL,
wallet use, live payment or automatic recurring backup is performed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
from urllib.parse import unquote, urlsplit, parse_qs

PROJECT_REF = "kqbkaozfjubkjevdfvic"
ACK = "I_APPROVE_READ_ONLY_ENCRYPTED_EXPORT"
AGE_RECIPIENT = re.compile(r"^age1[0-9a-z]{58}$")
MAX_DSN_CHARS = 8192


class ExportBlocked(ValueError):
    pass


def parse_source(dsn: str) -> dict:
    if not isinstance(dsn, str) or not (20 <= len(dsn) <= MAX_DSN_CHARS):
        raise ExportBlocked("Canonical Jhadina PostgreSQL URL is required")
    try:
        uri = urlsplit(dsn)
        host = (uri.hostname or "").lower()
        port = uri.port or 5432
        user = unquote(uri.username or "")
        secret = unquote(uri.password or "")
        database = unquote(uri.path.lstrip("/"))
        query = parse_qs(uri.query, strict_parsing=True)
    except (ValueError, AttributeError) as exc:
        raise ExportBlocked("Invalid PostgreSQL connection URL") from exc
    if uri.scheme not in ("postgres", "postgresql"):
        raise ExportBlocked("Expected a PostgreSQL connection URL, not an API endpoint")
    direct = host == f"db.{PROJECT_REF}.supabase.co" and user == "postgres"
    pooled = (host.endswith(".pooler.supabase.com")
              and user == f"postgres.{PROJECT_REF}")
    if not (direct or pooled):
        raise ExportBlocked("Connection does not identify the canonical Jhadina database")
    if not secret or database != "postgres" or not (1 <= port <= 65535):
        raise ExportBlocked("Expected the canonical PostgreSQL database and an owner-supplied password")
    if uri.fragment:
        raise ExportBlocked("Unexpected connection URI components")
    if any(k not in ("sslmode", "application_name") for k in query):
        raise ExportBlocked("Unsupported connection URI setting")
    if "sslmode" in query and query["sslmode"] != ["verify-full"]:
        raise ExportBlocked("TLS hostname verification is required (sslmode=verify-full)")
    return {"host": host, "port": port, "user": user,
            "password": secret, "database": database,
            "sourceKind": "DIRECT" if direct else "POOLER"}


def validate_owner_inputs(dsn: str, recipient: str, ack: str, output_dir: Path) -> dict:
    source = parse_source(dsn)
    if ack != ACK:
        raise ExportBlocked("Separate explicit owner approval for the read-only export is required")
    if not isinstance(recipient, str) or not AGE_RECIPIENT.fullmatch(recipient):
        raise ExportBlocked("Valid age X25519 public recipient is required; never provide private keys")
    if not output_dir.exists() or not output_dir.is_dir() or output_dir.is_symlink():
        raise ExportBlocked("An existing owner-controlled, non-symlink local output directory is required")
    if not os.access(output_dir, os.W_OK):
        raise ExportBlocked("Owner-controlled backup directory is not writable")
    return source


def receipt_for_encrypted_copy(
    filename: str, size: int, digest: str, utc: str, source_kind: str
) -> dict:
    if not filename.endswith(".dump.age") or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ExportBlocked("Encrypted export receipt metadata invalid")
    if type(size) is not int or size <= 0 or source_kind not in ("DIRECT", "POOLER"):
        raise ExportBlocked("Encrypted export receipt evidence invalid")
    return {
        "schema": "jhadina.purse.owner-logical-export.v1",
        "sourceProjectRef": PROJECT_REF,
        "sourceDatabase": "postgres",
        "sourceKind": source_kind,
        "createdAtUtc": utc,
        "archiveName": filename,
        "archiveFormat": "pg_dump-custom-age-x25519",
        "archiveEncrypted": True,
        "archiveBytes": size,
        "encryptedArchiveSha256": digest,
        "physicalBackup": False,
        "fullClusterRolesAndPasswordsIncluded": False,
        "externalStorageObjectsIncluded": False,
        "independentlyDownloadedAndDecrypted": False,
        "independentRealDataRestoreVerified": False,
        "authenticatedCrossTenantRlsVerified": False,
        "productionMigrationApproved": False,
        "canChangeProductionSchema": False,
        "canMoveMoney": False,
        "status": "LOCAL_ENCRYPTED_COPY_ONLY_UNVERIFIED_RESTORE"
    }



# Strict allowlist: never pass JH_PURSE_SOURCE_DSN, other integration secrets,
# or the database password through to the age encryption process.
_SAFE_CHILD_ENV = frozenset((
    "PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR",
    "SSL_CERT_FILE", "SSL_CERT_DIR"
))


def build_export_child_environments(source: dict, inherited: dict) -> tuple[dict, dict]:
    if any(key not in source for key in ("host", "port", "user", "password", "database")):
        raise ExportBlocked("Incomplete canonical source configuration")
    common = {key: value for key, value in inherited.items()
              if key in _SAFE_CHILD_ENV and isinstance(value, str)}
    encryption_env = dict(common)
    database_env = dict(common)
    database_env.update({
        "PGHOST": source["host"], "PGPORT": str(source["port"]),
        "PGUSER": source["user"], "PGPASSWORD": source["password"],
        "PGDATABASE": source["database"], "PGSSLMODE": "verify-full",
        "PGOPTIONS": "-c default_transaction_read_only=on",
        "PGAPPNAME": "jhadina_purse_owner_readonly_export"
    })
    if inherited.get("PGSSLROOTCERT"):
        database_env["PGSSLROOTCERT"] = inherited["PGSSLROOTCERT"]
    return database_env, encryption_env

def run_backup(source: dict, recipient: str, output_dir: Path) -> tuple[Path, Path]:
    if not shutil.which("pg_dump") or not shutil.which("age"):
        raise ExportBlocked("Local pg_dump and age tools are both required")
    when = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = secrets.token_hex(6)
    name = f"jhadina-purse-{when}-{suffix}.dump.age"
    archive = output_dir / name
    partial = output_dir / (name + ".partial")
    manifest = output_dir / (name + ".json")
    database_env, encryption_env = build_export_child_environments(source, os.environ)
    try:
        # Encrypted stream from the start. No readable dump file ever exists.
        fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as out:
            pg = subprocess.Popen(
                ["pg_dump", "--format=custom", "--no-owner", "--serializable-deferrable"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=database_env
            )
            try:
                age = subprocess.Popen(
                    ["age", "-r", recipient], stdin=pg.stdout,
                    stdout=out, stderr=subprocess.DEVNULL, env=encryption_env
                )
                assert pg.stdout is not None
                pg.stdout.close()
                dump_status = pg.wait()
                age_status = age.wait()
            except BaseException:
                pg.kill()
                pg.wait()
                raise
            if dump_status != 0 or age_status != 0:
                raise ExportBlocked(
                    "Local read-only export or encryption failed; partial ciphertext discarded"
                )
            out.flush()
            os.fsync(out.fileno())
        if partial.stat().st_size < 512:
            raise ExportBlocked("Encrypted export unexpectedly short")
        os.rename(partial, archive)
        h = hashlib.sha256()
        with archive.open("rb") as src:
            for chunk in iter(lambda: src.read(1024 * 1024), b""):
                h.update(chunk)
        receipt = receipt_for_encrypted_copy(
            archive.name, archive.stat().st_size, h.hexdigest(),
            dt.datetime.now(dt.timezone.utc).isoformat(), source["sourceKind"]
        )
        receipt_fd = os.open(manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(receipt_fd, "w", encoding="utf-8") as dst:
            json.dump(receipt, dst, indent=2, sort_keys=True)
            dst.write("\n")
        return archive, manifest
    except BaseException:
        partial.unlink(missing_ok=True)
        # A failed receipt makes the archive unauditable; do not retain it.
        if archive.exists() and not manifest.exists():
            archive.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True,
                        help="Pre-existing private folder on your own computer")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate settings without touching the database or writing an archive")
    args = parser.parse_args()
    try:
        source = validate_owner_inputs(
            os.environ.get("JH_PURSE_SOURCE_DSN", ""),
            os.environ.get("JH_PURSE_AGE_RECIPIENT", ""),
            os.environ.get("JH_PURSE_SOURCE_BACKUP_ACK", ""),
            args.output_dir
        )
        if args.dry_run:
            print("PASS: source identity, encryption recipient, explicit approval and local path.")
            print("NO DATABASE CONNECTION OR BACKUP PERFORMED.")
            return 0
        archive, receipt = run_backup(
            source, os.environ["JH_PURSE_AGE_RECIPIENT"], args.output_dir
        )
        print(f"Encrypted LOCAL copy: {archive.name}")
        print(f"Read-only LOCAL receipt: {receipt.name}")
        print("NOT VERIFIED: independent download/decryption, restore, JWT tenant isolation.")
        print("Do not upload archives/keys or enter database passwords into GitHub or chat.")
        return 0
    except (ExportBlocked, OSError, subprocess.SubprocessError) as exc:
        # Redact underlying driver/process messages to avoid leaking secrets.
        if isinstance(exc, ExportBlocked):
            print(f"BLOCKED: {exc}", file=sys.stderr)
        else:
            print("BLOCKED: local export failed; inspect tools privately", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
