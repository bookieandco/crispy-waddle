"""SHARK-LIVE.HOST.01–04 fail-closed host and real age cryptography tests."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch

import shark_host_acceptance as host
import shark_live_commission as commission
import shark_live_intelligence as worker
import public_mint_dossier as public

MINT = public.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
NOW = "2026-10-17T23:58:00Z"


class HostPrecommissionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.db = self.root / "study.sqlite3"

    def populate(self):
        with worker.local_database(str(self.db)) as db:
            db.execute("""INSERT INTO tokens(mint,first_discovered,last_seen)
                          VALUES(?,?,?)""", (MINT, NOW, NOW))
            db.execute("""INSERT INTO cycles(available_at,receipt_digest,new_tokens,checked,graded)
                          VALUES(?,?,?,?,?)""", (NOW, "a" * 64, 1, 0, 0))
            db.commit()
            return commission.audit_db(db)["fingerprint"]

    def _host_ready(self):
        """FAKE operator gate for isolated unit tests only; never production."""
        with patch.object(host, "_private_dir", return_value=self.root):
            with patch.object(host.os, "geteuid", return_value=10001):
                with patch.dict(host.os.environ, {"SHARK_PUBLIC_HOST_COMMISSIONED":"true"}):
                    return host.host_status(str(self.root), mounts={str(self.root)})

    def test_default_preflight_remains_noncommissioned(self):
        s = host.host_status(str(self.root), mounts=set())
        self.assertEqual(s["status"], "NOT_COMMISSIONED")
        self.assertFalse(s["dedicatedMountObserved"])
        self.assertFalse(s["postRestartPersistenceObserved"])
        self.assertFalse(s["encryptedOffHostRestoreObserved"])
        self.assertFalse(s["ownerPhoneAlertReadbackObserved"])
        self.assertTrue(s["noTradingAuthority"])

    def test_nonprivate_directory_fails_before_host_grant(self):
        self.root.chmod(0o755)
        result = host.host_status(str(self.root), mounts={str(self.root)})
        self.assertFalse(result["isolatedOwnerPrivateDirectory"])
        self.assertEqual(result["status"], "NOT_COMMISSIONED")
        self.assertRaisesRegex(ValueError, "not_ready", host._require_host, result)

    def test_gate_requires_real_flags_and_does_not_claim_external_proof(self):
        synthetic = self._host_ready()
        host._require_host(synthetic)
        self.assertEqual(synthetic["status"],
                         "LOCAL_PRECHECK_ONLY_EXTERNAL_CERTIFICATIONS_REQUIRED")
        self.assertFalse(synthetic["postRestartPersistenceObserved"])
        self.assertFalse(synthetic["ownerPhoneAlertReadbackObserved"])
        for key in ("dedicatedMountObserved", "nonRootIdentity",
                    "explicitHostCommissioningGrant", "freeSpaceThresholdMet"):
            altered = dict(synthetic, **{key: False})
            with self.assertRaisesRegex(ValueError, "not_ready"):
                host._require_host(altered)

    def test_mountinfo_parser_does_not_claim_parent_root_mount(self):
        info = "24 23 8:2 / / rw,relatime - ext4 /dev/root rw\n" \
               "71 23 8:13 /vol /state rw,relatime - ext4 /dev/disk rw\n"
        mounts = host._mountpoints(info)
        self.assertIn("/state", mounts)
        self.assertIn("/", mounts)
        self.assertNotIn("/state/sub", mounts)

    def test_public_once_requires_exact_grant_and_never_notifies_by_default(self):
        calls = []
        def runner(args):
            calls.append(args)
            return 0
        with self.assertRaisesRegex(ValueError, "grant_missing"):
            host.public_accept_once(state_path=str(self.db),
                                    public_confirm="anything", runner=runner)
        with patch.object(host, "host_status", return_value=self._host_ready()):
            result = host.public_accept_once(state_path=str(self.db),
                                              public_confirm=host.PUBLIC_CONFIRM,
                                              runner=runner)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("--notify", calls[0])
        self.assertEqual(calls[0][0:2], ["--mode", "once"])
        self.assertEqual(result["status"], "MANUAL_ONE_SHOT_COMPLETE_NOT_CONTINUOUS")
        self.assertFalse(result["privateAlertAttemptEnabled"])
        self.assertFalse(result["ownerPhoneAlertReadbackVerified"])
        self.assertFalse(result["continuousHostCommissioned"])
        self.assertFalse(result["noTradingAuthority"] is False)

    def test_public_once_rejects_uncommissioned_host_and_failed_cycle(self):
        calls = []
        with patch.object(host, "host_status", return_value={
            "isolatedOwnerPrivateDirectory": False}):
            with self.assertRaisesRegex(ValueError, "not_ready"):
                host.public_accept_once(state_path=str(self.db),
                    public_confirm=host.PUBLIC_CONFIRM,
                    runner=lambda _: calls.append(1))
        self.assertEqual(calls, [])
        with patch.object(host, "host_status", return_value=self._host_ready()):
            with self.assertRaisesRegex(ValueError, "acceptance_failed"):
                host.public_accept_once(state_path=str(self.db),
                    public_confirm=host.PUBLIC_CONFIRM, runner=lambda _: 1)

    def test_private_alert_needs_independent_grant_and_preflight(self):
        gate = self._host_ready()
        sent = []
        with patch.object(host, "host_status", return_value=gate):
            with patch.dict(host.os.environ, {}, clear=True):
                with self.assertRaisesRegex(ValueError, "not_authorized"):
                    host.public_accept_once(state_path=str(self.db),
                        public_confirm=host.PUBLIC_CONFIRM,
                        notify_confirm=host.NOTIFY_CONFIRM,
                        runner=lambda args: sent.append(args))
        self.assertEqual(sent, [])

    def test_age_invalid_recipient_does_not_read_state_or_allocate_archive(self):
        self.populate()
        dest = self.root / "backup.age"
        with patch.object(host, "_age_binary", side_effect=AssertionError("AGE USED")):
            with self.assertRaisesRegex(ValueError, "invalid_age_recipient"):
                host.encrypt_snapshot(state_path=str(self.db),
                    encrypted_destination=str(dest), public_recipient="not a key")
        self.assertFalse(dest.exists())

    def test_age_missing_fails_closed_without_export(self):
        self.populate()
        dest = self.root / "backup.age"
        fake_pub = "age1" + "q" * 58
        with patch.object(host, "_age_binary", side_effect=ValueError("age_encryption_tool_unavailable")):
            with self.assertRaisesRegex(ValueError, "age_encryption_tool_unavailable"):
                host.encrypt_snapshot(state_path=str(self.db),
                                      encrypted_destination=str(dest),
                                      public_recipient=fake_pub)
        self.assertFalse(dest.exists())

    def test_decrypt_without_expected_fingerprint_refused(self):
        with self.assertRaisesRegex(ValueError, "fingerprint_required"):
            host.check_encrypted_restore(
                encrypted_source=str(self.root / "fake.age"),
                identity_path=str(self.root / "fake.key"),
                expected_fingerprint="untrusted")

    def test_local_operator_help_never_calls_telegram_or_provider(self):
        with patch.object(worker, "read_public_feeds",
                          side_effect=AssertionError("NETWORK")):
            with patch.object(worker, "_private_sender",
                              side_effect=AssertionError("TELEGRAM")):
                out = io.StringIO()
                with redirect_stdout(out):
                    code = host.main(["--mode", "preflight",
                                      "--state-dir", str(self.root)])
                self.assertEqual(code, 0)
                self.assertIn("NOT_COMMISSIONED", out.getvalue())
                self.assertNotIn(str(self.root), out.getvalue())

    def test_error_output_does_not_leak_recipient_identity_or_path(self):
        err = io.StringIO()
        with redirect_stderr(err):
            exit_code = host.main(["--mode", "decrypt-check",
                                   "--archive", str(self.root / "fake.age"),
                                   "--identity", str(self.root / "fake.key"),
                                   "--expected-fingerprint", "wrong"])
        self.assertEqual(exit_code, 1)
        self.assertEqual(err.getvalue().strip(), "SHARK_HOST_ACCEPTANCE_FAIL_CLOSED")
        self.assertNotIn(str(self.root), err.getvalue())

    @unittest.skipUnless(shutil.which("age") and shutil.which("age-keygen"),
                         "Real age binary not installed: do not claim encrypted backup proof")
    def test_real_age_encryption_and_sqlite_restore(self):
        original = self.populate()
        identity = self.root / "private-age-identity.txt"
        cmd = subprocess.run(["age-keygen", "-o", str(identity)],
                             capture_output=True, text=True, timeout=15, check=True)
        identity.chmod(0o600)
        combined = cmd.stdout + "\n" + cmd.stderr + "\n" + identity.read_text()
        match = re.search(r"(age1[023456789acdefghjklmnpqrstuvwxyz]{58})", combined)
        self.assertIsNotNone(match)
        dest = self.root / "backup.age"
        result = host.encrypt_snapshot(
            state_path=str(self.db), encrypted_destination=str(dest),
            public_recipient=match.group(1))
        self.assertEqual(result["status"], "LOCAL_AGE_CIPHERTEXT_CREATED")
        self.assertFalse(result["encryptedOffHostBackupVerified"])
        self.assertFalse(result["differentHostRestoreVerified"])
        self.assertEqual(dest.stat().st_mode & 0o777, 0o600)
        self.assertNotIn(b"SQLite format 3", dest.read_bytes())
        restored = host.check_encrypted_restore(
            encrypted_source=str(dest), identity_path=str(identity),
            expected_fingerprint=original)
        self.assertEqual(restored["status"], "LOCAL_AGE_DECRYPT_AND_SQLITE_RESTORE_MATCH")
        self.assertEqual(restored["restoredFingerprint"], original)
        self.assertFalse(restored["differentHostRestoreVerified"])
        with self.assertRaisesRegex(ValueError, "overwrite"):
            host.encrypt_snapshot(state_path=str(self.db),
                                  encrypted_destination=str(dest),
                                  public_recipient=match.group(1))
        with self.assertRaisesRegex(ValueError, "fingerprint_mismatch"):
            host.check_encrypted_restore(
                encrypted_source=str(dest), identity_path=str(identity),
                expected_fingerprint="b" * 64)


if __name__ == "__main__":
    unittest.main()
