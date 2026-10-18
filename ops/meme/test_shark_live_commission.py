"""Commissioning gates: real SQLite backup and local restore; no network."""
from __future__ import annotations

import io
import json
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import public_mint_dossier as public
import shark_live_intelligence as worker
import shark_live_commission as commission

MINT = public.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
PAIR = public.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)
WSOL = "So11111111111111111111111111111111111111112"
START = "2026-10-17T23:58:00Z"
NOW = "2026-10-17T23:58:07Z"


def evidence():
    account = {"context": {"slot": 1245}, "value": {
        "owner": public.authority.LEGACY, "data": {"parsed": {"type": "mint", "info": {
            "supply": "900000000", "mintAuthority": None, "freezeAuthority": None,
        }}}}}
    pairs = [{"chainId": "solana", "pairAddress": PAIR,
              "baseToken": {"address": MINT}, "quoteToken": {"address": WSOL},
              "priceUsd": "0.003", "liquidity": {"usd": 15000},
              "dexId": "pumpswap", "pairCreatedAt": 1790000000000}]
    return public.compose_public_dossier(
        MINT, account=account, pairs=pairs,
        rpc_observed_at=START, rpc_available_at=START,
        market_observed_at=START, market_available_at=START,
        information_cutoff=START)


class PublicCommissioningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.dbpath = self.root / "observations.sqlite3"

    def populate(self, *, with_alerts=True):
        with worker.local_database(str(self.dbpath)) as db:
            result = worker.tick(db, now=NOW,
                profiles=[{"chainId": "solana", "tokenAddress": MINT}],
                boosts=[],
                read_dossier=lambda _: evidence(),
                deliver=(lambda body: True) if with_alerts else None)
            self.assertEqual(result["checkedPublicMints"], 1)

    def test_empty_ledger_local_restore_has_no_certified_public_provider(self):
        with worker.local_database(str(self.dbpath)) as db:
            evidence_result = commission.restore_drill(db)
        self.assertEqual(evidence_result["status"], "LOCAL_SNAPSHOT_RESTORE_PROVEN")
        self.assertEqual(evidence_result["sourceRecords"], 0)
        self.assertFalse(evidence_result["offHostEncryptedBackupVerified"])
        self.assertFalse(evidence_result["providerFeedVerified"])
        self.assertFalse(evidence_result["productionHostCommissioned"])
        self.assertFalse(evidence_result["privateTelegramDeliveryVerified"])
        self.assertFalse(evidence_result["canTrade"])

    def test_populated_snapshot_and_restored_copy_match(self):
        self.populate()
        with worker.local_database(str(self.dbpath)) as db:
            result = commission.restore_drill(db)
        self.assertEqual(result["sourceFingerprint"], result["restoredFingerprint"])
        self.assertEqual(result["sourceRecords"], 1)
        self.assertEqual(result["studiedOutcomes"], 0)
        self.assertNotIn(MINT, json.dumps(result))
        self.assertEqual(self.dbpath.stat().st_mode & 0o777, 0o600)

    def test_exclusive_local_backup_is_real_restorable_sqlite(self):
        self.populate()
        target = self.root / "backup.sqlite3"
        with worker.local_database(str(self.dbpath)) as db:
            before = commission.audit_db(db)["fingerprint"]
            commission._backup(db, target)
        self.assertTrue(target.exists())
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        with sqlite3.connect(str(target)) as restored:
            after = commission.audit_db(restored)["fingerprint"]
            self.assertEqual(before, after)
            self.assertEqual(restored.execute("SELECT COUNT(*) FROM tokens").fetchone()[0], 1)

    def test_never_overwrite_backup_or_follow_backup_symlinks(self):
        self.populate()
        target = self.root / "backup.sqlite3"
        target.write_text("original")
        target.chmod(0o600)
        with worker.local_database(str(self.dbpath)) as db:
            with self.assertRaisesRegex(ValueError, "overwrite"):
                commission._backup(db, target)
        self.assertEqual(target.read_text(), "original")
        link = self.root / "link.sqlite3"
        link.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "insecure"):
            commission._secure_file(str(link), must_exist=False)

    def test_insecure_parent_or_source_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = Path(tmp)
            parent.chmod(0o777)
            with self.assertRaisesRegex(ValueError, "insecure"):
                commission._secure_file(str(parent / "new.sqlite3"), must_exist=False)
        self.dbpath.write_bytes(b"")
        self.dbpath.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "insecure"):
            commission._secure_file(str(self.dbpath), must_exist=True)

    def test_corrupt_or_inconsistent_study_fails_restore_drill(self):
        self.populate()
        with worker.local_database(str(self.dbpath)) as db:
            db.execute("UPDATE tokens SET risk_json = ? WHERE mint=?", ('["FROM_PRIVATE_TELEGRAM"]', MINT))
            db.commit()
            with self.assertRaisesRegex(ValueError, "invalid_risk"):
                commission.restore_drill(db)

    def test_missing_state_does_not_create_phantom_database(self):
        with redirect_stderr(io.StringIO()) as sink:
            code = commission.main(["--mode", "recovery-drill", "--state", str(self.dbpath)])
        self.assertEqual(code, 1)
        self.assertFalse(self.dbpath.exists())
        self.assertIn("FAIL_CLOSED", sink.getvalue())

    def test_cli_drill_no_external_calls_or_private_identifiers(self):
        self.populate()
        out = io.StringIO()
        with patch.object(worker, "read_public_feeds", side_effect=AssertionError("NETWORK")):
            with patch.object(public, "manual_read_public_mint",
                              side_effect=AssertionError("NETWORK")):
                with redirect_stdout(out):
                    code = commission.main(["--mode", "recovery-drill",
                                            "--state", str(self.dbpath)])
        self.assertEqual(code, 0)
        report = json.loads(out.getvalue())
        self.assertEqual(report["sourceRecords"], 1)
        self.assertNotIn(MINT, out.getvalue())

    def test_notify_preflight_never_reads_messages_or_sends(self):
        with patch.dict(commission.os.environ, {}, clear=True):
            no = commission.notifications_ready(explicit_owner_ack=False)
        self.assertEqual(no["status"], "NOTIFICATION_DISABLED_OR_UNVERIFIED")
        self.assertFalse(no["messageSent"])
        with patch.dict(commission.os.environ, {
            "ENABLE_SHARK_PUBLIC_ALERTS": "true",
            "TELEGRAM_BOT_TOKEN": "do-not-print-secret",
            "TELEGRAM_ALLOWED_USER_ID": "12345678",
        }, clear=True):
            self.assertFalse(commission.notifications_ready(explicit_owner_ack=False)["enabledWithExplicitOwnerConsent"])
            yes = commission.notifications_ready(explicit_owner_ack=True)
            self.assertTrue(yes["enabledWithExplicitOwnerConsent"])
            self.assertFalse(yes["messageSent"])
            self.assertFalse(yes["chatInspected"])
            self.assertNotIn("12345678", json.dumps(yes))
            self.assertNotIn("do-not-print-secret", json.dumps(yes))

    def test_snapshot_validation_rejects_corrupt_sqlite(self):
        p = self.dbpath
        p.write_bytes(b"not sqlite")
        p.chmod(0o600)
        with sqlite3.connect(str(p)) as connection:
            with self.assertRaises(sqlite3.DatabaseError):
                commission.audit_db(connection)


if __name__ == "__main__":
    unittest.main()
