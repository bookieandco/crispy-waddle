"""Hermetic CLOUD.COMMISSION.06–.10 tests. Never contacts Telegram or a host."""
import asyncio
import copy
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import cloud_commissioning as commission
import cloud_personal_listener as cloud
import telegram_intake as intake


def evidence():
    return json.loads(Path(commission.__file__).with_name(
        "cloud_commission_evidence.json").read_text(encoding="utf-8"))


class CloudCommissioningTests(unittest.TestCase):
    def test_source_manifest_is_not_an_external_host_or_release_attestation(self):
        report = commission.source_only_contract(evidence())
        self.assertEqual(report["status"], "SOURCE_ONLY_NOT_COMMISSIONED")
        self.assertFalse(report["external_evidence_verified"])
        for key in ("canDeploy", "canReadTelegram", "canUseForModel",
                    "canTrade", "canSign", "canSpend"):
            self.assertIs(report[key], False)

    def test_false_external_certification_and_permissions_are_rejected(self):
        original = evidence()
        for key in commission.EXTERNAL:
            case = copy.deepcopy(original)
            case["external"][key] = "VERIFIED"
            with self.subTest(key=key), self.assertRaises(commission.CommissionHold):
                commission.source_only_contract(case)
        for key in original["permissions"]:
            case = copy.deepcopy(original)
            case["permissions"][key] = True
            with self.subTest(key=key), self.assertRaises(commission.CommissionHold):
                commission.source_only_contract(case)
        case = copy.deepcopy(original)
        case["mode"] = "LIVE"
        with self.assertRaises(commission.CommissionHold):
            commission.source_only_contract(case)
        case = copy.deepcopy(original)
        case["host_token"] = "sensitive-should-not-print"
        with self.assertRaises(commission.CommissionHold):
            commission.source_only_contract(case)

    def test_release_cannot_be_authorized_by_source_checks(self):
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(commission.main(["--mode", "source"]), 0)
            self.assertEqual(commission.main(["--mode", "release"]), 1)
        self.assertIn("SOURCE_ONLY_NOT_COMMISSIONED", out.getvalue())
        self.assertIn("REQUIRES_REAL_HOST_AND_OWNER_CERTIFICATION", out.getvalue())
        self.assertNotIn("COMMISSIONED_LIVE", out.getvalue())

    def test_metrics_only_bounded_local_processing_durations(self):
        metric = commission.EphemeralHandlerMetrics(capacity=16, emit_every=16)
        for i in range(1, 16):
            self.assertEqual(metric.add(i * 1_000_000, i * 1_000_000 + 2_000_000), "")
        public = metric.add(16_000_000, 18_000_000)
        self.assertIn("N=16", public)
        self.assertIn("P99_MS=2.000", public)
        self.assertIn("NO_END_TO_END_OR_600MS_CERTIFICATION", public)
        for forbidden in ("chat_id", "token_address", "message", "telegram_user_id"):
            self.assertNotIn(forbidden, public)
        self.assertEqual(len(metric.samples), 16)
        for i in range(100):
            metric.add(i, i + 100)
        self.assertEqual(len(metric.samples), 16)

    def test_bad_or_fabricated_monotonic_span_rejected(self):
        obj = commission.EphemeralHandlerMetrics()
        for begin, end in ((2, 1), (-1, 9), (1, 30_000_000_002),
                           (True, 1), (1.0, 2)):
            with self.subTest(begin=begin, end=end), self.assertRaises(ValueError):
                obj.add(begin, end)
        for config in ((0, 16), (1, 16), (1025, 16), (16, 0),
                       (16, True), (16, 10001)):
            with self.assertRaises(ValueError):
                commission.EphemeralHandlerMetrics(*config)

    def test_owner_enrollment_rejects_existing_session_and_never_logs_in(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "owner.session").write_text("fictional test only")
            with patch.object(cloud, "assert_cloud_environment", return_value=root):
                with patch.dict(os.environ, {"TELEGRAM_CLOUD_ENROLL_APPROVED": "YES"}, clear=True):
                    with patch.object(sys.stdin, "isatty", return_value=True):
                        with patch.object(cloud, "enroll") as remote:
                            with contextlib.redirect_stdout(io.StringIO()) as output:
                                self.assertEqual(cloud.main(["enroll"]), 1)
                            remote.assert_not_called()
                            self.assertIn("EXISTING_SESSION", output.getvalue())

    def test_owner_enrollment_acquires_and_releases_exclusive_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(cloud, "assert_cloud_environment", return_value=root):
                with patch.dict(os.environ, {"TELEGRAM_CLOUD_ENROLL_APPROVED": "YES"}, clear=True):
                    with patch.object(sys.stdin, "isatty", return_value=True):
                        with patch.object(cloud, "enroll", new_callable=AsyncMock) as enrollment:
                            with contextlib.redirect_stdout(io.StringIO()):
                                self.assertEqual(cloud.main(["enroll"]), 0)
                            enrollment.assert_called_once()
                            self.assertTrue((root / "telegram-worker.lock").exists())
                            self.assertEqual((root / "telegram-worker.lock").stat().st_mode & 0o777, 0o600)

    def test_owner_enrollment_fails_when_another_process_holds_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(cloud, "assert_cloud_environment", return_value=root):
                with patch.dict(os.environ, {"TELEGRAM_CLOUD_ENROLL_APPROVED": "YES"}, clear=True):
                    with patch.object(sys.stdin, "isatty", return_value=True):
                        with patch.object(cloud, "exclusive_worker_lock",
                                          side_effect=BlockingIOError):
                            with patch.object(cloud, "enroll") as enrollment:
                                with contextlib.redirect_stdout(io.StringIO()) as log:
                                    self.assertEqual(cloud.main(["enroll"]), 1)
                                enrollment.assert_not_called()
                                self.assertIn("OTHER_READER_ACTIVE", log.getvalue())

    def test_owner_private_chat_exclusions_are_bounded_and_never_echoed(self):
        self.assertEqual(cloud.parse_private_exclusions(""), [])
        self.assertEqual(cloud.parse_private_exclusions(
            "@unrelatedChat,-1001234567890"), ["@unrelatedChat", "-1001234567890"])
        for raw in ("@short", "@private, @other", "@private,@private",
                    "abc", ";@", "@" + "q" * 100, "1,2," * 50):
            with self.subTest(raw=raw):
                with self.assertRaises(cloud.CloudHold) as caught:
                    cloud.parse_private_exclusions(raw)
                self.assertNotIn(raw, str(caught.exception))

    def test_reconnect_detects_revocation_before_owner_id_or_retry(self):
        class FakeClient:
            def __init__(self):
                self.owner_queries = 0
                self.auth_queries = 0
            async def run_until_disconnected(self):
                raise ConnectionError("private mock transport error")
            async def connect(self):
                return None
            async def is_user_authorized(self):
                self.auth_queries += 1
                return False
            async def get_me(self):
                self.owner_queries += 1
                raise AssertionError("revoked client must not fetch identity")

        client = FakeClient()
        with patch.dict(os.environ, {"TELEGRAM_CLOUD_NONINTERACTIVE": "1"}, clear=True):
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(SystemExit, "REVOKED_OR_EXPIRED_STOP"):
                    asyncio.run(intake.supervise_personal_connection(
                        client, "123", sleeper=lambda _: asyncio.sleep(0),
                        backoff_seconds=(1,)))
        self.assertEqual(client.auth_queries, 1)
        self.assertEqual(client.owner_queries, 0)

    def test_existing_bot_one_shot_and_public_only_research_remain_separate(self):
        with self.assertRaisesRegex(SystemExit, "SINGLE_OWNER_REQUIRED"):
            intake.forwarded_bot(Path("/tmp/not-used"), "")
        observation = intake.ephemeral_crypto_observation(
            "CA So11111111111111111111111111111111111111112")
        self.assertNotIn("token_address", observation)
        self.assertNotIn("sender", observation)
        self.assertNotIn("canTrade", observation)


if __name__ == "__main__":
    unittest.main()
