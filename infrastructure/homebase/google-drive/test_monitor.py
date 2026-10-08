"""Backup watchdog never treats file existence as proof of recovery."""
import json
import tempfile
import unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path

import monitor


class MonitorTests(unittest.TestCase):
    def test_empty_folder_is_unhealthy(self):
        with tempfile.TemporaryDirectory() as root:
            state=monitor.check_backups(Path(root),at=datetime.now(timezone.utc))
            self.assertFalse(state["healthy"])
            self.assertEqual(state["reason"],"NO_VERIFIED_BACKUP_RECEIPT")

    def test_receipt_must_be_timestamped_and_byte_verified(self):
        now=datetime(2026,10,7,12,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)
            name="a"*64
            r={"schema":"jhadina.google-homebase.db-backup.v1","scope":"POSTGRES_ONLY",
               "restic_encrypted":True,"remote_byte_restore_verified":False,
               "snapshot_id":name,"completed_at":now.isoformat()}
            file=folder/(name+".json")
            file.write_text(json.dumps(r))
            self.assertFalse(monitor.check_backups(folder,at=now)["healthy"])
            r["remote_byte_restore_verified"]=True
            file.write_text(json.dumps(r))
            self.assertTrue(monitor.check_backups(folder,at=now)["healthy"])
            state=monitor.check_backups(folder,at=now+timedelta(days=3))
            self.assertFalse(state["healthy"])
            self.assertEqual(state["reason"],"VERIFIED_BACKUP_STALE")

    def test_missing_timestamp_not_accepted(self):
        with tempfile.TemporaryDirectory() as root:
            name="b"*64
            (Path(root)/(name+".json")).write_text(json.dumps({
                "schema":"jhadina.google-homebase.db-backup.v1","scope":"POSTGRES_ONLY",
                "restic_encrypted":True,"remote_byte_restore_verified":True,
                "snapshot_id":name}))
            self.assertFalse(monitor.check_backups(Path(root),at=datetime.now(timezone.utc))["healthy"])


    def test_exact_bucket_required_for_object_receipts(self):
        now=datetime(2026,10,7,20,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)
            name="c"*64
            payload={
                "schema":"jhadina.google-homebase.object-backup.v1",
                "scope":"ONE_MINIO_BUCKET_CURRENT_OBJECTS",
                "bucket":"director",
                "restic_encrypted":True,
                "remote_bytes_restored_verified":True,
                "minio_api_rehydrate_tested":False,
                "object_count":2,
                "sha256_object_manifest":"d"*64,
                "snapshot_id":name,
                "completed_at":now.isoformat(),
            }
            file=folder/("objects-"+name+".json")
            file.write_text(json.dumps(payload))
            own=monitor.check_object_archive(folder,"director",at=now)
            other=monitor.check_object_archive(folder,"music",at=now)
            self.assertTrue(own["healthy"])
            self.assertFalse(own["minio_api_restore_certified"])
            self.assertFalse(other["healthy"])
            self.assertEqual(other["reason"],"NO_VERIFIED_OBJECT_BYTE_ARCHIVE")
            self.assertFalse(monitor.check_object_archive(
                folder,"director",at=now+timedelta(days=3))["healthy"])
            payload["remote_bytes_restored_verified"]=False
            file.write_text(json.dumps(payload))
            self.assertFalse(monitor.check_object_archive(folder,"director",at=now)["healthy"])

    def test_object_manifest_hash_required(self):
        now=datetime(2026,10,7,20,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as root:
            name="e"*64
            (Path(root)/("objects-"+name+".json")).write_text(json.dumps({
                "schema":"jhadina.google-homebase.object-backup.v1",
                "scope":"ONE_MINIO_BUCKET_CURRENT_OBJECTS",
                "bucket":"director",
                "restic_encrypted":True,
                "remote_bytes_restored_verified":True,
                "minio_api_rehydrate_tested":False,
                "object_count":3,
                "sha256_object_manifest":"NOT_A_SHA256",
                "snapshot_id":name,
                "completed_at":now.isoformat()
            }))
            self.assertFalse(monitor.check_object_archive(Path(root),"director",at=now)["healthy"])
            with self.assertRaises(monitor.MonitorError):
                monitor.check_object_archive(Path(root),"../escape",at=now)


if __name__=="__main__":
    unittest.main()
