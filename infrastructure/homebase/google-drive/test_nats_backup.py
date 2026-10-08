"""Hermetic JetStream archival safety tests: no NATS/Drive auth or live writes."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import nats_backup as n


def env():
    return {
        "JHADINA_NATS_BACKUP_TRUST_DOMAIN": "OWNER_CONTROLLED",
        "JHADINA_NATS_BACKUP_APPROVED": "YES",
        "JHADINA_NATS_BACKUP_STREAM": "JHADINA_EVENTS",
        "JHADINA_NATS_BACKUP_SERVER": "nats://127.0.0.1:4222",
        "GOOGLE_HOMEBASE_RCLONE_REMOTE": "jhadina-drive",
        "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID": "PRIVATE_BACKUP_FOLDER_1234",
        "RESTIC_PASSWORD_FILE": "/private/restic",
    }


def make_backup(root: Path, payload: bytes = b"archive-binary"):
    root.mkdir(exist_ok=True, parents=True)
    (root/"backup.json").write_text('{"name":"JHADINA_EVENTS","state":{"messages":1}}')
    (root/"stream.arc.s2").write_bytes(payload)


class JetstreamTests(unittest.TestCase):
    def test_requires_exact_local_nats_and_owner_scope(self):
        self.assertEqual(n.stream_source(env()), ("JHADINA_EVENTS", "nats://127.0.0.1:4222"))
        for override in (
            {"GITHUB_ACTIONS": "true"},
            {"JHADINA_NATS_BACKUP_APPROVED": "NO"},
            {"JHADINA_NATS_BACKUP_TRUST_DOMAIN": "UNTRUSTED"},
            {"JHADINA_NATS_BACKUP_STREAM": "../UNSAFE"},
            {"JHADINA_NATS_BACKUP_SERVER": "nats://nats.example.org:4222"},
            {"JHADINA_NATS_BACKUP_SERVER": "nats://127.0.0.1:4223"},
            {"JHADINA_NATS_BACKUP_SERVER": "nats://token:secret@127.0.0.1:4222"},
        ):
            with self.subTest(override=override), self.assertRaises(n.StreamBackupError):
                n.stream_source({**env(), **override})

    def test_archive_manifest_detects_missing_archive_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/"snapshot"
            make_backup(root)
            digest,size,count=n.archive_manifest(root)
            self.assertEqual(len(digest),64)
            self.assertGreater(size,0)
            self.assertEqual(count,2)
            (root/"stream.arc.s2").unlink()
            with self.assertRaisesRegex(n.StreamBackupError,"archive missing"):
                n.archive_manifest(root)
            (root/"stream.arc.s2").symlink_to(root/"backup.json")
            with self.assertRaisesRegex(n.StreamBackupError,"Symlink"):
                n.archive_manifest(root)

    def test_reject_old_format_without_confirmed_restore_support(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/"snapshot"
            make_backup(root)
            (root/"stream.arc.s2").rename(root/"stream.tar.s2")
            with self.assertRaisesRegex(n.StreamBackupError,"Older stream.tar.s2"):
                n.archive_manifest(root)

    def test_remote_restore_success_only_with_offline_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot="e"*64
            class Result:
                def __init__(self, code=0, stdout=b""):
                    self.returncode=code
                    self.stdout=stdout
            calls=[]
            def fake_execute(args,cwd,*,timeout=180,capture=False):
                calls.append(args)
                if args[:4]==["nats","--server","nats://127.0.0.1:4222","backup"]:
                    make_backup(Path(args[6]))
                if args[:3]==["restic","-r","rclone:jhadina-drive:homebase-postgres-restic-v1"] and "backup" in args:
                    return Result(stdout=b'{"message_type":"summary","snapshot_id":"' + snapshot.encode()+b'"}')
                if "restore" in args and args[0]=="restic":
                    restore_folder=Path(args[args.index("--target")+1])/"nats-stream-backup"
                    make_backup(restore_folder)
                return Result()
            with patch.object(n.backup,"require_password_file"), \
                 patch.object(n.backup,"require_binary"), \
                 patch.object(n.backup,"remote_check"), \
                 patch.object(n,"execute",side_effect=fake_execute):
                receipt=n.archive_stream(env(),Path(tmp)/"backup-root")
            self.assertTrue(receipt["remote_bytes_restored_verified"])
            self.assertTrue(receipt["nats_archive_offline_validated"])
            self.assertFalse(receipt["nats_api_restore_tested"])
            self.assertFalse(receipt["consumer_positions_rehydrated_tested"])
            self.assertFalse(receipt["production_queue_modified"])
            self.assertTrue((Path(tmp)/"backup-root"/"receipts"/("nats-"+snapshot+".json")).is_file())
            self.assertEqual((Path(tmp)/"backup-root"/"receipts"/("nats-"+snapshot+".json")).stat().st_mode & 0o077,0)
            self.assertEqual(sum("validate" in a for a in calls),2)

    def test_failed_offline_validation_does_not_publish_restic(self):
        with tempfile.TemporaryDirectory() as tmp:
            class Result:
                returncode=1
            def bad_validate(args,cwd,*,timeout=180,capture=False):
                if args[:4]==["nats","--server","nats://127.0.0.1:4222","backup"]:
                    make_backup(Path(args[6]))
                    return type("Ok",(),{"returncode":0})()
                return Result()
            with patch.object(n.backup,"require_password_file"), \
                 patch.object(n.backup,"require_binary"), \
                 patch.object(n.backup,"remote_check"), \
                 patch.object(n,"execute",side_effect=bad_validate) as exe:
                with self.assertRaisesRegex(n.StreamBackupError,"validation failed"):
                    n.archive_stream(env(),Path(tmp)/"backups")
            self.assertFalse(any(a.args[0][0]=="restic" for a in exe.call_args_list))
            self.assertFalse((Path(tmp)/"backups"/"receipts").exists())

    def test_no_false_receipt_when_remote_restore_differs(self):
        with tempfile.TemporaryDirectory() as tmp:
            snapshot="f"*64
            class Result:
                def __init__(self, code=0, stdout=b""):
                    self.returncode=code
                    self.stdout=stdout
            def tampered(args,cwd,*,timeout=180,capture=False):
                if args[:4]==["nats","--server","nats://127.0.0.1:4222","backup"]:
                    make_backup(Path(args[6]))
                if args[0]=="restic" and "backup" in args:
                    return Result(stdout=b'{"message_type":"summary","snapshot_id":"'+snapshot.encode()+b'"}')
                if args[0]=="restic" and "restore" in args:
                    restored=Path(args[args.index("--target")+1])/"nats-stream-backup"
                    make_backup(restored,b"tampered")
                return Result()
            with patch.object(n.backup,"require_password_file"), \
                 patch.object(n.backup,"require_binary"), \
                 patch.object(n.backup,"remote_check"), \
                 patch.object(n,"execute",side_effect=tampered):
                with self.assertRaisesRegex(n.StreamBackupError,"manifest mismatch"):
                    n.archive_stream(env(),Path(tmp)/"backups")
            self.assertFalse((Path(tmp)/"backups"/"receipts").exists())


if __name__=="__main__":
    unittest.main()
