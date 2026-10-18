"""SHARK final commissioning: protected operator receipts, no network/test sends."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

import shark_final_commission as final
import shark_live_intelligence as worker
import shark_acceptance_multicycle as synthetic
import shark_host_acceptance as host

BOOT_FIRST = "11111111-1111-4111-8111-111111111111"
BOOT_NEXT = "22222222-2222-4222-8222-222222222222"


class FinalCommissionGatesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root.chmod(0o700)
        self.db = str(self.root / "observations.sqlite3")
        self.baseline = str(self.root / "pre-restart.json")
        self.ready = {
            "isolatedOwnerPrivateDirectory": True,
            "nonRootIdentity": True,
            "dedicatedMountObserved": True,
            "freeSpaceThresholdMet": True,
            "explicitHostCommissioningGrant": True,
        }

    def create_state(self):
        with worker.local_database(self.db):
            pass

    def boot_baseline(self):
        self.create_state()
        with patch.object(host, "host_status", return_value=self.ready), \
             patch.object(final, "_boot_id", return_value=BOOT_FIRST):
            return final.record_before_restart(
                self.db, self.baseline, final.RESTART_CONFIRM)

    def test_default_preflight_never_equates_flag_to_commissioning(self):
        with patch.object(host, "host_status", return_value=self.ready):
            x = final.host_review(str(self.root))
        self.assertEqual(x["status"], "LOCAL_HOST_REVIEW_ONLY_NO_PRODUCTION_APPROVAL")
        self.assertTrue(x["operatorGrantFlagPresent"])
        for key in ("ownerCostApprovalVerified","encryptedOffHostRestoreVerified",
                    "hostRebootContinuityProven","ownerPhoneAlertReadbackVerified",
                    "commissioned", "canTrade"):
            self.assertFalse(x[key])

    def test_restart_baseline_without_consent_refuses_to_create_file(self):
        self.create_state()
        with patch.object(host, "host_status", return_value=self.ready):
            with self.assertRaisesRegex(ValueError, "confirmation_required"):
                final.record_before_restart(self.db, self.baseline, "YES")
        self.assertFalse(Path(self.baseline).exists())

    def test_restart_baseline_rejects_unapproved_host_even_with_consent(self):
        self.create_state()
        not_ready = dict(self.ready, dedicatedMountObserved=False)
        with patch.object(host, "host_status", return_value=not_ready):
            with self.assertRaisesRegex(ValueError, "not_ready"):
                final.record_before_restart(self.db, self.baseline, final.RESTART_CONFIRM)
        self.assertFalse(Path(self.baseline).exists())

    def test_boot_change_and_real_sqlite_same_ledger_proves_local_continuity(self):
        first = self.boot_baseline()
        self.assertEqual(first["status"], "OWNER_PRIVATE_RESTART_BASELINE_RECORDED")
        self.assertFalse(first["newHostBootObserved"])
        self.assertEqual(Path(self.baseline).stat().st_mode & 0o777, 0o600)
        with patch.object(host, "host_status", return_value=self.ready), \
             patch.object(final, "_boot_id", return_value=BOOT_NEXT):
            result = final.review_after_restart(self.db, self.baseline)
        self.assertTrue(result["localLedgerContinuityObserved"])
        self.assertFalse(result["encryptedOffHostRestoreVerified"])
        self.assertFalse(result["continuousServiceCommissioned"])
        self.assertFalse(result["ownerPhoneAlertReadbackVerified"])
        self.assertFalse(result["canTrade"])

    def test_same_os_boot_cannot_claim_reboot_and_overwrite_is_forbidden(self):
        self.boot_baseline()
        with patch.object(host,"host_status",return_value=self.ready), \
             patch.object(final,"_boot_id",return_value=BOOT_FIRST):
            with self.assertRaisesRegex(ValueError,"no_distinct"):
                final.review_after_restart(self.db,self.baseline)
            with self.assertRaisesRegex(ValueError,"overwrite"):
                final.record_before_restart(self.db,self.baseline,final.RESTART_CONFIRM)

    def test_restart_receipt_tamper_or_database_mutation_fails(self):
        self.boot_baseline()
        receipt = json.loads(Path(self.baseline).read_text())
        receipt["stateFingerprint"] = "f" * 64
        Path(self.baseline).write_text(json.dumps(receipt))
        with patch.object(host,"host_status",return_value=self.ready), \
             patch.object(final,"_boot_id",return_value=BOOT_NEXT):
            with self.assertRaisesRegex(ValueError,"fingerprint_changed"):
                final.review_after_restart(self.db,self.baseline)
        receipt["bootId"] = "illegal ID"
        Path(self.baseline).write_text(json.dumps(receipt))
        with patch.object(host,"host_status",return_value=self.ready), \
             patch.object(final,"_boot_id",return_value=BOOT_NEXT):
            with self.assertRaisesRegex(ValueError,"receipt_invalid"):
                final.review_after_restart(self.db,self.baseline)

    def test_restart_receipt_cannot_be_written_outside_same_mount(self):
        self.create_state()
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(host,"host_status",return_value=self.ready):
            with self.assertRaisesRegex(ValueError,"same_private_volume"):
                final.record_before_restart(
                    self.db,str(Path(tmp)/"outside.json"),final.RESTART_CONFIRM)

    def test_existing_ledger_only_empty_paper_review_reports_no_outcomes(self):
        self.create_state()
        p=final.paper_review(self.db)
        self.assertEqual(p["status"], "NO_LOCAL_PROSPECTIVE_24H_MARKS")
        self.assertEqual(p["locallyConsistent24To30hPriceOnlyMarks"],0)
        self.assertFalse(p["historicalSyntheticCasesRuledOut"])
        self.assertFalse(p["providerEvidenceIndependentlyAttested"])
        self.assertFalse(p["calibratedProfitableAlphaVerified"])

    def test_synthetic_24hour_mark_is_labelled_unattested_not_profitable(self):
        synthetic._run_cycle(self.db,0,lambda mint:
            synthetic.sample_public_dossier(mint,hours=0,price="0.001"))
        synthetic._run_cycle(self.db,24,lambda mint:
            synthetic.sample_public_dossier(mint,hours=24,price="0.0012"))
        p=final.paper_review(self.db)
        self.assertEqual(p["locallyConsistent24To30hPriceOnlyMarks"],2)
        self.assertEqual(p["status"],"LOCAL_PAPER_RECEIPTS_UNATTESTED")
        self.assertFalse(p["historicalSyntheticCasesRuledOut"])
        self.assertFalse(p["providerEvidenceIndependentlyAttested"])
        self.assertFalse(p["executableReturnsVerified"])

    def test_deliberately_backdated_mark_without_matching_cycle_refused(self):
        synthetic._run_cycle(self.db,0,lambda mint:
            synthetic.sample_public_dossier(mint,hours=0,price="0.001"))
        synthetic._run_cycle(self.db,24,lambda mint:
            synthetic.sample_public_dossier(mint,hours=24,price="0.0012"))
        with worker.local_database(self.db) as db:
            db.execute("UPDATE cycles SET available_at=? WHERE new_tokens=0",
                       (synthetic.timestamp(3, seconds=7),))
            db.commit()
        with self.assertRaisesRegex(ValueError,"missing_prospective_cycle"):
            final.paper_review(self.db)

    def test_output_review_is_send_free_even_if_alerts_exist(self):
        synthetic._run_cycle(self.db,0,lambda mint:
            synthetic.sample_public_dossier(mint,hours=0,price="0.001"),
            deliver=lambda _: True)
        with patch.object(worker,"_private_sender",side_effect=AssertionError("no bot")), \
             patch.object(worker,"read_public_feeds",side_effect=AssertionError("no public")):
            p=final.alert_review(self.db)
        self.assertEqual(p["senderAcknowledgedRecords"],2)
        self.assertFalse(p["ownerPhoneAlertReadbackVerified"])
        self.assertFalse(p["notificationsSentByThisAudit"])
        self.assertFalse(p["telegramMessagesRead"])
        self.assertNotIn(synthetic.MINT_A,json.dumps(p))

    def test_existing_state_is_required_no_phantom_ledger_or_telegram_activity(self):
        with redirect_stderr(io.StringIO()) as error:
            self.assertEqual(final.main(["--mode","paper-review","--state",self.db]),1)
        self.assertFalse(Path(self.db).exists())
        self.assertIn("FAIL_CLOSED",error.getvalue())

    def test_cli_readback_never_claims_host_or_contacted_phone(self):
        self.create_state()
        out=io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(final.main(["--mode","alert-review","--state",self.db]),0)
        result=json.loads(out.getvalue())
        self.assertFalse(result["ownerPhoneAlertReadbackVerified"])
        self.assertFalse(result["notificationsSentByThisAudit"])
        self.assertFalse(result["canTrade"])


if __name__=="__main__":
    unittest.main()
