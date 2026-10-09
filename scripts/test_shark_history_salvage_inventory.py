"""Read-only historical discovery: artifacts never certify recovered data."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import shark_history_salvage_inventory as salvage


class SalvageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "candidate"
        self.root.mkdir()

    def test_postgres_magic_is_only_unverified_candidate(self):
        dump = self.root / "shadow-postgres.dump"
        dump.write_bytes(b"PGDMP" + b"test bytes not real historical data")
        before = dump.read_bytes()
        r = salvage.inventory(self.root)
        self.assertEqual(len(r["entries"]), 1)
        self.assertEqual(r["entries"][0]["kind"], "ORIGINAL_DB_CANDIDATE")
        self.assertFalse(r["entries"][0]["originalProvenanceVerified"])
        self.assertFalse(r["originalLedgerRecovered"])
        self.assertFalse(r["writeOperationsPerformed"])
        self.assertEqual(dump.read_bytes(), before)

    def test_fake_pg_dump_header_is_not_original(self):
        dump = self.root / "shadow-postgres.dump"
        dump.write_bytes(b"NOT_PGDMP")
        r = salvage.inventory(self.root)
        self.assertEqual(r["entries"][0]["kind"], "HANDOFF")

    def test_synthetic_canary_cannot_be_recovered_original(self):
        dump = self.root / "shadow-synthetic-postgres.dump"
        dump.write_bytes(b"PGDMP" + b"synthetic")
        self.assertEqual(salvage.inventory(self.root)["entries"][0]["kind"],
                         "SYNTHETIC")

    def test_historical_market_export_is_not_original_shadow_ledger(self):
        f = self.root / "market-archive.csv"
        f.write_bytes(b"mint,observed_at,price\na,2026-01-01,1\n")
        self.assertEqual(salvage.inventory(self.root)["entries"][0]["kind"],
                         "MARKET_ARCHIVE")

    def test_paths_and_file_names_are_never_emitted(self):
        f = self.root / "private-client-name-shadow.jsonl"
        f.write_text('{"test_only": true}')
        report = salvage.inventory(self.root)
        as_text = str(report)
        self.assertNotIn(str(self.root), as_text)
        self.assertNotIn(f.name, as_text)
        self.assertFalse(report["entries"][0]["mayUpdateForwardLearning"])
        self.assertFalse(report["entries"][0]["canAuthorizeLive"])

    def test_symlinked_file_and_directory_are_excluded(self):
        outside = Path(self.tmp.name) / "outside.jsonl"
        outside.write_text("private")
        (self.root / "linked.jsonl").symlink_to(outside)
        nested = Path(self.tmp.name) / "outside-dir"
        nested.mkdir()
        (nested / "archive.dump").write_bytes(b"PGDMP" + b"private")
        (self.root / "linked-dir").symlink_to(nested, target_is_directory=True)
        self.assertEqual(salvage.inventory(self.root)["entries"], [])

    def test_invalid_root_refused(self):
        with self.assertRaises(salvage.SalvageInventoryError):
            salvage.inventory(Path("/"))
        alias = Path(self.tmp.name) / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(salvage.SalvageInventoryError):
            salvage.inventory(alias)

    def test_existing_private_receipt_never_overwritten(self):
        file = self.root / "shadow.dump"
        file.write_bytes(b"PGDMPtest")
        out = Path(self.tmp.name) / "audit.json"
        out.write_text("original receipt")
        with patch("sys.argv", ["salvage", "--root", str(self.root),
                                "--out", str(out)]):
            self.assertEqual(salvage.main(), 2)
        self.assertEqual(out.read_text(), "original receipt")

    def test_private_receipt_created_with_restrictive_permissions(self):
        (self.root / "shadow.dump").write_bytes(b"PGDMPtest")
        out = Path(self.tmp.name) / "new-audit.json"
        with patch("sys.argv", ["salvage", "--root", str(self.root),
                                "--out", str(out)]):
            self.assertEqual(salvage.main(), 0)
        self.assertEqual(os.stat(out).st_mode & 0o077, 0)

    def test_limits_fail_closed_before_large_read(self):
        large = self.root / "too-large.dump"
        large.write_bytes(b"PGDMPtest")
        with patch.object(salvage, "MAX_TOTAL_BYTES", 4):
            with self.assertRaisesRegex(salvage.SalvageInventoryError,
                                        "TOTAL_BYTE_LIMIT_REACHED"):
                salvage.inventory(self.root)


if __name__ == "__main__":
    unittest.main()
