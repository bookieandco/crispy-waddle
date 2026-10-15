import datetime as dt
import json
import pathlib
import tempfile
import unittest
from finalize import evaluate, render, sha
from learning import produce, grade

START=dt.date(2026,10,14)
LABS=("capital","social_music","business","tv_music","game_qa")

def receipts(day,price):
    date=day.isoformat()
    stamp=f"{date}T12:36:00Z"
    values={"capital":price,"social_music":10,"business":42,"tv_music":4,"tv_music_catalog":10}
    results={}
    for key,value in values.items():
        metric=("btc_usd_price" if key=="capital" else "posted_business_keyword_grant_count" if key=="business" else "itunes_catalog_search_result_count")
        observation={"metric":metric,"value":value}
        if key=="capital":observation["provider_timestamp"]=stamp
        results[key]={"observation_status":"VERIFIED_PROVIDER_RESPONSE","source_response_sha256":(key[0] if key!="business" else "b")*64,"observation":observation}
    return results

def build_records(root):
    previous=None
    for i in range(8):
        day=START+dt.timedelta(days=i)
        obs=receipts(day,100+i)
        stamp=day.isoformat()+"T12:37:00Z"
        test_results=[{"lab":l,"status":"PASS"} for l in LABS]
        outputs=grade(previous,day,stamp,obs,test_results) if previous else []
        predictions=produce(day,stamp,obs,test_results,previous) if i<7 else []
        record={
            "schema_version":1,"date":day.isoformat(),"preflight":False,"dry_run":False,
            "settlement":i==7,"predictions":predictions,"outcomes":outputs,
            "feeds":obs,"results":test_results,
            "prior_state":"FIRST_DAY_NO_PRIOR_REQUIRED" if i==0 else "VERIFIED_PRIOR_DAY",
            "prior_record_sha256":previous["record_sha256"] if previous else None,
            "financial_authority":"NONE","publication_authority":"NONE",
            "paid_services_authorized":False
        }
        record["record_sha256"]=sha(record)
        dest=pathlib.Path(root)/f"case-{i}"
        dest.mkdir()
        (dest/"evidence.json").write_text(json.dumps(record))
        previous=record

class FinalizerTests(unittest.TestCase):
    def test_eight_day_complete_forward_learning_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            report=evaluate(folder)
            self.assertEqual(report["status"],"COMPLETE_EVIDENCE_ONLY")
            self.assertEqual(report["dates_verified"],8)
            self.assertEqual(report["sealed_predictions"],42)
            self.assertEqual(report["verified_forward_outcomes"],42)
            self.assertIn("market_quote_research_only",report["metrics"])
            self.assertFalse(report["metrics"]["market_quote_research_only"]["auto_promotion_authorized"])
            self.assertIn("No real-money authority",render(report))
    def test_missing_day_breaks_completeness(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            (pathlib.Path(folder)/"case-2"/"evidence.json").unlink()
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Missing 2026-10-16" in x for x in report["issues"]))
    def test_tampered_evidence_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-1"/"evidence.json"
            data=json.loads(path.read_text())
            data["feeds"]["capital"]["observation"]["value"]=999999
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(report["invalid_artifacts"])
    def test_outcome_rewriting_with_new_valid_hash_is_still_detected(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-1"/"evidence.json"
            data=json.loads(path.read_text())
            data["outcomes"][0]["actual_value"]=99999
            g=data["outcomes"][0]
            g["grade_sha256"]=sha({k:v for k,v in g.items() if k!="grade_sha256"})
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("result/source mismatch" in x for x in report["issues"]))
    def test_duplicate_day_is_ambiguous(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            original=(pathlib.Path(folder)/"case-0"/"evidence.json").read_text()
            extra=pathlib.Path(folder)/"duplicate"
            extra.mkdir()
            (extra/"evidence.json").write_text(original)
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Ambiguous duplicate" in x for x in report["issues"]))
    def test_missing_verified_feed_prevents_false_complete_certification(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-3"/"evidence.json"
            data=json.loads(path.read_text())
            data["feeds"]["business"]["observation_status"]="UNAVAILABLE"
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Missing verified source(s)" in x for x in report["issues"]))
    def test_missing_lab_test_prevents_false_complete_certification(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-2"/"evidence.json"
            data=json.loads(path.read_text())
            data["results"][0]["status"]="FAIL"
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Failed or missing lab certification" in x for x in report["issues"]))
    def test_missing_forward_case_is_detected_even_with_valid_record_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-0"/"evidence.json"
            data=json.loads(path.read_text())
            data["predictions"]=data["predictions"][:-1]
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Incomplete pre-outcome forecasts" in x for x in report["issues"]))
    def test_fabricated_metadata_overlap_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-1"/"evidence.json"
            data=json.loads(path.read_text())
            data["domain_changes"]={"social_music":{"stable_items":99,"sample_jaccard":1.0}}
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("Unreconciled public metadata sample changes" in x for x in report["issues"]))
    def test_settlement_cannot_issue_new_prediction(self):
        with tempfile.TemporaryDirectory() as folder:
            build_records(folder)
            path=pathlib.Path(folder)/"case-7"/"evidence.json"
            data=json.loads(path.read_text())
            data["predictions"]=json.loads((pathlib.Path(folder)/"case-6"/"evidence.json").read_text())["predictions"]
            data["record_sha256"]=sha({k:v for k,v in data.items() if k!="record_sha256"})
            path.write_text(json.dumps(data))
            report=evaluate(folder)
            self.assertEqual(report["status"],"INCOMPLETE_OR_UNVERIFIED")
            self.assertTrue(any("outcome-only settlement" in x for x in report["issues"]))
if __name__=="__main__":
    unittest.main()
