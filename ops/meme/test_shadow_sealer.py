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

    def test_new_cycle_does_not_backdate_old_cycle(self):
        s=seeded()
        t="2026-10-14T02:00:00Z"
        self.assertEqual(shadow.reconcile(s,t)["sealedNoTradeDecisions"],0)
        stats=observer.sample(s,feed(2),t,t)
        observer.append_event(s,{"type":"CYCLE","observedAt":t,"availableAt":t,**stats})
        self.assertEqual(shadow.reconcile(s,"2026-10-14T02:00:10Z")["sealedNoTradeDecisions"],1)
        self.assertEqual([e for e in s["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION"][0]["informationCutoff"],t)

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


    def test_multi_cycle_repeated_mint_has_new_real_receipt(self):
        s=seeded()
        shadow.reconcile(s,T1)
        later="2026-10-14T02:00:00Z"
        stats=observer.sample(s,feed(2.4),later,later)
        observer.append_event(s,{"type":"CYCLE","observedAt":later,"availableAt":later,**stats})
        result=shadow.reconcile(s,"2026-10-14T02:00:05Z")
        self.assertEqual(result["sealedNoTradeDecisions"],2)
        decisions=[e for e in s["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION"]
        self.assertNotEqual(decisions[0]["decisionId"],decisions[1]["decisionId"])
        self.assertEqual(decisions[0]["marketPriceUsd"],2)
        self.assertEqual(decisions[1]["marketPriceUsd"],2.4)

    def test_missing_future_quote_is_censored_not_loss(self):
        s=seeded()
        shadow.reconcile(s,T1)
        result=shadow.reconcile(s,"2026-10-15T08:01:00Z")
        self.assertEqual(result["censoredGrades"],1)
        self.assertEqual(result["scoredSpotOnlyGrades"],0)
        self.assertEqual(s["events"][-1]["reason"],"CENSORED_MISSING_24H")
        self.assertFalse(s["events"][-1]["isExecutablePnL"])
        self.assertEqual(shadow.reconcile(s,"2026-10-15T08:02:00Z")["newCensors"],0)

    def test_mid_horizon_pool_switch_is_censored_even_if_back(self):
        s=seeded()
        shadow.reconcile(s,T1)
        t="2026-10-14T10:00:00Z"
        changed=feed(1.1)
        changed[2][0]["pairAddress"]="11111111111111111111111111111111"
        stats=observer.sample(s,changed,t,t)
        observer.append_event(s,{"type":"CYCLE","observedAt":t,"availableAt":t,**stats})
        stats=observer.sample(s,feed(3),T2,T2)
        observer.append_event(s,{"type":"CYCLE","observedAt":T2,"availableAt":T2,**stats})
        verdict=shadow.reconcile(s,T3)
        self.assertEqual(verdict["newSpotOnlyGrades"],0)
        self.assertEqual(verdict["newCensors"],1)
        self.assertEqual(s["events"][-1]["reason"],"CENSORED_PAIR_SWITCH")

    def test_shadow_window_limits_unaltered_past(self):
        s=seeded()
        before=copy.deepcopy(s)
        with self.assertRaisesRegex(ValueError,"shadow_outside_start"):
            shadow.reconcile(s,"2026-10-13T22:49:00Z")
        self.assertEqual(before,s)


if __name__=="__main__":
    unittest.main()
