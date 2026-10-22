"""Offline CLOUD.01–.05 gates; no Telegram credentials, sockets or paid hosts."""
import asyncio
import contextlib
import io
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import cloud_personal_listener as cloud
import telegram_intake as intake


class CloudIndependenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.mount = Path(self.tmp.name) / "persistent-volume"
        self.root = self.mount / "private"
        self.root.mkdir(parents=True, mode=0o700)
        self.root.chmod(0o700)
        self.env = {
            "TELEGRAM_API_ID": "987654",
            "TELEGRAM_API_HASH": "b" * 32,
            "TELEGRAM_ALLOWED_USER_ID": "432100",
            "TELEGRAM_CLOUD_MOUNT": str(self.mount),
            "TELEGRAM_PRIVATE_DIR": str(self.root),
        }

    def guard(self, env=None):
        return cloud.assert_cloud_environment(
            env or self.env, is_mount=lambda _: True)

    def session(self):
        p = self.root / "owner.session"
        p.write_bytes(b"fake-test-only-session-not-real")
        p.chmod(0o600)
        return p

    def test_host_gate_accepts_private_dedicated_root_not_relying_on_mac(self):
        self.assertEqual(self.guard(), self.root)
        self.assertIn("Mac-free", cloud.__doc__)
        with self.assertRaisesRegex(cloud.CloudHold, "NOT_PROVEN_MOUNTED"):
            cloud.assert_cloud_environment(self.env, is_mount=lambda _: False)

    def test_missing_or_escape_storage_fails_closed(self):
        for change in [
            {"TELEGRAM_CLOUD_MOUNT": ""},
            {"TELEGRAM_PRIVATE_DIR": self.tmp.name},
            {"TELEGRAM_PRIVATE_DIR": "/tmp"},
            {"TELEGRAM_PRIVATE_DIR": str(self.mount)},
        ]:
            with self.subTest(change=change):
                with self.assertRaises(cloud.CloudHold):
                    self.guard({**self.env, **change})
        self.root.chmod(0o755)
        with self.assertRaisesRegex(cloud.CloudHold, "MODE_UNSAFE"):
            self.guard()
        self.root.chmod(0o700)

    def test_symlink_world_readable_session_and_build_env_are_denied(self):
        target = self.mount / "external"
        target.mkdir()
        link = self.mount / "redirect"
        link.symlink_to(target, target_is_directory=True)
        with self.assertRaises(cloud.CloudHold):
            self.guard({**self.env, "TELEGRAM_PRIVATE_DIR": str(link)})
        p = self.session()
        p.chmod(0o644)
        with self.assertRaisesRegex(cloud.CloudHold, "MODE_UNSAFE"):
            self.guard()
        p.chmod(0o600)
        for key in ("CI", "GITHUB_ACTIONS", "VERCEL", "CF_PAGES"):
            with self.subTest(env=key), self.assertRaises(cloud.CloudHold):
                self.guard({**self.env, key: "true"})
        for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_HMAC_KEY"):
            with self.subTest(env=key), self.assertRaises(cloud.CloudHold):
                self.guard({**self.env, key: "nope"})

    def test_no_false_session_network_or_cloud_release_claims(self):
        with self.assertRaisesRegex(cloud.CloudHold, "NOT_ENROLLED"):
            cloud.assert_session_present(self.root)
        self.session()
        self.assertIsNone(cloud.assert_session_present(self.root))
        with self.assertRaisesRegex(cloud.CloudHold, "APPROVAL"):
            cloud.assert_run_admission(self.env, self.root)
        with self.assertRaisesRegex(cloud.CloudHold, "HELD_PENDING_REAL_CERTIFICATION"):
            cloud.assert_run_admission({
                **self.env, "TELEGRAM_CLOUD_OWNER_APPROVED": "true",
                "TELEGRAM_CLOUD_RIGHTS_REVIEWED": "true",
            }, self.root)

    def test_credentials_are_validated_but_never_reflected_in_errors(self):
        secret = "c" * 32
        for changes in [
            {"TELEGRAM_API_HASH": secret + "bad"},
            {"TELEGRAM_ALLOWED_USER_ID": "0"},
            {"TELEGRAM_API_ID": "not-a-number"},
            {"TELEGRAM_API_ID": "0"},
        ]:
            with self.subTest(changes=changes):
                with self.assertRaises(cloud.CloudHold) as caught:
                    self.guard({**self.env, **changes})
                self.assertNotIn(secret, str(caught.exception))

    def test_noninteractive_headless_reader_never_prompts_when_revoked(self):
        class FakeClient:
            def __init__(self, *_args):
                self.started = False
                self.disconnected = False

            async def start(self):
                self.started = True
                raise AssertionError("headless Telegram OTP prompt was attempted")

            async def connect(self):
                return True

            async def is_user_authorized(self):
                return False

            async def disconnect(self):
                self.disconnected = True

        created = []
        def factory(*args):
            client = FakeClient(*args)
            created.append(client)
            return client

        fake_telethon = SimpleNamespace(TelegramClient=factory,
                                        events=SimpleNamespace(),
                                        utils=SimpleNamespace())
        args = SimpleNamespace(
            mode="live", all_chats=True, chats=None, exclude_chats=None,
            days=30, max_per_chat=2000,
        )
        with patch.dict(sys.modules, {"telethon": fake_telethon}):
            with patch.dict(os.environ, {
                **self.env, "TELEGRAM_CLOUD_NONINTERACTIVE": "1",
            }, clear=True):
                with self.assertRaisesRegex(SystemExit, "REVOKED_OR_EXPIRED"):
                    asyncio.run(intake.user_reader(args, self.root, ""))
        self.assertTrue(created)
        self.assertFalse(created[0].started)
        self.assertTrue(created[0].disconnected)

    def test_enrollment_is_separate_and_main_refuses_unapproved_ssh(self):
        with patch.dict(os.environ, self.env, clear=True):
            with patch.object(cloud, "assert_cloud_environment", return_value=self.root):
                with patch.object(sys.stdin, "isatty", return_value=False):
                    with patch.object(cloud, "enroll") as auth:
                        with contextlib.redirect_stdout(io.StringIO()) as log:
                            self.assertEqual(cloud.main(["enroll"]), 1)
                        auth.assert_not_called()
                        self.assertNotIn(self.env["TELEGRAM_API_HASH"], log.getvalue())
                with patch.object(sys.stdin, "isatty", return_value=True):
                    with patch.object(cloud, "enroll") as auth:
                        self.assertEqual(cloud.main(["enroll"]), 1)
                        auth.assert_not_called()

    def test_single_bot_queue_owner_and_shark_no_trade_boundary(self):
        with self.assertRaisesRegex(SystemExit, "SINGLE_OWNER_REQUIRED"):
            intake.forwarded_bot(self.root, "")
        counts = intake.ephemeral_crypto_observation(
            "CA So11111111111111111111111111111111111111112")
        self.assertEqual(counts["candidates"], 1)
        self.assertNotIn("token_address", counts)
        self.assertNotIn("chat_id", counts)
        self.assertNotIn("can_authorize_trade", counts)


if __name__ == "__main__":
    unittest.main()
