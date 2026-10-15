import datetime as dt
import json
import pathlib
import tempfile
import unittest
import zipfile
from archive import make_archive,validate_archive,upload_drive
from admission import select,read_valid
from finish_core import inspect,render_html,campaign_plan,media_review,game_review,paper_review,fingerprint
from learning import sha

DAY=dt.date(2026,10,15)
def receipt(date="2026-10-15"):
    preds=[]
    for key in ("capital","social_music","business","tv_music","tv_music_catalog","game_qa"):
        p={"prediction_id":"case:"+key,"source":key,"target_date_utc":"2026-10-16",
           "baseline_value":100,"execute_authority":False,"publication_authority":False}
        p["prediction_sha256"]=sha(p)
        preds.append(p)
    out={"schema_version":1,"date":date,"preflight":False,"dry_run":False,"settlement":False,
         "financial_authority":"NONE","publication_authority":"NONE","paid_services_authorized":False,
         "prior_state":"VERIFIED_PRIOR_DAY","prior_record_sha256":"b"*64,
         "health":{"status":"HEALTHY"},
         "predictions":preds,
         "results":[{"lab":name,"status":"PASS"} for name in ("capital","social_music","business","tv_music","game_qa")],
         "feeds":{name:{"observation_status":"VERIFIED_PROVIDER_RESPONSE"} for name in
                  ("capital","social_music","business","tv_music","tv_music_catalog")}}
    out["record_sha256"]=sha(out)
    return out
class FinishTests(unittest.TestCase):
 def test_archive_round_trip_restore_all_files(self):
    with tempfile.TemporaryDirectory() as folder:
     root=pathlib.Path(folder);src=root/"source";src.mkdir()
     (src/"evidence.json").write_text(json.dumps(receipt()))
     (src/"game_qa.log").write_bytes(b"headless PASS")
     archive=root/"out.zip"
     saved=make_archive(src,archive)
     manifest=validate_archive(archive,root/"restored")
     self.assertEqual(manifest["record_sha256"],saved["record_sha256"])
     self.assertEqual((root/"restored"/"game_qa.log").read_bytes(),b"headless PASS")
     self.assertEqual(saved["zip_sha256"],__import__("hashlib").sha256(archive.read_bytes()).hexdigest())
 def test_archive_rejects_corruption_even_when_zip_parses(self):
    with tempfile.TemporaryDirectory() as folder:
     root=pathlib.Path(folder);src=root/"source";src.mkdir()
     (src/"evidence.json").write_text(json.dumps(receipt()))
     archive=root/"out.zip";make_archive(src,archive)
     with zipfile.ZipFile(archive,"a") as z:z.writestr("game_qa.log",b"extra payload")
     with self.assertRaises(ValueError):validate_archive(archive)
 def test_no_fake_drive_upload_from_missing_id(self):
    with self.assertRaises(ValueError):upload_drive("/tmp/no.zip","../other", "{}")
 def test_exact_predecessor_and_duplicate_rejection(self):
    with tempfile.TemporaryDirectory() as folder:
     root=pathlib.Path(folder);(root/"a").mkdir();(root/"a"/"evidence.json").write_text(json.dumps(receipt()))
     self.assertEqual(select(root,DAY)[1]["date"],DAY.isoformat())
     (root/"b").mkdir();(root/"b"/"evidence.json").write_text(json.dumps(receipt()))
     with self.assertRaises(ValueError):select(root,DAY)
 def test_prior_requires_genuine_live_day_and_unique_sealed_cases(self):
    with tempfile.TemporaryDirectory() as folder:
     root=pathlib.Path(folder)/"evidence.json"
     entry=receipt();entry["preflight"]=True
     entry["record_sha256"]=sha({k:v for k,v in entry.items() if k!="record_sha256"})
     root.write_text(json.dumps(entry))
     self.assertIsNone(read_valid(root,DAY))
 def test_review_cannot_certify_simulation_or_media_rights(self):
    r=receipt()
    r["lab_experiments"]={
     "capital":{"status":"OBSERVED","state":{"equity_usd":1000,"peak_equity_usd":1000,"max_drawdown_pct":0,"samples":0}},
     "social_music":{"winner_in_simulation_only":"a","variants":[{"id":"a"}]},
     "business":{"opportunities":[{"source_number":"100","score_heuristic_only":75,"potential_award_usd":100000}]},
     "tv_music":{"ranked_candidates":[{"source":"tv_music","id":"1","official_catalog_link_verified":True,"score":70}]},
     "game_qa":{"headless_browser_status":"PASS"}}
    r["browser_qa"]={"checks":[{"id":"responsive_screen_not_clipped","passed":True}]}
    report=inspect(r)
    self.assertIn("LICENSED_PLAYBACK_NOT_CERTIFIED",report["blocking_checks"])
    self.assertIn("IPHONE_HARDWARE_NOT_ATTESTED",report["blocking_checks"])
    self.assertFalse(report["labs"]["social_music"]["external_engagement_verified"])
    self.assertFalse(report["labs"]["capital"]["automatic_order_authority"])
    self.assertEqual(report["labs"]["business"]["candidates"][0]["eligibility"],"REQUIRES_APPLICANT_AND_CURRENT_AGENCY_RULE_REVIEW")
 def test_attack_markup_is_escaped_in_dashboard(self):
    report={"date":"2026-10-15","status":"<script>alert(1)</script>",
            "source_record_sha256":"a"*64,"labs":{"capital":{"error":"<img src=x>"}},
            "blocking_checks":["<bad>"]}
    markup=render_html(report)
    self.assertNotIn("<script>alert",markup)
    self.assertNotIn("<img src=x>",markup)
    self.assertIn("&lt;bad&gt;",markup)
    self.assertIn("default-src 'none'",markup)
 def test_bad_analytics_attestation_remains_simulated(self):
    record={"lab_experiments":{"social_music":{"variants":[{"id":"first"}]}}}
    out=campaign_plan(record,{"provenance_kind":"OWNED_PLATFORM_ACCOUNT_ANALYTICS",
                              "authorization_receipt_sha256":"a"*64,"variant_id":"first",
                              "published_at_utc":"2026-10-15T12:00:00Z",
                              "observed_at_utc":"2026-10-15T12:01:00Z",
                              "impressions":10,"clicks":11})
    self.assertEqual(out["analytics_status"],"REJECTED_UNVERIFIED_OR_INVALID")
    self.assertFalse(out["external_engagement_verified"])
 def test_official_apple_link_does_not_prove_rights(self):
    r={"lab_experiments":{"tv_music":{"ranked_candidates":[{"source":"tv_music","id":"1",
           "official_catalog_link_verified":True,"score":70}]}}}
    result=media_review(r)
    self.assertEqual(result["approved_playback_count"],0)
    self.assertEqual(result["candidates"][0]["rights_status"],"NO_VERIFIED_PLAYBACK_RIGHT")
 def test_iphone_no_hardware_stays_pending(self):
    result=game_review({"lab_experiments":{"game_qa":{"headless_browser_status":"PASS"}},
                        "browser_qa":{"checks":[]}})
    self.assertFalse(result["independent_iphone_certification"])
    self.assertEqual(len(result["missing_real_device_checks"]),6)
if __name__=="__main__":unittest.main()
