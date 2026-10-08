"""Hermetic tests for DVC folder isolation, classification and scoped push."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import dvc_assets as a


class DvcAssetTests(unittest.TestCase):
    def test_exact_folder_id_required(self):
        self.assertEqual(a.folder_url("TEST_DVC_FOLDER_ID_1234567"),
                         "gdrive://TEST_DVC_FOLDER_ID_1234567")
        for value in ("", "root", "../secret", "gdrive://something", "with/slash", " space "):
            with self.subTest(value=value), self.assertRaises(a.DvcSetupError):
                a.folder_url(value)

    def test_asset_path_escape_and_symlinks_blocked(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "assets").mkdir()
            (root / "assets" / "good.bin").write_bytes(b"clear")
            self.assertEqual(a.validated_asset(root, "good.bin", require_file=True),
                             root / "assets" / "good.bin")
            for bad in ("../secret", "/tmp/key", "folder/file", ".dvc", "bad.dvc"):
                with self.subTest(bad=bad), self.assertRaises(a.DvcSetupError):
                    a.validated_asset(root, bad, require_file=True)
            (root / "assets" / "alias").symlink_to(root / "assets" / "good.bin")
            with self.assertRaises(a.DvcSetupError):
                a.validated_asset(root, "alias", require_file=True)

    def test_sensitive_classifications_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".dvc").mkdir()
            (root / "assets").mkdir()
            (root / "assets" / "draft.bin").write_bytes(b"local")
            with patch.object(a, "ensure_installed"), patch.object(a, "command") as cmd:
                with self.assertRaises(a.DvcSetupError):
                    a.track(root, "draft.bin", "CONFIDENTIAL", "director")
                cmd.assert_not_called()

    def test_local_tracking_never_uploads(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".dvc").mkdir()
            (root / "assets").mkdir()
            (root / "assets" / "scene.mp4").write_bytes(b"approved-test-bytes")
            with patch.object(a, "ensure_installed"), patch.object(a, "command") as cmd:
                a.track(root, "scene.mp4", "CLEARED_NON_SENSITIVE", "director")
            cmd.assert_called_once_with(["dvc", "add", "assets/scene.mp4"], root)
            manifest = json.loads(a.approval_path(root).read_text())
            self.assertEqual(manifest["scene.mp4"]["sha256"], hashlib.sha256(b"approved-test-bytes").hexdigest())
            self.assertEqual(manifest["scene.mp4"]["subsystem"], "director")
            self.assertEqual(a.approval_path(root).stat().st_mode & 0o077, 0)

    def test_modification_after_approval_prevents_upload(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".dvc").mkdir()
            (root / "assets").mkdir()
            asset = root / "assets" / "model.bin"
            asset.write_bytes(b"approved")
            (root / "assets" / "model.bin.dvc").write_text("not used in test")
            a.save_approval(root, {"name": "model.bin", "sha256": hashlib.sha256(b"approved").hexdigest(),
                                   "classification": "PUBLIC", "subsystem": "research"})
            self.assertEqual(a.approved_target(root, "model.bin"), "assets/model.bin.dvc")
            asset.write_bytes(b"modified")
            with patch.object(a, "ensure_installed"), patch.object(a, "command") as cmd, \
                 patch.object(a, "remote_configured", return_value=True):
                with self.assertRaisesRegex(a.DvcSetupError, "changed after approval"):
                    a.push(root, "TEST_DVC_FOLDER_ID_1234567", "model.bin")
                cmd.assert_not_called()

    def test_push_only_exact_approved_pointer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".dvc").mkdir()
            (root / "assets").mkdir()
            asset = root / "assets" / "model.bin"
            asset.write_bytes(b"model")
            (root / "assets" / "model.bin.dvc").write_text("pointer")
            a.save_approval(root, {"name": "model.bin", "sha256": hashlib.sha256(b"model").hexdigest(),
                                   "classification": "PUBLIC", "subsystem": "research"})
            with patch.object(a, "ensure_installed"), patch.object(a, "command") as cmd, \
                 patch.object(a, "remote_configured", return_value=True):
                a.push(root, "TEST_DVC_FOLDER_ID_1234567", "model.bin")
            cmd.assert_called_once_with(["dvc", "push", "-r", "jhadina-assets", "assets/model.bin.dvc"], root)

    def test_remote_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            class Done:
                returncode = 0
                stdout = b"gdrive://unexpected-folder-id"
            with patch.object(a.subprocess, "run", return_value=Done()):
                with self.assertRaisesRegex(a.DvcSetupError, "differs"):
                    a.remote_configured(root, "TEST_DVC_FOLDER_ID_1234567")


if __name__ == "__main__":
    unittest.main()
