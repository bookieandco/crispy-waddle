"""Offline RECOVER.03/.08: durable cursor, poison isolation, latency honesty."""
import os
from pathlib import Path
import sqlite3
import stat
import tempfile
import unittest

from telegram_listener_recovery_contract import (
    OwnerUpdateLedger, LatencyAcceptance,
)

FAKE = "f" * 64


class DurableReceipts(unittest.TestCase):
    def test_reopen_checkpoint_replay_and_conservative_gap(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "private" / "queue.sqlite"
            with OwnerUpdateLedger(path) as ledger:
                first = ledger.commit(5, FAKE, "DERIVED_RESEARCH_ONLY")
                self.assertTrue(first["accepted"])
                self.assertEqual(first["gap_before"], 5)
                self.assertFalse(first["canTrade"])
                self.assertEqual(ledger.commit(
                    5, FAKE, "DERIVED_RESEARCH_ONLY")["status"],
                    "DUPLICATE_OR_ALREADY_CHECKPOINTED")
                ledger.commit(6, FAKE, "QUARANTINED_INVALID")
                self.assertEqual(ledger.next_offset, 7)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(path.parent.stat().st_mode), 0o700)
            with OwnerUpdateLedger(path) as ledger:
                self.assertEqual(ledger.next_offset, 7)
                self.assertFalse(ledger.commit(6, FAKE, "EMPTY")["accepted"])
                self.assertEqual(ledger.conn.execute(
                    "SELECT COUNT(*) FROM updates").fetchone()[0], 2)

    def test_invalid_event_never_advances_and_no_raw_message_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            with OwnerUpdateLedger(Path(tmp) / "queue.sqlite") as ledger:
                for args in [(-1, FAKE, "EMPTY"), (True, FAKE, "EMPTY"),
                             (2, "private-chat", "EMPTY"),
                             (2, FAKE, "EXECUTE_TRADE")]:
                    with self.assertRaises(ValueError):
                        ledger.commit(*args)
                self.assertEqual(ledger.next_offset, 0)
                fields = [x[1] for x in ledger.conn.execute(
                    "PRAGMA table_info(updates)").fetchall()]
                self.assertEqual(fields, [
                    "update_id", "event_hmac", "disposition", "gap_before"])

    def test_symlinks_and_world_readable_database_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "safe.sqlite"
            with OwnerUpdateLedger(path):
                pass
            os.chmod(path, 0o644)
            with self.assertRaises(PermissionError):
                OwnerUpdateLedger(path)
            link = Path(tmp) / "alias.sqlite"
            link.symlink_to(path)
            with self.assertRaises(PermissionError):
                OwnerUpdateLedger(link)


class LatencyContracts(unittest.TestCase):
    def test_histogram_is_synthetic_not_live_certification(self):
        audit = LatencyAcceptance()
        for i in range(1, 101):
            audit.observe_synthetic("intake", 0, i)
        result = audit.report()
        stage = result["p50_p95_p99_ms"]["intake"]
        self.assertEqual((stage["p50"], stage["p95"], stage["p99"]),
                         (50, 95, 99))
        self.assertEqual(result["status"],
                         "SYNTHETIC_ONLY_NO_LIVE_LATENCY_CERTIFICATION")
        self.assertFalse(result["canClaim600msLive"])
        self.assertFalse(result["canTrade"])

    def test_untrusted_and_nonmonotonic_receipts_rejected(self):
        audit = LatencyAcceptance(max_receipts=1)
        for args in [("model", 0, 1), ("intake", 10, 0),
                     ("intake", float("nan"), 3)]:
            with self.assertRaises(ValueError):
                audit.observe_synthetic(*args)
        audit.observe_synthetic("intake", 1, 2)
        with self.assertRaises(ValueError):
            audit.observe_synthetic("intake", 2, 3)
        self.assertEqual(audit.report()["invalid_receipts"], 4)


if __name__ == "__main__":
    unittest.main()
