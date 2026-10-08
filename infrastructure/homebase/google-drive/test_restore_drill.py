"""Hermetic fail-closed tests for isolated database restoration."""
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import restore_drill as d


def receipt():
    return {"schema":"jhadina.google-homebase.db-backup.v1","scope":"POSTGRES_ONLY",
            "restic_encrypted":True,"remote_byte_restore_verified":True,
            "snapshot_id":"c"*64,"sha256":hashlib.sha256(b"PGDMP"+b"payload"*20).hexdigest()}


class RestoreTests(unittest.TestCase):
    def test_receipt_requires_exact_encrypted_byte_verified_source(self):
        s,h=d.validate_receipt(receipt())
        self.assertEqual(s,"c"*64)
        self.assertEqual(len(h),64)
        for bad in [{"scope":"MINIO"},{ "restic_encrypted":False},
                    {"remote_byte_restore_verified":False},{"snapshot_id":"latest"}]:
            with self.subTest(bad=bad), self.assertRaises(d.RestoreError):
                d.validate_receipt({**receipt(),**bad})

    def test_no_hosted_actions_or_unapproved_machine_restore(self):
        good={"JHADINA_RESTORE_TRUST_DOMAIN":"OWNER_CONTROLLED","JHADINA_RESTORE_APPROVED":"YES"}
        d.trusted_host(good)
        for patch_env in ({"GITHUB_ACTIONS":"true"},{"JHADINA_RESTORE_APPROVED":"NO"},
                          {"JHADINA_RESTORE_TRUST_DOMAIN":"OTHER"}):
            with self.subTest(patch_env=patch_env), self.assertRaises(d.RestoreError):
                d.trusted_host({**good,**patch_env})

    def test_hash_mismatch_cannot_reach_docker(self):
        class Result:
            returncode=0
        with tempfile.TemporaryDirectory() as tmp:
            dump=Path(tmp)/"restored.dump"
            def fake_exec(args, **kwargs):
                kwargs["stdout"].write(b"PGDMP"+b"corrupted")
                return Result()
            with patch.object(d,"safe_run",side_effect=fake_exec),patch.object(d,"restore_into_disposable_postgres") as docker:
                with self.assertRaisesRegex(d.RestoreError,"SHA256 mismatch"):
                    d.verify_download("rclone:drive:repo","a"*64,"b"*64,dump)
                docker.assert_not_called()

    def test_source_receipt_is_read_only_and_no_prod_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/"receipt.json"
            p.write_text(json.dumps(receipt()))
            os.chmod(p,0o600)
            env={"JHADINA_RESTORE_TRUST_DOMAIN":"OWNER_CONTROLLED","JHADINA_RESTORE_APPROVED":"YES",
                 "GOOGLE_HOMEBASE_RCLONE_REMOTE":"drive","GOOGLE_HOMEBASE_BACKUP_FOLDER_ID":"PRIVATE_FOLDER_012345",
                 "RESTIC_PASSWORD_FILE":"/secure/file"}
            with patch.object(d.backup,"require_password_file"),patch.object(d.backup,"require_binary"), \
                 patch.object(d.backup,"remote_check"),patch.object(d,"verify_download") as download, \
                 patch.object(d,"restore_into_disposable_postgres",return_value=42):
                result=d.drill(p,env)
            self.assertEqual(result["restored_application_table_count"],42)
            self.assertTrue(result["postgres_database_restore_tested"])
            self.assertFalse(result["production_database_modified"])
            self.assertFalse(result["other_subsystems_restored"])
            download.assert_called_once()

    def test_receipt_permissions_fail_before_any_provider_call(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/"receipt.json"
            p.write_text(json.dumps(receipt()))
            os.chmod(p,0o644)
            with patch.object(d.backup,"remote_check") as remote:
                with self.assertRaisesRegex(d.RestoreError,"owner-only"):
                    d.drill(p,{"JHADINA_RESTORE_TRUST_DOMAIN":"OWNER_CONTROLLED",
                               "JHADINA_RESTORE_APPROVED":"YES"})
                remote.assert_not_called()


if __name__=="__main__":
    unittest.main()
