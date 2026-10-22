"""No-network TELEGRAM-LIVE.12 startup and recovery readiness tests."""
from __future__ import annotations

import contextlib
import io
import os
import sys
import tempfile
import unittest
from importlib import metadata
from pathlib import Path
from unittest.mock import patch

import personal_startup_diagnostics as diag

PRIVATE_API_HASH = "a" * 32
PRIVATE_OWNER_ID = "98765432"
PRIVATE_ROOT_NAME = "MY_PRIVATE_TELEGRAM_WORKER"


class StartupDiagnosticTests(unittest.TestCase):
    def test_fresh_mac_without_session_is_ready_to_attempt_not_authenticated(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch) / "missing-directory"
            with patch.dict(os.environ, {}, clear=True):
                ready, lines = diag.startup_diagnostic(
                    root, python_version=(3, 12), telethon_version="1.45.0")
            self.assertTrue(ready)
            self.assertEqual(lines[0], "PREFLIGHT_LOCAL_READY_TO_ATTEMPT_LOGIN")
            self.assertIn("TELEGRAM_SESSION_ABSENT", lines[1])
            self.assertIn("NETWORK_NOT_CHECKED", lines[1])
            self.assertIn("NO_TELEGRAM_AUTH_NO_NETWORK_NO_MESSAGE_READ", lines[2])
            self.assertFalse(root.exists())

    def test_existing_session_only_means_file_exists_never_authenticated(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            os.chmod(root, 0o700)
            file = root / "owner.session"
            file.write_text("SENSITIVE_SESSION_BYTES")
            os.chmod(file, 0o600)
            with patch.dict(os.environ, {}, clear=True):
                ready, lines = diag.startup_diagnostic(
                    root, python_version=(3, 12), telethon_version="1.45.0")
            self.assertTrue(ready)
            self.assertIn("TELEGRAM_SESSION_PRESENT", lines[1])
            self.assertIn("NETWORK_NOT_CHECKED", lines[1])
            self.assertNotIn("SENSITIVE_SESSION_BYTES", str(lines))

    def test_old_python_fail_closed_before_touching_storage(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch) / "uncreated"
            with patch.dict(os.environ, {}, clear=True):
                ready, lines = diag.startup_diagnostic(
                    root, python_version=(3, 10), telethon_version="1.45.0")
            self.assertFalse(ready)
            self.assertIn("PREFLIGHT_PYTHON_TOO_OLD", lines)
            self.assertFalse(root.exists())

    def test_wrong_or_missing_telethon_never_triggers_network(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch) / "uncreated"
            with patch.dict(os.environ, {}, clear=True):
                ready, labels = diag.startup_diagnostic(
                    root, python_version=(3, 12), telethon_version="1.46.0")
                self.assertFalse(ready)
                self.assertIn("PREFLIGHT_TELETHON_PIN_MISMATCH", labels)
                with patch.object(diag.metadata, "version",
                                  side_effect=metadata.PackageNotFoundError("Telethon")):
                    ready, labels = diag.startup_diagnostic(root, python_version=(3, 12))
                self.assertFalse(ready)
                self.assertIn("PREFLIGHT_TELETHON_MISSING", labels)
            self.assertFalse(root.exists())

    def test_private_root_file_permissions_symlinks_fail_closed(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch) / "private"
            root.mkdir(mode=0o700)
            with patch.dict(os.environ, {}, clear=True):
                os.chmod(root, 0o755)
                ready, labels = diag.startup_diagnostic(
                    root, python_version=(3, 12), telethon_version="1.45.0")
                self.assertFalse(ready)
                self.assertIn("PREFLIGHT_PRIVATE_STORAGE_UNSAFE", labels)
                os.chmod(root, 0o700)
                session = root / "owner.session"
                session.touch(mode=0o600)
                os.chmod(session, 0o666)
                ready, labels = diag.startup_diagnostic(
                    root, python_version=(3, 12), telethon_version="1.45.0")
                self.assertFalse(ready)
                self.assertIn("PREFLIGHT_PRIVATE_STORAGE_UNSAFE", labels)
                session.unlink()
                symlink = Path(scratch) / "shortcut"
                symlink.symlink_to(root, target_is_directory=True)
                ready, labels = diag.startup_diagnostic(
                    symlink, python_version=(3, 12), telethon_version="1.45.0")
                self.assertFalse(ready)
                self.assertIn("PREFLIGHT_PRIVATE_STORAGE_UNSAFE", labels)

    def test_ci_and_cloud_refused_even_if_local_dependencies_are_good(self):
        with tempfile.TemporaryDirectory() as scratch:
            for name in ("GITHUB_ACTIONS", "CI", "VERCEL"):
                with self.subTest(env=name), patch.dict(os.environ, {name: "true"}, clear=True):
                    ready, labels = diag.startup_diagnostic(
                        Path(scratch), python_version=(3, 12), telethon_version="1.45.0")
                    self.assertFalse(ready)
                    self.assertIn("PREFLIGHT_LOCAL_ONLY_CLOUD_FORBIDDEN", labels)

    def test_main_safe_redacted_no_keys_no_root_disclosure(self):
        with tempfile.TemporaryDirectory(prefix=PRIVATE_ROOT_NAME) as scratch:
            root = Path(scratch) / PRIVATE_ROOT_NAME
            env = {"TELEGRAM_PRIVATE_DIR": str(root),
                   "TELEGRAM_API_HASH": PRIVATE_API_HASH,
                   "TELEGRAM_ALLOWED_USER_ID": PRIVATE_OWNER_ID}
            with patch.dict(os.environ, env, clear=True):
                with patch.object(diag.metadata, "version", return_value="1.45.0"):
                    with contextlib.redirect_stdout(io.StringIO()) as out:
                        self.assertEqual(diag.main(), 0)
            response = out.getvalue()
            for value in (PRIVATE_ROOT_NAME, PRIVATE_API_HASH, PRIVATE_OWNER_ID, str(root)):
                self.assertNotIn(value, response)
            self.assertIn("PREFLIGHT_LOCAL_READY_TO_ATTEMPT_LOGIN", response)
            self.assertIn("NETWORK_NOT_CHECKED", response)
            self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()
