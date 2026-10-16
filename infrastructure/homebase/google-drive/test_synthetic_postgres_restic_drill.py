"""No-real-data tests for synthetic PostgreSQL + Restic integration admission."""
import inspect
import io
import subprocess
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import synthetic_postgres_restic_drill as s


class SyntheticPgDrillTests(unittest.TestCase):
    def test_must_approve_only_synthetic(self):
        with self.assertRaisesRegex(s.SyntheticRestoreError,"synthetic-only"):
            s.check_admission({})
        s.check_admission({"JHADINA_SYNTHETIC_PG_APPROVED":"SYNTHETIC-ONLY"})

    def test_no_remote_docker_or_external_database_settings(self):
        good={"JHADINA_SYNTHETIC_PG_APPROVED":"SYNTHETIC-ONLY"}
        for key,value in (
            ("DOCKER_HOST","tcp://example.com:2375"),
            ("DOCKER_CONTEXT","production"),
            ("DATABASE_URL","postgres://private"),
            ("SUPABASE_SERVICE_ROLE_KEY","never-emit"),
            ("RESTIC_REPOSITORY","rclone:private:repo"),
            ("GOOGLE_HOMEBASE_RCLONE_REMOTE","private"),
            ("PGHOST","private.example.org"),
            ("PGSERVICE","production"),
        ):
            with self.subTest(key=key), self.assertRaises(s.SyntheticRestoreError):
                s.check_admission({**good,key:value})

    def test_bad_marker_no_docker_process(self):
        with patch.object(s,"call") as call:
            with self.assertRaisesRegex(s.SyntheticRestoreError,"marker"):
                s.prepare_source(None,"'; DELETE FROM production; --")
            call.assert_not_called()

    def test_missing_dependencies_fail_before_commands(self):
        with patch.object(s.shutil,"which",return_value=None), patch.object(s,"call") as call:
            with self.assertRaisesRegex(s.SyntheticRestoreError,"required"):
                s.run_synthetic(env={"JHADINA_SYNTHETIC_PG_APPROVED":"SYNTHETIC-ONLY"})
            call.assert_not_called()

    def test_source_waits_through_socket_only_init_before_dump(self):
        calls = []
        probes = 0

        def fake_call(args, **kwargs):
            nonlocal probes
            calls.append(args)
            if "pg_isready" in args:
                probes += 1
                # Init accepts sockets immediately, but TCP only on probe 3.
                tcp = "-h" in args and args[args.index("-h") + 1] == "127.0.0.1"
                return subprocess.CompletedProcess(args, int(tcp and probes < 3))
            if "psql" in args or "pg_dump" in args:
                self.assertEqual(probes, 3, "must not use the temporary init server")
            if "pg_dump" in args:
                kwargs["stdout"].write(b"PGDMP" + b"fixture" * 8)
            return subprocess.CompletedProcess(args, 0)

        with tempfile.TemporaryDirectory() as tmp, patch.object(s, "call", side_effect=fake_call):
            s.prepare_source(Path(tmp) / "saved.dump", "a" * 32, sleep=lambda _: None)
        self.assertIn("rm", calls[-1])

    def test_source_never_ready_fails_and_cleans_up_without_writes(self):
        calls = []

        def fake_call(args, **kwargs):
            calls.append(args)
            return subprocess.CompletedProcess(args, int("pg_isready" in args))

        with tempfile.TemporaryDirectory() as tmp, patch.object(s, "call", side_effect=fake_call):
            dump = Path(tmp) / "saved.dump"
            with self.assertRaisesRegex(s.SyntheticRestoreError, "did not become ready"):
                s.prepare_source(dump, "a" * 32, sleep=lambda _: None)
            self.assertFalse(dump.exists())
        self.assertFalse(any("psql" in args for args in calls))
        self.assertIn("rm", calls[-1])

    def test_diagnostic_names_stage_without_exposing_exception_or_environment(self):
        def fail(**kwargs):
            kwargs["report_stage"]("source_dump")
            raise OSError("secret-value /private/path postgres://credential")

        output = io.StringIO()
        with patch.object(s, "run_synthetic", side_effect=fail), patch.object(s.sys, "stderr", output):
            self.assertEqual(s.main(), 2)
        self.assertEqual(output.getvalue(),
                         "GOOGLE_HOMEBASE_SYNTHETIC_PG_BLOCKED: stage=source_dump; synthetic drill failed\n")

    def test_source_and_restore_are_isolated_and_not_remote(self):
        code=inspect.getsource(s)
        self.assertIn('"--network=none"',code)
        self.assertIn('"--pull=never"',code)
        self.assertIn('"--name", name',code)
        self.assertIn("restore_drill.restore_into_disposable_postgres(",code)
        self.assertIn("expected_synthetic_marker=original_marker",code)
        self.assertIn('"restic", "-r", repo_string, "dump"',code)
        self.assertIn('"--stdin-filename", "jhadina-postgres.dump"',code)
        self.assertIn('secrets.token_urlsafe(48)',code)
        for prohibited in ("supabase.com", "drive.google.com", "rclone config", "mc mirror",
                           "nats stream", "restic forget", "restic prune"):
            with self.subTest(prohibited=prohibited):
                self.assertNotIn(prohibited,code)


if __name__=="__main__":
    unittest.main()
