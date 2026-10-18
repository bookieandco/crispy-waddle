"""Offline contract checks for SHARK's manual, zero-persistence public probe."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

import shark_ephemeral_once as case
import shark_live_intelligence as live


def receipt(*, new=1, checked=1, quarantined=0, opened=1,
            trade=False, telegram=False, attempted=0):
    return {
        "schema": live.SCHEMA,
        "newlyDiscovered": new,
        "checkedPublicMints": checked,
        "quarantined": quarantined,
        "alertsAttempted": attempted,
        "alertsAcknowledged": 0,
        "priceOnlyCasesGraded": 0,
        "canTrade": trade,
        "canSign": False,
        "canBroadcast": False,
        "telegramDataIngested": telegram,
        "providerEvidenceIndependentlyAttested": False,
        "continuousLatencyCertified": False,
        "paper": {
            "observedPublicTokens": new,
            "openProspectiveCases": opened,
            "calibratedEntryOrExitSignal": False,
            "actualProfitsVerified": False,
            "canTrade": False,
        },
    }


class EphemeralPublicAcceptanceTests(unittest.TestCase):
    def test_valid_first_public_dossier_is_only_partial_not_alpha(self):
        obj, code = case.classify(receipt(), 1.5)
        self.assertEqual(code, 0)
        self.assertEqual(obj["status"], "PARTIAL_PUBLIC_RESEARCH_RECEIVED_NOT_ALPHA")
        self.assertEqual(obj["freshProspectivePaperCases"], 1)
        self.assertFalse(obj["privateTelegramReadOrWrite"])
        self.assertFalse(obj["canTrade"])
        self.assertFalse(obj["publicProviderOriginCryptographicallyAttested"])
        self.assertFalse(obj["oneShotRepresentativeOfContinuousLatency"])
        self.assertTrue(obj["temporaryRunnerStateDeletedAtEnd"])

    def test_no_candidates_are_inconclusive_not_positive(self):
        obj, code = case.classify(receipt(new=0, checked=0, opened=0), 2)
        self.assertEqual(code, 2)
        self.assertEqual(obj["status"], "INCONCLUSIVE_NO_USABLE_PUBLIC_RESEARCH")

    def test_provider_evidence_quarantine_is_inconclusive(self):
        obj, code = case.classify(receipt(new=2, checked=2, quarantined=2, opened=0), 3)
        self.assertEqual(code, 2)
        self.assertEqual(obj["quarantinedEvidence"], 2)

    def test_no_trade_or_telegram_authority_escalation(self):
        for override in ({"trade": True}, {"telegram": True}, {"attempted": 1}):
            with self.subTest(override=override):
                with self.assertRaises(ValueError):
                    case.classify(receipt(**override), 1)

    def test_counters_and_paper_outcomes_cannot_be_forged(self):
        for rec in (
            receipt(new=live.MAX_NEW + 1),
            receipt(checked=live.MAX_CHECKS + 1),
            receipt(quarantined=2),
            receipt(opened=2),
            dict(receipt(), paper={"calibratedEntryOrExitSignal": True}),
            dict(receipt(), priceOnlyCasesGraded=1),
        ):
            with self.subTest(rec=rec):
                with self.assertRaises(ValueError):
                    case.classify(rec, 1)

    def test_consent_fails_before_child_process_runs(self):
        def forbidden(*args, **kwargs):
            self.fail("network runner must not start")
        for consent in ("", "YES", "PUBLIC-MARKET-RESEARCH-ONLY", case.CONFIRM + " "):
            with self.subTest(consent=consent):
                with self.assertRaisesRegex(ValueError, "consent_required"):
                    case.run_once(confirm=consent, runner=forbidden)

    def test_temp_state_deleted_and_child_has_no_secrets(self):
        seen = {}
        def fake_runner(argv, **kwargs):
            seen["argv"] = argv
            seen["env"] = kwargs["env"]
            seen["state_path"] = Path(argv[argv.index("--state") + 1])
            self.assertTrue(seen["state_path"].parent.is_dir())
            self.assertEqual(seen["state_path"].parent.stat().st_mode & 0o777, 0o700)
            self.assertNotIn("--notify", argv)
            self.assertNotIn("serve", argv)
            self.assertEqual(kwargs["timeout"], case.LIMIT_SECONDS)
            return subprocess.CompletedProcess(argv, 0, json.dumps(receipt()), "")
        timeline = iter((100.0, 101.2))
        with patch.dict(os.environ, {
            "TELEGRAM_BOT_TOKEN": "PRIVATE_SECRET",
            "TELEGRAM_ALLOWED_USER_ID": "12345",
            "ENABLE_SHARK_PUBLIC_ALERTS": "true",
            "SHARK_PUBLIC_HOST_COMMISSIONED": "true",
        }):
            out, code = case.run_once(
                confirm=case.CONFIRM, runner=fake_runner,
                clock=lambda: next(timeline))
        self.assertEqual(code, 0)
        self.assertFalse(seen["state_path"].parent.exists())
        self.assertNotIn("TELEGRAM_BOT_TOKEN", seen["env"])
        self.assertNotIn("TELEGRAM_ALLOWED_USER_ID", seen["env"])
        self.assertEqual(seen["env"]["ENABLE_SHARK_PUBLIC_ALERTS"], "false")
        self.assertEqual(seen["env"]["SHARK_PUBLIC_HOST_COMMISSIONED"], "false")
        self.assertNotIn("PRIVATE_SECRET", json.dumps(out))

    def test_nonzero_child_exit_never_echoes_secret_stderr(self):
        def fail(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 1, "",
                "secret token: NEVER_LOG_ME")
        with self.assertRaisesRegex(ValueError, "incomplete"):
            case.run_once(confirm=case.CONFIRM, runner=fail,
                          clock=lambda: 10)

    def test_malformed_payload_does_not_turn_green(self):
        def fake(text):
            return lambda argv, **kwargs: subprocess.CompletedProcess(argv, 0, text, "")
        for bad in ('{"schema":"WRONG"}', "totally invalid", '"SUCCESS"',
                    '{"canTrade":true}'):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    case.run_once(confirm=case.CONFIRM, runner=fake(bad),
                                  clock=lambda: 10)

    def test_child_timeout_fails_closed(self):
        def fail(*args, **kwargs):
            raise subprocess.TimeoutExpired(cmd="redacted", timeout=case.LIMIT_SECONDS)
        with self.assertRaisesRegex(ValueError, "failed_closed"):
            case.run_once(confirm=case.CONFIRM, runner=fail,
                          clock=lambda: 10)


if __name__ == "__main__":
    unittest.main()
