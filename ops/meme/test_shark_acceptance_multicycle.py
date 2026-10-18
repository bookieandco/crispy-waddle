"""SHARK-LIVE.ACCEPT.12–.15 offline multi-cycle, recovery and send-only tests."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch

import shark_acceptance_multicycle as accept
import shark_live_intelligence as worker
import shark_live_commission as commission


class PublicMulticycleAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ledger = str(Path(self.tmp.name) / "not-created.sqlite3")

    def test_five_synthetic_cycles_recover_without_proving_live_alpha(self):
        proof = accept.rehearse()
        self.assertEqual(proof["schema"], accept.SCHEMA)
        self.assertEqual(proof["syntheticCyclesAcrossSeparateDatabaseOpens"], 5)
        self.assertEqual(proof["syntheticPriceOnlyMarks"], 1)
        self.assertEqual(proof["syntheticMissedOrCensored"], 1)
        self.assertTrue(proof["interruptedPendingCycleRolledBack"])
        self.assertTrue(proof["uncertainTelegramOutputNeverRetried"])
        self.assertTrue(proof["localSnapshotRestoreBeforeAndAfterVerified"])
        for field in ("publicMarketLiveDataUsed", "phonePrivateTelegramDeliveryVerified",
                      "providerIndependentAttestation", "marketAlphaOrProfitVerified",
                      "continuousProductionHostCommissioned", "offHostEncryptedRestoreVerified",
                      "telegramMessagesRead", "telegramMessageBasedAiTraining",
                      "canTrade", "canSign", "canBroadcast"):
            with self.subTest(field=field):
                self.assertIs(proof[field], False)

    def test_no_synthetic_rehearsal_network_calls_or_telegram_client(self):
        with patch.object(worker, "read_public_feeds",
                          side_effect=AssertionError("real feed called")):
            with patch.object(worker.public, "manual_read_public_mint",
                              side_effect=AssertionError("public rpc called")):
                with patch.object(worker, "_private_sender",
                                  side_effect=AssertionError("Telegram called")):
                    result = accept.rehearse()
        self.assertEqual(result["syntheticPriceOnlyMarks"], 1)

    def test_synthetic_fixture_has_public_only_incomplete_attribution(self):
        sample = accept.sample_public_dossier(
            accept.MINT_A, hours=0, price="0.001")
        checked = worker.paper.exact_public_dossier(sample)
        self.assertFalse(checked["sourcesCryptographicallyAttested"])
        self.assertFalse(checked["canTrade"])
        self.assertEqual(checked["classification"], "PUBLIC_MINT_RESEARCH_ONLY")
        for bad in (accept.WSOL, "/research-token " + accept.MINT_A):
            with self.assertRaisesRegex(ValueError, "fixture_outside"):
                accept.sample_public_dossier(bad, hours=0, price="0.001")
        with self.assertRaisesRegex(ValueError, "fixture_outside"):
            accept.sample_public_dossier(accept.MINT_A, hours=48, price="0.001")

    def test_rehearsal_cli_prints_no_mints_or_telegram_content(self):
        out = io.StringIO()
        with redirect_stdout(out):
            status = accept.main(["--mode", "synthetic-rehearsal"])
        self.assertEqual(status, 0)
        payload = json.loads(out.getvalue())
        self.assertEqual(payload["syntheticPriceOnlyMarks"], 1)
        for redacted in (accept.MINT_A, accept.MINT_B, accept.PAIR_A, "chat_id"):
            self.assertNotIn(redacted, out.getvalue())
        self.assertFalse(payload["phonePrivateTelegramDeliveryVerified"])

    def test_audit_rejects_nonexistent_and_never_creates_phantom_state(self):
        err = io.StringIO()
        with redirect_stderr(err):
            code = accept.main(["--mode", "audit-existing", "--state", self.ledger])
        self.assertEqual(code, 1)
        self.assertFalse(Path(self.ledger).exists())
        self.assertIn("FAIL_CLOSED", err.getvalue())

    def test_audit_private_existing_ledger_retains_readonly_study_data(self):
        with worker.local_database(self.ledger) as db:
            db.execute("INSERT INTO tokens(mint,first_discovered,last_seen) VALUES(?,?,?)",
                       (accept.MINT_A, accept.timestamp(0, seconds=7),
                        accept.timestamp(0, seconds=7)))
            db.commit()
        proof = accept.audit_owner_ledger(self.ledger)
        self.assertEqual(proof["publicMintCount"], 1)
        self.assertEqual(proof["priceOnlyPaperMarks"], 0)
        self.assertEqual(len(proof["localLedgerFingerprint"]), 64)
        self.assertFalse(proof["offHostEncryptedRestoreVerified"])
        self.assertNotIn(accept.MINT_A, json.dumps(proof))

    def test_audit_rejects_foreign_private_risk_data(self):
        with worker.local_database(self.ledger) as db:
            db.execute("""INSERT INTO tokens(mint,first_discovered,last_seen,risk_json)
                       VALUES(?,?,?,?)""",
                       (accept.MINT_A, accept.timestamp(0, seconds=7),
                        accept.timestamp(0, seconds=7), '["TELEGRAM_CHAT_CONTENT"]'))
            db.commit()
        with self.assertRaisesRegex(ValueError, "invalid_risk"):
            accept.audit_owner_ledger(self.ledger)

    def test_main_rejects_unsupported_modes_without_new_state(self):
        for args in (["--mode", "synthetic-rehearsal", "--state", self.ledger],
                     ["--mode", "audit-existing"]):
            with redirect_stderr(io.StringIO()):
                self.assertEqual(accept.main(args), 1)
        with self.assertRaises(SystemExit):
            accept.main(["--mode", "serve"])
        self.assertFalse(Path(self.ledger).exists())

    def test_private_owner_sender_only_calls_existing_send_function(self):
        root = str(Path(worker.__file__).resolve().parent.parent / "telegram")
        if root not in sys.path:
            sys.path.insert(0, root)
        import bot_research_once as bot
        calls = []
        with patch.dict(os.environ, {
            "ENABLE_SHARK_PUBLIC_ALERTS": "true",
            "TELEGRAM_BOT_TOKEN": "fake_not_real",
            "TELEGRAM_ALLOWED_USER_ID": "123456789",
        }, clear=True):
            with patch.object(bot, "send_private_preview",
                              side_effect=lambda token, uid, message:
                              calls.append((token, uid, message))):
                send = worker._private_sender()
                self.assertTrue(send("Synthetic PUBLIC-only research (NOT a trade alert)"))
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1], 123456789)
        self.assertEqual(calls[0][2],
                         "Synthetic PUBLIC-only research (NOT a trade alert)")
        # Source-only delivery gate; receipt on a real phone is NOT proven.
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "not_enabled"):
                worker._private_sender()

    def test_main_rejects_notify_without_host_grant(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(worker, "_private_sender", side_effect=AssertionError("unexpected")):
                with redirect_stderr(io.StringIO()):
                    result = worker.main(["--mode", "once", "--state", self.ledger,
                                          "--confirm", "PUBLIC-MARKET-RESEARCH-ONLY",
                                          "--notify"])
        self.assertEqual(result, 1)
        self.assertFalse(Path(self.ledger).exists())

    def test_duplicate_alert_delivery_is_not_retried_across_reopens(self):
        tmp_db = self.ledger
        fail_once = []
        first = accept._run_cycle(
            tmp_db, 0,
            lambda mint: accept.sample_public_dossier(
                mint, hours=0, price="0.001"),
            deliver=lambda body: (fail_once.append(body), False)[1])
        self.assertEqual(first["alertsAttempted"], 2)
        with worker.local_database(tmp_db) as db:
            delivery_status = db.execute(
                "SELECT DISTINCT delivery FROM outbox").fetchall()
            self.assertEqual(delivery_status, [("UNCERTAIN_NO_RETRY",)])
        # New process/open and no new risk category => no repeated send attempts
        second = accept._run_cycle(
            tmp_db, 3,
            lambda mint: accept.sample_public_dossier(
                mint, hours=3, price="0.002"),
            deliver=lambda body: (fail_once.append(body), True)[1])
        self.assertEqual(second["alertsAttempted"], 0)
        self.assertEqual(len(fail_once), 2)

    def test_corrupt_existing_ledger_fails_not_silent_repair(self):
        p = Path(self.ledger)
        p.write_bytes(b"Not a database")
        p.chmod(0o600)
        with self.assertRaises(sqlite3.DatabaseError):
            accept.audit_owner_ledger(str(p))


if __name__ == "__main__":
    unittest.main()
