"""TELEGRAM-LIVE.11 offline transport/recovery and operator status checks.

No real Telegram network, credentials, or inbox content.
"""
from __future__ import annotations

import asyncio
import contextlib
import fcntl
import io
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

import telegram_intake as mod

OWNER = "12345678"
CONFIDENTIAL = "NEVER_PRINT_PRIVATE_MESSAGE_OR_API_HASH"


class FakeConnection:
    def __init__(self, outcomes, *, reconnect_errors=(), user_id=12345678):
        self.outcomes = list(outcomes)
        self.reconnect_errors = list(reconnect_errors)
        self.user_id = user_id
        self.connected = 0
        self.me_calls = 0
        self.wait_calls = 0

    async def run_until_disconnected(self):
        self.wait_calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    async def connect(self):
        self.connected += 1
        if self.reconnect_errors:
            failure = self.reconnect_errors.pop(0)
            if failure is not None:
                raise failure

    async def get_me(self):
        self.me_calls += 1
        return types.SimpleNamespace(id=self.user_id, bot=False)


class ReconnectTests(unittest.IsolatedAsyncioTestCase):
    async def test_first_transport_failure_recovers_with_owner_recheck(self):
        client = FakeConnection([OSError(CONFIDENTIAL), None])
        paused = []
        with contextlib.redirect_stdout(io.StringIO()) as stream:
            success = await mod.supervise_personal_connection(
                client, OWNER, sleeper=lambda seconds: _sleep_record(paused, seconds),
                backoff_seconds=(2, 5))
        self.assertTrue(success)
        self.assertEqual(paused, [2])
        self.assertEqual(client.connected, 1)
        self.assertEqual(client.me_calls, 1)
        self.assertEqual(client.wait_calls, 2)
        public = stream.getvalue()
        self.assertIn("TELEGRAM_CONNECTION_RECOVERED_OWNER_VERIFIED", public)
        self.assertIn("TELEGRAM_LOCAL_LISTENER_STOPPED", public)
        self.assertNotIn(CONFIDENTIAL, public)
        self.assertNotIn(OWNER, public)

    async def test_repeated_transport_failures_stop_after_bounded_attempts(self):
        client = FakeConnection([ConnectionError(CONFIDENTIAL)],
                                reconnect_errors=[OSError(CONFIDENTIAL)] * 3)
        paused = []
        with contextlib.redirect_stdout(io.StringIO()) as stream:
            with self.assertRaisesRegex(SystemExit, "TELEGRAM_LOCAL_LISTENER_OFFLINE"):
                await mod.supervise_personal_connection(
                    client, OWNER, sleeper=lambda seconds: _sleep_record(paused, seconds),
                    backoff_seconds=(2, 5, 15))
        self.assertEqual(client.connected, 3)
        self.assertEqual(paused, [2, 5, 15])
        self.assertIn("TELEGRAM_RECONNECT_EXHAUSTED_NO_HISTORY_REPLAY", stream.getvalue())
        self.assertNotIn(CONFIDENTIAL, stream.getvalue())

    async def test_transport_can_drop_again_after_reconnection(self):
        client = FakeConnection([TimeoutError("secret"), ConnectionError("secret"), None])
        paused = []
        with contextlib.redirect_stdout(io.StringIO()) as stream:
            self.assertTrue(await mod.supervise_personal_connection(
                client, OWNER, sleeper=lambda seconds: _sleep_record(paused, seconds),
                backoff_seconds=(2, 5, 15)))
        self.assertEqual(paused, [2, 5])
        self.assertEqual(client.me_calls, 2)
        self.assertEqual(stream.getvalue().count("TELEGRAM_CONNECTION_INTERRUPTED"), 2)

    async def test_identity_mismatch_is_never_silently_repaired(self):
        client = FakeConnection([OSError("private"), None], user_id=999)
        paused = []
        with contextlib.redirect_stdout(io.StringIO()) as stream:
            with self.assertRaisesRegex(SystemExit, "ACCOUNT_ID_MISMATCH"):
                await mod.supervise_personal_connection(
                    client, OWNER, sleeper=lambda seconds: _sleep_record(paused, seconds),
                    backoff_seconds=(2, 5))
        self.assertEqual(client.connected, 1)
        self.assertEqual(client.wait_calls, 1)
        self.assertNotIn("RECOVERED_OWNER_VERIFIED", stream.getvalue())

    async def test_intentional_stop_never_reconnects(self):
        client = FakeConnection([None])
        with contextlib.redirect_stdout(io.StringIO()) as stream:
            self.assertTrue(await mod.supervise_personal_connection(
                client, OWNER, backoff_seconds=(2, 5)))
        self.assertEqual(client.connected, 0)
        self.assertEqual(client.me_calls, 0)
        self.assertIn("TELEGRAM_LOCAL_LISTENER_STOPPED", stream.getvalue())

    async def test_cancelled_task_does_not_reconnect(self):
        client = FakeConnection([asyncio.CancelledError()])
        with self.assertRaises(asyncio.CancelledError):
            await mod.supervise_personal_connection(client, OWNER)
        self.assertEqual(client.connected, 0)

    async def test_bad_retry_policy_stops_safely(self):
        client = FakeConnection([OSError("secret")])
        with contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(ValueError, "INVALID_RECONNECT_POLICY"):
                await mod.supervise_personal_connection(
                    client, OWNER, backoff_seconds=(0,))


async def _sleep_record(output, seconds):
    output.append(seconds)


class OperatorStatusTests(unittest.TestCase):
    def test_missing_root_no_session_no_network(self):
        with tempfile.TemporaryDirectory() as scratch:
            target = Path(scratch) / "missing"
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(
                    mod.safe_operator_status(target),
                    "TELEGRAM_SESSION_ABSENT LOCAL_WORKER_LOCK_FREE NETWORK_NOT_CHECKED")
            self.assertFalse(target.exists())

    def test_secure_session_presence_without_reading_session(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            os.chmod(root, 0o700)
            session = root / "owner.session"
            session.write_text(CONFIDENTIAL)
            os.chmod(session, 0o600)
            with patch.dict(os.environ, {}, clear=True):
                result = mod.safe_operator_status(root)
            self.assertEqual(result,
                "TELEGRAM_SESSION_PRESENT LOCAL_WORKER_LOCK_FREE NETWORK_NOT_CHECKED")
            self.assertNotIn(CONFIDENTIAL, result)
            self.assertNotIn(str(root), result)

    def test_advisory_lock_distinguishes_held_from_unheld_without_claiming_network(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            os.chmod(root, 0o700)
            # Model a trusted local Mac, without disabling the runtime CI gate.
            with patch.dict(os.environ, {}, clear=True):
                fd = mod.exclusive_worker_lock(root)
                try:
                    self.assertIn("LOCAL_WORKER_LOCK_HELD", mod.safe_operator_status(root))
                    self.assertIn("NETWORK_NOT_CHECKED", mod.safe_operator_status(root))
                finally:
                    os.close(fd)
                self.assertIn("LOCAL_WORKER_LOCK_FREE", mod.safe_operator_status(root))

    def test_insecure_session_or_dir_or_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch) / "session"
            root.mkdir(mode=0o700)
            session = root / "owner.session"
            session.touch(mode=0o600)
            with patch.dict(os.environ, {}, clear=True):
                os.chmod(session, 0o644)
                with self.assertRaises(PermissionError):
                    mod.safe_operator_status(root)
                os.chmod(session, 0o600)
                os.chmod(root, 0o755)
                with self.assertRaises(PermissionError):
                    mod.safe_operator_status(root)
                os.chmod(root, 0o700)
                link = Path(scratch) / "link"
                link.symlink_to(root, target_is_directory=True)
                with self.assertRaises(PermissionError):
                    mod.safe_operator_status(link)
                (root / "telegram-worker.lock").symlink_to(session)
                with self.assertRaises(PermissionError):
                    mod.safe_operator_status(root)

    def test_cloud_runner_refuses_session_status(self):
        with tempfile.TemporaryDirectory() as scratch:
            with patch.dict(os.environ, {"GITHUB_ACTIONS": "true"}, clear=True):
                with self.assertRaises(SystemExit):
                    mod.safe_operator_status(Path(scratch))

    def test_operator_cli_requires_no_api_or_hmac_credentials(self):
        with tempfile.TemporaryDirectory() as scratch:
            with patch.dict(os.environ, {"TELEGRAM_PRIVATE_DIR": scratch}, clear=True):
                with patch.object(sys, "argv", ["telegram_intake.py", "operator-status"]):
                    with contextlib.redirect_stdout(io.StringIO()) as stream:
                        mod.main()
            self.assertIn("NETWORK_NOT_CHECKED", stream.getvalue())
            self.assertNotIn(CONFIDENTIAL, stream.getvalue())


if __name__ == "__main__":
    unittest.main()
