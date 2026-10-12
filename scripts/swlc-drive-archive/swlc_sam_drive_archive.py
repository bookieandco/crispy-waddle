#!/usr/bin/env python3
"""Owner-operated, READ-ONLY Swlc SAM history -> encrypted Google Drive archive.

No database writes, no retention/deletion, no scheduler, no plan/billing changes.
Run inside a short-lived Google Colab session after mounting your own Drive.
The Drive-mounted readback in this script is NOT an independently downloaded backup.
"""
from __future__ import annotations

import getpass
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile
from datetime import date, datetime, timezone
import secrets
from urllib.parse import urlsplit, unquote
import csv

MAGIC = b"JHADINA-SWLC-GCM1\n"
PROJECT_REF = "kqbkaozfjubkjevdfvic"
DRIVE_FOLDER = Path(
    "/content/drive/MyDrive/JHADINA-HOMEBASE/04-SUBSYSTEM-ARCHIVES/"
    "SWLC-SAM-ARCHIVE-STAGING-2026-10-12/02-ENCRYPTED-ARCHIVES"
)
KDF_SALT_BYTES = 16
NONCE_BYTES = 12
TAG_BYTES = 16
CHUNK = 1024 * 1024


def sha256_file(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(CHUNK):
            sha.update(block)
    return sha.hexdigest()


def validate_source_dsn(dsn: str) -> None:
    """Stop accidental exporting from another database or non-TLS hostname."""
    parsed = urlsplit(dsn)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError("Use the PostgreSQL connection URI, not the REST API URL.")
    host = (parsed.hostname or "").lower()
    user = unquote(parsed.username or "")
    direct = host == f"db.{PROJECT_REF}.supabase.co"
    # Supabase transaction/session pooler hosts are *.pooler.supabase.com,
    # and the project is encoded in the canonical postgres.<project-ref> user.
    pooled = host.endswith(".pooler.supabase.com") and user == f"postgres.{PROJECT_REF}"
    if not (direct or pooled):
        raise ValueError("Host and user must identify the original Swlc project.")
    if parsed.query and "sslmode=disable" in parsed.query.lower():
        raise ValueError("Insecure PostgreSQL TLS option refused.")


def derive_key(passphrase: str, salt: bytes) -> bytes:
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
    if len(passphrase) < 20:
        raise ValueError("Archive passphrase must be at least 20 characters.")
    return Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(
        passphrase.encode("utf-8")
    )


class GCMEncryptingSink(io.RawIOBase):
    def __init__(self, stream, encryptor):
        self.stream = stream
        self.encryptor = encryptor

    def writable(self):
        return True

    def write(self, raw):
        chunk = bytes(raw)
        ciphertext = self.encryptor.update(chunk)
        self.stream.write(ciphertext)
        return len(chunk)

    def flush(self):
        if not self.stream.closed:
            self.stream.flush()


def encrypted_csv_archive(
    csv_chunks, output: Path, passphrase: str
) -> tuple[str, int, int]:
    """Stream CSV bytes -> gzip -> authenticated AES-256-GCM ciphertext."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    if output.exists():
        raise FileExistsError(f"Refusing to replace an existing archive: {output}")
    salt = secrets.token_bytes(KDF_SALT_BYTES)
    nonce = secrets.token_bytes(NONCE_BYTES)
    header = MAGIC + salt + nonce
    key = derive_key(passphrase, salt)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    encryptor.authenticate_additional_data(header)
    digest = hashlib.sha256()
    written = 0
    try:
        with output.open("xb") as fh:
            fh.write(header)
            sink = GCMEncryptingSink(fh, encryptor)
            # gzip compresses as a stream; no unencrypted database dump in Drive.
            with gzip.GzipFile(fileobj=sink, mode="wb", compresslevel=6, mtime=0) as gz:
                for block in csv_chunks:
                    raw = bytes(block)
                    digest.update(raw)
                    written += len(raw)
                    gz.write(raw)
            fh.write(encryptor.finalize())
            fh.write(encryptor.tag)
            fh.flush()
        return digest.hexdigest(), written, output.stat().st_size
    except Exception:
        # A partial ciphertext is not an archive and must not be used for recovery.
        output.unlink(missing_ok=True)
        raise


def verify_encrypted_csv_archive(
    archive: Path, passphrase: str, expected_plaintext_sha256: str
) -> tuple[str, int]:
    """Decrypt in local ephemeral scratch; verify GCM tag and raw CSV SHA-256."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    header_size = len(MAGIC) + KDF_SALT_BYTES + NONCE_BYTES
    size = archive.stat().st_size
    if size <= header_size + TAG_BYTES:
        raise ValueError("Encrypted archive too short.")
    with archive.open("rb") as inp:
        header = inp.read(header_size)
        if not header.startswith(MAGIC):
            raise ValueError("Wrong archive version/header.")
        salt = header[len(MAGIC):len(MAGIC)+KDF_SALT_BYTES]
        nonce = header[-NONCE_BYTES:]
        inp.seek(size-TAG_BYTES)
        tag = inp.read(TAG_BYTES)
        decryptor = Cipher(
            algorithms.AES(derive_key(passphrase, salt)),
            modes.GCM(nonce, tag)
        ).decryptor()
        decryptor.authenticate_additional_data(header)
        with tempfile.TemporaryDirectory(prefix="swlc-verify-") as tmp:
            gz_file = Path(tmp) / "unverified.csv.gz"
            with gz_file.open("wb") as raw_gz:
                inp.seek(header_size)
                remaining = size-header_size-TAG_BYTES
                while remaining:
                    enc = inp.read(min(CHUNK, remaining))
                    if not enc:
                        raise ValueError("Encrypted archive truncated.")
                    raw_gz.write(decryptor.update(enc))
                    remaining -= len(enc)
                # No decompression/use until authenticated tag has validated.
                decryptor.finalize()
            plain_hash = hashlib.sha256()
            count = 0
            with gzip.open(gz_file, "rb") as verified:
                while chunk := verified.read(CHUNK):
                    plain_hash.update(chunk)
                    count += len(chunk)
    result = plain_hash.hexdigest()
    if result != expected_plaintext_sha256:
        raise ValueError("Decrypted data hash mismatch.")
    return result, count


def export_sam_versions_readonly(
    database_url: str,
    passphrase: str,
    cutoff_iso: str,
    output_dir: Path = DRIVE_FOLDER,
) -> dict:
    # Import after validation so local crypto tests require no database package.
    from psycopg import connect, sql

    validate_source_dsn(database_url)
    cutoff = date.fromisoformat(cutoff_iso)
    if not output_dir.is_dir():
        raise FileNotFoundError(
            "Drive folder is not mounted. Mount Google Drive first; "
            "do not create an unverified destination in local Colab scratch."
        )
    if cutoff > datetime.now(timezone.utc).date():
        raise ValueError("Future cutoff not permitted.")
    suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = output_dir / f"swlc-sam-versions-before-{cutoff.isoformat()}-{suffix}-{secrets.token_hex(4)}.csv.gz.aesgcm"
    manifest = archive.with_suffix(archive.suffix + ".json")

    with connect(database_url, connect_timeout=20, sslmode="verify-full", autocommit=True) as conn:
        # A read-only repeatable-read transaction prohibits database mutations
        # and keeps the count and streamed COPY at the same source snapshot.
        with conn.transaction():
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            conn.execute("SET LOCAL TIME ZONE 'UTC'")
            rows = conn.execute(
                "select count(*) from public.jhadina_sam_versions "
                "where captured_at < %s::date", (cutoff.isoformat(),)
            ).fetchone()[0]
            if rows <= 0:
                raise ValueError("Zero matching rows; refusing empty archive.")
            with conn.cursor() as cur:
                query = sql.SQL(
                    "COPY (SELECT id,notice_id,version,checksum,snapshot,captured_at "
                    "FROM public.jhadina_sam_versions WHERE captured_at < {cutoff}::date) "
                    "TO STDOUT WITH (FORMAT CSV, HEADER TRUE)"
                ).format(cutoff=sql.Literal(cutoff.isoformat()))
                with cur.copy(query) as copy:
                    source_hash, source_bytes, encrypted_bytes = encrypted_csv_archive(
                        copy, archive, passphrase
                    )

    # One local readback. Remote, independent Drive download is still required.
    # Never assert export integrity by copy-row count alone; the separate
    # archive verifier checks CSV row boundaries after authenticated decrypt.
    actual_plain_hash, actual_bytes = verify_encrypted_csv_archive(
        archive, passphrase, source_hash
    )
    if actual_bytes != source_bytes:
        raise ValueError("Local decrypted byte count mismatch.")

    receipt = {
        "schema": "jhadina.swlc.sam-version-archive.v1",
        "sourceProject": PROJECT_REF,
        "sourceTable": "public.jhadina_sam_versions",
        "sourceTransaction": "REPEATABLE_READ_READ_ONLY",
        "cutoffExclusive": cutoff.isoformat(),
        "sourceRowsCountedInTransaction": rows,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "archiveName": archive.name,
        "archiveEncrypted": True,
        "archiveFormat": "CSV-GZIP-AES256-GCM-SCRYPT",
        "encryptedFileBytes": encrypted_bytes,
        "encryptedFileSha256": sha256_file(archive),
        "sourceCsvBytes": source_bytes,
        "sourceCsvSha256": source_hash,
        "mountedDriveDecryptReadback": True,
        "sourceSnapshotCsvStructureVerified": False,
        "decryptedCsvRowsVerified": False,
        "mountedDriveDecryptedSha256": actual_plain_hash,
        "independentDriveDownloadSha256Verified": False,
        "isolatedPostgresRestoreVerified": False,
        "retentionDecisionApproved": False,
        "productionDeletionAuthorized": False,
        "sourcePostgresModified": False,
        "productionSpaceReclaimed": False,
        "status": "ARCHIVED_COPY_REQUIRES_INDEPENDENT_RESTORE_AND_RETENTION_REVIEW"
    }
    with manifest.open("x", encoding="utf-8") as fh:
        json.dump(receipt, fh, indent=2, sort_keys=True)
        fh.write("\n")
    return receipt


def colab_operator_main():
    cutoff = input("Archive versions captured before date YYYY-MM-DD [2026-10-01]: ").strip() or "2026-10-01"
    url = getpass.getpass(
        "Swlc PostgreSQL connection URI (masked, never saved in notebook): "
    ).strip()
    phrase = getpass.getpass(
        "New 20+ character archive encryption passphrase (store offline safely): "
    )
    again = getpass.getpass("Re-enter the passphrase: ")
    if phrase != again:
        raise ValueError("Archive passphrase confirmation mismatch.")
    # Explicit read-only operation; there is intentionally NO DELETE call.
    report = export_sam_versions_readonly(url, phrase, cutoff)
    from swlc_sam_archive_verify import verify_downloaded_archive
    archive_path = DRIVE_FOLDER / report["archiveName"]
    manifest_path = archive_path.with_suffix(archive_path.suffix + ".json")
    validation = verify_downloaded_archive(archive_path, manifest_path, phrase)
    print("Mounted-Drive content verification passed, but independent Drive download and PostgreSQL restore are NOT proved.")
    print(json.dumps({
        "status": report["status"],
        "encryptedFileBytes": report["encryptedFileBytes"],
        "sourceRowsCountedInTransaction": report["sourceRowsCountedInTransaction"],
        "independentRestoreVerified": report["isolatedPostgresRestoreVerified"],
        "productionDeletionAuthorized": report["productionDeletionAuthorized"],
        "archiveName": report["archiveName"],
        "csvSchemaVerified": validation["csvSchemaAndRowsVerified"],
        "decryptedCsvRowCount": validation["rowCount"],
        "independentDownloadVerified": False,
        "isolatedPostgresRestoreVerified": False,
    }, indent=2))


if __name__ == "__main__":
    colab_operator_main()
