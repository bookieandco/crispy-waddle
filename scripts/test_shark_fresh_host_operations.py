"""Owner-host SHARK preflight and real backup workflow contracts.

Mocks are for fail-closed sequencing only: no CI test runs an actual owner
PostgreSQL, authenticates a machine or uploads a real SHARK backup to Drive.
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, Mock

import shark_fresh_host_operations as ops


class ShadowOwnerHostTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "fresh-paper"
        self.root.mkdir()
        self.pgdata = self.root / "postgres"
        self.pgdata.mkdir()
        (self.pgdata / "PG_VERSION").write_text("17\n")
        stats = self.pgdata.stat()
        self.genesis = {
            "schema": "jhadina.shadow.paper-genesis.v1",
            "state_root": str(self.root),
            "pgdata_dev": stats.st_dev,
            "pgdata_ino": stats.st_ino,
            "pg_version_sha256": hashlib.sha256(b"17\n").hexdigest(),
            "history_label": "NEW_EMPTY_RESEARCH_ONLY",
            "original_history_recovered": False,
            "created_from_empty_initdb": True,
            "can_execute": False, "can_sign": False,
            "can_broadcast": False, "can_authorize_live": False,
        }
        self.genesis_path = self.root / ".shadow-fresh-genesis.json"
        self.genesis_path.write_text(json.dumps(self.genesis))
        self.genesis_path.chmod(0o600)
        self.env = {
            "JHADINA_HOMEBASE_TRUST_DOMAIN": "OWNER_CONTROLLED",
            "SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED": "YES",
            "SHARK_SHADOW_DATA_DIR": str(self.root),
            "SHARK_FRESH_REAL_BACKUP_RESTORE_APPROVED": "YES",
            "SHADOW_DRIVE_BACKUP_APPROVED": "YES",
            "JHADINA_RESTORE_TRUST_DOMAIN": "OWNER_CONTROLLED",
            "JHADINA_RESTORE_APPROVED": "YES",
            "JHADINA_BACKUP_ROOT": str(Path(self.tmp.name) / "backup"),
        }
        self.output = Path(self.tmp.name) / "audit.json"
        self.source = {"socket": str(self.root / "socket")}
        self.backup = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "snapshot_id": "a" * 64,
            "sha256": "b" * 64,
            "encrypted_at_rest": True,
            "remote_bytes_restored_verified": True,
            "live_trading_authorized": False,
        }
        self.restore = {
            "schema": "jhadina.shadow.google-drive-restore.v2",
            "snapshot_id": "a" * 64, "sha256": "b" * 64,
            "semantic_integrity_verified": True,
            "network_isolated": True,
            "active_database_modified": False,
            "live_trading_authorized": False,
            "restored_table_count": 9,
            "restored_ledger_counts": {},
        }
        self.provider = SimpleNamespace(
            source_settings=Mock(return_value=self.source),
            scoped_repository=Mock(return_value="rclone:private/path"),
            archive=Mock(return_value=self.backup),
            recovery_drill=Mock(return_value=self.restore),
        )
        self.mock_probe = {
            "schema": "shark.fresh.owner-host-probe.v1",
            "freshPGDataPresent": True, "persistentMountObserved": True,
            "continuousUptimeVerified": False,
        }

    def mount_run(self, args, **kwargs):
        self.assertEqual(args[:2], ["findmnt", "-T"])
        return SimpleNamespace(returncode=0, stdout="/mnt/data ext4 /dev/vol123\n")

    def test_owner_host_probe_is_real_mount_snapshot_not_continuous_uptime(self):
        disk = SimpleNamespace(free=3 * 1024**3)
        with patch.object(ops, "shutil") as util:
            util.disk_usage.return_value = disk
            result = ops.probe_host(self.root, env=self.env,
                                    run=self.mount_run)
        self.assertTrue(result["persistentMountObserved"])
        self.assertFalse(result["continuousUptimeVerified"])
        self.assertFalse(result["realBackupAndIsolatedRestoreVerified"])
        self.assertFalse(result["canExecute"])

    def test_root_or_overlay_mount_not_accepted(self):
        for stdout in ("/ overlay overlay\n", "/mnt/data tmpfs tmpfs\n"):
            with self.subTest(stdout=stdout):
                runner = lambda *a, **k: SimpleNamespace(returncode=0, stdout=stdout)
                with self.assertRaisesRegex(ops.HostCommissionError, "MOUNT"):
                    ops.probe_host(self.root, env=self.env, run=runner)

    def test_ci_or_unapproved_host_cannot_probe(self):
        for patch_env in ({"GITHUB_ACTIONS": "true"},
                          {"SHARK_SHADOW_PERSISTENT_STORAGE_APPROVED": "NO"}):
            with self.assertRaises(ops.HostCommissionError):
                ops.probe_host(self.root, env={**self.env, **patch_env})

    def test_successful_real_provider_path_creates_owner_only_receipt_not_worker(self):
        with patch.object(ops, "probe_host", return_value=self.mock_probe):
            receipt = ops.actual_backup_and_restore(
                self.root, env=self.env, provider=self.provider, audit_root=self.output)
        self.provider.scoped_repository.assert_called_once()
        self.provider.archive.assert_called_once()
        self.provider.recovery_drill.assert_called_once()
        self.assertTrue(receipt["isolatedDatabaseRestoreVerified"])
        self.assertFalse(receipt["productionCommissioned"])
        self.assertFalse(receipt["forwardLearningCyclesVerified"])
        self.assertFalse(receipt["canAuthorizeLive"])
        self.assertTrue(self.output.exists())
        self.assertEqual(self.output.stat().st_mode & 0o077, 0)
        self.assertEqual(json.loads(self.output.read_text())["backupSnapshotId"], "a" * 64)

    def test_no_backup_before_explicit_owner_approval(self):
        with patch.object(ops, "probe_host", return_value=self.mock_probe):
            with self.assertRaisesRegex(ops.HostCommissionError, "APPROVAL"):
                ops.actual_backup_and_restore(
                    self.root,
                    env={**self.env, "SHARK_FRESH_REAL_BACKUP_RESTORE_APPROVED": "NO"},
                    provider=self.provider, audit_root=self.output)
        self.provider.archive.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_genesis_tamper_and_source_mismatch_denied_before_remote_upload(self):
        with patch.object(ops, "probe_host", return_value=self.mock_probe):
            with self.assertRaisesRegex(ops.HostCommissionError, "SOURCE_MUST_MATCH"):
                ops.actual_backup_and_restore(
                    self.root, env={**self.env, "SHARK_SHADOW_DATA_DIR": "/wrong/source"},
                    provider=self.provider, audit_root=self.output)
            self.genesis_path.write_text(json.dumps({**self.genesis, "can_sign": True}))
            self.genesis_path.chmod(0o600)
            with self.assertRaisesRegex(ops.HostCommissionError, "GENESIS_NOT_VERIFIED"):
                ops.actual_backup_and_restore(
                    self.root, env=self.env, provider=self.provider,
                    audit_root=self.output)
        self.provider.archive.assert_not_called()

    def test_failed_remote_restore_does_not_write_false_success_receipt(self):
        self.provider.recovery_drill.return_value = {**self.restore,
                                                     "network_isolated": False}
        with patch.object(ops, "probe_host", return_value=self.mock_probe):
            with self.assertRaisesRegex(ops.HostCommissionError, "RESTORE_FAILED"):
                ops.actual_backup_and_restore(
                    self.root, env=self.env, provider=self.provider, audit_root=self.output)
        self.assertFalse(self.output.exists())

    def test_private_audit_is_append_only_and_never_inside_postgres(self):
        ops.append_private_receipt(self.output, {"check": True}, self.root)
        with self.assertRaises(FileExistsError):
            ops.append_private_receipt(self.output, {"check": False}, self.root)
        with self.assertRaisesRegex(ops.HostCommissionError, "OUTSIDE_DATABASE"):
            ops.append_private_receipt(self.root / "bad.json", {}, self.root)
        self.assertFalse((self.root / "bad.json").exists())


if __name__ == "__main__":
    unittest.main()
