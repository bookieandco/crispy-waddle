#!/usr/bin/env python3
"""Fail-closed verification of owner-exported Swlc SAM archive ciphertext.

Supports a read-only independently downloaded copy. It NEVER deletes any
production database rows, connects to production, or asserts a restore has run.
The expected values in a manifest are not cryptographic proof that the sender
was Supabase: source identity still needs independent database receipts.
"""
from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tempfile

import swlc_sam_drive_archive as exporter

EXPECTED_HEADER = ("id", "notice_id", "version", "checksum", "snapshot", "captured_at")
SHA256 = re.compile(r"^[a-f0-9]{64}$")


def _check(condition: bool, detail: str) -> None:
    if not condition:
        raise ValueError(detail)


def verify_manifest_schema(receipt: dict, archive: Path) -> tuple[str, date]:
    _check(receipt.get("schema") == "jhadina.swlc.sam-version-archive.v1", "Unexpected receipt schema")
    _check(receipt.get("sourceProject") == exporter.PROJECT_REF, "Wrong source project")
    _check(receipt.get("sourceTable") == "public.jhadina_sam_versions", "Wrong source table")
    _check(receipt.get("sourceTransaction") == "REPEATABLE_READ_READ_ONLY", "Source transaction not marked read-only")
    _check(receipt.get("archiveName") == archive.name, "Archive name mismatch")
    _check(receipt.get("archiveEncrypted") is True, "Unencrypted archive")
    _check(receipt.get("archiveFormat") == "CSV-GZIP-AES256-GCM-SCRYPT", "Unexpected encryption format")
    _check(receipt.get("sourcePostgresModified") is False, "Source write indicator is not false")
    _check(receipt.get("productionDeletionAuthorized") is False, "Delete permission must stay false")
    _check(receipt.get("retentionDecisionApproved") is False, "Unexpected retention approval")
    _check(receipt.get("isolatedPostgresRestoreVerified") is False, "Unsubstantiated restore flag")
    _check(receipt.get("independentDriveDownloadSha256Verified") is False, "Unsubstantiated independent proof")
    row_count = receipt.get("sourceRowsCountedInTransaction")
    _check(type(row_count) is int and row_count > 0, "Missing positive source row count")
    for key in ("encryptedFileBytes", "sourceCsvBytes"):
        _check(type(receipt.get(key)) is int and receipt[key] > 0, f"Missing positive {key}")
    for key in ("sourceCsvSha256", "encryptedFileSha256"):
        _check(isinstance(receipt.get(key), str) and SHA256.fullmatch(receipt[key]) is not None, f"Bad {key}")
    cutoff = date.fromisoformat(receipt["cutoffExclusive"])
    return receipt["sourceCsvSha256"], cutoff


def inspect_authenticated_csv(
    archive: Path, passphrase: str, expected_plain_hash: str, cutoff: date
) -> dict:
    """No decompression until after the GCM authentication tag passes.

    2 passes over locally held ciphertext: verifier authentication/decryption,
    then validated streaming CSV; no plaintext is persisted in Google Drive.
    """
    # The version-1 encrypted format needs a temporary locally held authenticated
    # gzip file, because plaintext should never be parsed before GCM validates.
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    header_length = len(exporter.MAGIC) + exporter.KDF_SALT_BYTES + exporter.NONCE_BYTES
    n = archive.stat().st_size
    _check(n > header_length + exporter.TAG_BYTES, "Archive too short")
    with archive.open("rb") as src:
        header = src.read(header_length)
        _check(header.startswith(exporter.MAGIC), "Invalid archive magic")
        salt = header[len(exporter.MAGIC):len(exporter.MAGIC) + exporter.KDF_SALT_BYTES]
        nonce = header[-exporter.NONCE_BYTES:]
        src.seek(n - exporter.TAG_BYTES)
        tag = src.read(exporter.TAG_BYTES)
        cipher = Cipher(algorithms.AES(exporter.derive_key(passphrase, salt)), modes.GCM(nonce, tag))
        decryptor = cipher.decryptor()
        decryptor.authenticate_additional_data(header)
        with tempfile.TemporaryDirectory(prefix="swlc-authenticated-csv-") as tmp:
            gz_path = Path(tmp) / "authenticated.csv.gz"
            with gz_path.open("xb") as dst:
                src.seek(header_length)
                remaining = n - header_length - exporter.TAG_BYTES
                while remaining:
                    enc = src.read(min(exporter.CHUNK, remaining))
                    _check(bool(enc), "Truncated archive")
                    dst.write(decryptor.update(enc))
                    remaining -= len(enc)
                decryptor.finalize()  # cryptographic authenticity first
            # Huge single-row JSON may exceed Python CSV reader's tiny default.
            csv.field_size_limit(min(2_147_483_647, sys.maxsize))
            expected_id_set: set[str] = set()
            min_date, max_date = None, None
            records = 0
            sha = hashlib.sha256()
            counted_bytes = 0
            with gzip.open(gz_path, "rb") as raw:
                class HashingStream(io.RawIOBase):
                    def readable(self):
                        return True
                    def readinto(self, output):
                        nonlocal counted_bytes
                        chunk = raw.read(len(output))
                        n_read = len(chunk)
                        if n_read:
                            output[:n_read] = chunk
                            sha.update(chunk)
                            counted_bytes += n_read
                        return n_read

                stream = io.TextIOWrapper(io.BufferedReader(HashingStream()), encoding="utf-8", newline="")
                reader = csv.reader(stream)
                header_row = next(reader, None)
                _check(tuple(header_row or ()) == EXPECTED_HEADER, "Archive CSV header mismatch")
                for line in reader:
                    _check(len(line) == len(EXPECTED_HEADER), "Malformed CSV record")
                    id_value, notice_id, version, checksum, snapshot, capture = line
                    _check(id_value and notice_id and version, "Required record identity missing")
                    _check(id_value not in expected_id_set, "Duplicate archive record ID")
                    expected_id_set.add(id_value)
                    _check(int(id_value) >= 0 and int(version) >= 0, "Invalid record identifier/version")
                    # JSON parsing ensures the database snapshot is not a broken raw text payload.
                    json.loads(snapshot)
                    timestamp = datetime.fromisoformat(capture.replace("Z", "+00:00"))
                    _check(timestamp.tzinfo is not None, "Timestamp missing timezone")
                    taken = timestamp.astimezone(timezone.utc).date()
                    _check(taken < cutoff, "Captured time at or after exclusive cutoff")
                    min_date = taken if min_date is None or taken < min_date else min_date
                    max_date = taken if max_date is None or taken > max_date else max_date
                    records += 1
                # Ensure stream is consumed and hashing is complete.
                stream.close()
            _check(sha.hexdigest() == expected_plain_hash, "Decrypted CSV SHA-256 mismatch")
            return {
                "decryptedCsvSha256": sha.hexdigest(),
                "decryptedCsvBytes": counted_bytes,
                "rowCount": records,
                "distinctArchiveIds": len(expected_id_set),
                "minCapturedDate": min_date.isoformat() if min_date else None,
                "maxCapturedDate": max_date.isoformat() if max_date else None,
                "sourceRowsFullyParsed": records > 0,
            }


def verify_downloaded_archive(archive: Path, receipt_path: Path, passphrase: str) -> dict:
    """Caller must independently obtain archive bytes; source never queried."""
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    _check(isinstance(receipt, dict), "Receipt must be JSON object")
    expected_sha, cutoff = verify_manifest_schema(receipt, archive)
    _check(archive.stat().st_size == receipt["encryptedFileBytes"], "Ciphertext size mismatch")
    _check(exporter.sha256_file(archive) == receipt["encryptedFileSha256"], "Ciphertext SHA-256 mismatch")
    data = inspect_authenticated_csv(archive, passphrase, expected_sha, cutoff)
    _check(data["decryptedCsvBytes"] == receipt["sourceCsvBytes"], "Source CSV byte count mismatch")
    _check(data["rowCount"] == receipt["sourceRowsCountedInTransaction"], "Source transaction row count mismatch")
    return {
        "schema": "jhadina.swlc.sam-version-download-verify.v2",
        "archiveName": archive.name,
        "sourceProject": exporter.PROJECT_REF,
        "encryptedSha256MatchesReceipt": True,
        "gcmAuthenticationPassed": True,
        "csvSchemaAndRowsVerified": True,
        **data,
        "independentDownloadProvenance": "OPERATOR_MUST_VERIFY_OUT_OF_BAND",
        "isolatedPostgresRestoreVerified": False,
        "canDeleteSupabaseRecords": False,
        "canCertifyDiskSpaceReclaimed": False,
        "state": "CONTENT_VERIFIED_RESTORE_AND_INDEPENDENT_SOURCE_PROOF_STILL_REQUIRED",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive", type=Path, required=True)
    p.add_argument("--receipt", type=Path, required=True)
    args = p.parse_args()
    import getpass
    phrase = getpass.getpass("Archive decryption passphrase (hidden): ")
    try:
        report = verify_downloaded_archive(args.archive, args.receipt, phrase)
    except Exception as exc:
        print(json.dumps({"state":"BLOCKED", "error":str(exc),"canDeleteSupabaseRecords":False}), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
