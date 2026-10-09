#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

modpath=Path(__file__).with_name("money-portable-host-durable-check.py")
spec=importlib.util.spec_from_file_location("money_portable_host",modpath)
assert spec and spec.loader
host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)
HEAD="a"*40

class Tests(unittest.TestCase):
    def test_ephemeral_directory_never_passes_as_real_host(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,"EPHEMERAL_OR_SYSTEM_PATH_DENIED"):
                host.check_mount(Path(d),1)

    def test_non_mount_and_world_writable_deny(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            with patch.object(host.os.path,"ismount",return_value=False):
                with self.assertRaisesRegex(ValueError,"EPHEMERAL_OR_SYSTEM_PATH_DENIED"):
                    host.check_mount(root,1)

    def test_initial_challenge_requires_reboot_and_immutable_file(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)
            with patch.object(host,"check_mount",return_value=path),patch.object(
                host,"boot_id",return_value="boot1"):
                before=host.make_challenge(path,HEAD,1)
                self.assertEqual(before["status"],"REBOOT_PROOF_PENDING")
                with self.assertRaises(FileExistsError):
                    host.make_challenge(path,HEAD,1)
                with self.assertRaisesRegex(ValueError,"RESTART_NOT_PROVEN"):
                    host.check_after_restart(path,HEAD,1)
            with patch.object(host,"check_mount",return_value=path),patch.object(
                host,"boot_id",return_value="boot2"):
                after=host.check_after_restart(path,HEAD,1)
            self.assertEqual(after["status"],"INDEPENDENT_HOST_REVIEW_REQUIRED")
            self.assertEqual(after["canarySha256"],before["canarySha256"])
            self.assertEqual(after["finalCertification"],"NOT_ISSUED")
            self.assertFalse(after["canExecute"])

    def test_wrong_commit_and_replaced_challenge_fail(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            with patch.object(host,"check_mount",return_value=root),patch.object(
                host,"boot_id",return_value="boot1"):
                host.make_challenge(root,HEAD,1)
            with patch.object(host,"check_mount",return_value=root),patch.object(
                host,"boot_id",return_value="boot2"):
                with self.assertRaisesRegex(ValueError,"CANARY_INVALID"):
                    host.check_after_restart(root,"b"*40,1)
                (root/host.CANARY).write_text("{}")
                with self.assertRaisesRegex(ValueError,"CANARY_INVALID"):
                    host.check_after_restart(root,HEAD,1)

    def test_invalid_source_revision_denied(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.object(host,"check_mount",return_value=Path(d)):
                with self.assertRaisesRegex(ValueError,"SHA_INVALID"):
                    host.make_challenge(Path(d),"main",1)

if __name__=="__main__":
    unittest.main()
