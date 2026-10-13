"""Hermetic privacy checks for trusted-Mac, personal-account Telegram onboarding."""
import contextlib
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import start_personal_live as target

ID = "12345678"
HASH = "a" * 32
OWNER = "777777777"


class PersonalLiveSetupTests(unittest.TestCase):
    def test_environment_is_only_for_local_subprocess_no_bot_or_ai_secret(self):
        base = {
            "HOME": "/Users/test",
            "TELEGRAM_BOT_TOKEN": "SECRET_BOT",
            "TELEGRAM_HMAC_KEY": "SECRET_HMAC",
            "TELEGRAM_API_HASH": "OLD_HASH",
        }
        derived = target.build_private_environment(base, ID, HASH, OWNER)
        self.assertEqual(base["TELEGRAM_BOT_TOKEN"], "SECRET_BOT")
        self.assertEqual(derived["TELEGRAM_API_ID"], ID)
        self.assertEqual(derived["TELEGRAM_API_HASH"], HASH)
        self.assertEqual(derived["TELEGRAM_ALLOWED_USER_ID"], OWNER)
        self.assertNotIn("TELEGRAM_BOT_TOKEN", derived)
        self.assertNotIn("TELEGRAM_HMAC_KEY", derived)

    def test_reject_invalid_api_and_owner_without_displaying_user_values(self):
        for candidate in [
            ("-2", HASH, OWNER), ("abc", HASH, OWNER),
            (ID, "wrong-private-hash", OWNER),
            (ID, "x" * 32, OWNER),
            (ID, HASH, "invalid-owner"),
            (ID, HASH, "0"),
        ]:
            with self.subTest(value=str(candidate)[:10]):
                with self.assertRaises(target.SecureSetupError) as caught:
                    target.build_private_environment({}, *candidate)
                for private in candidate:
                    self.assertNotIn(private, str(caught.exception))

    def test_exact_non_shell_command_only(self):
        command = target.prepare_live_command(
            "/usr/bin/python3", Path("/private/shark-telegram"))
        self.assertEqual(command, [
            "/usr/bin/python3", "/private/shark-telegram/telegram_intake.py",
            "live", "--all-chats",
        ])
        excluded = target.prepare_live_command(
            "/usr/bin/python3", Path("/private/shark-telegram"), ["@unrelated"])
        self.assertEqual(excluded[-2:], ["--exclude-chats", "@unrelated"])
        with self.assertRaises(target.SecureSetupError):
            target.prepare_live_command("/usr/bin/python3", Path("/private"),
                                        ["--chats"])

    def test_automated_ci_and_noninteractive_context_never_prompt(self):
        for key in ("CI", "VERCEL", "GITHUB_ACTIONS"):
            with patch.dict(os.environ, {key: "true"}, clear=True):
                with patch.object(target.getpass, "getpass") as prompt:
                    with contextlib.redirect_stdout(io.StringIO()) as stdout:
                        self.assertEqual(target.main(), 1)
                    prompt.assert_not_called()
                    self.assertIn("FORBIDDEN_IN_CLOUD_BUILD", stdout.getvalue())
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(sys.stdin, "isatty", return_value=False):
                with patch.object(target.getpass, "getpass") as prompt:
                    self.assertEqual(target.main(), 1)
                    prompt.assert_not_called()

    def test_decline_does_not_prompt_or_start_subprocess(self):
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(sys.stdin, "isatty", return_value=True):
                with patch("builtins.input", return_value="NO"):
                    with patch.object(target.getpass, "getpass") as prompt:
                        with patch.object(target.subprocess, "run") as run:
                            self.assertEqual(target.main(), 1)
                            prompt.assert_not_called()
                            run.assert_not_called()

    def test_subprocess_is_local_and_credentials_not_in_arguments_or_logs(self):
        private = ("SECRET_API_ID", HASH, OWNER)
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(sys.stdin, "isatty", return_value=True):
                with patch("builtins.input", return_value="YES"):
                    with patch.object(target.getpass, "getpass",
                                      side_effect=[ID, HASH, OWNER]):
                        with patch.object(target.subprocess, "run") as run:
                            run.return_value.returncode = 0
                            with contextlib.redirect_stdout(io.StringIO()) as output:
                                self.assertEqual(target.main(), 0)
                            args, kwargs = run.call_args
                            self.assertEqual(kwargs["env"]["TELEGRAM_ALLOWED_USER_ID"], OWNER)
                            self.assertIn("--all-chats", args[0])
                            self.assertNotIn(OWNER, repr(args[0]))
                            self.assertNotIn(HASH, repr(args[0]))
                            self.assertNotIn(HASH, output.getvalue())
                            self.assertNotIn(OWNER, output.getvalue())


if __name__ == "__main__":
    unittest.main()
