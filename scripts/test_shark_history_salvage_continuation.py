"""Offline SHARK recovery 08-.10: original history never materialized by self-claims."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import shark_history_salvage_inventory as scanner
import shark_history_salvage_continuation as s


class HistoryContinuationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "old-source"
        self.root.mkdir()
        self.archive = self.root / "shadow-legacy.dump"
        self.archive.write_bytes(b"PGDMP" + b"historical candidate NOT authentic")
        self.snapshot = scanner.inventory(self.root)
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.review = s.review_archive(self.root, self.snapshot)
        self.backup = {
            "schema": "jhadina.google-homebase.db-backup.v1",
            "scope": "POSTGRES_ONLY",
            "source_kind": "LOCAL_HOMEBASE_COMPOSE",
            "hosted_supabase_data_covered": False,
            "remote_byte_restore_verified": True,
            "restic_encrypted": True,
            "snapshot_id": "a" * 64,
            "sha256": self.digest,
        }
        self.restored = {
            "schema": "jhadina.google-homebase.db-restore-drill.v1",
            "source_snapshot_id": "a" * 64,
            "source_sha256": self.digest,
            "source_kind": "LOCAL_HOMEBASE_COMPOSE",
            "hosted_supabase_data_covered": False,
            "isolated_network": True,
            "production_database_modified": False,
            "postgres_database_restore_tested": True,
            "restored_application_table_count": 3,
        }

    def test_exact_rescan_is_candidate_only(self):
        report = self.review
        self.assertEqual(report["candidateCount"], 1)
        self.assertEqual(report["status"], "ORIGINAL_CANDIDATES_UNVERIFIED")
        self.assertEqual(report["candidateHashes"][0]["sha256"], self.digest)
        self.assertFalse(report["originalLedgerRecovered"])
        self.assertFalse(report["allowedToImportLearning"])

    def test_changed_bytes_are_rejected_not_ingested(self):
        self.archive.write_bytes(b"PGDMP" + b"altered now")
        with self.assertRaisesRegex(s.SalvageGateError, "CHANGED"):
            s.review_archive(self.root, self.snapshot)

    def test_removed_artifact_is_detected(self):
        self.archive.unlink()
        with self.assertRaisesRegex(s.SalvageGateError, "CHANGED"):
            s.review_archive(self.root, self.snapshot)

    def test_snapshot_changed_identity_and_root_fail(self):
        wrong = {**self.snapshot, "rootFingerprint": "not-the-same"}
        with self.assertRaisesRegex(s.SalvageGateError, "ROOT_IDENTITY"):
            s.review_archive(self.root, wrong)
        tamper = {**self.snapshot, "entries": [
            {**self.snapshot["entries"][0], "sha256": "f" * 64}
        ]}
        with self.assertRaisesRegex(s.SalvageGateError, "SOURCE_BYTES_CHANGED"):
            s.review_archive(self.root, tamper)

    def test_no_original_candidate_returns_scoped_no_candidate(self):
        self.archive.rename(self.root / "synthetic-fixture.dump")
        latest = scanner.inventory(self.root)
        r = s.review_archive(self.root, latest)
        self.assertEqual(r["candidateCount"], 0)
        self.assertEqual(r["status"], "NO_ORIGINAL_CANDIDATE_IN_SCOPED_ROOT")

    def test_self_attested_backup_and_offline_restore_not_origin_proof(self):
        result = s.assess_backup_restore(self.review, self.backup, self.restored)
        self.assertEqual(result["status"], "RESTORED_CONTENT_EXTERNAL_LINEAGE_AUDIT_REQUIRED")
        self.assertFalse(result["historicalPodVolumeIdentityVerified"])
        self.assertFalse(result["historicalDecisionRowsVerified"])
        self.assertFalse(result["originalLedgerRecovered"])
        self.assertFalse(result["mayImportLearning"])

    def test_mismatched_snapshot_hash_or_bad_restore_blocks(self):
        for bad_backup, bad_restore in [
            ({**self.backup, "sha256": "f" * 64}, self.restored),
            (self.backup, {**self.restored, "source_snapshot_id": "b" * 64}),
            (self.backup, {**self.restored, "production_database_modified": True}),
            (self.backup, {**self.restored, "restored_application_table_count": 0}),
            ({**self.backup, "restic_encrypted": False}, self.restored),
            ({**self.backup, "remote_byte_restore_verified": False}, self.restored),
        ]:
            with self.subTest(backup=bad_backup, restore=bad_restore):
                self.assertEqual(s.assess_backup_restore(
                    self.review, bad_backup, bad_restore)["status"], "BLOCKED")

    def test_arbitrary_backup_cannot_match_synthetic(self):
        self.archive.rename(self.root / "shadow-synthetic-canary.dump")
        review = s.review_archive(self.root, scanner.inventory(self.root))
        r = s.assess_backup_restore(review, self.backup, self.restored)
        self.assertEqual(r["status"], "BLOCKED")
        self.assertIn("NO_EXACT_MATCHING_PG_DUMP_CANDIDATE", r["reasonCodes"])

    def test_private_receipt_enforced_and_readback(self):
        p = Path(self.tmp.name) / "scan.json"
        p.write_text(json.dumps(self.snapshot))
        os.chmod(p, 0o600)
        self.assertEqual(s.private_json(p)["schema"], self.snapshot["schema"])
        os.chmod(p, 0o644)
        with self.assertRaisesRegex(s.SalvageGateError, "PERMISSIONS"):
            s.private_json(p)
        p.unlink()
        p.symlink_to(self.archive)
        with self.assertRaisesRegex(s.SalvageGateError, "PRIVATE_ABSOLUTE"):
            s.private_json(p)

    def test_immutable_private_review_receipt_outside_source(self):
        output = Path(self.tmp.name) / "owner-audit-review.json"
        s.write_private_receipt(output, self.review, (self.root,))
        self.assertEqual(s.private_json(output)["candidateCount"], 1)
        self.assertEqual(os.stat(output).st_mode & 0o077, 0)
        with self.assertRaises(FileExistsError):
            s.write_private_receipt(output, {"madeUp": True}, (self.root,))

    def test_receipt_inside_old_archive_or_fresh_ledger_rejected(self):
        new = Path(self.tmp.name) / "fresh-paper"
        new.mkdir()
        for root, path in [
            (self.root, self.root / "receipt.json"),
            (new, new / "receipt.json"),
        ]:
            with self.subTest(root=root):
                with self.assertRaisesRegex(s.SalvageGateError, "MODIFY_LEDGER_ROOT"):
                    s.write_private_receipt(path, self.review, (root,))
                self.assertFalse(path.exists())

    def test_receipt_symlink_parent_not_followed(self):
        redirect = Path(self.tmp.name) / "alias"
        redirect.symlink_to(self.root, target_is_directory=True)
        output = redirect / "unsafe.json"
        with self.assertRaisesRegex(s.SalvageGateError, "SYMLINK"):
            s.write_private_receipt(output, self.review, (self.root,))
        self.assertFalse((self.root / "unsafe.json").exists())

    def test_staging_preflight_checks_real_fresh_mount_without_creating_it(self):
        new = Path(self.tmp.name) / "new-volume" / "shadow-new"
        parent = new.parent
        parent.mkdir()
        checked = s.fresh_start_preflight(
            old_root=self.root, new_root=new,
            owner_approval="YES_NEW_PAPER_HISTORY_NOT_RECOVERED",
            mount_probe=lambda p: "/mnt/storage ext4 /dev/disk/by-id/volume-1",
        )
        self.assertEqual(checked["status"], "READY_FOR_OWNER_STAGING_REVIEW")
        self.assertFalse(new.exists())
        self.assertEqual(checked["label"], "NEW_HISTORY_NOT_RECOVERED")
        self.assertFalse(checked["workerCommissioned"])
        self.assertFalse(checked["independentBackupRestored"])

    def test_fresh_preflight_blocks_root_overlap_ephemeral_mount_and_ci(self):
        new = Path(self.tmp.name) / "new-paper"
        common = dict(old_root=self.root, new_root=new,
                      owner_approval="YES_NEW_PAPER_HISTORY_NOT_RECOVERED")
        for args in [
            dict(common, new_root=self.root / "nested"),
            dict(common, new_root=self.root.parent),
            dict(common, mount_probe=lambda _: "/ overlay overlay"),
            dict(common, running_in_ci=True),
            dict(common, owner_approval=""),
        ]:
            with self.subTest(args=args):
                self.assertEqual(s.fresh_start_preflight(**args)["status"], "BLOCKED")

    def test_existing_new_pg_data_and_symlink_destination_block(self):
        new = Path(self.tmp.name) / "new-paper"
        new.mkdir()
        (new / "PG_VERSION").write_text("17")
        r = s.fresh_start_preflight(
            old_root=self.root, new_root=new,
            owner_approval="YES_NEW_PAPER_HISTORY_NOT_RECOVERED")
        self.assertIn("NEW_ROOT_MUST_BE_EMPTY", r["reasonCodes"])
        alternate = Path(self.tmp.name) / "new-link"
        alternate.symlink_to(new, target_is_directory=True)
        r = s.fresh_start_preflight(
            old_root=self.root, new_root=alternate,
            owner_approval="YES_NEW_PAPER_HISTORY_NOT_RECOVERED")
        self.assertEqual(r["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()
