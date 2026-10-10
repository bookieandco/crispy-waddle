"""Negative/positive contract tests for the dedicated Shadow Drive schema."""
import unittest

import shark_history_salvage_continuation as salvage
import shark_history_shadow_receipts as shadow


class ShadowReceiptsTests(unittest.TestCase):
    def setUp(self):
        self.digest = "a" * 64
        self.backup = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "source_kind": "LOCAL_SHADOW_UNIX_SOCKET",
            "scope": "SHADOW_POSTGRES_ONLY", "restic_path": "shadow-postgres-restic-v1",
            "snapshot_id": "b" * 64, "sha256": self.digest,
            "encrypted_at_rest": True, "remote_bytes_restored_verified": True,
            "isolated_database_restore_verified": False,
            "active_database_modified": False, "swlc_synced": False,
            "live_trading_authorized": False,
        }
        self.restore = {
            "schema": "jhadina.shadow.google-drive-restore.v2",
            "snapshot_id": self.backup["snapshot_id"], "sha256": self.digest,
            "required_shadow_tables_verified": True,
            "restored_table_count": 9, "semantic_integrity_verified": True,
            "restored_grade_review_table_present": True,
            "restored_ledger_counts": {
                "market_samples": 2, "decisions": 1, "executions": 1,
                "observations": 1, "lessons": 1, "calibrations": 0,
                "memories": 0, "sync_records": 0, "runtime_state": 1,
            },
            "restored_observation_horizons": {"15M": 1},
            "restored_lesson_horizons": {"15M": 1},
            "network_isolated": True, "active_database_modified": False,
            "swlc_synced": False, "live_trading_authorized": False,
            "source_vs_restored_snapshot_row_parity_verified": False,
            "all_learning_horizons_semantically_verified": False,
        }
        self.review = {
            "schema": "SHARK-HISTORY-SALVAGE-REVIEW.v1",
            "originalLedgerRecovered": False, "originalProvenanceVerified": False,
            "canExecute": False, "candidateCount": 1,
            "candidateHashes": [
                {"id": "local:test", "kind": "ORIGINAL_DB_CANDIDATE",
                 "sha256": self.digest, "bytes": 500},
            ],
        }

    def test_matching_shadow_receipts_escalate_to_audit_not_history(self):
        self.assertEqual(shadow.validate_shadow_receipt_pair(self.backup, self.restore), [])
        result = salvage.assess_backup_restore(self.review, self.backup, self.restore)
        self.assertEqual(result["status"], "RESTORED_CONTENT_EXTERNAL_LINEAGE_AUDIT_REQUIRED")
        self.assertFalse(result["historicalPodVolumeIdentityVerified"])
        self.assertFalse(result["historicalDecisionRowsVerified"])
        self.assertFalse(result["originalLedgerRecovered"])
        self.assertFalse(result["mayImportLearning"])

    def test_mutated_receipts_block(self):
        for key, value in (
            ("encrypted_at_rest", False), ("remote_bytes_restored_verified", False),
            ("scope", "POSTGRES_ONLY"), ("sha256", "f" * 64),
            ("source_kind", "LOCAL_HOMEBASE_COMPOSE"),
        ):
            with self.subTest(field=key):
                bad = {**self.backup, key: value}
                self.assertEqual(salvage.assess_backup_restore(
                    self.review, bad, self.restore)["status"], "BLOCKED")
        for key, value in (
            ("semantic_integrity_verified", False),
            ("restored_grade_review_table_present", False),
            ("network_isolated", False),
            ("sha256", "f" * 64),
            ("source_vs_restored_snapshot_row_parity_verified", True),
            ("all_learning_horizons_semantically_verified", True),
            ("live_trading_authorized", True),
            ("restored_observation_horizons", {"7D": 999}),
            ("restored_table_count", 3),
            ("restored_ledger_counts", {
                **self.restore["restored_ledger_counts"], "decisions": 0}),
        ):
            with self.subTest(field=key):
                bad = {**self.restore, key: value}
                self.assertEqual(salvage.assess_backup_restore(
                    self.review, self.backup, bad)["status"], "BLOCKED")

    def test_no_original_candidate_may_be_restored_by_name(self):
        review = {**self.review, "candidateCount": 0, "candidateHashes": []}
        result = salvage.assess_backup_restore(review, self.backup, self.restore)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertIn("NO_EXACT_MATCHING_PG_DUMP_CANDIDATE", result["reasonCodes"])

    def test_incomplete_shadow_rows_and_horizons_block(self):
        changed = {**self.restore, "restored_ledger_counts": {
            **self.restore["restored_ledger_counts"], "observations": -1}}
        self.assertIn("SHADOW_RESTORED_AGGREGATES_INVALID",
                      shadow.validate_shadow_receipt_pair(self.backup, changed))
        other = {**self.restore, "restored_lesson_horizons": {"7D": 2}}
        self.assertIn("SHADOW_RESTORED_HORIZON_COUNTS_INVALID",
                      shadow.validate_shadow_receipt_pair(self.backup, other))


if __name__ == "__main__":
    unittest.main()
