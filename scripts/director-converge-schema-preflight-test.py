#!/usr/bin/env python3
"""Offline fixture tests for collision-aware Director schema audit."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE=Path(__file__).with_name('director-converge-schema-preflight.py')
spec=importlib.util.spec_from_file_location('director_schema_audit', SOURCE)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class DirectorSchemaPreflightTests(unittest.TestCase):
    def test_collision_blocks_blind_replay_even_if_version_marked_applied(self):
        with tempfile.TemporaryDirectory() as path:
            root=Path(path)
            (root/'20261003221000_director_durable_workstation_timeline.sql').write_text('-- timeline')
            (root/'20261003221000_other_studio.sql').write_text('-- colliding version')
            report=module.inventory(root,{'20261003221000'})
            self.assertFalse(report['safeForAutomaticReplay'])
            self.assertEqual(report['collidingVersions']['20261003221000'],[
                '20261003221000_director_durable_workstation_timeline.sql',
                '20261003221000_other_studio.sql',
            ])
            self.assertIn('director_workstation_timelines',report['sourceCheckFailures'])
    def test_no_applied_history_never_certifies_safe_replay(self):
        with tempfile.TemporaryDirectory() as path:
            report=module.inventory(Path(path))
            self.assertFalse(report['safeForAutomaticReplay'])
            self.assertFalse(report['appliedHistorySupplied'])
            self.assertTrue(report['sourceCheckFailures'])
    def test_no_schema_mutation_code_path(self):
        source=SOURCE.read_text()
        for forbidden in ('execute_sql','apply_migration','supabase db push',
                          'psycopg','subprocess.run','urllib.request'):
            self.assertNotIn(forbidden,source)
if __name__=='__main__':
    unittest.main()
