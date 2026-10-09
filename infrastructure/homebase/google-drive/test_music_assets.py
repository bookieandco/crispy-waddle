"""MUSIC-DRIVE.1-.8 security and lifecycle contracts; no OAuth/network/GPU."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import music_assets as m


class MusicArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace"
        (self.workspace / ".dvc").mkdir(parents=True)
        (self.workspace / "assets").mkdir()
        self.source = self.root / "source"
        self.source.mkdir()
        self.audio = b"RIFF" + b"\0" * 512
        (self.source / "kick.wav").write_bytes(self.audio)
        self.manifest = {
            "caseId": "music-case-1",
            "currentVersionId": "version-1",
            "sourceArtifactId": "source-1",
            "tracks": [{
                "artifactId": "kick:1", "role": "drums.kick",
                "fileName": "kick.wav", "sha256": hashlib.sha256(self.audio).hexdigest()
            }]
        }
        self.manifest_path = self.root / "manifest.json"
        self.manifest_path.write_text(json.dumps(self.manifest))

    def stage(self):
        return m.stage(self.workspace, self.source, m.inspect_manifest(self.manifest_path),
                       "CLEARED_NON_SENSITIVE", True, "owner-approval-123")

    def test_bounded_manifest_and_path_validation(self):
        self.assertEqual(len(m.inspect_manifest(self.manifest_path)["tracks"]), 1)
        for name in ("../secret.wav", "sub/kick.wav", ".hidden.wav", "oops.sh"):
            with self.subTest(name=name):
                broken = json.loads(json.dumps(self.manifest))
                broken["tracks"][0]["fileName"] = name
                self.manifest_path.write_text(json.dumps(broken))
                with self.assertRaises(m.MusicArchiveError):
                    m.inspect_manifest(self.manifest_path)
        self.manifest_path.write_text(json.dumps(self.manifest))

    def test_requires_rights_and_clearance(self):
        info = m.inspect_manifest(self.manifest_path)
        for classification, rights, approval in [
            ("PRIVATE", True, "approval"), ("PUBLIC", False, "approval"), ("PUBLIC", True, ""),
        ]:
            with self.subTest(classification=classification, rights=rights):
                with self.assertRaises(m.MusicArchiveError):
                    m.stage(self.workspace, self.source, info, classification, rights, approval)
        self.assertEqual(list((self.workspace / "assets").iterdir()), [])

    def test_stage_hash_and_immutable_receipt(self):
        receipt = self.stage()
        self.assertTrue(receipt["localBytesVerified"])
        self.assertFalse(receipt["dvcRemoteVerified"])
        info = m.inspect_manifest(self.manifest_path)
        self.assertEqual(m.load_receipt(self.workspace, info)["manifestSha256"], m.manifest_digest(info))
        self.assertEqual(m.checksum(self.workspace / "assets" / receipt["assets"][0]["name"]),
                         self.manifest["tracks"][0]["sha256"])
        self.assertEqual(m.receipt_location(self.workspace, info).stat().st_mode & 0o077, 0)
        self.stage()
        (self.workspace / "assets" / receipt["assets"][0]["name"]).write_bytes(b"changed")
        with self.assertRaises(m.MusicArchiveError):
            self.stage()

    def test_source_drift_or_symlink_refused(self):
        (self.source / "kick.wav").write_bytes(b"different")
        with self.assertRaisesRegex(m.MusicArchiveError, "differs"):
            self.stage()
        (self.source / "kick.wav").unlink()
        (self.source / "kick.wav").symlink_to(self.root / "manifest.json")
        with self.assertRaisesRegex(m.MusicArchiveError, "Symlink"):
            self.stage()

    def test_track_uses_existing_dvc_adapter(self):
        receipt = self.stage()
        info = m.inspect_manifest(self.manifest_path)
        with patch.object(m.dvc_assets, "track") as fake:
            state = m.track(self.workspace, info)
        fake.assert_called_once_with(self.workspace, receipt["assets"][0]["name"],
                                     "CLEARED_NON_SENSITIVE", "music")
        self.assertEqual(state["uploaded"], False)

    def approved(self):
        receipt = self.stage()
        info = m.inspect_manifest(self.manifest_path)
        item = receipt["assets"][0]
        (self.workspace / "assets" / (item["name"] + ".dvc")).write_text("pointer")
        m.dvc_assets.save_approval(self.workspace, {
            "name": item["name"], "sha256": item["sha256"],
            "classification": "CLEARED_NON_SENSITIVE", "subsystem": "music"
        })
        return info, item

    def test_push_denied_without_independent_live_authorization(self):
        info, item = self.approved()
        with patch.object(m.dvc_assets, "remote_configured", return_value=True), \
             patch.object(m.dvc_assets, "push") as execute:
            with self.assertRaises(m.MusicArchiveError):
                m.push(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)
            execute.assert_not_called()
            with patch.dict(os.environ, {"MUSIC_DRIVE_LIVE_APPROVED": "YES"}):
                with self.assertRaises(m.MusicArchiveError):
                    m.push(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, False)
                result = m.push(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)
        execute.assert_called_once_with(self.workspace, "TEST_DVC_FOLDER_ID_1234567", item["name"])
        self.assertFalse(result["remoteRestoreProven"])

    def test_restore_requires_remote_only_and_checks_bytes(self):
        info, item = self.approved()
        with patch.object(m.dvc_assets, "remote_configured", return_value=True), \
             patch.dict(os.environ, {"MUSIC_DRIVE_LIVE_APPROVED": "YES"}), \
             patch.object(m.dvc_assets, "pull") as pull:
            with self.assertRaisesRegex(m.MusicArchiveError, "absent"):
                m.restore(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)
            original = self.workspace / "assets" / item["name"]
            original.unlink()
            def bad_pull(*args):
                original.write_bytes(b"corrupt")
            pull.side_effect = bad_pull
            with self.assertRaisesRegex(m.MusicArchiveError, "SHA"):
                m.restore(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)
            original.unlink()
            pull.side_effect = lambda *args: original.write_bytes(self.audio)
            result = m.restore(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)
            self.assertTrue(result["remoteRestoreProven"])

    def test_cleared_metadata_mismatch_denied(self):
        info, item = self.approved()
        m.dvc_assets.save_approval(self.workspace, {
            "name": item["name"], "sha256": item["sha256"],
            "classification": "PUBLIC", "subsystem": "director"
        })
        with patch.object(m.dvc_assets, "remote_configured", return_value=True), \
             patch.dict(os.environ, {"MUSIC_DRIVE_LIVE_APPROVED": "YES"}):
            with self.assertRaisesRegex(m.MusicArchiveError, "Exact approved"):
                m.push(self.workspace, "TEST_DVC_FOLDER_ID_1234567", info, True)


if __name__ == "__main__":
    unittest.main()
