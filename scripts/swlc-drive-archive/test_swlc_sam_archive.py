"""V2 archive verification regression; synthetic rows only and no database contact."""
from __future__ import annotations

import csv
import io
import json
from pathlib import Path
import tempfile
import unittest

import swlc_sam_drive_archive as exporter
from swlc_sam_archive_verify import verify_downloaded_archive

SECRET = "synthetic-test-passphrase-never-production"

def fixture_csv(rows):
    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    writer.writerow(["id","notice_id","version","checksum","snapshot","captured_at"])
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.archive = self.root/"sample.csv.gz.aesgcm"
        self.receipt = self.root/"sample.csv.gz.aesgcm.json"
        self.rows = [
            ["1","fictional-A","1","abc",json.dumps({"hello":"line1\nline2"}),"2026-09-28 09:00:00+00"],
            ["2","fictional-B","2","def",json.dumps({"amount":[1,2]}),"2026-09-30 08:00:00+00"],
        ]

    def write(self, records=None, recorded_count=None):
        records = self.rows if records is None else records
        raw = fixture_csv(records)
        digest, nbytes, encbytes = exporter.encrypted_csv_archive([raw],self.archive,SECRET)
        manifest = {
            "schema":"jhadina.swlc.sam-version-archive.v1",
            "sourceProject":exporter.PROJECT_REF,
            "sourceTable":"public.jhadina_sam_versions",
            "sourceTransaction":"REPEATABLE_READ_READ_ONLY",
            "archiveName":self.archive.name,
            "archiveEncrypted":True,
            "archiveFormat":"CSV-GZIP-AES256-GCM-SCRYPT",
            "sourcePostgresModified":False,
            "productionDeletionAuthorized":False,
            "retentionDecisionApproved":False,
            "isolatedPostgresRestoreVerified":False,
            "independentDriveDownloadSha256Verified":False,
            "sourceRowsCountedInTransaction":len(records) if recorded_count is None else recorded_count,
            "sourceCsvBytes":nbytes,
            "encryptedFileBytes":encbytes,
            "sourceCsvSha256":digest,
            "encryptedFileSha256":exporter.sha256_file(self.archive),
            "cutoffExclusive":"2026-10-01",
        }
        self.receipt.write_text(json.dumps(manifest),encoding="utf-8")
        return manifest

    def test_valid_synthetic_archive_keeps_production_gate_closed(self):
        self.write()
        result = verify_downloaded_archive(self.archive,self.receipt,SECRET)
        self.assertEqual(result["rowCount"],2)
        self.assertEqual(result["distinctArchiveIds"],2)
        self.assertTrue(result["gcmAuthenticationPassed"])
        self.assertFalse(result["canDeleteSupabaseRecords"])
        self.assertFalse(result["isolatedPostgresRestoreVerified"])

    def test_source_row_count_mismatch_blocks(self):
        self.write(self.rows[:1],recorded_count=2)
        with self.assertRaisesRegex(ValueError,"row count mismatch"):
            verify_downloaded_archive(self.archive,self.receipt,SECRET)

    def test_wrong_key_blocks(self):
        self.write()
        with self.assertRaises(Exception):
            verify_downloaded_archive(self.archive,self.receipt,"a-different-synthetic-password-test")

    def test_ciphertext_tampering_blocks(self):
        self.write()
        contents = bytearray(self.archive.read_bytes())
        contents[40] ^= 1
        self.archive.write_bytes(contents)
        with self.assertRaisesRegex(ValueError,"Ciphertext SHA-256 mismatch"):
            verify_downloaded_archive(self.archive,self.receipt,SECRET)

    def test_duplicate_ids_block(self):
        self.write([self.rows[0],self.rows[0]])
        with self.assertRaisesRegex(ValueError,"Duplicate archive record ID"):
            verify_downloaded_archive(self.archive,self.receipt,SECRET)

    def test_cutoff_violation_blocks(self):
        bad = list(self.rows[1])
        bad[-1] = "2026-10-02 08:00:00+00"
        self.write([self.rows[0],bad])
        with self.assertRaisesRegex(ValueError,"at or after exclusive cutoff"):
            verify_downloaded_archive(self.archive,self.receipt,SECRET)

    def test_forged_restore_approval_blocks(self):
        manifest = self.write()
        manifest["isolatedPostgresRestoreVerified"] = True
        self.receipt.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError,"Unsubstantiated restore flag"):
            verify_downloaded_archive(self.archive,self.receipt,SECRET)

    def test_wrong_source_and_supabase_pooler_validation(self):
        with self.assertRaises(ValueError):
            exporter.validate_source_dsn("postgresql://postgres:password@db.OTHER.supabase.co:5432/postgres")
        exporter.validate_source_dsn("postgresql://postgres:pw@db.kqbkaozfjubkjevdfvic.supabase.co:5432/postgres")
        exporter.validate_source_dsn("postgresql://postgres.kqbkaozfjubkjevdfvic:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres")

if __name__ == "__main__":
    unittest.main()
