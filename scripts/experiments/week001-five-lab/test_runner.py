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
    def test_real_two_day_chain_with_sealed_forecasts_and_grades(self):
        def receipts(price,stamp):
            result={}
            for key in ("capital","social_music","business","tv_music","tv_music_catalog"):
                metric=("btc_usd_price" if key=="capital" else "posted_business_keyword_grant_count" if key=="business" else "itunes_catalog_search_result_count")
                observation={"metric":metric,"value":price if key=="capital" else 10}
                if key=="capital": observation["provider_timestamp"]=stamp
                result[key]={"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":observation,"source_response_sha256":"a"*64}
            return result
        class Pass:
            returncode=0
            stdout=b"tests succeeded"
        with tempfile.TemporaryDirectory() as temp:
            one=pathlib.Path(temp)/"one"
            two=pathlib.Path(temp)/"two"
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=receipts(100,"2026-10-14T12:36:00Z")):
                day_one=run_suite(dt.date(2026,10,14),one,public_feeds=True,captured_at="2026-10-14T12:37:00Z")
            self.assertEqual(day_one["prior_state"],"FIRST_DAY_NO_PRIOR_REQUIRED")
            self.assertEqual(len(day_one["predictions"]),6)
            self.assertEqual(len(day_one["outcomes"]),0)
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=receipts(105,"2026-10-15T12:36:00Z")):
                day_two=run_suite(dt.date(2026,10,15),two,public_feeds=True,previous=str(one/"evidence.json"),captured_at="2026-10-15T12:37:00Z")
            self.assertEqual(day_two["prior_state"],"VERIFIED_PRIOR_DAY")
            self.assertEqual(day_two["prior_record_sha256"],day_one["record_sha256"])
            self.assertEqual(len(day_two["predictions"]),6)
            self.assertEqual(len(day_two["outcomes"]),6)
            capital=next(x for x in day_two["outcomes"] if x["outcome_kind"]=="market_quote_research_only")
            self.assertEqual(capital["baseline_absolute_error"],5)
            self.assertFalse(capital["investment_performance"])
            corrupt=json.loads((one/"evidence.json").read_text())
            corrupt["feeds"]["capital"]["observation"]["value"]=5000
            (one/"evidence.json").write_text(json.dumps(corrupt))
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=receipts(105,"2026-10-15T12:36:00Z")):
                rejected=run_suite(dt.date(2026,10,15),pathlib.Path(temp)/"rejected",public_feeds=True,previous=str(one/"evidence.json"),captured_at="2026-10-15T12:37:00Z")
            self.assertEqual(rejected["prior_state"],"MISSING_OR_INVALID_PRIOR_DAY")
            self.assertEqual(len(rejected["outcomes"]),0)

if __name__=='__main__': unittest.main()
