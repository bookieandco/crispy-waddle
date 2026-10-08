"""The DVC canary must require a deliberate synthetic-only live authorization."""
import unittest
from unittest.mock import patch
import dvc_canary as c


class CanaryTests(unittest.TestCase):
    def test_no_hosted_actions(self):
        env={"GOOGLE_HOMEBASE_DVC_CANARY_APPROVED":"YES",
             "GOOGLE_HOMEBASE_DVC_FOLDER_ID":"TEST_DVC_FOLDER_123456789",
             "GITHUB_ACTIONS":"true"}
        with self.assertRaisesRegex(c.CanaryError,"No hosted Actions"):
            c.check_operator(env)

    def test_no_remote_without_approval(self):
        with self.assertRaisesRegex(c.CanaryError,"approval"):
            c.check_operator({"GOOGLE_HOMEBASE_DVC_FOLDER_ID":"TEST_DVC_FOLDER_123456789"})

    def test_approved_folder_is_exact(self):
        self.assertEqual(c.check_operator({
            "GOOGLE_HOMEBASE_DVC_CANARY_APPROVED":"YES",
            "GOOGLE_HOMEBASE_DVC_FOLDER_ID":"TEST_DVC_FOLDER_123456789"
        }),"gdrive://TEST_DVC_FOLDER_123456789")

    def test_invalid_folder_blocks_before_provider(self):
        with self.assertRaises(c.dvc_assets.DvcSetupError):
            c.check_operator({
              "GOOGLE_HOMEBASE_DVC_CANARY_APPROVED":"YES",
              "GOOGLE_HOMEBASE_DVC_FOLDER_ID":"../other-user"
            })

    def test_missing_live_flag_refuses_transfer(self):
        with patch.object(c,"remote_roundtrip") as remote:
            with patch("sys.argv",["dvc_canary.py"]):
                self.assertEqual(c.main(),2)
            remote.assert_not_called()


if __name__=="__main__":
    unittest.main()
