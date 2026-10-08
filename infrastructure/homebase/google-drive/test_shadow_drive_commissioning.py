#!/usr/bin/env python3
"""Hermetic commissioning receipt contract checks: no Google or database I/O."""
import os
import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

import shadow_drive_commissioning as gate


class ShadowDriveGateTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 8, 0, 0, tzinfo=timezone.utc)
        self.env = {"JHADINA_HOMEBASE_TRUST_DOMAIN": "OWNER_CONTROLLED",
                    "SHADOW_DRIVE_BACKUP_APPROVED": "YES",
                    "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "SHADOW_PRIVATE_FOLDER_012345"}
        self.snapshot = "a" * 64
        self.digest = "b" * 64
        self.backup = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "scope": "SHADOW_POSTGRES_ONLY",
            "source_kind": "LOCAL_SHADOW_UNIX_SOCKET",
            "restic_path": "shadow-postgres-restic-v1",
            "encrypted_at_rest": True,
            "remote_bytes_restored_verified": True,
            "live_trading_authorized": False,
            "snapshot_id": self.snapshot,
            "sha256": self.digest,
            "completed_at": (self.now - timedelta(minutes=12)).isoformat(),
        }
        self.restore = {
            "schema": "jhadina.shadow.google-drive-restore.v1",
            "snapshot_id": self.snapshot, "sha256": self.digest,
            "required_shadow_tables_verified": True,
            "network_isolated": True, "active_database_modified": False,
            "live_trading_authorized": False,
        }
        self.monitor = {
            "schema": "jhadina.shadow.google-drive-monitor.v1",
            "scheduleEnabled": True,
            "latestSnapshotFresh": True, "failureAlertDelivered": True,
            "pruneExecuted": False,
            "observedAt": (self.now - timedelta(hours=1)).isoformat(),
        }
        self.sync = {
            "schema": "jhadina.shadow.sync-redacted.v1",
            "swlcHealthy": True, "acknowledged": 5, "rejected": 0,
        }
        self.p2 = {
            "authority": "CERTIFICATION_ONLY", "operationalPassed": True,
            "realWorldProfitabilityProven": False, "liveTradingAuthorized": False,
        }

    def check(self, **overrides):
        params = dict(env=self.env,backup_receipt=self.backup,
                      restore_receipt=self.restore,monitor_receipt=self.monitor,
                      sync_receipt=self.sync,p2_receipt=self.p2,now=self.now)
        params.update(overrides)
        return gate.assess(**params)

    def test_no_provider_operations_or_computer_host_assertion_from_phone(self):
        report = gate.assess(env={})
        self.assertFalse(report["ready"])
        self.assertFalse(report["providerOperationsExecuted"])
        self.assertFalse(report["checks"]["approved_existing_worker"])
        self.assertFalse(report["checks"]["encrypted_snapshot_and_byte_restore"])
        self.assertFalse(report["sourceReceiptsIndependentlyAuthenticated"])

    def test_all_receipt_shapes_do_not_self_certify_live_recovery(self):
        report = self.check()
        self.assertTrue(report["receiptContractPassed"])
        self.assertFalse(report["ready"])
        self.assertEqual(report["blocked"], [])
        self.assertFalse(report["liveShadowServiceMovedToDrive"])
        self.assertFalse(report["realMoneyAuthorized"])

    def test_restore_must_match_exact_snapshot_and_checksum(self):
        report = self.check(restore_receipt={**self.restore, "sha256": "c" * 64})
        self.assertFalse(report["checks"]["isolated_shadow_tables_restored"])
        self.assertFalse(report["receiptContractPassed"])

    def test_non_owner_worker_or_github_host_is_not_authorized(self):
        self.assertFalse(self.check(env={**self.env, "GITHUB_ACTIONS": "true"})["checks"]["approved_existing_worker"])
        self.assertFalse(self.check(env={**self.env, "SHADOW_DRIVE_BACKUP_APPROVED": "NO"})["checks"]["approved_existing_worker"])

    def test_stale_snapshot_and_no_delivery_never_pass(self):
        old={**self.backup, "completed_at": (self.now - timedelta(days=5)).isoformat()}
        self.assertFalse(self.check(backup_receipt=old)["checks"]["encrypted_snapshot_and_byte_restore"])
        self.assertFalse(self.check(monitor_receipt={**self.monitor,"failureAlertDelivered":False})["checks"]["scheduled_backups_and_alert_delivered"])

    def test_sync_rejects_zero_ack_and_rejections(self):
        self.assertFalse(self.check(sync_receipt={**self.sync,"acknowledged":0})["checks"]["swlc_import_acknowledged"])
        self.assertFalse(self.check(sync_receipt={**self.sync,"rejected":2})["checks"]["swlc_import_acknowledged"])

    def test_unprotected_or_symlinked_receipt_fails_before_read(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/"receipt.json"
            path.write_text(json.dumps(self.backup))
            os.chmod(path,0o644)
            with self.assertRaises(gate.ShadowDriveGateError):
                gate.load_private(path)
            os.chmod(path,0o600)
            self.assertEqual(gate.load_private(path)["snapshot_id"],self.snapshot)
            alias=Path(td)/"alias.json"
            alias.symlink_to(path)
            with self.assertRaises(gate.ShadowDriveGateError):
                gate.load_private(alias)


if __name__ == "__main__":
    unittest.main()
