#!/usr/bin/env python3
"""Hermetic Shadow Google Drive migration tests: never contact provider APIs."""
import hashlib
import json
import os
import socket
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import backup
import restore_drill
import shadow_backup


class FakeResult:
    def __init__(self, returncode=0, stdout=b""):
        self.returncode = returncode
        self.stdout = stdout


class SourceBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "shadow"
        (self.root / "socket").mkdir(parents=True)
        self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.socket.bind(str(self.root / "socket" / ".s.PGSQL.55432"))
        self.addCleanup(self.socket.close)
        self.env = {
            "JHADINA_HOMEBASE_TRUST_DOMAIN": "OWNER_CONTROLLED",
            "SHADOW_DRIVE_BACKUP_APPROVED": "YES",
            "SHARK_SHADOW_DATA_DIR": str(self.root),
        }

    def test_local_socket_required_and_database_fixed_by_explicit_local_identity(self):
        source = shadow_backup.source_settings(self.env)
        self.assertEqual(source["database"], "jhadina_shadow")
        self.assertEqual(source["socket"], str(self.root / "socket"))
        self.assertEqual(source["port"], "55432")
        with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "running Shadow"):
            shadow_backup.source_settings({**self.env, "SHARK_SHADOW_POSTGRES_PORT": "55555"})
        with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "identity"):
            shadow_backup.source_settings({**self.env, "SHARK_SHADOW_POSTGRES_DB": "bad;DROP"})

    def test_unapproved_and_hosted_sources_fail_before_remote_calls(self):
        for env in ({**self.env, "GITHUB_ACTIONS": "true"},
                    {**self.env, "SHADOW_DRIVE_BACKUP_APPROVED": "NO"},
                    {**self.env, "JHADINA_HOMEBASE_TRUST_DOMAIN": "OTHER"}):
            with self.assertRaises(shadow_backup.ShadowBackupError):
                shadow_backup.source_settings(env)

    def test_symlinked_shadow_directory_rejected(self):
        alias = Path(self.temp.name) / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "non-symlink"):
            shadow_backup.source_settings({**self.env, "SHARK_SHADOW_DATA_DIR": str(alias)})


class EncryptedArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = {"socket": str(self.root / "socket"), "port": "55432",
                       "user": "jhadina_shadow_pg", "database": "jhadina_shadow"}
        self.payload = b"PGDMP" + b"not-real-user-data" * 40
        self.snapshot = "a" * 64

    def fake_pg(self, argv, **kwargs):
        self.assertIn(argv[0], ("psql", "pg_dump"))
        self.assertIn("-h", argv)
        self.assertIn(str(self.root / "socket"), argv)
        self.assertNotIn("postgresql://", " ".join(argv))
        self.assertEqual(kwargs["env"].get("PGHOST"), None)
        if argv[0] == "psql":
            tables = "\n".join(sorted(shadow_backup.REQUIRED_TABLES)) + "\n"
            return FakeResult(stdout=tables.encode())
        kwargs["stdout"].write(self.payload)
        return FakeResult()

    def fake_restic(self, argv, **kwargs):
        self.assertEqual(argv[0], "restic")
        self.assertIn("--tag", argv)
        self.assertIn(shadow_backup.DUMP_NAME, argv)
        return FakeResult(stdout=(b'{"message_type":"summary","snapshot_id":"' +
                                  self.snapshot.encode() + b'"}\n'))

    def download_success(self, repository, snapshot, target, expected):
        self.assertEqual(repository, "rclone:drive:shadow-postgres-restic-v1")
        self.assertEqual(snapshot, self.snapshot)
        self.assertEqual(expected, hashlib.sha256(self.payload).hexdigest())
        target.write_bytes(self.payload)

    def test_snapshot_creates_receipt_only_after_encrypted_restore(self):
        with patch.object(shadow_backup.backup, "require_binary"), \
             patch.object(shadow_backup.subprocess, "run", side_effect=self.fake_pg), \
             patch.object(shadow_backup.backup, "run_quiet", side_effect=self.fake_restic), \
             patch.object(shadow_backup, "restic_download", side_effect=self.download_success):
            result = shadow_backup.archive("rclone:drive:shadow-postgres-restic-v1",
                                           self.source, self.root / "archive")
        self.assertTrue(result["encrypted_at_rest"])
        self.assertTrue(result["remote_bytes_restored_verified"])
        self.assertFalse(result["isolated_database_restore_verified"])
        self.assertFalse(result["active_database_modified"])
        self.assertFalse(result["swlc_synced"])
        receipt = self.root / "archive" / "receipts" / ("shadow-" + self.snapshot + ".json")
        self.assertTrue(receipt.is_file())
        self.assertEqual(receipt.stat().st_mode & 0o077, 0)
        self.assertEqual(shadow_backup.validated_receipt(receipt)["snapshot_id"], self.snapshot)
        self.assertEqual(list((self.root / "archive" / "staging").iterdir()), [])

    def test_bad_pg_dump_never_uploads(self):
        def broken_dump(argv, **kwargs):
            if argv[0] == "psql":
                return self.fake_pg(argv, **kwargs)
            return FakeResult(returncode=1)
        with patch.object(shadow_backup.backup, "require_binary"), \
             patch.object(shadow_backup.subprocess, "run", side_effect=broken_dump), \
             patch.object(shadow_backup.backup, "run_quiet") as upload:
            with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "logical dump failed"):
                shadow_backup.archive("rclone:drive:repo", self.source, self.root / "failed")
            upload.assert_not_called()

    def test_wrong_database_without_shadow_schema_is_never_exported(self):
        with patch.object(shadow_backup.backup, "require_binary"), \
             patch.object(shadow_backup.subprocess, "run",
                          return_value=FakeResult(stdout=b"customer_pii\n")) as subprocess_run, \
             patch.object(shadow_backup.backup, "run_quiet") as upload:
            with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "ledger tables absent"):
                shadow_backup.archive("rclone:drive:repo", self.source, self.root / "wrong")
            self.assertEqual(subprocess_run.call_count, 1)
            self.assertEqual(subprocess_run.call_args.args[0][0], "psql")
            upload.assert_not_called()
            self.assertFalse((self.root / "wrong").exists())

    def test_wrong_restored_bytes_issue_no_receipt(self):
        with patch.object(shadow_backup.backup, "require_binary"), \
             patch.object(shadow_backup.subprocess, "run", side_effect=self.fake_pg), \
             patch.object(shadow_backup.backup, "run_quiet", side_effect=self.fake_restic), \
             patch.object(shadow_backup, "restic_download", side_effect=shadow_backup.ShadowBackupError("checksum failed")):
            with self.assertRaisesRegex(shadow_backup.ShadowBackupError, "checksum failed"):
                shadow_backup.archive("rclone:drive:repo", self.source, self.root / "corrupt")
        self.assertFalse((self.root / "corrupt" / "receipts").exists())

    def test_receipts_must_remain_owner_only(self):
        path = self.root / "receipt.json"
        path.write_text("{}")
        os.chmod(path, 0o644)
        with self.assertRaises(shadow_backup.ShadowBackupError):
            shadow_backup.validated_receipt(path)

    def test_restore_reuses_isolated_postgres_and_exact_table_set(self):
        receipt = {"snapshot_id": self.snapshot, "sha256": hashlib.sha256(self.payload).hexdigest()}
        with patch.object(shadow_backup.restore_drill, "trusted_host") as trusted, \
             patch.object(shadow_backup, "restic_download", side_effect=self.download_success), \
             patch.object(shadow_backup.restore_drill, "restore_into_disposable_postgres",
                          return_value=len(shadow_backup.REQUIRED_TABLES)) as restored:
            result = shadow_backup.recovery_drill("rclone:drive:shadow-postgres-restic-v1",
                                                  receipt, {"JHADINA_RESTORE_APPROVED": "YES"})
        trusted.assert_called_once()
        self.assertEqual(restored.call_args.kwargs["required_tables"], shadow_backup.REQUIRED_TABLES)
        self.assertTrue(result["required_shadow_tables_verified"])
        self.assertFalse(result["all_learning_horizons_semantically_verified"])

    def test_provider_scope_is_separate_shadow_repository(self):
        env = {"GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-shadow",
               "GOOGLE_HOMEBASE_RESTIC_PATH": "homebase-postgres-restic-v1"}
        with patch.object(backup, "require_binary"), \
             patch.object(backup, "require_password_file"), \
             patch.object(backup, "remote_check") as check:
            repo = shadow_backup.scoped_repository(env)
        self.assertEqual(repo, "rclone:jhadina-shadow:shadow-postgres-restic-v1")
        self.assertEqual(check.call_args.args[0]["GOOGLE_HOMEBASE_RESTIC_PATH"],
                         "shadow-postgres-restic-v1")


class IsolatedRestoreSchemaTests(unittest.TestCase):
    def test_exact_shadow_tables_required_inside_disposable_database(self):
        names = b"\n".join(x.encode() for x in sorted(shadow_backup.REQUIRED_TABLES)) + b"\n"
        with tempfile.TemporaryDirectory() as td:
            payload = Path(td) / "fixture.dump"
            payload.write_bytes(b"PGDMP" + b"fixture")
            with patch.object(restore_drill.shutil, "which", return_value="/usr/bin/docker"), \
                 patch.object(restore_drill, "safe_run", return_value=FakeResult()), \
                 patch.object(restore_drill.subprocess, "run", side_effect=[
                     FakeResult(stdout=b"9\n"), FakeResult(stdout=names)]):
                self.assertEqual(
                    restore_drill.restore_into_disposable_postgres(
                        payload, required_tables=shadow_backup.REQUIRED_TABLES), 9)
            with patch.object(restore_drill.shutil, "which", return_value="/usr/bin/docker"), \
                 patch.object(restore_drill, "safe_run", return_value=FakeResult()), \
                 patch.object(restore_drill.subprocess, "run", side_effect=[
                     FakeResult(stdout=b"9\n"), FakeResult(stdout=b"not_shadow\n")]):
                with self.assertRaisesRegex(restore_drill.RestoreError, "Required Shadow"):
                    restore_drill.restore_into_disposable_postgres(
                        payload, required_tables=shadow_backup.REQUIRED_TABLES)


if __name__ == "__main__":
    unittest.main()
