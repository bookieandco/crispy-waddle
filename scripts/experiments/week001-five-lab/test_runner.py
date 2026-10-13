import datetime as dt
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from runner import run_suite, LABS, canonical, digest
class RunnerTests(unittest.TestCase):
    def test_rejects_outside_week(self):
        with tempfile.TemporaryDirectory() as path:
            for date in (dt.date(2026,10,13),dt.date(2026,10,21)):
                with self.assertRaises(ValueError): run_suite(date,path,True)
    def test_dry_run_provenance_and_safety(self):
        with tempfile.TemporaryDirectory() as path:
            evidence=run_suite(dt.date(2026,10,14),path,True)
            self.assertEqual(len(evidence['results']),5)
            self.assertEqual({x['lab'] for x in evidence['results']},set(LABS))
            self.assertEqual({x['status'] for x in evidence['results']},{'DRY_RUN_NOT_EXECUTED'})
            self.assertEqual(evidence['financial_authority'],'NONE')
            self.assertFalse(evidence['paid_services_authorized'])
            record=json.loads((pathlib.Path(path)/'evidence.json').read_text())
            sha=record.pop('record_sha256')
            self.assertEqual(sha,digest(canonical(record)))
    def test_failed_command_not_success(self):
        with tempfile.TemporaryDirectory() as path:
            class Bad: returncode=1;stdout=b'failed'
            with patch('runner.subprocess.run',return_value=Bad()):
                evidence=run_suite(dt.date(2026,10,15),path,False)
            self.assertEqual({x['status'] for x in evidence['results']},{'FAIL'})
    def test_no_side_effect_dry_run(self):
        with tempfile.TemporaryDirectory() as path:
            with patch('runner.subprocess.run',side_effect=AssertionError('executed')):
                run_suite(dt.date(2026,10,16),path,True)
if __name__=='__main__': unittest.main()
