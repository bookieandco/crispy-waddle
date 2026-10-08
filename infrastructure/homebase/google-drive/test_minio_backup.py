"""Hermetic safety tests: object export never transfers live MinIO to hosted CI."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import minio_backup as m


def safe_env():
    return {
        "JHADINA_OBJECT_BACKUP_TRUST_DOMAIN": "OWNER_CONTROLLED",
        "JHADINA_OBJECT_BACKUP_APPROVED": "YES",
        "JHADINA_MINIO_BUCKET": "jhadina-test",
        "MC_HOST_jhadinaprivate": "http://owner:password@127.0.0.1:9000",
        "GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-drive",
        "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "PRIVATE_BACKUP_FOLDER_1234",
        "RESTIC_PASSWORD_FILE": "/private/restic",
    }


class MinioTests(unittest.TestCase):
    def test_source_is_loopback_and_approved_only(self):
        env = safe_env()
        self.assertEqual(m.source_bucket(env), "jhadina-test")
        for changes in (
            {"GITHUB_ACTIONS": "true"},
            {"JHADINA_OBJECT_BACKUP_APPROVED": "NO"},
            {"JHADINA_OBJECT_BACKUP_TRUST_DOMAIN": "PUBLIC_CI"},
            {"MC_HOST_jhadinaprivate": "https://owner:password@remote.example.com:9000"},
            {"MC_HOST_jhadinaprivate": "http://owner:password@localhost:9000"},
            {"JHADINA_MINIO_BUCKET": "my/other"},
            {"JHADINA_MINIO_BUCKET": "../secrets"},
        ):
            with self.subTest(changes=changes), self.assertRaises(m.ObjectBackupError):
                m.source_bucket({**env, **changes})

    def test_unsafe_keys_denied(self):
        for key in ("", "../escape", "dir/../escape", "/root", "foo//bar",
                    "a/./b", "hello\nworld", r"foo\other"):
            with self.subTest(key=key), self.assertRaises(m.ObjectBackupError):
                m.object_path(key)
        self.assertEqual(str(m.object_path("directory/file.bin")), "directory/file.bin")

    def test_inventory_caps_are_fail_closed(self):
        class RunResult:
            returncode = 0
            stdout = b'{"type":"file","key":"one.txt","size":3}\n{"type":"file","key":"two.txt","size":4}\n'
        with patch.object(m, "run", return_value=RunResult()):
            self.assertEqual(m.inventory("jhadina-test"), {"one.txt": 3, "two.txt": 4})
            with self.assertRaisesRegex(m.ObjectBackupError, "exceeds bounded"):
                m.inventory("jhadina-test", max_objects=1)
            with self.assertRaisesRegex(m.ObjectBackupError, "exceeds bounded"):
                m.inventory("jhadina-test", max_bytes=6)

    def test_inventory_rejects_error_and_duplicates(self):
        class Result:
            returncode = 0
            stdout = b'{"type":"file","key":"a","size":1}\n{"type":"file","key":"a","size":1}'
        with patch.object(m, "run", return_value=Result()):
            with self.assertRaisesRegex(m.ObjectBackupError, "Duplicate"):
                m.inventory("jhadina-test")
        Result.stdout = b'{"status":"error","error":"failed"}'
        with patch.object(m, "run", return_value=Result()):
            with self.assertRaisesRegex(m.ObjectBackupError, "reported an error"):
                m.inventory("jhadina-test")

    def test_exact_local_manifest_and_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            (folder/"nested").mkdir()
            (folder/"nested"/"file.txt").write_bytes(b"hello")
            first,n=m.snapshot_manifest(folder, {"nested/file.txt":5})
            self.assertEqual(len(first),64)
            self.assertEqual(n,5)
            with self.assertRaisesRegex(m.ObjectBackupError,"Missing"):
                m.snapshot_manifest(folder, {"nested/file.txt":5,"other":2})
            with self.assertRaisesRegex(m.ObjectBackupError,"size changed"):
                m.snapshot_manifest(folder, {"nested/file.txt":9})
            (folder/"nested"/"symlink").symlink_to(folder/"nested"/"file.txt")
            with self.assertRaisesRegex(m.ObjectBackupError,"Symlink"):
                m.snapshot_manifest(folder, {"nested/file.txt":5})

    def test_success_must_prove_restic_restore_before_receipt(self):
        # All provider operations simulated: this never performs real OAuth,
        # MinIO reads or actual encryption. A live canary still is required.
        with tempfile.TemporaryDirectory() as tmp:
            env=safe_env()
            before={"demo.txt": 4}
            snapshot="e"*64
            class Result:
                def __init__(self, code=0, stdout=b""):
                    self.returncode=code
                    self.stdout=stdout
            def fake_run(args, *, cwd=None, timeout=180, capture=False):
                if args[:2] == ["mc","mirror"]:
                    (Path(args[-1])/"demo.txt").write_bytes(b"demo")
                if args[0] == "restic" and "restore" in args:
                    target=Path(args[args.index("--target")+1])/"bucket"
                    target.mkdir()
                    (target/"demo.txt").write_bytes(b"demo")
                if args[0] == "restic" and "backup" in args:
                    return Result(stdout=(b'{"message_type":"summary","snapshot_id":"' + snapshot.encode() + b'"}'))
                return Result()
            with patch.object(m.backup, "require_password_file"), \
                 patch.object(m.backup, "require_binary"), \
                 patch.object(m.backup, "remote_check"), \
                 patch.object(m,"inventory",return_value=before), \
                 patch.object(m,"run",side_effect=fake_run):
                receipt=m.archive_objects(env,Path(tmp)/"backups")
            self.assertEqual(receipt["snapshot_id"],snapshot)
            self.assertEqual(receipt["object_count"],1)
            self.assertTrue(receipt["remote_bytes_restored_verified"])
            self.assertFalse(receipt["minio_api_rehydrate_tested"])
            self.assertFalse(receipt["version_history_covered"])
            self.assertFalse(receipt["atomic_source_snapshot"])
            self.assertFalse(receipt["production_data_modified"])
            self.assertEqual((Path(tmp)/"backups"/"receipts"/("objects-"+snapshot+".json")).stat().st_mode & 0o077,0)

    def test_failed_download_never_issues_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            env=safe_env()
            class Result:
                returncode=1
                stdout=b""
            def fake_run(args, *, cwd=None, timeout=180, capture=False):
                if args[:2] == ["mc","mirror"]:
                    (Path(args[-1])/"demo.txt").write_bytes(b"demo")
                    return type("Good",(),{"returncode":0,"stdout":b""})()
                return Result()
            with patch.object(m.backup, "require_password_file"), \
                 patch.object(m.backup, "require_binary"), \
                 patch.object(m.backup, "remote_check"), \
                 patch.object(m,"inventory",return_value={"demo.txt":4}), \
                 patch.object(m,"run",side_effect=fake_run):
                with self.assertRaisesRegex(m.ObjectBackupError,"Restic object write failed"):
                    m.archive_objects(env,Path(tmp)/"backups")
            self.assertFalse((Path(tmp)/"backups"/"receipts").exists())


if __name__ == "__main__":
    unittest.main()
