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

    def test_missing_feed_is_explicit_degradation_and_preserves_evidence(self):
        class Pass:
            returncode=0
            stdout=b"passed"
        missing={key:{"observation_status":"UNAVAILABLE"} for key in ("capital","social_music","business","tv_music","tv_music_catalog")}
        with tempfile.TemporaryDirectory() as temp:
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=missing):
                record=run_suite(dt.date(2026,10,14),temp,public_feeds=True,captured_at="2026-10-14T12:37:00Z")
            self.assertEqual(record["health"]["status"],"DEGRADED")
            self.assertEqual(len(record["health"]["issues"]),6)
            self.assertTrue((pathlib.Path(temp)/"evidence.json").exists())
            self.assertEqual(record["predictions"][-1]["lab"],"game_qa")
    def test_unverified_predecessor_is_degraded_even_if_sources_succeed(self):
        class Pass:
            returncode=0
            stdout=b"passed"
        with tempfile.TemporaryDirectory() as temp:
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value={}):
                record=run_suite(dt.date(2026,10,15),temp,public_feeds=True,captured_at="2026-10-15T12:37:00Z")
            self.assertEqual(record["health"]["status"],"DEGRADED")
            self.assertIn("MISSING_OR_INVALID_PRIOR_EVIDENCE",record["health"]["issues"])
    def test_preflight_not_mislabeled_as_genuine_case(self):
        class Pass:
            returncode=0
            stdout=b"passed"
        with tempfile.TemporaryDirectory() as temp:
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value={}):
                record=run_suite(dt.date(2026,10,13),temp,public_feeds=True,captured_at="2026-10-13T12:37:00Z",preflight=True)
            self.assertEqual(record["health"]["status"],"NOT_A_LIVE_OBSERVATION")
            self.assertFalse(record["predictions"])
    def test_october_21_settlement_scores_without_new_predictions(self):
        class Pass:
            returncode=0
            stdout=b"certifications passed"
        receipts={}
        for source in ("capital","social_music","business","tv_music","tv_music_catalog"):
            metric="btc_usd_price" if source=="capital" else "posted_business_keyword_grant_count" if source=="business" else "itunes_catalog_search_result_count"
            observation={"metric":metric,"value":100}
            if source=="capital": observation["provider_timestamp"]="2026-10-20T12:36:00Z"
            receipts[source]={"observation_status":"VERIFIED_PROVIDER_RESPONSE","observation":observation,"source_response_sha256":"c"*64}
        with tempfile.TemporaryDirectory() as temp:
            old=pathlib.Path(temp)/"oct20"
            end=pathlib.Path(temp)/"oct21"
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=receipts):
                prior=run_suite(dt.date(2026,10,20),old,public_feeds=True,captured_at="2026-10-20T12:37:00Z")
            self.assertEqual(len(prior["predictions"]),6)
            latest={**receipts,"capital":{**receipts["capital"],"observation":{**receipts["capital"]["observation"],"value":102,"provider_timestamp":"2026-10-21T12:36:00Z"}}}
            with patch("runner.subprocess.run",return_value=Pass()),patch("runner.collect",return_value=latest):
                resolved=run_suite(dt.date(2026,10,21),end,public_feeds=True,previous=str(old/"evidence.json"),captured_at="2026-10-21T12:37:00Z",settlement=True)
            self.assertEqual(len(resolved["predictions"]),0)
            self.assertEqual(len(resolved["outcomes"]),6)
            self.assertTrue(resolved["settlement"])
            with self.assertRaises(ValueError):
                run_suite(dt.date(2026,10,21),pathlib.Path(temp)/"blocked",dry_run=True,captured_at="2026-10-21T12:37:00Z")

if __name__=='__main__': unittest.main()
