import os
from pathlib import Path
import tempfile
import unittest
import shark_live_intelligence as worker
import shark_attention_operator_audit as audit

AT = "2026-10-24T16:00:00Z"

class AttentionCommissionOperatorTest(unittest.TestCase):
    def test_existing_canonical_ledger_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "public.sqlite3")
            with worker.local_database(path) as db:
                db.execute("INSERT INTO cycles(available_at,receipt_digest,new_tokens,checked,graded) VALUES(?,?,?,?,?)",
                           ("2026-10-24T15:55:00Z", "a" * 64, 0, 0, 0))
                db.commit()
            stat_before = Path(path).stat()
            out = audit.inspect_existing_ledger(path, audit_at=AT)
            stat_after = Path(path).stat()
            self.assertEqual(out["cycleCount"], 1)
            self.assertEqual(out["lastCycleAt"], "2026-10-24T15:55:00Z")
            self.assertFalse(out["continuousHostCommissioned"])
            self.assertFalse(out["canTrade"])
            self.assertFalse(out["canNotify"])
            self.assertEqual(stat_before.st_size, stat_after.st_size)
            self.assertEqual(stat_before.st_mtime_ns, stat_after.st_mtime_ns)

    def test_missing_and_symlink_not_opened_or_created(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.sqlite3"
            with self.assertRaisesRegex(ValueError, "attention_existing_ledger_required"):
                audit.inspect_existing_ledger(str(source), audit_at=AT)
            self.assertFalse(source.exists())
            with worker.local_database(str(source)):
                pass
            linked = Path(directory) / "linked.sqlite3"
            linked.symlink_to(source)
            with self.assertRaisesRegex(ValueError, "attention_existing_ledger_required"):
                audit.inspect_existing_ledger(str(linked), audit_at=AT)

    def test_future_cycle_quarantined(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "public.sqlite3")
            with worker.local_database(path) as db:
                db.execute("INSERT INTO cycles(available_at,receipt_digest,new_tokens,checked,graded) VALUES(?,?,?,?,?)",
                           ("2026-10-25T17:00:00Z", "b" * 64, 0, 0, 0))
                db.commit()
            with self.assertRaisesRegex(ValueError, "attention_ledger_future_cycle"):
                audit.inspect_existing_ledger(path, audit_at=AT)

if __name__ == "__main__":
    unittest.main()
