#!/usr/bin/env python3
"""DIRECTOR-LIVE.20: source-only negative and positive inventory contracts."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("director_live_admission",ROOT/"scripts/director-live-migration-admission.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class MigrationAdmissionTest(unittest.TestCase):
    def test_full_repo_has_all_ten_canonical_sources_and_collisions(self):
        x=module.audit(module.MIGRATIONS)
        self.assertEqual(len(x["migrationSources"]),10)
        self.assertGreaterEqual(x["versionCollisionCount"],9)
        self.assertFalse(x["automaticReplayAllowed"])
        self.assertFalse(x["schemaChangesAuthorized"])
        self.assertFalse(x["liveRestoreVerified"])
        self.assertEqual(x["migrationSources"][0]["remoteHistoryStatus"],"UNKNOWN")
        self.assertIn("20261003221000",x["allTimestampCollisions"])
        self.assertIn("20261005023000",x["allTimestampCollisions"])
    def test_applied_version_never_validates_payload_identity(self):
        x=module.audit(module.MIGRATIONS,["20261003221000","20261005023000"])
        self.assertEqual(x["migrationSources"][0]["remoteHistoryStatus"],"VERSION_RECORDED_PAYLOAD_UNVERIFIED")
        self.assertFalse(x["automaticReplayAllowed"])
        self.assertIn("20261005024500",x["sourceVersionsMissingFromRemote"])
    def test_missing_files_stop_admission(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(FileNotFoundError):
                module.audit(Path(d),[])
    def test_malformed_remote_snapshot_rejected(self):
        for history in (["20261003"],[123],{"20261003221000":"bad"},[None]):
            with self.subTest(history=history):
                with self.assertRaises(ValueError):
                    module.audit(module.MIGRATIONS,history)

if __name__=="__main__":unittest.main()
