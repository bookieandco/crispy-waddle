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

    def test_isolated_postgres_restore_proves_temporary_schema_only(self):
        from swlc_sam_isolated_restore import isolated_local_restore
        self.write()
        result = isolated_local_restore(
            self.archive, self.receipt, SECRET,
            port=55432, username="postgres", password="synthetic-only-postgres",
        )
        self.assertEqual(result["restoredRows"],2)
        self.assertEqual(result["uniqueIds"],2)
        self.assertEqual(result["invalidOrOutsideCutoff"],0)
        self.assertTrue(result["localTempPostgresRestoreVerified"])
        self.assertFalse(result["productionRestoreVerified"])
        self.assertFalse(result["sourceDeletionAuthorized"])
        # After the transaction ends, no user-schema tables were persisted.
        from psycopg import connect
        with connect(host="127.0.0.1",port=55432,dbname="swlc_archive_sandbox",
                     user="postgres",password="synthetic-only-postgres") as conn:
            self.assertIsNone(conn.execute(
                "select to_regclass('public.swlc_sam_versions_sandbox')"
            ).fetchone()[0])

    def test_restore_denies_tampered_content_before_local_db_access(self):
        from swlc_sam_isolated_restore import isolated_local_restore
        self.write()
        blob=bytearray(self.archive.read_bytes())
        blob[-30] ^= 1
        self.archive.write_bytes(blob)
        with self.assertRaisesRegex(ValueError,"Ciphertext SHA-256 mismatch"):
            isolated_local_restore(
                self.archive,self.receipt,SECRET,
                port=55432,username="postgres",password="synthetic-only-postgres"
            )

    def test_restore_denies_invalid_local_port(self):
        from swlc_sam_isolated_restore import isolated_local_restore
        self.write()
        with self.assertRaisesRegex(ValueError,"Local port"):
            isolated_local_restore(self.archive,self.receipt,SECRET,port=0)


    def test_iphone_colab_notebook_cells_are_valid_and_have_no_saved_outputs(self):
        import ast
        import hashlib
        notebook_path = Path(__file__).with_name("SWLC_SAM_COLAB_IPHONE_FIXED_2026-10-12.ipynb")
        notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
        self.assertEqual(notebook["nbformat"], 4)
        cells = notebook["cells"]
        self.assertGreaterEqual(len(cells), 6)
        code_cells = [cell for cell in cells if cell["cell_type"] == "code"]
        source_code = "\\n".join("".join(cell["source"]) for cell in code_cells)
        self.assertIn("urlopen(SOURCE_ROOT + filename", source_code)
        self.assertIn("hashlib.sha256(source).hexdigest() != expected_hash", source_code)
        self.assertIn("DRIVE_FOLDER.is_dir()", source_code)
        self.assertNotIn("cryptography>=46,<47", source_code)
        self.assertNotIn("assert candidate.is_file()", source_code)
        for cell in code_cells:
            self.assertIsNone(cell["execution_count"])
            self.assertEqual(cell["outputs"], [])
            compile("".join(cell["source"]), "<safe-colab-cell>", "exec")
        for cell in cells:
            self.assertEqual(cell.get("metadata", {}), {})
        hashed = next(cell for cell in code_cells if "SOURCE_HASHES = {" in "".join(cell["source"]))
        module = ast.parse("".join(hashed["source"]))
        hash_assignment = next(
            stmt for stmt in module.body
            if isinstance(stmt, ast.Assign) and
            any(isinstance(t, ast.Name) and t.id == "SOURCE_HASHES" for t in stmt.targets)
        )
        approved_hashes = ast.literal_eval(hash_assignment.value)
        for filename, expected in approved_hashes.items():
            local = Path(__file__).with_name(filename)
            self.assertEqual(hashlib.sha256(local.read_bytes()).hexdigest(), expected)


if __name__ == "__main__":
    unittest.main()
