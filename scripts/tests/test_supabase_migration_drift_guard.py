"""Offline invariants for the Supabase migration drift guard."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from supabase_migration_drift_guard import compare, load_baseline, load_remote


class MigrationGuardTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.migrations = self.root / "migrations"
        self.migrations.mkdir()
        self.baseline = self.root / "baseline.json"
        self.remote = self.root / "remote.json"
        self.set_baseline({})

    def set_baseline(self, groups):
        self.baseline.write_text(
            json.dumps({"known_duplicate_versions": groups}), encoding="utf-8"
        )

    def create_sql(self, *names):
        for name in names:
            (self.migrations / name).write_text("-- test fixture\n", encoding="utf-8")

    def test_unique_versions_pass(self):
        self.create_sql("20260101000000_alpha.sql", "20260102000000_beta.sql")
        report, blocked = compare(self.migrations, self.baseline)
        self.assertFalse(blocked)
        self.assertEqual(report["localCollisionGate"], "PASS_WITH_KNOWN_DEBT")
        self.assertEqual(report["distinctLocalVersions"], 2)

    def test_existing_exact_collision_is_pinned_and_passes_only_guard(self):
        names = ["20260101000000_alpha.sql", "20260101000000_beta.sql"]
        self.create_sql(*names)
        self.set_baseline({"20260101000000": names})
        report, blocked = compare(self.migrations, self.baseline)
        self.assertFalse(blocked)
        self.assertEqual(report["knownDuplicateVersionGroups"]["20260101000000"], names)
        self.assertFalse(report["migrationApplied"])

    def test_new_collision_blocks(self):
        self.create_sql("20260101000000_alpha.sql", "20260101000000_beta.sql")
        report, blocked = compare(self.migrations, self.baseline)
        self.assertTrue(blocked)
        self.assertIn("20260101000000", report["newOrChangedDuplicateGroups"])

    def test_baseline_changed_or_removed_requires_review(self):
        names = ["20260101000000_alpha.sql", "20260101000000_beta.sql"]
        self.create_sql(*names)
        self.set_baseline({"20260101000000": names})
        (self.migrations / names[1]).unlink()
        report, blocked = compare(self.migrations, self.baseline)
        self.assertTrue(blocked)
        self.assertIn("20260101000000", report["baselineOutOfSync"])

    def test_invalid_filename_blocks(self):
        self.create_sql("not_timestamped.sql")
        report, blocked = compare(self.migrations, self.baseline)
        self.assertTrue(blocked)
        self.assertEqual(report["invalidMigrationFilenames"], ["not_timestamped.sql"])

    def test_remote_drift_reports_without_mutation(self):
        self.create_sql("20260101000000_alpha.sql", "20260102000000_beta.sql")
        self.remote.write_text(json.dumps({"migrations": [
            {"version": "20260101000000", "name": "alpha"},
            {"version": "20260103000000", "name": "beta"},
            {"version": "20260104000000", "name": "gamma"},
        ]}), encoding="utf-8")
        report, blocked = compare(self.migrations, self.baseline, self.remote)
        self.assertFalse(blocked)
        remote = report["remote"]
        self.assertEqual(remote["gate"], "REVIEW_REQUIRED")
        self.assertEqual(remote["recordedVersionsAbsentFromGit"], ["20260103000000", "20260104000000"])
        self.assertEqual(remote["gitVersionsAbsentFromRemote"], ["20260102000000"])
        self.assertEqual(remote["sameNameDifferentVersion"], [
            {"file": "20260102000000_beta.sql", "recordedVersions": ["20260103000000"]}
        ])
        self.assertFalse(report["productionSqlExecuted"])

    def test_same_version_different_name_requires_review(self):
        self.create_sql("20260101000000_alpha.sql")
        self.remote.write_text(json.dumps([
            {"version": "20260101000000", "name": "unexpected"}
        ]), encoding="utf-8")
        report, _ = compare(self.migrations, self.baseline, self.remote)
        self.assertEqual(len(report["remote"]["sameVersionDifferentName"]), 1)

    def test_rejects_untrusted_remote_shapes(self):
        self.remote.write_text(json.dumps({"migrations": [
            {"version": "../20260101000000", "name": "alpha"}
        ]}), encoding="utf-8")
        with self.assertRaises(ValueError):
            load_remote(self.remote)

    def test_baseline_rejects_incorrect_filename_version(self):
        self.set_baseline({"20260101000000": [
            "20260101000000_alpha.sql", "20260102000000_beta.sql"
        ]})
        with self.assertRaises(ValueError):
            load_baseline(self.baseline)


if __name__ == "__main__":
    unittest.main()
