import datetime as dt
import json
import pathlib
import tempfile
import unittest
from release_gate import run,CODES,DATES
from finish_core import inspect,media_review,paper_review,campaign_plan,game_review

class CompletionAcceptance(unittest.TestCase):
 def test_eighteen_milestones_never_certify_missing_week_or_unlinked_accounts(self):
  with tempfile.TemporaryDirectory() as folder:
   report=run(folder)
   self.assertEqual(len(report["milestones"]),18)
   self.assertEqual([r["id"] for r in report["milestones"]],[c[0] for c in CODES])
   self.assertEqual(report["certification"],"INCOMPLETE_PENDING_DATES_OR_EVIDENCE")
   self.assertFalse(report["production_certified"])
   self.assertTrue(all(r["status"]!="VERIFIED" for r in report["milestones"]))
 def test_archive_receipt_missing_does_not_count_as_google_drive_backup(self):
  with tempfile.TemporaryDirectory() as folder:
   root=pathlib.Path(folder)/"run";root.mkdir()
   (root/"evidence.json").write_text(json.dumps({"schema_version":1,"date":"2026-10-15",
    "preflight":False,"dry_run":False,"record_sha256":"e"*64}))
   report=run(folder)
   self.assertFalse(report["daily_backup_evidence"]["2026-10-15"]["archive_restore_verified"])
   self.assertNotEqual(report["daily_backup_evidence"]["2026-10-15"]["drive_status"],"UPLOADED_NOT_RESTORED")
 def test_paper_baseline_is_no_trade_not_profitable_forecast_claim(self):
  old={"lab_experiments":{"capital":{"open_position":{"quote_at_utc":"2026-10-14T12:35:00Z"}}}}
  now={"lab_experiments":{"capital":{"status":"OBSERVED",
     "state":{"equity_usd":995,"peak_equity_usd":1000,"max_drawdown_pct":0.5,"samples":1},
     "closed_paper_trade":{"entry_effective_ask_usd":100,"exit_effective_bid_usd":95,
       "exit_quote_at_utc":"2026-10-15T12:35:00Z","notional_usd":100,
       "net_pnl_usd":-5,"observed_only_not_executed":True}}}}
  x=paper_review(now,old)
  self.assertEqual(x["comparison"]["no_trade_return_pct"],0)
  self.assertEqual(x["comparison"]["paper_minus_no_trade_pct"],-5)
  self.assertFalse(x["comparison"]["real_trade_or_investment_return"])
 def test_unrelated_host_does_not_become_authorized_media(self):
  record={"lab_experiments":{"tv_music":{"ranked_candidates":[{"source":"tv_music","id":"7","score":99}]}}}
  rights={"tv_music|7":{"legal_review_completed":True,"rights_holder_verified":True,
    "rights_receipt_sha256":"a"*64,"permission_scope":"PERSONAL_STREAMING_IN_APP",
    "playback_url":"https://untrusted.net/stream","authorized_hosts":["trusted.example"]}}
  self.assertEqual(media_review(record,rights)["approved_playback_count"],0)
 def test_attested_real_campaign_does_not_become_platform_independent_certification(self):
  rec={"lab_experiments":{"social_music":{"variants":[{"id":"A"}]}}}
  proof={"provenance_kind":"OWNED_PLATFORM_ACCOUNT_ANALYTICS",
    "authorization_receipt_sha256":"a"*64,"variant_id":"A",
    "published_at_utc":"2026-10-14T12:00:00Z",
    "observed_at_utc":"2026-10-15T12:00:00Z","impressions":500,"clicks":45}
  x=campaign_plan(rec,proof)
  self.assertEqual(x["analytics_status"],"ACCEPTED_AS_USER_ATTESTATION_NOT_PLATFORM_AUDIT")
  self.assertFalse(x["external_engagement_verified"])
  self.assertEqual(x["observed_metrics"]["ctr_pct"],9.0)
 def test_physical_iphone_attestation_still_requires_separate_certification(self):
  physical={"device_kind":"IPHONE_SAFARI_REAL_DEVICE","human_operator_attested":True,
    "evidence_sha256":"f"*64,
    "passed_checks":["safari_user_gesture_audio","audible_speaker_route",
      "bluetooth_controller_inputs","touch_cancel_releases",
      "landscape_controls_visible","fullscreen_responsive"]}
  r=game_review({"lab_experiments":{"game_qa":{}}},physical)
  self.assertTrue(r["physical_iphone_user_attestation"])
  self.assertFalse(r["independent_iphone_certification"])
if __name__=="__main__":unittest.main()
