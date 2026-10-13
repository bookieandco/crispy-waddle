"""Hermetic SHARK-FRESH-COMMISSION.01-.05 authorization regression tests."""
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import shark_fresh_commission as gate


class FreshCommissionTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
        self.source = {
            "schema": "shark.fresh.integration-source.v1",
            "commit": "a" * 40, "sourceReviewed": True, "paperOnly": True,
        }
        self.preflight = {
            "schema": "SHARK-HISTORY-FRESH-PRESTART.v1",
            "status": "READY_FOR_OWNER_STAGING_REVIEW",
            "label": "NEW_HISTORY_NOT_RECOVERED", "startupExecuted": False,
            "workerCommissioned": False, "reasonCodes": [],
        }
        self.genesis = {
            "schema": "jhadina.shadow.paper-genesis.v1",
            "history_label": "NEW_EMPTY_RESEARCH_ONLY",
            "created_from_empty_initdb": True,
            "original_history_recovered": False, "state_root": "/mnt/shark/new",
            "pgdata_dev": 5, "pgdata_ino": 77, "pg_version": "17",
            "can_execute": False, "can_sign": False,
            "can_broadcast": False, "can_authorize_live": False,
        }
        self.doctor = {
            "schema": "jhadina.shadow.google-drive-doctor.v1",
            "owner_controlled_local_socket_verified": True,
            "machine_drive_oauth_and_encryption_remote_verified": True,
            "actual_backup_taken": False, "isolated_restore_verified": False,
        }
        self.backup = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "scope": "SHADOW_POSTGRES_ONLY",
            "source_kind": "LOCAL_SHADOW_UNIX_SOCKET",
            "restic_path": "shadow-postgres-restic-v1",
            "snapshot_id": "a" * 64, "sha256": "b" * 64,
            "completed_at": "2026-10-19T12:00:00Z",
            "encrypted_at_rest": True, "remote_bytes_restored_verified": True,
            "active_database_modified": False, "live_trading_authorized": False,
        }
        self.restore = {
            "schema": "jhadina.shadow.google-drive-restore.v2",
            "snapshot_id": "a" * 64, "sha256": "b" * 64,
            "semantic_integrity_verified": True,
            "required_shadow_tables_verified": True,
            "restored_grade_review_table_present": True,
            "restored_table_count": 9,
            "restored_ledger_counts": {key: 0 for key in gate.COUNTS},
            "network_isolated": True, "active_database_modified": False,
            "swlc_synced": False, "live_trading_authorized": False,
        }
        self.first_health = {
            "status": "ready", "observedAt": "2026-10-09T11:00:00Z",
            "authority": "SHADOW_LEARNING_ONLY",
            "canExecute": False, "canSign": False,
            "canBroadcast": False, "canAuthorizeLive": False,
        }
        self.later_health = {
            **self.first_health,
            "observedAt": "2026-10-19T11:00:00Z",
            "certification": {
                "observationCounts": {k: 1 for k in gate.HORIZONS},
                "lessonCounts": {k: 1 for k in gate.HORIZONS},
            },
        }

    def check(self, **kw):
        data = {key: getattr(self, key) for key in (
            "source", "preflight", "genesis", "doctor", "backup",
            "restore", "first_health", "later_health")}
        data.update(kw)
        return gate.assess(**data, now=self.now)

    def test_all_self_attested_receipts_still_do_not_certify_external_production(self):
        result = self.check()
        self.assertEqual(result["status"], "INDEPENDENT_HOST_AND_PROVIDER_ATTESTATION_REQUIRED")
        self.assertTrue(result["allReceiptShapesPassed"])
        self.assertFalse(result["productionCommissioned"])
        self.assertFalse(result["originalLedgerRecovered"])
        self.assertFalse(result["canExecute"])
        self.assertFalse(result["syntheticLearningPromoted"])
        self.assertFalse(result["realMoneyAuthorized"])

    def test_missing_evidence_blocks_all_five_phases(self):
        result = gate.assess(now=self.now)
        for phase in (".01", ".02", ".03", ".04", ".05"):
            self.assertTrue(result["phases"][phase]["blockers"], phase)
        self.assertEqual(result["status"], "BLOCKED")

    def test_unreviewed_integration_and_missing_persistent_host_block(self):
        result = self.check(source={**self.source, "sourceReviewed": False},
                            preflight={**self.preflight, "startupExecuted": True})
        self.assertTrue(result["phases"][".01"]["blockers"])
        self.assertTrue(result["phases"][".02"]["blockers"])

    def test_synthetic_or_existing_history_genesis_is_rejected(self):
        for changed in ({"original_history_recovered": True},
                        {"history_label": "RECOVERED_HISTORICAL"},
                        {"can_sign": True},
                        {"created_from_empty_initdb": False}):
            self.assertFalse(self.check(genesis={**self.genesis, **changed})[
                "phases"][".03"]["sourceChecksPassed"])

    def test_phone_drive_connector_cannot_substitute_worker_machine_oauth(self):
        result = self.check(doctor={**self.doctor,
                                    "machine_drive_oauth_and_encryption_remote_verified": False})
        self.assertTrue(result["phases"][".04"]["blockers"])

    def test_encrypted_receipt_not_a_restore_without_matching_snapshot(self):
        for changed in ({"sha256": "0" * 64},
                        {"network_isolated": False},
                        {"semantic_integrity_verified": False},
                        {"swlc_synced": True},
                        {"live_trading_authorized": True},
                        {"restored_ledger_counts": {"market_samples": 0}},
                        {"restored_table_count": 0}):
            self.assertFalse(self.check(restore={**self.restore, **changed})[
                "phases"][".04"]["sourceChecksPassed"])

    def test_restore_of_empty_database_is_allowed_as_initial_snapshot_only(self):
        result = self.check(later_health=None, first_health=None)
        self.assertTrue(result["phases"][".04"]["sourceChecksPassed"])
        self.assertFalse(result["phases"][".05"]["sourceChecksPassed"])
        self.assertFalse(result["productionCommissioned"])

    def test_no_six_horizon_fabrication_or_shortcut_to_day_seven(self):
        shorter = {**self.later_health, "observedAt": "2026-10-10T11:00:00Z"}
        self.assertIn("ACTUAL_SEVEN_DAY_FORWARD_OBSERVATION_WINDOW_REQUIRED",
                      self.check(later_health=shorter)["phases"][".05"]["blockers"])
        counts = {**self.later_health["certification"]["observationCounts"], "7D": 0}
        incomplete = {**self.later_health, "certification": {
            **self.later_health["certification"], "observationCounts": counts}}
        self.assertFalse(self.check(later_health=incomplete)[
            "phases"][".05"]["sourceChecksPassed"])

    def test_private_receipts_readonly_and_reject_world_readable_symlink(self):
        with tempfile.TemporaryDirectory() as td:
            file = Path(td) / "private.json"
            file.write_text(json.dumps(self.backup))
            file.chmod(0o600)
            self.assertEqual(gate.private_receipt(file)["snapshot_id"], "a" * 64)
            file.chmod(0o644)
            with self.assertRaises(gate.CommissionError):
                gate.private_receipt(file)
            file.chmod(0o600)
            link = Path(td) / "symlink.json"
            link.symlink_to(file)
            with self.assertRaises(gate.CommissionError):
                gate.private_receipt(link)


if __name__ == "__main__":
    unittest.main()
