"""No-cloud and no-credential tests for the Railway staging-only bundle."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import os
import stat
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("telegram_cloud_host", SOURCE / "host.py")
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class RailwaySourceOnlyTests(unittest.TestCase):
    def test_credible_volume_mount_and_private_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount = Path(tmp) / "volume"
            mount.mkdir()
            private = mount / "private"
            host.prepare_volume(mount, private, os.geteuid(), os.getegid(),
                                is_mount=lambda _: True)
            self.assertTrue(private.is_dir())
            self.assertEqual(stat.S_IMODE(private.stat().st_mode), 0o700)
            self.assertFalse((private / "owner.session").exists())
            self.assertFalse((private / "telegram-worker.lock").exists())

    def test_missing_mount_denied(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount = Path(tmp) / "volume"
            mount.mkdir()
            with self.assertRaisesRegex(host.HostHold, "VOLUME_NOT_VERIFIED"):
                host.prepare_volume(mount, mount / "private",
                                    os.geteuid(), os.getegid(),
                                    is_mount=lambda _: False)

    def test_symlink_volume_and_private_root_denied(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = Path(tmp) / "target"
            original.mkdir()
            link = Path(tmp) / "redirect"
            link.symlink_to(original, target_is_directory=True)
            with self.assertRaises(host.HostHold):
                host.prepare_volume(link, link / "private",
                                    os.geteuid(), os.getegid(),
                                    is_mount=lambda _: True)
            private = original / "private"
            private.symlink_to(Path(tmp), target_is_directory=True)
            with self.assertRaises(host.HostHold):
                host.prepare_volume(original, private,
                                    os.geteuid(), os.getegid(),
                                    is_mount=lambda _: True)

    def test_session_permissions_and_symlinks_never_repaired_silently(self):
        with tempfile.TemporaryDirectory() as tmp:
            mount = Path(tmp) / "volume"
            mount.mkdir()
            private = mount / "private"
            private.mkdir(mode=0o700)
            session = private / "owner.session"
            session.write_text("fake-session-not-a-real-credential")
            session.chmod(0o644)
            with self.assertRaisesRegex(host.HostHold, "MODE_DENIED"):
                host.prepare_volume(mount, private, os.geteuid(), os.getegid(),
                                    is_mount=lambda _: True)
            self.assertEqual(stat.S_IMODE(session.stat().st_mode), 0o644)
            session.unlink()
            session.symlink_to(Path(tmp) / "outside")
            with self.assertRaisesRegex(host.HostHold, "SYMLINK_DENIED"):
                host.prepare_volume(mount, private, os.geteuid(), os.getegid(),
                                    is_mount=lambda _: True)

    def test_no_live_listener_entrypoint_or_auto_export(self):
        docker = (SOURCE / "Dockerfile").read_text()
        shell = (SOURCE / "entrypoint.sh").read_text()
        source = (SOURCE / "host.py").read_text()
        self.assertIn("TELEGRAM_CLOUD_PROCESS_MODE=hold", docker)
        self.assertIn("gosu jhadina", shell)
        self.assertIn("RAILWAY_VOLUME_MOUNT_PATH", shell)
        self.assertIn('!= "hold"', shell)
        self.assertNotIn("cloud_personal_listener.py run", shell)
        self.assertNotIn("TELEGRAM_API_HASH=", docker)
        self.assertNotIn("TELEGRAM_BOT_TOKEN=", docker)
        self.assertNotIn("cloud_personal_listener.py", source)
        self.assertNotIn("http.server", source)


if __name__ == "__main__":
    unittest.main()
