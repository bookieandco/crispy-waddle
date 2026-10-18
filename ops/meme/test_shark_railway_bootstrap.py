"""SHARK Railway root volume bootstrap isolation: offline only."""
from __future__ import annotations

from contextlib import redirect_stderr
import io
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

import shark_railway_bootstrap as boot

VALID_ENV = {
    "SHARK_RAILWAY_VOLUME_BOOTSTRAP": "true",
    "RAILWAY_RUN_UID": "0",
    "RAILWAY_VOLUME_MOUNT_PATH": "/state",
    "RAILWAY_PROJECT_ID": "sample-project",
    "RAILWAY_SERVICE_ID": "sample-service",
    "RAILWAY_ENVIRONMENT_ID": "sample-environment",
    "RAILWAY_VOLUME_NAME": "public-study-volume",
}


class RailwayBootstrapTests(unittest.TestCase):
    def test_default_route_runs_preflight_only(self):
        module,args=boot._route(boot.DEFAULT,{})
        self.assertEqual(module,"shark_host_acceptance.py")
        self.assertEqual(args,boot.DEFAULT)

    def test_arbitrary_launch_without_explicit_worker_flag_is_refused(self):
        for args in ([], ["--mode","serve"], ["--mode","audit"],
                     ["--worker"], ["--worker","--mode","serve"]):
            with self.subTest(args=args):
                with self.assertRaises(ValueError):
                    boot._route(args,{})

    def test_worker_route_requires_both_operational_grants(self):
        args=["--worker","--mode","serve","--state",boot.STATE,
              "--confirm","PUBLIC-MARKET-RESEARCH-ONLY"]
        with self.assertRaisesRegex(ValueError,"not_operator_enabled"):
            boot._route(args,{})
        env={"SHARK_RAILWAY_WORKER_ENABLED":"true"}
        module,rest=boot._route(args,env)
        self.assertEqual(module,"shark_live_intelligence.py")
        self.assertEqual(rest[0:2],["--mode","serve"])
        with self.assertRaisesRegex(ValueError,"private_alert_not_operator_enabled"):
            boot._route(args+["--notify"],env)
        approved=dict(env,SHARK_RAILWAY_ALERTS_ENABLED="true")
        self.assertEqual(boot._route(args+["--notify"],approved)[0],
                         "shark_live_intelligence.py")

    def test_only_exact_mounted_ledger_and_public_research_command(self):
        env={"SHARK_RAILWAY_WORKER_ENABLED":"true"}
        for mode,state,confirm in (("audit",boot.STATE,"PUBLIC-MARKET-RESEARCH-ONLY"),
                                   ("serve","/tmp/state.db","PUBLIC-MARKET-RESEARCH-ONLY"),
                                   ("serve",boot.STATE,"TRADE-ALLOWED")):
            args=["--worker","--mode",mode,"--state",state,"--confirm",confirm]
            with self.subTest(args=args),self.assertRaisesRegex(ValueError,"not_allowlisted"):
                boot._route(args,env)

    def test_root_initializer_rejects_missing_railway_identity(self):
        with patch.object(boot.os,"geteuid",return_value=0), \
             patch.object(boot.os,"getegid",return_value=0):
            for name in ("SHARK_RAILWAY_VOLUME_BOOTSTRAP","RAILWAY_RUN_UID",
                         "RAILWAY_VOLUME_MOUNT_PATH","RAILWAY_VOLUME_NAME",
                         "RAILWAY_SERVICE_ID","RAILWAY_PROJECT_ID",
                         "RAILWAY_ENVIRONMENT_ID"):
                bad=dict(VALID_ENV)
                bad.pop(name)
                with self.subTest(name=name),self.assertRaisesRegex(ValueError,"not_authorized"):
                    boot.prepare_root_mounted_volume(bad,mounts={"/state"})

    def test_mount_not_observed_rejects_before_any_chown(self):
        with tempfile.TemporaryDirectory() as root:
            with patch.object(boot,"MOUNT",root), \
                 patch.object(boot.os,"geteuid",return_value=0), \
                 patch.object(boot.os,"getegid",return_value=0), \
                 patch.object(boot.os,"chown",side_effect=AssertionError("unexpected chown")):
                env=dict(VALID_ENV,RAILWAY_VOLUME_MOUNT_PATH=root)
                with self.assertRaisesRegex(ValueError,"not_observed"):
                    boot.prepare_root_mounted_volume(env,mounts=set())

    def test_insecure_preexisting_state_refuses_recursive_reownership(self):
        with tempfile.TemporaryDirectory() as root:
            private=Path(root)/"observations.sqlite3"
            private.write_text("do not modify existing data")
            private.chmod(0o644)
            before=private.read_bytes()
            with patch.object(boot,"MOUNT",root), \
                 patch.object(boot.os,"geteuid",return_value=0), \
                 patch.object(boot.os,"getegid",return_value=0), \
                 patch.object(boot.os.path,"ismount",return_value=True), \
                 patch.object(boot.os,"chown",side_effect=AssertionError("unsafe chown")):
                env=dict(VALID_ENV,RAILWAY_VOLUME_MOUNT_PATH=root)
                with self.assertRaisesRegex(ValueError,"manual_repair"):
                    boot.prepare_root_mounted_volume(env,mounts={root})
            self.assertEqual(private.read_bytes(),before)

    def test_root_bootstrap_only_changes_mount_top_level(self):
        with tempfile.TemporaryDirectory() as root:
            current=os.lstat(root)
            call_count=0
            def lstat(_):
                nonlocal call_count
                call_count+=1
                return SimpleNamespace(
                    st_mode=current.st_mode, st_uid=0 if call_count==1 else boot.UID,
                    st_gid=0 if call_count==1 else boot.GID)
            changes=[]
            with patch.object(boot,"MOUNT",root), \
                 patch.object(boot.os,"geteuid",return_value=0), \
                 patch.object(boot.os,"getegid",return_value=0), \
                 patch.object(boot.os.path,"ismount",return_value=True), \
                 patch.object(boot.os,"lstat",side_effect=lstat), \
                 patch.object(boot.os,"chown",side_effect=lambda *args:changes.append(("chown",args))), \
                 patch.object(boot.os,"chmod",side_effect=lambda *args:changes.append(("chmod",args))):
                env=dict(VALID_ENV,RAILWAY_VOLUME_MOUNT_PATH=root)
                boot.prepare_root_mounted_volume(env,mounts={root})
            self.assertEqual(changes,[("chown",(root,boot.UID,boot.GID)),
                                      ("chmod",(root,0o700))])
            self.assertEqual(call_count,2)

    def test_main_rejects_other_uid_before_exec(self):
        with patch.object(boot.os,"geteuid",return_value=12345), \
             patch.object(boot.os,"getegid",return_value=12345), \
             patch.object(boot.os,"execv",side_effect=AssertionError("must not exec")):
            with redirect_stderr(io.StringIO()) as messages:
                self.assertEqual(boot.main(boot.DEFAULT),1)
        self.assertIn("FAIL_CLOSED",messages.getvalue())

    def test_main_nonroot_preflight_execs_only_known_python(self):
        intercepted=[]
        def fake_exec(binary,args):
            intercepted.append((binary,args))
            raise SystemExit(0)
        with patch.object(boot.os,"geteuid",return_value=boot.UID), \
             patch.object(boot.os,"getegid",return_value=boot.GID), \
             patch.object(boot.os,"execv",side_effect=fake_exec):
            with self.assertRaises(SystemExit):
                boot.main(boot.DEFAULT)
        self.assertEqual(len(intercepted),1)
        self.assertEqual(intercepted[0][1][-3:],boot.DEFAULT)

    def test_root_drop_orders_group_then_gid_then_uid(self):
        mutations=[]
        def fail_if_wrong_order(label):
            def _call(*_):
                mutations.append(label)
            return _call
        with patch.object(boot.os,"setgroups",side_effect=fail_if_wrong_order("groups")), \
             patch.object(boot.os,"setgid",side_effect=fail_if_wrong_order("gid")), \
             patch.object(boot.os,"setuid",side_effect=fail_if_wrong_order("uid")), \
             patch.object(boot.os,"geteuid",return_value=boot.UID), \
             patch.object(boot.os,"getegid",return_value=boot.GID):
            boot.drop_privileges()
        self.assertEqual(mutations,["groups","gid","uid"])

    def test_root_main_never_execs_if_volume_authorization_fails(self):
        with patch.object(boot.os,"geteuid",return_value=0), \
             patch.object(boot.os,"getegid",return_value=0), \
             patch.object(boot.os,"execv",side_effect=AssertionError("must not exec")):
            with redirect_stderr(io.StringIO()) as messages:
                self.assertEqual(boot.main(boot.DEFAULT),1)
        self.assertIn("FAIL_CLOSED",messages.getvalue())


if __name__ == "__main__":
    unittest.main()
