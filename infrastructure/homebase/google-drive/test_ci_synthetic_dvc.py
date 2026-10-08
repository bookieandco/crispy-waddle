"""No-provider synthetic-only CI guard tests."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import ci_synthetic_dvc as c


def settings():
    return {
        "GITHUB_ACTIONS":"true",
        "GITHUB_EVENT_NAME":"workflow_dispatch",
        "GITHUB_REPOSITORY":"bookieandco/crispy-waddle",
        "GOOGLE_HOMEBASE_CI_CANARY_APPROVED":"SYNTHETIC-ONLY",
        "GOOGLE_HOMEBASE_CI_STORAGE_MODE":"SHARED_DRIVE",
        "GOOGLE_HOMEBASE_DVC_FOLDER_ID":"FAKE_DVC_FOLDER_12345678",
        "GDRIVE_CREDENTIALS_DATA":json.dumps({
            "type":"service_account",
            "client_email":"jhadina-synthetic@example-project.iam.gserviceaccount.com",
            "private_key":"-----BEGIN PRIVATE KEY-----\nTEST_ONLY\n-----END PRIVATE KEY-----\n",
            "project_id":"synthetic-test-project",
            "padding":"x"*240,
        }),
    }


class SyntheticCiTests(unittest.TestCase):
    def test_valid_synthetic_identity_has_no_secret_in_return(self):
        folder, identity=c.authorize(settings())
        self.assertEqual(folder,"gdrive://FAKE_DVC_FOLDER_12345678")
        self.assertEqual(identity["type"],"service_account")

    def test_requires_manual_dispatch_repository_and_exact_consent(self):
        for bad in (
            {"GITHUB_ACTIONS":"false"},
            {"GITHUB_EVENT_NAME":"pull_request"},
            {"GITHUB_REPOSITORY":"attacker/fork"},
            {"GOOGLE_HOMEBASE_CI_CANARY_APPROVED":"YES"},
            {"GOOGLE_HOMEBASE_CI_STORAGE_MODE":"MY_DRIVE"},
            {"GOOGLE_HOMEBASE_CI_STORAGE_MODE":""},
        ):
            with self.subTest(bad=bad), self.assertRaises(c.SyntheticCiError):
                c.authorize({**settings(),**bad})

    def test_rejects_wrong_secrets_and_folder(self):
        for bad in (
            {"GDRIVE_CREDENTIALS_DATA":""},
            {"GDRIVE_CREDENTIALS_DATA":"x"*300},
            {"GDRIVE_CREDENTIALS_DATA":json.dumps({"type":"authorized_user","padding":"x"*300})},
            {"GOOGLE_HOMEBASE_DVC_FOLDER_ID":"../private-folder"},
        ):
            with self.subTest(bad=list(bad)), self.assertRaises((c.SyntheticCiError,c.dvc_assets.DvcSetupError)):
                c.authorize({**settings(),**bad})

    def test_ephemeral_secret_file_private_and_no_real_backup_claims(self):
        def simulate(folder, *, service_account_file):
            path=Path(service_account_file)
            self.assertTrue(path.is_file())
            self.assertEqual(path.stat().st_mode & 0o077,0)
            self.assertIn("service_account",path.read_text())
            return {
                "schema":"jhadina.google-homebase.dvc-canary.v1",
                "remote_only_restore_verified":True,
                "production_asset_touched":False,
            }
        with patch.object(c.dvc_canary,"remote_roundtrip",side_effect=simulate) as canary:
            proof=c.run_canary(settings())
        self.assertEqual(canary.call_count,1)
        self.assertTrue(proof["remote_only_restore_verified"])
        self.assertFalse(proof["real_database_recovery_certified"])
        self.assertFalse(proof["full_runtime_google_oauth_verified"])
        self.assertFalse(proof["real_asset_archiving_certified"])


if __name__=="__main__":
    unittest.main()
