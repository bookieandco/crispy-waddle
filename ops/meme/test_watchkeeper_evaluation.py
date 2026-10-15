"""WATCHKEEPER.10 future-safe research scoring regression."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE=pathlib.Path(__file__).parent
def load(name):
    s=importlib.util.spec_from_file_location("w10test_"+name,HERE/name)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load("watchkeeper_evaluation.py")
legacy=load("test_final_evaluation.py")
cktests=load("test_watchkeeper_checkpoint.py")
BEFORE="2026-10-14T12:00:00Z"
AFTER="2026-10-20T23:02:00Z"
MINT=legacy.MINT
PAIR=legacy.PAIR
def current():
    s=m.obs.empty_state()
    s["status"]="RUNNING"
    t="2026-10-14T10:00:00Z"
    m.obs.append_event(s,{"type":"MARKET_OBSERVATION","mint":MINT,"pair":PAIR,
        "securityStatus":"UNVERIFIED","canTrade":False,
        "flags":["PRICE_COLLAPSE_NOT_PROVEN_RUG"],"availableAt":t,"observedAt":t})
    m.obs.append_event(s,{"type":"CYCLE","availableAt":t,"observedAt":t})
    m.obs.append_event(s,{"type":"SHADOW_NO_TRADE_DECISION",
        "decisionId":"no-trade:fixture","action":"NO_TRADE",
        "canTrade":False,"canSign":False,"canBroadcast":False,
        "isExecutablePnL":False,"availableAt":t,"observedAt":t,
        "mint":MINT,"pair":PAIR,"authority":"SHADOW_DECISION_ONLY"})
    s["cases"][MINT]={"first24hMark":None,"baselineClass":"PENDING",
        "firstAvailableAt":t}
    m.obs.audit(s)
    return s
class ResearchEvaluation(unittest.TestCase):
    def test_preview_cannot_certify_future_end(self):
        r=m.evaluate(current(),BEFORE)
        self.assertFalse(r["final"])
        self.assertEqual(r["status"],"PROVISIONAL_MISSING_OR_IMMATURE_EVIDENCE")
        self.assertIsNone(r["netTradingReturn"])
        self.assertIsNone(r["confirmedRugCount"])
        self.assertIsNone(r["rugFalsePositiveRate"])
        self.assertFalse(r["strategyPromotionEligible"])
        self.assertEqual(r["verifiedPaperFills"],0)

    def test_pre_cutoff_unresolved_decision_is_explicit(self):
        r=m.evaluate(current(),BEFORE)
        self.assertEqual(r["shadowDecisions"],1)
        self.assertEqual(r["shadowUnresolved"],1)
        self.assertIsNone(r["shadowPriceDirectionRatio"])
        self.assertEqual(r["baselineUnscored"],1)

    def test_post_cutoff_without_end_not_final(self):
        r=m.evaluate(current(),AFTER)
        self.assertFalse(r["final"])
        self.assertEqual(r["ledgerStatus"],"RUNNING")

    def test_true_completed_end_is_research_only(self):
        s=legacy.ready()
        r=m.evaluate(s,AFTER)
        self.assertTrue(r["final"])
        self.assertEqual(r["status"],"FINAL_RESEARCH_NOT_EXECUTION_CERTIFIED")
        self.assertIsNone(r["maxDrawdown"])
        self.assertIsNone(r["sharpeRatio"])
        self.assertEqual(r["shadowCensored"],1)
        self.assertFalse(r["postgresColdRestoreVerified"])
        self.assertIn("No real or independently certified",m.render(r))

    def test_end_before_real_cutoff_refused(self):
        s=current()
        m.obs.append_event(s,{"type":"END","availableAt":"2026-10-19T22:50:00Z"})
        s["status"]="COMPLETED"
        with self.assertRaisesRegex(ValueError,"early_or_missing_end"):
            m.evaluate(s,AFTER)

    def test_end_from_future_cannot_finalize_early(self):
        s=current()
        m.obs.append_event(s,{"type":"END","availableAt":AFTER})
        with self.assertRaisesRegex(ValueError,"future_end_receipt"):
            m.evaluate(s,BEFORE)

    def test_undeclared_trade_events_refused(self):
        s=current();m.obs.append_event(s,{"type":"EXECUTED_TRADE","amount":"10"})
        with self.assertRaisesRegex(ValueError,"executable_event"):
            m.evaluate(s,BEFORE)

    def test_source_integrity_edit_refused(self):
        s=current();s["events"][0]["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            m.evaluate(s,BEFORE)

    def test_invalid_shadow_spot_claim_refused(self):
        s=current()
        m.obs.append_event(s,{"type":"SHADOW_SPOT_GRADE",
            "decisionId":"no-trade:fixture","availableAt":BEFORE,
            "grade":"MISSED_SPOT_UP_MOVE","isExecutablePnL":True})
        with self.assertRaisesRegex(ValueError,"unsafe_grade"):
            m.evaluate(s,BEFORE)

    def test_independent_backup_is_not_implied_by_local_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp);s=current()
            ck=m.ck.commit(f,m.ck.canonical(s),"run-20261014-001",BEFORE)
            r=m.evaluate(s,BEFORE,f)
            self.assertEqual(r["localCheckpointStatus"],"LOCAL_SNAPSHOT_MATCHES_CURRENT_HEAD")
            self.assertFalse(r["independentArchiveRestoreVerified"])
            self.assertFalse(r["schedulerRunsIndependentlyWitnessed"])
            self.assertFalse(r["canAuthorizeLive"])

    def test_uncheckpointed_future_head_reports_stale_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=pathlib.Path(tmp);s=current()
            m.ck.commit(f,m.ck.canonical(s),"run-20261014-001",BEFORE)
            m.obs.append_event(s,{"type":"CYCLE","availableAt":"2026-10-14T11:30:00Z"})
            r=m.evaluate(s,BEFORE,f)
            self.assertEqual(r["localCheckpointStatus"],"MISSING_OR_STALE_LOCAL_SNAPSHOT")

    def test_spot_grade_not_counted_as_trading_return(self):
        s=current();m.obs.append_event(s,{"type":"SHADOW_SPOT_GRADE",
            "decisionId":"no-trade:fixture","availableAt":"2026-10-14T11:30:00Z",
            "grade":"MISSED_SPOT_UP_MOVE","isExecutablePnL":False,"canTrade":False})
        r=m.evaluate(s,BEFORE)
        self.assertEqual(r["shadowSpotOnlyUp"],1)
        self.assertEqual(r["shadowPriceDirectionRatio"],1)
        self.assertIsNone(r["netTradingReturn"])

    def test_tampered_report_digest_rejected(self):
        r=m.evaluate(current(),BEFORE);r["verifiedPaperFills"]=55
        with self.assertRaisesRegex(ValueError,"result_digest_invalid"):
            m.render(r)

    def test_legacy_final_unavailable_at_missing_end(self):
        s=current();s["status"]="COMPLETED"
        with self.assertRaisesRegex(ValueError,"early_or_missing_end"):
            m.evaluate(s,AFTER)
if __name__=="__main__":
    unittest.main()
