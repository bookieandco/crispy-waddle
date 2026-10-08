"""No-real-data tests for synthetic PostgreSQL + Restic integration admission."""
import inspect
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

    def test_source_and_restore_are_isolated_and_not_remote(self):
        code=inspect.getsource(s)
        self.assertIn('"--network=none"',code)
        self.assertIn('"--pull=never"',code)
        self.assertIn('"--name", name',code)
        self.assertIn("restore_drill.restore_into_disposable_postgres(output)",code)
        self.assertIn('"restic", "-r", repo_string, "dump"',code)
        self.assertIn('"--stdin-filename", "jhadina-postgres.dump"',code)
        self.assertIn('secrets.token_urlsafe(48)',code)
        for prohibited in ("supabase.com", "drive.google.com", "rclone config", "mc mirror",
                           "nats stream", "restic forget", "restic prune"):
            with self.subTest(prohibited=prohibited):
                self.assertNotIn(prohibited,code)


if __name__=="__main__":
    unittest.main()
