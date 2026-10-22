#!/usr/bin/env python3
"""Offline check for owner-exported encrypted Jhadina PostgreSQL logical archives.

Runs on an independent owner-controlled machine. Cannot access Supabase, create a
database, approve deployment, handle Stripe, or claim a restored source database.
Complete age decryption is streamed into memory (not written to disk).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys

PROJECT = "kqbkaozfjubkjevdfvic"
HASH = re.compile(r"^[a-f0-9]{64}$")
FILENAME = re.compile(r"^jhadina-purse-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}\.dump\.age$")
LIMIT_BYTES = 50 * 1024 * 1024 * 1024
SCHEMA = "jhadina.purse.owner-logical-export.v1"


class VerificationBlocked(ValueError):
    pass


def _regular_file(path: Path) -> None:
    if not path.is_file() or path.is_symlink():
        raise VerificationBlocked("Expected an existing local regular file, not a symlink")


def validate_receipt(archive: Path, metadata: object) -> dict:
    _regular_file(archive)
    if not isinstance(metadata, dict):
        raise VerificationBlocked("Receipt must be a JSON object")
    if metadata.get("schema") != SCHEMA or metadata.get("sourceProjectRef") != PROJECT:
        raise VerificationBlocked("Wrong archive schema or database project")
    if not FILENAME.fullmatch(archive.name) or metadata.get("archiveName") != archive.name:
        raise VerificationBlocked("Archive name does not match the receipt")
    if metadata.get("sourceDatabase") != "postgres" or metadata.get("sourceKind") not in ("DIRECT", "POOLER"):
        raise VerificationBlocked("Source identity not pinned in receipt")
    if metadata.get("archiveFormat") != "pg_dump-custom-age-x25519" or metadata.get("archiveEncrypted") is not True:
        raise VerificationBlocked("Archive is not marked as the required encrypted format")
    expected = metadata.get("encryptedArchiveSha256")
    declared_length = metadata.get("archiveBytes")
    if not isinstance(expected, str) or not HASH.fullmatch(expected):
        raise VerificationBlocked("Invalid expected encrypted archive SHA-256")
    if type(declared_length) is not int or declared_length < 512 or declared_length > LIMIT_BYTES:
        raise VerificationBlocked("Invalid encrypted archive byte count")
    actual_length = archive.stat().st_size
    if actual_length != declared_length:
        raise VerificationBlocked("Archive size does not match the source receipt")
    for field in ("independentlyDownloadedAndDecrypted", "independentRealDataRestoreVerified",
                  "authenticatedCrossTenantRlsVerified", "productionMigrationApproved",
                  "canChangeProductionSchema", "canMoveMoney"):
        if metadata.get(field) is not False:
            raise VerificationBlocked("Premature or forged acceptance flag: " + field)
    return metadata


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def check_encrypted_copy(archive: Path, receipt_path: Path) -> dict:
    _regular_file(receipt_path)
    try:
        metadata = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise VerificationBlocked("Receipt is not valid UTF-8 JSON") from exc
    validate_receipt(archive, metadata)
    actual = digest_file(archive)
    if actual != metadata["encryptedArchiveSha256"]:
        raise VerificationBlocked("Encrypted bytes fail independent SHA-256 readback")
    return {
        "schema": "jhadina.purse.offline-verification.v1",
        "sourceProjectRef": PROJECT,
        "archiveName": archive.name,
        "archiveSizeBytes": archive.stat().st_size,
        "ciphertextMatchesSourceReceipt": True,
        "encryptedArchiveSha256": actual,
        "ageDecryptionVerified": False,
        "postgresCustomArchiveHeaderVerified": False,
        "isolatedRestoreVerified": False,
        "productionMigrationApproved": False,
        "canChangeProductionSchema": False,
        "canMoveMoney": False,
        "status": "ENCRYPTED_BYTES_MATCH_DECRYPTION_AND_RESTORE_UNVERIFIED"
    }


def verify_complete_decryption(archive: Path, identity: Path) -> tuple[int, str]:
    _regular_file(identity)
    if not shutil.which("age"):
        raise VerificationBlocked("The age decryptor is not installed on this machine")
    total = 0
    header = b""
    h = hashlib.sha256()
    process = subprocess.Popen(
        ["age", "--decrypt", "--identity", str(identity), str(archive)],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    )
    try:
        assert process.stdout is not None
        for chunk in iter(lambda: process.stdout.read(1024 * 1024), b""):
            if len(header) < 5:
                header += chunk[:5-len(header)]
            total += len(chunk)
            if total > LIMIT_BYTES:
                raise VerificationBlocked("Decrypted file exceeds local safety limit")
            h.update(chunk)
        process.stdout.close()
        result = process.wait()
        if result != 0:
            raise VerificationBlocked("Full encrypted file authentication/decryption failed")
        if header != b"PGDMP" or total < 512:
            raise VerificationBlocked("Decrypted bytes are not a PostgreSQL custom-format archive")
        return total, h.hexdigest()
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        if process.stdout is not None and not process.stdout.closed:
            process.stdout.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--age-identity", type=Path, help="Offline private age key file path, never its contents")
    parser.add_argument("--output-dir", type=Path, help="Private directory for a new verification receipt")
    args = parser.parse_args()
    try:
        report = check_encrypted_copy(args.archive, args.receipt)
        if args.age_identity:
            size, digest = verify_complete_decryption(args.archive, args.age_identity)
            report.update({
                "ageDecryptionVerified": True,
                "postgresCustomArchiveHeaderVerified": True,
                "decryptedArchiveBytes": size,
                "decryptedArchiveSha256": digest,
                "status": "INDEPENDENT_DECRYPTION_VERIFIED_RESTORE_NOT_VERIFIED",
            })
        if args.output_dir:
            output = args.output_dir
            if not output.is_dir() or output.is_symlink():
                raise VerificationBlocked("Existing private output directory required")
            path = output / (
                "purse-backup-check-" + secrets.token_hex(6) + ".json"
            )
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as writer:
                json.dump(report, writer, sort_keys=True, indent=2)
                writer.write("\n")
        print("PASS: ciphertext matches the receipt." + (
            " Complete local decryption and PG custom header verified." if args.age_identity else ""
        ))
        print("NOT CERTIFIED: actual PostgreSQL restoration, role/JWT isolation,")
        print("               source completeness, payments, migrations or deployment.")
        return 0
    except (VerificationBlocked, OSError) as exc:
        if isinstance(exc, VerificationBlocked):
            print("BLOCKED: " + str(exc), file=sys.stderr)
        else:
            print("BLOCKED: offline verification failed; examine local files", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
