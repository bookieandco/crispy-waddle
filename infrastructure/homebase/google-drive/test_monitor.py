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
               "source_kind":"LOCAL_HOMEBASE_COMPOSE","hosted_supabase_data_covered":False,
               "restic_encrypted":True,"remote_byte_restore_verified":False,
               "snapshot_id":name,"completed_at":now.isoformat()}
            file=folder/(name+".json")
            file.write_text(json.dumps(r))
            self.assertFalse(monitor.check_backups(folder,at=now)["healthy"])
            r["remote_byte_restore_verified"]=True
            file.write_text(json.dumps(r))
            self.assertTrue(monitor.check_backups(folder,at=now)["healthy"])
            r["source_kind"]="SUPABASE_HOSTED"
            file.write_text(json.dumps(r))
            self.assertFalse(monitor.check_backups(folder,at=now)["healthy"])
            r["source_kind"]="LOCAL_HOMEBASE_COMPOSE"
            r["hosted_supabase_data_covered"]=True
            file.write_text(json.dumps(r))
            self.assertFalse(monitor.check_backups(folder,at=now)["healthy"])
            r["hosted_supabase_data_covered"]=False
            file.write_text(json.dumps(r))
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


    def test_nats_watch_is_exact_stream_and_rejects_unverified_receipts(self):
        now=datetime(2026,10,7,20,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)
            snapshot="f"*64
            record={
                "schema":"jhadina.google-homebase.jetstream-backup.v1",
                "scope":"ONE_NATS_STREAM_WITH_CONSUMER_SNAPSHOT",
                "stream":"JHADINA_EVENTS",
                "encrypted_with_restic":True,
                "remote_bytes_restored_verified":True,
                "nats_archive_offline_validated":True,
                "sha256_archive_manifest":"e"*64,
                "snapshot_id":snapshot,
                "completed_at":now.isoformat(),
                "nats_api_restore_tested":False
            }
            path=folder/("nats-"+snapshot+".json")
            path.write_text(json.dumps(record))
            proof=monitor.check_nats_archive(folder,"JHADINA_EVENTS",at=now)
            self.assertTrue(proof["healthy"])
            self.assertFalse(proof["nats_consumer_recovery_certified"])
            self.assertFalse(monitor.check_nats_archive(folder,"ANOTHER_STREAM",at=now)["healthy"])
            self.assertFalse(monitor.check_nats_archive(
                folder,"JHADINA_EVENTS",at=now+timedelta(days=4))["healthy"])
            record["remote_bytes_restored_verified"]=False
            path.write_text(json.dumps(record))
            self.assertFalse(monitor.check_nats_archive(folder,"JHADINA_EVENTS",at=now)["healthy"])
            with self.assertRaises(monitor.MonitorError):
                monitor.check_nats_archive(folder,"../../other",at=now)


if __name__=="__main__":
    unittest.main()
