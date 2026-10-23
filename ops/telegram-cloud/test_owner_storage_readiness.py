"""Hermetic tests: no Telegram account, network, Railway or wallet credentials."""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import stat
import tempfile
import unittest

SRC = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("storage_readiness", SRC / "owner_storage_readiness.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class StorageReadinessTests(unittest.TestCase):
    def ready(self, root):
        mount = root / "mounted"
        mount.mkdir(mode=0o700)
        private = mount / "private"
        private.mkdir(mode=0o700)
        return mount, private

    def assess(self, mount, private, mounted=True):
        return mod.storage_readiness(mount, private,
            uid=os.geteuid(), gid=os.getegid(), is_mount=lambda _: mounted)

    def test_permitted_attestation_is_storage_only_never_connected(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            result = self.assess(mount, private)
            self.assertEqual(result["status"], "STORAGE_ONLY_READY")
            self.assertFalse(result["sessionFilePresent"])
            for key in ("telegramConnected", "sharkIntakeConnected", "tradingEnabled",
                        "canSign", "authorizedOwnerVerified", "sshHostKeyVerified",
                        "aiTrainingEnabled"):
                self.assertIs(result[key], False)
            self.assertNotIn(str(mount), str(result))
            self.assertNotIn("owner_id", result)

    def test_unmounted_volume_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            self.assertEqual(self.assess(mount, private, False)["status"], "BLOCKED")

    def test_private_symlink_and_volume_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            alias = mount.parent / "alias"
            alias.symlink_to(mount, target_is_directory=True)
            self.assertEqual(self.assess(alias, alias / "private")["status"], "BLOCKED")
            private.rmdir()
            private.symlink_to(mount.parent, target_is_directory=True)
            self.assertEqual(self.assess(mount, private)["status"], "BLOCKED")

    def test_world_readable_private_dir_denied(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            private.chmod(0o755)
            self.assertEqual(self.assess(mount, private)["status"], "BLOCKED")

    def test_root_mount_permissions_denied(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            mount.chmod(0o777)
            self.assertEqual(self.assess(mount, private)["status"], "BLOCKED")

    def test_session_metadata_only_and_no_contents_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            session = private / "owner.session"
            session.write_bytes(b"not-a-telegram-token\n")
            session.chmod(0o600)
            report = self.assess(mount, private)
            self.assertEqual(report["status"], "STORAGE_ONLY_READY")
            self.assertTrue(report["sessionFilePresent"])
            self.assertNotIn("not-a-telegram-token", str(report))
            self.assertEqual(session.read_bytes(), b"not-a-telegram-token\n")
            session.chmod(0o644)
            self.assertEqual(self.assess(mount, private)["status"], "BLOCKED")

    def test_lock_symlink_rejected_without_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount, private = self.ready(Path(tmp))
            lock = private / "telegram-worker.lock"
            outside = mount.parent / "outside"
            outside.write_text("leave unchanged")
            lock.symlink_to(outside)
            self.assertEqual(self.assess(mount, private)["status"], "BLOCKED")
            self.assertEqual(outside.read_text(), "leave unchanged")

    def test_offline_self_test_requires_no_service(self):
        self.assertEqual(mod.main(["--offline-self-test"]), 0)


if __name__ == "__main__":
    unittest.main()
