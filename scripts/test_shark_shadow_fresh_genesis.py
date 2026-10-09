"""No PostgreSQL/RunPod needed: fresh paper genesis and backup-gated restart."""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("shark-shadow-fresh-ledger-genesis.py")
spec = importlib.util.spec_from_file_location("shark_fresh_genesis", MODULE)
assert spec and spec.loader
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class FreshPaperGenesisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "new-shadow-paper"
        self.pgdata = self.root / "postgres"
        self.pgdata.mkdir(parents=True)
        self.version = self.pgdata / "PG_VERSION"
        self.version.write_text("17\n")
        helper.create_genesis(str(self.root))
        self.backup = {
            "schema": "jhadina.shadow.google-drive-backup.v1",
            "source_kind": "LOCAL_SHADOW_UNIX_SOCKET", "scope": "SHADOW_POSTGRES_ONLY",
            "restic_path": "shadow-postgres-restic-v1", "snapshot_id": "a" * 64,
            "sha256": "b" * 64, "encrypted_at_rest": True,
            "remote_bytes_restored_verified": True,
            "active_database_modified": False, "live_trading_authorized": False,
        }
        self.restore = {
            "schema": "jhadina.shadow.google-drive-restore.v2",
            "snapshot_id": "a" * 64, "sha256": "b" * 64,
            "required_shadow_tables_verified": True,
            "semantic_integrity_verified": True,
            "restored_grade_review_table_present": True,
            "restored_table_count": 9,
            "restored_ledger_counts": {key: 0 for key in helper.ROWS},
            "network_isolated": True, "active_database_modified": False,
            "swlc_synced": False, "live_trading_authorized": False,
            "source_vs_restored_snapshot_row_parity_verified": False,
        }
        self.backup_path = Path(self.temp.name) / "real-backup-receipt.json"
        self.restore_path = Path(self.temp.name) / "real-restore-receipt.json"
        self.update_receipts()

    def update_receipts(self):
        for path, value in ((self.backup_path, self.backup),
                            (self.restore_path, self.restore)):
            path.write_text(json.dumps(value))
            path.chmod(0o600)

    def verify(self):
        return helper.verify_restart(
            str(self.root), str(self.backup_path), str(self.restore_path))

    def test_original_new_marker_survives_without_any_ledger_import(self):
        marker = helper.private_read(helper.genesis_path(str(self.root)))
        self.assertEqual(marker["history_label"], "NEW_EMPTY_RESEARCH_ONLY")
        self.assertFalse(marker["original_history_recovered"])
        self.assertEqual(os.stat(helper.genesis_path(str(self.root))).st_mode & 0o077, 0)
        self.assertEqual(self.verify()["state"], "SOURCE_ONLY_RESTART_ADMITTED")
        self.assertFalse(self.verify()["can_execute"])

    def test_existing_pgdata_without_genesis_always_denied(self):
        helper.genesis_path(str(self.root)).unlink()
        with self.assertRaises(OSError):
            self.verify()

    def test_genesis_cannot_be_replaced_or_created_twice(self):
        with self.assertRaises(FileExistsError):
            helper.create_genesis(str(self.root))

    def test_pg_version_change_and_marker_tamper_block(self):
        self.version.write_text("16\n")
        with self.assertRaisesRegex(helper.FreshGenesisError, "MUST_NOT_BE_ADMITTED"):
            self.verify()
        self.version.write_text("17\n")
        marker_path = helper.genesis_path(str(self.root))
        marker = helper.private_read(marker_path)
        marker["can_execute"] = True
        marker_path.write_text(json.dumps(marker))
        marker_path.chmod(0o600)
        with self.assertRaisesRegex(helper.FreshGenesisError, "MUST_NOT_BE_ADMITTED"):
            self.verify()

    def test_missing_encrypted_remote_backup_or_restore_blocks(self):
        for key, value in (("encrypted_at_rest", False),
                           ("remote_bytes_restored_verified", False),
                           ("snapshot_id", "bad"),
                           ("live_trading_authorized", True)):
            with self.subTest(key=key):
                broken = {**self.backup, key: value}
                self.backup = broken
                self.update_receipts()
                with self.assertRaises(helper.FreshGenesisError):
                    self.verify()
                self.backup = {**self.backup, key: self._valid_backup(key)}
        self.update_receipts()

    def _valid_backup(self, key):
        return {"encrypted_at_rest": True, "remote_bytes_restored_verified": True,
                "snapshot_id": "a" * 64, "live_trading_authorized": False}[key]

    def test_mismatch_or_nonisolated_restore_blocks(self):
        for key, value in (("sha256", "f" * 64),
                           ("network_isolated", False),
                           ("semantic_integrity_verified", False),
                           ("active_database_modified", True),
                           ("restored_grade_review_table_present", False),
                           ("restored_table_count", 1)):
            with self.subTest(key=key):
                restore = {**self.restore, key: value}
                self.restore_path.write_text(json.dumps(restore))
                self.restore_path.chmod(0o600)
                with self.assertRaises(helper.FreshGenesisError):
                    self.verify()

    def test_world_readable_or_symlink_receipt_denied(self):
        self.backup_path.chmod(0o644)
        with self.assertRaisesRegex(helper.FreshGenesisError, "PRIVATE"):
            self.verify()
        self.backup_path.unlink()
        self.backup_path.symlink_to(self.restore_path)
        with self.assertRaisesRegex(helper.FreshGenesisError, "PRIVATE"):
            self.verify()

    def test_pgdata_symlink_refused(self):
        moved = Path(self.temp.name) / "copy"
        self.pgdata.rename(moved)
        self.pgdata.symlink_to(moved, target_is_directory=True)
        with self.assertRaisesRegex(helper.FreshGenesisError, "PGDATA"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
