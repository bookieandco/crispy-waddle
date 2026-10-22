"""No-cost, no-network OVH SHARK staging/volume preflight contracts."""
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import shark_ovh_readiness as target


class OvhReadinessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.mounted = Path(self.temp.name) / "dedicated-data"
        self.mounted.mkdir()
        self.state = self.mounted / "shadow-paper"
        self.now = datetime(2026, 10, 11, 21, 0, tzinfo=timezone.utc)
        self.env = {"SHARK_OVH_READ_ONLY_APPROVED": "YES"}
        self.kw = dict(
            state_root=self.state, env=self.env,
            cpu_count=4, ram_bytes=8 * 1024**3,
            mount=lambda p: (str(self.mounted), "ext4", "/dev/vdb"),
            disk=lambda p: SimpleNamespace(free=50 * 1024**3),
            which=lambda binary: "/usr/bin/" + binary,
            host_os="Linux", linux_distribution="ubuntu:24.04", now=self.now,
        )

    def check(self, **overrides):
        return target.probe(**{**self.kw, **overrides})

    def test_proper_host_is_staging_ready_never_certified_as_operational(self):
        report = self.check()
        self.assertEqual(report["status"], "READY_FOR_OPERATOR_REVIEW")
        self.assertEqual(report["reasonCodes"], [])
        self.assertTrue(report["dedicatedVolumeMountObserved"])
        self.assertFalse(report["productionCommissioned"])
        self.assertFalse(report["realShadowEncryptedBackupRestored"])
        self.assertFalse(report["realForwardPaperOutcomesVerified"])
        self.assertFalse(report["futureGpuProvisioningAuthorized"])
        self.assertFalse(report["gpuRequiredForInitialPaper"])
        self.assertNotIn("/dev/vdb", str(report))
        self.assertFalse(self.state.exists())

    def test_no_approval_and_ci_always_block(self):
        with self.assertRaises(target.ReadinessError):
            self.check(env={})
        with self.assertRaises(target.ReadinessError):
            self.check(env={**self.env, "GITHUB_ACTIONS": "true"})

    def test_host_constraints_are_diagnostic_not_fake_provisioning(self):
        report = self.check(cpu_count=2, ram_bytes=2 * 1024**3,
                            linux_distribution="debian:12")
        self.assertEqual(report["status"], "BLOCKED")
        self.assertIn("MINIMUM_FOUR_VCPU_RECOMMENDED", report["reasonCodes"])
        self.assertIn("AT_LEAST_SIX_GIB_RAM_RECOMMENDED", report["reasonCodes"])
        self.assertIn("SUPPORTED_UBUNTU_LTS_REQUIRED", report["reasonCodes"])

    def test_no_dedicated_volume_if_root_or_overlay(self):
        for values in (("/", "ext4", "/dev/vda"), (str(self.mounted), "overlay", "overlay")):
            with self.subTest(values=values):
                result = self.check(mount=lambda p: values)
                self.assertEqual(result["status"], "BLOCKED")
                self.assertFalse(result["dedicatedVolumeMountObserved"])
                self.assertIn("SEPARATE_NON_EPHEMERAL_DATA_VOLUME_NOT_VERIFIED", result["reasonCodes"])

    def test_volume_covering_unrelated_location_not_counted(self):
        other = Path(self.temp.name) / "another-mount"
        result = self.check(mount=lambda p: (str(other), "ext4", "/dev/vdc"))
        self.assertFalse(result["dedicatedVolumeMountObserved"])

    def test_minimum_disk_space_and_missing_tools_block(self):
        small = self.check(disk=lambda p: SimpleNamespace(free=2 * 1024**3),
                           which=lambda tool: None if tool in ("restic", "rclone") else "/usr/bin/" + tool)
        self.assertEqual(small["status"], "BLOCKED")
        self.assertIn("INSUFFICIENT_FREE_SPACE_ON_SEPARATE_VOLUME", small["reasonCodes"])
        self.assertIn("WORKER_TOOLS_MISSING", small["reasonCodes"])
        self.assertEqual(small["missingTools"], ["restic", "rclone"])

    def test_root_and_symlink_escape_rejected(self):
        with self.assertRaisesRegex(target.ReadinessError, "UNSAFE"):
            self.check(state_root=Path("/"))
        alternate = self.mounted / "redirect"
        alternate.symlink_to(self.mounted, target_is_directory=True)
        with self.assertRaisesRegex(target.ReadinessError, "SYMLINK"):
            self.check(state_root=alternate / "new")

    def test_memory_parser_and_missing_data(self):
        self.assertEqual(target.parse_meminfo("MemTotal:       8388608 kB\nMemFree: 64 kB"), 8 * 1024**3)
        with self.assertRaisesRegex(target.ReadinessError, "MEMORY_PROBE"):
            target.parse_meminfo("MemFree: 1024 kB")

    def test_planned_root_is_not_created_and_private_data_not_printed(self):
        report = self.check()
        self.assertFalse(self.state.exists())
        self.assertNotIn(str(self.mounted), str(report))
        self.assertNotIn("ownerToken", str(report))


if __name__ == "__main__":
    unittest.main()
