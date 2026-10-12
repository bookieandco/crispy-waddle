#!/usr/bin/env python3
import json
import os
import tempfile
import unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path

import shadow_drive_monitor as monitor


class ShadowWatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        (self.root/"receipts").mkdir()
        self.now=datetime(2026,10,8,tzinfo=timezone.utc)

    def receipt(self, *, age_hours: int=1, valid=True):
        snapshot="a"*64
        receipt={
            "schema":"jhadina.shadow.google-drive-backup.v1",
            "source_kind":"LOCAL_SHADOW_UNIX_SOCKET",
            "scope":"SHADOW_POSTGRES_ONLY",
            "restic_path":"shadow-postgres-restic-v1",
            "snapshot_id":snapshot,
            "sha256":"b"*64,
            "encrypted_at_rest":valid,
            "remote_bytes_restored_verified":True,
            "live_trading_authorized":False,
            "completed_at":(self.now-timedelta(hours=age_hours)).isoformat(),
        }
        path=self.root/"receipts"/("shadow-"+snapshot+".json")
        path.write_text(json.dumps(receipt))
        os.chmod(path,0o600)
        return path

    def test_missing_snapshot_blocks_and_never_claims_alert_delivery(self):
        result=monitor.status(self.root,now=self.now)
        self.assertFalse(result["healthy"])
        self.assertFalse(result["scheduleEnabled"])
        self.assertFalse(result["failureAlertDelivered"])

    def test_fresh_snapshot_is_eligible_for_health_only(self):
        self.receipt()
        result=monitor.status(self.root,now=self.now)
        self.assertTrue(result["healthy"])
        self.assertEqual(result["ageHours"],1)
        self.assertFalse(result["scheduleEnabled"])

    def test_stale_or_unencrypted_snapshot_is_not_healthy(self):
        self.receipt(age_hours=40)
        self.assertFalse(monitor.status(self.root,now=self.now,max_age_hours=36)["healthy"])
        self.receipt(age_hours=1,valid=False)
        self.assertFalse(monitor.status(self.root,now=self.now)["healthy"])

    def test_symlinked_receipt_cannot_count(self):
        real=self.receipt()
        real.unlink()
        (self.root/"receipts"/("shadow-"+("a"*64)+".json")).symlink_to(self.root/"nonexistent")
        self.assertFalse(monitor.status(self.root,now=self.now)["healthy"])


if __name__=="__main__":
    unittest.main()
