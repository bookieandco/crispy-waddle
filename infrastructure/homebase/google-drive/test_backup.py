#!/usr/bin/env python3
"""Hermetic backup safety and restore-hash tests (no Google credentials)."""

import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import backup


class RepositoryContractTests(unittest.TestCase):
    def test_repository_is_always_scoped(self):
        self.assertEqual(backup.repository_from_env({"GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-drive"}),
                         "rclone:jhadina-drive:homebase-postgres-restic-v1")
        for path in ["../personal", "/root", "folder//sub", "foo:bar", "folder/./data", "folder\\escape"]:
            with self.subTest(path=path), self.assertRaises(backup.BackupError):
                backup.repository_from_env({"GOOGLE_HOMEBASE_RCLONE_REMOTE": "drive", "GOOGLE_HOMEBASE_RESTIC_PATH": path})
        with self.assertRaises(backup.BackupError):
            backup.repository_from_env({"GOOGLE_HOMEBASE_RCLONE_REMOTE": "bad:other"})

    def test_remote_requires_exact_private_drive_folder(self):
        import json
        class Result:
            def __init__(self, code=0, payload=b""):
                self.returncode = code
                self.stdout = payload
        env = {
            "GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-drive",
            "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "PRIVATE_BACKUP_FOLDER_1234",
        }
        def command(argv, **kwargs):
            if argv[:3] == ["rclone", "config", "dump"]:
                return Result(payload=json.dumps({"jhadina-drive": {
                    "type": "drive", "root_folder_id": "PRIVATE_BACKUP_FOLDER_1234",
                    "token": "CONFIDENTIAL_FAKE_TOKEN"
                }}).encode())
            return Result()
        with patch.object(backup, "run_quiet", side_effect=command) as run:
            backup.remote_check(env)
            self.assertEqual(run.call_count, 2)
        with patch.object(backup, "run_quiet", side_effect=command):
            with self.assertRaisesRegex(backup.BackupError, "approved private backup folder"):
                backup.remote_check({**env, "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "SOME_OTHER_FOLDER_23456"})
        with patch.object(backup, "run_quiet") as run:
            with self.assertRaisesRegex(backup.BackupError, "BACKUP_FOLDER_ID"):
                backup.remote_check({**env, "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": ""})
            run.assert_not_called()

    def test_secret_file_must_be_private(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "restic-key"
            path.write_text("not-real-password")
            os.chmod(path, 0o644)
            with self.assertRaises(backup.BackupError):
                backup.require_password_file({"RESTIC_PASSWORD_FILE": str(path)})
            os.chmod(path, 0o600)
            self.assertEqual(backup.require_password_file({"RESTIC_PASSWORD_FILE": str(path)}), path)
            alias = Path(d) / "alias"
            alias.symlink_to(path)
            with self.assertRaises(backup.BackupError):
                backup.require_password_file({"RESTIC_PASSWORD_FILE": str(alias)})

    def test_postgres_never_runs_in_hosted_github_actions(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            compose, envfile = root / "compose.yml", root / ".env"
            compose.write_text("services: {}")
            envfile.write_text("VAR=value")
            with patch.object(backup, "run_quiet") as upload, patch.object(backup, "require_binary") as binaries:
                with self.assertRaisesRegex(backup.BackupError, "GitHub Actions"):
                    backup.archive_postgres("rclone:drive:repo",
                                            {"GITHUB_ACTIONS":"true"},
                                            compose, envfile, root / "backup")
                binaries.assert_not_called()
                upload.assert_not_called()
            self.assertFalse((root / "backup").exists())

    def test_symlinked_backup_root_denied_without_private_writes(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            target = d / "target"
            target.mkdir()
            symlink = d / "backup-root"
            symlink.symlink_to(target, target_is_directory=True)
            compose, envfile = d / "compose.yml", d / ".env"
            compose.write_text("services: {}")
            envfile.write_text("VAR=value")
            with patch.object(backup, "require_binary"), \
                 patch.object(backup, "run_quiet") as uploaded:
                with self.assertRaisesRegex(backup.BackupError, "symlinked backup root"):
                    backup.archive_postgres("rclone:drive:repo", {}, compose, envfile, symlink)
                uploaded.assert_not_called()
            self.assertEqual(list(target.iterdir()), [])

    def test_backup_must_return_exact_snapshot_id(self):
        output = b'{"message_type":"status"}\n{"message_type":"summary","snapshot_id":"' + (b"a"*64) + b'"}\n'
        self.assertEqual(backup.snapshot_id_from_json(output), "a"*64)
        with self.assertRaises(backup.BackupError):
            backup.snapshot_id_from_json(b'{"message_type":"summary","snapshot_id":"latest"}')

    def test_corrupt_restore_fails_closed(self):
        data = b"restored-data"
        class Result:
            returncode = 0
        def downloaded(args, **kwargs):
            kwargs["stdout"].write(data)
            return Result()
        with patch.object(backup.subprocess, "run", side_effect=downloaded) as process:
            self.assertTrue(backup.verify_restored_bytes("rclone:drive:repo", "a"*64,
                              hashlib.sha256(data).hexdigest()))
            self.assertEqual(process.call_args.args[0][-2:], ["a"*64, "/jhadina-postgres.dump"])
            self.assertEqual(process.call_args.kwargs["timeout"], 600)
            self.assertFalse(backup.verify_restored_bytes("rclone:drive:repo", "a"*64, "b"*64))
        with self.assertRaises(backup.BackupError):
            backup.verify_restored_bytes("rclone:drive:repo", "latest", "b"*64)

    def test_remote_restore_timeout_fails_closed(self):
        import subprocess
        def stalled(args, **kwargs):
            raise subprocess.TimeoutExpired(args, kwargs.get("timeout"))
        with patch.object(backup.subprocess, "run", side_effect=stalled):
            with self.assertRaises(subprocess.TimeoutExpired):
                backup.verify_restored_bytes("rclone:drive:repo", "a"*64, "b"*64)


    def test_success_creates_recovery_verified_receipt(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            compose, envfile = d / "compose.yml", d / ".env"
            compose.write_text("services: {}")
            envfile.write_text("VAR=value")
            data = b"PGDMP" + (b"test-record" * 100)
            snapshot = "c" * 64
            class Result:
                returncode = 0
                stdout = (b'{"message_type":"summary","snapshot_id":"' + snapshot.encode() + b'"}')
            def dump_pg(argv, **kwargs):
                kwargs["stdout"].write(data)
                return Result()
            with patch.object(backup, "require_binary"), patch.object(backup.subprocess, "run", side_effect=dump_pg), \
                 patch.object(backup, "run_quiet", return_value=Result()) as restic, \
                 patch.object(backup, "verify_restored_bytes", return_value=True) as verify:
                receipt = backup.archive_postgres("rclone:drive:repo", {}, compose, envfile, d / "safe")
            self.assertEqual(receipt["snapshot_id"], snapshot)
            self.assertEqual(receipt["sha256"], hashlib.sha256(data).hexdigest())
            self.assertTrue(receipt["remote_byte_restore_verified"])
            self.assertFalse(receipt["postgres_database_restore_tested"])
            self.assertFalse(receipt["canonical_authority_changed"])
            self.assertTrue((d / "safe" / "receipts" / (snapshot + ".json")).is_file())
            self.assertEqual(list((d / "safe" / "staging").iterdir()), [])
            restic.assert_called_once()
            verify.assert_called_once()

    def test_failed_pg_dump_cannot_upload(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            compose, envfile = d / "compose.yml", d / ".env"
            compose.write_text("services: {}")
            envfile.write_text("VAR=value")
            class Failed:
                returncode = 1
            with patch.object(backup, "require_binary"), patch.object(backup.subprocess, "run", return_value=Failed()), patch.object(backup, "run_quiet") as upload:
                with self.assertRaisesRegex(backup.BackupError, "logical dump failed"):
                    backup.archive_postgres("rclone:drive:repo", {}, compose, envfile, d / "safe")
                upload.assert_not_called()


if __name__ == "__main__":
    unittest.main()
