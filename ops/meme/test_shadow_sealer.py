import copy
import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("shadow_sealer",HERE/"shadow_sealer.py")
shadow=importlib.util.module_from_spec(spec)
spec.loader.exec_module(shadow)
observer=shadow.observer
MINT="So11111111111111111111111111111111111111112"
PAIR="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
T0="2026-10-14T01:00:00Z"
T1="2026-10-14T01:00:10Z"
T2="2026-10-15T01:30:00Z"
T3="2026-10-15T01:30:10Z"

def feed(price):
    return ([{"chainId":"solana","tokenAddress":MINT}],[],[{
        "chainId":"solana","pairAddress":PAIR,
        "baseToken":{"address":MINT},"quoteToken":{"address":"quote"},
        "priceUsd":str(price),"liquidity":{"usd":100000},"dexId":"pumpswap"
    }])

def seeded():
    s=observer.empty_state()
    stats=observer.sample(s,feed(2),T0,T0)
    observer.append_event(s,{"type":"CYCLE","observedAt":T0,"availableAt":T0,**stats})
    return s


class ShadowStudy(unittest.TestCase):
    def test_seals_only_current_cycle_with_no_trade(self):
        s=seeded()
        result=shadow.reconcile(s,T1)
        self.assertEqual(result["newNoTradeDecisions"],1)
        self.assertEqual(result["sealedNoTradeDecisions"],1)
        self.assertFalse(s["events"][-1]["canTrade"])
        self.assertEqual(s["events"][-1]["action"],"NO_TRADE")
        self.assertEqual(shadow.reconcile(s,T1)["newNoTradeDecisions"],0)
        observer.audit(s)

    def test_never_backdates_old_cases(self):
        s=seeded()
        t="2026-10-14T02:00:00Z"
        self.assertEqual(shadow.reconcile(s,t)["sealedNoTradeDecisions"],0)
        stats=observer.sample(s,feed(2),t,t)
        observer.append_event(s,{"type":"CYCLE","observedAt":t,"availableAt":t,**stats})
        self.assertEqual(shadow.reconcile(s,"2026-10-14T02:00:10Z")["sealedNoTradeDecisions"],0)

    def test_grades_only_observed_future_marks(self):
        s=seeded()
        shadow.reconcile(s,T1)
        self.assertEqual(shadow.reconcile(s,T1)["scoredSpotOnlyGrades"],0)
        stats=observer.sample(s,feed(3),T2,T2)
        observer.append_event(s,{"type":"CYCLE","observedAt":T2,"availableAt":T2,**stats})
        result=shadow.reconcile(s,T3)
        self.assertEqual(result["newSpotOnlyGrades"],1)
        self.assertEqual(s["events"][-1]["grade"],"MISSED_SPOT_UP_MOVE")
        self.assertFalse(s["events"][-1]["isExecutablePnL"])
        self.assertEqual(shadow.reconcile(s,T3)["newSpotOnlyGrades"],0)

    def test_sealed_receipts_are_hash_protected(self):
        s=seeded()
        shadow.reconcile(s,T1)
        bad=copy.deepcopy(s)
        bad["events"][-1]["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"digest"):
            observer.audit(bad)

    def test_switch_censors_shadow_grades(self):
        s=seeded()
        shadow.reconcile(s,T1)
        switched=feed(.1)
        switched[2][0]["pairAddress"]="11111111111111111111111111111111"
        stats=observer.sample(s,switched,T2,T2)
        observer.append_event(s,{"type":"CYCLE","observedAt":T2,"availableAt":T2,**stats})
        self.assertEqual(shadow.reconcile(s,T3)["scoredSpotOnlyGrades"],0)
        self.assertEqual(s["cases"][MINT]["baselineClass"],"CENSORED_PAIR_SWITCH")


if __name__=="__main__":
    unittest.main()
