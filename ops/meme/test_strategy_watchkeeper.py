"""Pure offline tests: watchkeeper must never confer financial authority."""
from __future__ import annotations
import copy
import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location("watchkeeper",pathlib.Path(__file__).with_name("strategy_watchkeeper.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
T0="2026-10-13T12:00:00Z"
T1="2026-10-14T12:00:00Z"
ASOF="2026-10-15T12:00:00Z"

def arm(n:int, ret:float=-200, fill:str="COUNTERFACTUAL_ONLY")->dict:
    return {"sourceClass":"DEX_ROUTE_COUNTERFACTUAL","authority":"PAPER_SIMULATION_ONLY",
            "canExecute":False,"canSign":False,"canBroadcast":False,
            "fillStatus":fill,"returnBps":ret if fill=="COUNTERFACTUAL_ONLY" else None,
            "costBps":40,"quoteAvailableAt":T1,"quoteEvidenceIds":[f"q-{n}"],"exitFeasible":True}

def fixture(n:int=36)->dict:
    return {"schema":m.SCHEMA,"strategyId":"NEW_PAIR_POST_BUNDLE_DIP",
            "marketRegime":"SOL-PUMPSWAP-V1","hardLimitsHash":"a"*64,
            "safetyStatus":"INDEPENDENT_VERIFIED","asOf":ASOF,
            "pairs":[{"caseId":f"case-{i}","independentGroup":f"launch-{i}",
                      "marketRegime":"SOL-PUMPSWAP-V1","sealedAt":T0,"outcomeAvailableAt":T1,
                      "candidate":arm(i*2,-320),"baseline":arm(i*2+1,80)}
                     for i in range(n)]}

class WatchkeeperSafety(unittest.TestCase):
    def test_only_recommendation_even_when_significant(self):
        r=m.assess(fixture())
        self.assertEqual(r["verdict"],"PROPOSE_STRATEGY_REVIEW")
        self.assertEqual(r["meanPairedDeltaBps"],-400)
        self.assertEqual(r["authority"],"RESEARCH_ONLY")
        for key in ("canExecute","canSign","canBroadcast","canRewriteRules",
                    "canChangeHardLimits","canAuthorizeLive","tradePerformanceCertified"):
            self.assertIs(r[key],False,key)

    def test_missing_exit_is_unscored_and_blocks_certification(self):
        x=fixture()
        x["pairs"][0]["candidate"]["fillStatus"]="NO_FILL"
        x["pairs"][0]["candidate"]["returnBps"]=None
        r=m.assess(x)
        self.assertEqual(r["verdict"],"ABSTAIN")
        self.assertEqual(r["noFillPairs"],1)
        self.assertEqual(r["scoredPairs"],35)

    def test_unscored_return_is_rejected(self):
        x=fixture()
        x["pairs"][0]["baseline"]["fillStatus"]="UNSCORED"
        with self.assertRaisesRegex(ValueError,"unscored_cannot_have_return"):
            m.assess(x)

    def test_unverified_spot_prices_not_admitted(self):
        x=fixture()
        x["pairs"][0]["candidate"]["sourceClass"]="SPOT_ONLY"
        with self.assertRaisesRegex(ValueError,"unverified_source_class"):
            m.assess(x)

    def test_future_quote_is_rejected(self):
        x=fixture()
        x["pairs"][0]["candidate"]["quoteAvailableAt"]=ASOF
        with self.assertRaisesRegex(ValueError,"future_quote"):
            m.assess(x)

    def test_financial_authority_cannot_be_escalated(self):
        for key in ("canExecute","canSign","canBroadcast"):
            x=fixture()
            x["pairs"][0]["candidate"][key]=True
            with self.assertRaisesRegex(ValueError,"authority_escalation"):
                m.assess(x)

    def test_duplicates_and_dependent_cohorts_are_rejected(self):
        for key in ("caseId","independentGroup"):
            x=fixture()
            x["pairs"][1][key]=x["pairs"][0][key]
            with self.assertRaisesRegex(ValueError,"duplicate_or_dependent_case"):
                m.assess(x)

    def test_shared_quote_between_independent_cases_rejected(self):
        x=fixture()
        x["pairs"][1]["candidate"]["quoteEvidenceIds"]=x["pairs"][0]["candidate"]["quoteEvidenceIds"]
        with self.assertRaisesRegex(ValueError,"reused_cross_case_evidence"):
            m.assess(x)

    def test_mismatched_pool_regime_rejected(self):
        x=fixture()
        x["pairs"][0]["marketRegime"]="SOL-RAYDIUM-V4"
        with self.assertRaisesRegex(ValueError,"cross_regime"):
            m.assess(x)

    def test_insufficient_n_does_not_rewrite(self):
        r=m.assess(fixture(12))
        self.assertEqual(r["verdict"],"ABSTAIN")

    def test_unknown_independent_safety_abstains(self):
        x=fixture()
        x["safetyStatus"]="UNKNOWN"
        self.assertEqual(m.assess(x)["verdict"],"ABSTAIN")

    def test_good_simulation_does_not_promote(self):
        x=fixture()
        for p in x["pairs"]:
            p["candidate"]["returnBps"]=100
        r=m.assess(x)
        self.assertEqual(r["verdict"],"MONITOR_SIMULATION")
        self.assertIs(r["canAuthorizeLive"],False)

    def test_output_digest_repeatable_and_input_unchanged(self):
        x=fixture()
        old=copy.deepcopy(x)
        a=m.assess(x)
        b=m.assess(x)
        self.assertEqual(a["receiptDigest"],b["receiptDigest"])
        self.assertEqual(x,old)

    def test_future_outcomes_rejected(self):
        x=fixture()
        x["pairs"][0]["outcomeAvailableAt"]="2026-10-16T12:00:00Z"
        with self.assertRaisesRegex(ValueError,"future_or_unsealed_outcome"):
            m.assess(x)

    def test_negative_cost_rejected(self):
        x=fixture()
        x["pairs"][0]["candidate"]["costBps"]=-1
        with self.assertRaisesRegex(ValueError,"cost_bps_outside_bounds"):
            m.assess(x)

    def test_low_matched_coverage_rejected(self):
        x=fixture()
        for pair in x["pairs"][:10]:
            for key in ("candidate","baseline"):
                pair[key]["fillStatus"]="UNSCORED"
                pair[key]["returnBps"]=None
        r=m.assess(x)
        self.assertEqual(r["verdict"],"ABSTAIN")
        self.assertIn("UNSCORED_COVERAGE_TOO_HIGH",r["reasonCodes"])

if __name__=="__main__":
    unittest.main()
