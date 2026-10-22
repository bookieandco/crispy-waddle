#!/usr/bin/env python3
"""Unattended Shadow Drive cycles are opt-in; no external network in tests."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import shadow_archive_cycle as cycle


class OwnerControlledCycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "shadow-archive"
        self.env = {"SHADOW_DRIVE_UNATTENDED_APPROVED": "YES"}
        self.snapshot = "a" * 64
        self.receipt = {"snapshot_id": self.snapshot, "sha256": "b" * 64}

    def common(self):
        return (
            patch.object(cycle.shadow_backup, "source_settings", return_value={"socket": "/private"}),
            patch.object(cycle.shadow_backup, "scoped_repository", return_value="rclone:private:shadow"),
            patch.object(cycle.shadow_backup, "archive", return_value=self.receipt),
        )

    def test_no_automatic_schedule_without_explicit_owner_approval(self):
        with self.assertRaisesRegex(cycle.ShadowCycleError, "opt-in"):
            cycle.run_cycle(env={}, mode="backup", root=self.root)
        self.assertFalse(self.root.exists())

    def test_backup_cycle_writes_a_private_nonproduction_receipt(self):
        source, repository, archive = self.common()
        with source, repository, archive, patch.object(cycle.shadow_backup, "private_directory",
                                                       wraps=cycle.shadow_backup.private_directory):
            result = cycle.run_cycle(env=self.env, mode="backup", root=self.root)
        self.assertEqual(result["status"], "ENCRYPTED_BYTES_VERIFIED")
        self.assertFalse(result["semantic_restore_verified"])
        self.assertFalse(result["source_to_target_row_parity_verified"])
        self.assertFalse(result["alert_delivered"])
        self.assertFalse(result["live_trading_authorized"])
        journal = list((self.root / "cycle-journal").glob("*.json"))
        self.assertEqual(len(journal), 1)
        self.assertEqual(journal[0].stat().st_mode & 0o077, 0)
        self.assertEqual(json.loads(journal[0].read_text())["snapshot_id"], self.snapshot)

    def test_weekly_restore_must_be_semantically_verified_before_success(self):
        source, repository, archive = self.common()
        with source, repository, archive, patch.object(cycle.restore_drill, "trusted_host"), \
                patch.object(cycle.shadow_backup, "recovery_drill",
                             return_value={"semantic_integrity_verified": False}):
            with self.assertRaisesRegex(cycle.ShadowCycleError, "semantic"):
                cycle.run_cycle(env=self.env, mode="restore-drill", root=self.root)
        self.assertFalse((self.root / "cycle-journal").exists())

    def test_weekly_restore_receipt_does_not_certify_trading_or_source_parity(self):
        source, repository, archive = self.common()
        with source, repository, archive, patch.object(cycle.restore_drill, "trusted_host"), \
                patch.object(cycle.shadow_backup, "recovery_drill",
                             return_value={"semantic_integrity_verified": True}):
            result = cycle.run_cycle(env=self.env, mode="restore-drill", root=self.root)
        self.assertEqual(result["status"], "RESTORE_DRILL_PASSED")
        self.assertTrue(result["semantic_restore_verified"])
        self.assertFalse(result["source_to_target_row_parity_verified"])
        self.assertFalse(result["swlc_synced"])
        self.assertFalse(result["alert_delivered"])


if __name__ == "__main__":
    unittest.main()
