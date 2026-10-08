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
            "source_kind":"LOCAL_HOMEBASE_COMPOSE","hosted_supabase_data_covered":False,
            "restic_encrypted":True,"remote_byte_restore_verified":True,
            "snapshot_id":"c"*64,"sha256":hashlib.sha256(b"PGDMP"+b"payload"*20).hexdigest()}


class RestoreTests(unittest.TestCase):
    def test_receipt_requires_exact_encrypted_byte_verified_source(self):
        s,h=d.validate_receipt(receipt())
        self.assertEqual(s,"c"*64)
        self.assertEqual(len(h),64)
        for bad in [{"scope":"MINIO"},{ "restic_encrypted":False},
                    {"remote_byte_restore_verified":False},{"snapshot_id":"latest"},
                    {"source_kind":"SUPABASE_HOSTED"},
                    {"source_kind":None},
                    {"hosted_supabase_data_covered":True}]:
            with self.subTest(bad=bad), self.assertRaises(d.RestoreError):
                d.validate_receipt({**receipt(),**bad})

    def test_no_hosted_actions_or_unapproved_machine_restore(self):
        good={"JHADINA_RESTORE_TRUST_DOMAIN":"OWNER_CONTROLLED","JHADINA_RESTORE_APPROVED":"YES"}
        d.trusted_host(good)
        for patch_env in ({"GITHUB_ACTIONS":"true"},{"JHADINA_RESTORE_APPROVED":"NO"},
                          {"JHADINA_RESTORE_TRUST_DOMAIN":"OTHER"}):
            with self.subTest(patch_env=patch_env), self.assertRaises(d.RestoreError):
                d.trusted_host({**good,**patch_env})

    def test_synthetic_marker_validated_before_docker(self):
        with patch.object(d.shutil, "which") as installed:
            with self.assertRaisesRegex(d.RestoreError, "synthetic fixture marker"):
                d.restore_into_disposable_postgres(Path("dummy.dump"),
                                                    expected_synthetic_marker="bad';DROP TABLE;--")
            installed.assert_not_called()

    def test_exact_restored_fixture_row_required(self):
        marker="1a2b3c4d"*4
        class Result:
            def __init__(self, rc=0, stdout=b""):
                self.returncode=rc
                self.stdout=stdout
        def sql_ok(args, **kwargs):
            query=args[-1]
            if "count(*), min(marker), max(marker)" in query:
                return Result(stdout=f"1|{marker}|{marker}\\n".encode())
            return Result(stdout=b"1\\n")
        def sql_wrong(args, **kwargs):
            query=args[-1]
            if "count(*), min(marker), max(marker)" in query:
                return Result(stdout=f"1|{'0'*32}|{'0'*32}\\n".encode())
            return Result(stdout=b"1\\n")
        with patch.object(d.shutil, "which", return_value="/usr/bin/docker"), \\
             patch.object(d, "safe_run", return_value=Result()) as docker, \\
             patch.object(d.subprocess, "run", side_effect=sql_ok):
            self.assertEqual(d.restore_into_disposable_postgres(
                Path("fake.dump"), expected_synthetic_marker=marker), 1)
            self.assertTrue(any(x.args[0][:3]==["docker","rm","--force"]
                                for x in docker.call_args_list))
        with patch.object(d.shutil, "which", return_value="/usr/bin/docker"), \\
             patch.object(d, "safe_run", return_value=Result()) as docker, \\
             patch.object(d.subprocess, "run", side_effect=sql_wrong):
            with self.assertRaisesRegex(d.RestoreError, "row contents"):
                d.restore_into_disposable_postgres(Path("fake.dump"),
                                                   expected_synthetic_marker=marker)
            self.assertTrue(any(x.args[0][:3]==["docker","rm","--force"]
                                for x in docker.call_args_list))

    def test_isolated_pg_cleanup_failure_fails_closed(self):
        class Result:
            def __init__(self, rc=0, stdout=b""):
                self.returncode=rc
                self.stdout=stdout
        def local(args, **kwargs):
            if args[:3]==["docker","rm","--force"]:
                return Result(rc=1)
            return Result()
        with patch.object(d.shutil, "which", return_value="/usr/bin/docker"), \\
             patch.object(d, "safe_run", side_effect=local), \\
             patch.object(d.subprocess, "run", return_value=Result(stdout=b"1\\n")):
            with self.assertRaisesRegex(d.RestoreError, "cleanup failed"):
                d.restore_into_disposable_postgres(Path("fake.dump"))

    def test_hash_mismatch_cannot_reach_docker(self):
        class Result:
            returncode=0
        with tempfile.TemporaryDirectory() as tmp:
            dump=Path(tmp)/"restored.dump"
            def fake_exec(args, **kwargs):
                kwargs["stdout"].write(b"PGDMP"+b"corrupted"*4)
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
            self.assertFalse(result["hosted_supabase_data_covered"])
            self.assertEqual(result["source_kind"],"LOCAL_HOMEBASE_COMPOSE")
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
