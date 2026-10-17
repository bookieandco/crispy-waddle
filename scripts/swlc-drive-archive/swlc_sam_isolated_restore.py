#!/usr/bin/env python3
"""Replay an authenticated SAM V2 archive into a LOCAL disposable Postgres 17 DB.

Never connects to Swlc or accepts a database URL; it writes only a temporary
table within the exact-named localhost sandbox. This tests restore syntax and
row integrity, NOT source authenticity, physical backup or retention approval.
"""
from __future__ import annotations

import argparse
import getpass
import gzip
import hashlib
import json
from pathlib import Path
import tempfile

import swlc_sam_drive_archive as crypto
from swlc_sam_archive_verify import verify_downloaded_archive

SANDBOX_DATABASE = "swlc_archive_sandbox"
SANDBOX_HOST = "127.0.0.1"
SANDBOX_TABLE = "pg_temp.swlc_sam_versions_sandbox"


def _authenticated_gzip_to_scratch(archive: Path, passphrase: str, dest: Path) -> None:
    """GCM-verify the entire file before allowing decompression or SQL replay."""
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    header_length = len(crypto.MAGIC) + crypto.KDF_SALT_BYTES + crypto.NONCE_BYTES
    size = archive.stat().st_size
    if size <= header_length + crypto.TAG_BYTES:
        raise ValueError("Invalid encrypted archive length")
    with archive.open("rb") as source:
        header = source.read(header_length)
        if header[:len(crypto.MAGIC)] != crypto.MAGIC:
            raise ValueError("Unrecognized encrypted archive")
        salt = header[len(crypto.MAGIC):-crypto.NONCE_BYTES]
        nonce = header[-crypto.NONCE_BYTES:]
        source.seek(size - crypto.TAG_BYTES)
        tag = source.read(crypto.TAG_BYTES)
        decryptor = Cipher(
            algorithms.AES(crypto.derive_key(passphrase, salt)),
            modes.GCM(nonce, tag),
        ).decryptor()
        decryptor.authenticate_additional_data(header)
        try:
            with dest.open("xb") as output:
                source.seek(header_length)
                remaining = size - header_length - crypto.TAG_BYTES
                while remaining:
                    block = source.read(min(crypto.CHUNK, remaining))
                    if not block:
                        raise ValueError("Truncated encrypted file")
                    output.write(decryptor.update(block))
                    remaining -= len(block)
                decryptor.finalize()
        except BaseException:
            dest.unlink(missing_ok=True)
            raise


def isolated_local_restore(
    archive: Path,
    manifest_path: Path,
    passphrase: str,
    *,
    port: int = 55432,
    username: str = "postgres",
    password: str = "",
) -> dict:
    """Restore into ephemeral pg_temp ONLY and return fail-closed receipt."""
    if not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("Local port must be 1..65535")
    if not isinstance(username, str) or not username:
        raise ValueError("Missing local sandbox user")

    # GCM tag, ciphertext hash, CSV schema/row count/cutoff checked BEFORE DB I/O.
    validation = verify_downloaded_archive(archive, manifest_path, passphrase)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cutoff = manifest["cutoffExclusive"]

    from psycopg import connect

    with tempfile.TemporaryDirectory(prefix="swlc-isolated-restore-") as scratch:
        gz_file = Path(scratch) / "authenticated-dataset.csv.gz"
        _authenticated_gzip_to_scratch(archive, passphrase, gz_file)
        with connect(
            host=SANDBOX_HOST,
            port=port,
            dbname=SANDBOX_DATABASE,
            user=username,
            password=password,
            connect_timeout=10,
            autocommit=True,
            application_name="swlc_archive_isolated_restore_only",
        ) as conn:
            observed_database = conn.execute("select current_database()").fetchone()[0]
            if observed_database != SANDBOX_DATABASE:
                raise ValueError("Refusing restore outside disposable sandbox")
            with conn.transaction():
                conn.execute("""
                    CREATE TEMPORARY TABLE swlc_sam_versions_sandbox (
                        id bigint PRIMARY KEY,
                        notice_id text NOT NULL,
                        version integer NOT NULL,
                        checksum text,
                        snapshot jsonb,
                        captured_at timestamptz NOT NULL
                    ) ON COMMIT DROP
                """)
                with conn.cursor() as cursor:
                    with cursor.copy(
                        "COPY pg_temp.swlc_sam_versions_sandbox "
                        "(id,notice_id,version,checksum,snapshot,captured_at) "
                        "FROM STDIN WITH (FORMAT CSV, HEADER TRUE)"
                    ) as copy:
                        with gzip.open(gz_file, "rb") as csv_source:
                            while block := csv_source.read(crypto.CHUNK):
                                copy.write(block)
                counts = conn.execute("""
                    SELECT count(*), count(DISTINCT id),
                           count(*) FILTER (
                               WHERE captured_at >= %s::date
                                  OR id < 0 OR version < 0
                           )
                    FROM pg_temp.swlc_sam_versions_sandbox
                """, (cutoff,)).fetchone()
                expected_count = validation["rowCount"]
                if counts != (expected_count, expected_count, 0):
                    raise ValueError("Sandbox restore count/identity/cutoff mismatch")
                result = {
                    "schema": "jhadina.swlc.sam-isolated-restore-test.v1",
                    "sourceProject": crypto.PROJECT_REF,
                    "sandboxDatabase": SANDBOX_DATABASE,
                    "sandboxHost": SANDBOX_HOST,
                    "restoredRows": counts[0],
                    "uniqueIds": counts[1],
                    "invalidOrOutsideCutoff": counts[2],
                    "encryptedSha256": crypto.sha256_file(archive),
                    "sourceCsvSha256": validation["decryptedCsvSha256"],
                    "localTempPostgresRestoreVerified": True,
                    "archiveReadbackVerifiedByOperator": False,
                    "originalSwlcSourceAuthenticated": False,
                    "productionRestoreVerified": False,
                    "sourceDeletionAuthorized": False,
                    "spaceReclaimed": False,
                    "state": "ISOLATED_RESTORE_TESTED_SOURCE_AND_DRIVE_PROVENANCE_NOT_CERTIFIED",
                }
                # The temporary table is dropped at transaction end.
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--local-port", type=int, default=55432)
    parser.add_argument("--local-user", default="postgres")
    args = parser.parse_args()
    passphrase = getpass.getpass("Encrypted archive passphrase: ")
    password = getpass.getpass("LOCAL sandbox PostgreSQL password: ")
    try:
        report = isolated_local_restore(
            args.archive, args.receipt, passphrase,
            port=args.local_port, username=args.local_user, password=password,
        )
    except Exception as error:
        print(json.dumps({
            "state": "BLOCKED",
            "errorType": type(error).__name__,
            "sourceDeletionAuthorized": False,
        }))
        return 2
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
