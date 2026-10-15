"""Zero-network final audit regression: no final score before genuine cutoff."""
import importlib.util
import pathlib
import tempfile
import unittest

HERE=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location("final_evaluation",HERE/"final_evaluation.py")
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
obs=m.obs
MINT="So11111111111111111111111111111111111111112"
PAIR="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
AFTER="2026-10-20T23:01:00Z"
BEFORE="2026-10-19T23:01:00Z"

def ready():
    s=obs.empty_state()
    obs.append_event(s,{"type":"MARKET_OBSERVATION","mint":MINT,"pair":PAIR,
          "availableAt":"2026-10-13T23:00:00Z","observedAt":"2026-10-13T23:00:00Z",
          "flags":["PRICE_COLLAPSE_NOT_PROVEN_RUG"],"canTrade":False,
          "securityStatus":"UNVERIFIED"})
    obs.append_event(s,{"type":"CYCLE","availableAt":"2026-10-13T23:00:00Z"})
    s["candidateMints"]=[MINT]
    s["cases"][MINT]={"first24hMark":None,"baselineClass":"CENSORED_PAIR_SWITCH",
                       "firstAvailableAt":"2026-10-13T23:00:00Z"}
    obs.append_event(s,{"type":"SHADOW_NO_TRADE_DECISION","decisionId":"dn-01",
                        "mint":MINT,"canTrade":False,"action":"NO_TRADE",
                        "availableAt":"2026-10-14T00:00:00Z"})
    obs.append_event(s,{"type":"SHADOW_SPOT_CENSOR","decisionId":"dn-01","isExecutablePnL":False,
                        "availableAt":"2026-10-15T04:00:00Z"})
    obs.append_event(s,{"type":"END","availableAt":AFTER})
    s["status"]="COMPLETED"
    obs.audit(s)
    return s


class FinalEvaluationTest(unittest.TestCase):
    def test_before_cutoff_is_not_final(self):
        s=ready()
        r=m.build(s,BEFORE)
        self.assertFalse(r["final"])
        with self.assertRaisesRegex(ValueError,"not_an_actual_final"):
            m.render(r)

    def test_requires_actual_completed_ledger(self):
        s=ready()
        s["status"]="RUNNING"
        self.assertEqual(m.build(s,AFTER)["status"],"AWAITING_COMPLETED_LEDGER")
        s["status"]="COMPLETED"
        s["events"]=s["events"][:-1]
        # Restore integrity by constructing a valid alternative no-END state.
        s2=obs.empty_state()
        s2["status"]="COMPLETED"
        self.assertEqual(m.build(s2,AFTER)["status"],"AWAITING_COMPLETED_LEDGER")

    def test_censors_are_not_losses_or_rug_labels(self):
        r=m.build(ready(),AFTER)
        self.assertTrue(r["final"])
        self.assertEqual(r["shadowCensored"],1)
        self.assertEqual(r["shadowObservedGrades"],0)
        self.assertEqual(r["baselineUnscoredCases"],1)
        self.assertEqual(r["baseline24hMarks"],0)
        self.assertIsNone(r["baselineUpRate"])
        self.assertIsNone(r["confirmedRugs"])
        self.assertIsNone(r["falsePositiveRate"])
        self.assertEqual(r["paperFills"],0)
        self.assertEqual(r["realTrades"],0)
        md=m.render(r)
        self.assertIn("NOT certified as a sniper",md)
        self.assertIn("UNKNOWN / UNSCORED",md)
        self.assertIn("Unscored first-price cases: 1",md)

    def test_does_not_write_early_and_then_writes_exact_cutoff(self):
        s=ready()
        with tempfile.TemporaryDirectory() as folder:
            p=pathlib.Path(folder)/"state.json"
            out=pathlib.Path(folder)/"final.md"
            obs.write_json(p,s)
            result=m.finalize(p,out,BEFORE)
            self.assertFalse(result["final"])
            self.assertFalse(out.exists())
            result=m.finalize(p,out,AFTER)
            self.assertTrue(result["final"])
            self.assertIn(r"Immutable-style Git hash-linked ledger head:",out.read_text())

    def test_tampered_ledger_fails_hash_audit(self):
        s=ready()
        s["events"][0]["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            m.build(s,AFTER)

    def test_stale_or_wrong_shadow_grade_receipt_fails_closed(self):
        s=ready()
        obs.append_event(s,{"type":"SHADOW_SPOT_GRADE","decisionId":"unknown",
             "isExecutablePnL":False,"availableAt":AFTER})
        with self.assertRaisesRegex(ValueError,"unlinked_shadow_outcome"):
            m.build(s,AFTER)


if __name__=="__main__":unittest.main()
