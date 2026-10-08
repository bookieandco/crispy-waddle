"""GOOGLE-HOMEBASE-LIVE.1: preflight cannot become an action grant or expose secrets."""
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import commissioning_preflight as p


def candidate():
    return {
        "JHADINA_HOMEBASE_TRUST_DOMAIN":"OWNER_CONTROLLED",
        "JHADINA_HOMEBASE_PREFLIGHT_APPROVED":"YES",
        "GOOGLE_HOMEBASE_RCLONE_REMOTE":"jhadina-drive",
        "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID":"FAKE_BACKUP_FOLDER_12345",
        "RESTIC_PASSWORD_FILE":"/private/not-printed",
        "JHADINA_BACKUP_ROOT":"/srv/jhadina-backups",
    }


class LivePreflightTests(unittest.TestCase):
    def test_phone_only_is_control_not_local_runtime(self):
        r=p.audit(env={},profile="iphone",present={},secret_file_private=False)
        self.assertEqual(r["mode"],"CONTROL_ONLY")
        self.assertEqual(r["next_action"],"IDENTIFY_EXISTING_TRUSTED_RUNTIME")
        self.assertFalse(r["overall_live_ready"])
        self.assertFalse(r["checks"]["chat_drive_credentials_are_worker_oauth"])
        self.assertFalse(any(r["live_gates"].values()))
        self.assertFalse(r["production_authority_changed"])

    def test_alleged_host_with_all_dependencies_does_not_certify_runtime(self):
        r=p.audit(env=candidate(),profile="trusted-worker",
                  present={b:True for b in p.REQUIRED_BINARIES},
                  secret_file_private=True)
        self.assertTrue(all(r["checks"].values()))
        self.assertEqual(r["next_action"],"RUN_SEPARATELY_APPROVED_REAL_OAUTH_AND_RESTORE_DRILLS")
        self.assertFalse(r["overall_live_ready"])
        self.assertFalse(any(r["live_gates"].values()))
        self.assertFalse(r["new_billable_server_provisioned"])

    def test_github_hosted_forbidden_despite_fake_approval(self):
        r=p.audit(env={**candidate(),"GITHUB_ACTIONS":"true"},
                  profile="trusted-worker",present={b:True for b in p.REQUIRED_BINARIES},
                  secret_file_private=True)
        self.assertEqual(r["next_action"],"MOVE_TO_OWNER_CONTROLLED_RUNTIME")
        self.assertFalse(r["checks"]["execution_not_hosted_actions"])

    def test_bad_credentials_never_leak_values_in_json(self):
        secret="TEST_PRIVATE_SECRET_NEVER_EMIT"
        env={**candidate(),"GOOGLE_HOMEBASE_RCLONE_REMOTE":"invalid:remote",
             "GOOGLE_HOMEBASE_BACKUP_FOLDER_ID":"../not-allowed",
             "RESTIC_PASSWORD_FILE":f"/home/user/{secret}",
             "MC_HOST_jhadinaprivate":secret}
        r=p.audit(env=env,profile="trusted-worker",present={},secret_file_private=False)
        payload=json.dumps(r)
        self.assertNotIn(secret,payload)
        self.assertNotIn(env["RESTIC_PASSWORD_FILE"],payload)
        self.assertNotIn(env["GOOGLE_HOMEBASE_BACKUP_FOLDER_ID"],payload)
        self.assertFalse(r["checks"]["rclone_remote_name_syntax_valid"])
        self.assertFalse(r["checks"]["private_drive_backup_folder_id_syntax_valid"])
        self.assertFalse(r["checks"]["restic_password_file_private"])
        self.assertEqual(r["next_action"],"COMPLETE_TRUSTED_WORKER_LOCAL_DEPENDENCIES")

    def test_restic_secret_requires_regular_owner_only_nonsymlink(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/"restic.pass"
            file.write_text("not-a-real-secret")
            os.chmod(file,0o600)
            self.assertTrue(p.private_secret_file(str(file)))
            os.chmod(file,0o644)
            self.assertFalse(p.private_secret_file(str(file)))
            os.chmod(file,0o600)
            symlink=Path(tmp)/"alias"
            symlink.symlink_to(file)
            self.assertFalse(p.private_secret_file(str(symlink)))
            self.assertFalse(p.private_secret_file(str(Path(tmp))))
            self.assertFalse(p.private_secret_file("relative/pass"))
            self.assertFalse(p.private_secret_file(""))

    def test_cli_default_only_assesses_no_provider_invocation(self):
        out=io.StringIO()
        with patch.object(p.shutil,"which",return_value=None), \
             patch.object(p,"private_secret_file",return_value=False), \
             contextlib.redirect_stdout(out):
            self.assertEqual(p.main([]),0)
        result=json.loads(out.getvalue())
        self.assertEqual(result["profile"],"IPHONE_OPERATOR")
        self.assertEqual(result["next_action"],"IDENTIFY_EXISTING_TRUSTED_RUNTIME")
        self.assertFalse(result["overall_live_ready"])


if __name__=="__main__":
    unittest.main()
