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


if __name__=="__main__":
    unittest.main()
