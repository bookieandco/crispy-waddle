"""Regression: daily outcomes cannot disappear just because watchlist rotates."""
import importlib.util
import pathlib
import unittest
from unittest import mock

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("observational_pilot",HERE/"experiment_7day.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ALPH="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def mint(n):
    return "1"*30+ALPH[n//58]+ALPH[n%58]

ORIGIN="2026-10-14T01:00:00Z"
HORIZON="2026-10-15T02:00:00Z"
PAIRED="11111111111111111111111111111111"

def pair(token,price=1.0,pool=PAIRED):
    return {"chainId":"solana","pairAddress":pool,
            "baseToken":{"address":token},"quoteToken":{"address":"So11111111111111111111111111111111111111112"},
            "dexId":"pumpswap","priceUsd":str(price),"liquidity":{"usd":30000}}

def feed(tokens,prices=None):
    prices=prices or {}
    return ([{"chainId":"solana","tokenAddress":x} for x in tokens],
            [],[pair(mint,prices.get(mint,1)) for mint in tokens])

def fixture():
    s=m.empty_state()
    target=mint(0)
    m.sample(s,feed([target]),ORIGIN,ORIGIN)
    later="2026-10-14T02:00:00Z"
    m.sample(s,feed([mint(i) for i in range(1,101)]),later,later)
    assert target not in s["candidateMints"] and target in s["cases"]
    return s,target


class HorizonFollowup(unittest.TestCase):
    def test_evicted_case_receives_genuine_later_quote(self):
        s,target=fixture()
        self.assertIn(target,m.plan_horizon_followups(s,HORIZON))
        stats=m.sample(s,([],[],[pair(target,2.5)]),HORIZON,HORIZON)
        self.assertEqual(stats["evictedHorizonObservations"],1)
        self.assertGreaterEqual(stats["dueHorizonTargets"],1)
        self.assertLessEqual(stats["dueHorizonTargets"],m.MAX_HORIZON_FOLLOWUPS)
        case=s["cases"][target]
        self.assertEqual(case["first24hMark"]["returnPctPriceOnly"],150)
        self.assertTrue(case["first24hMark"]["up"])
        self.assertFalse(case["canTrade"])
        self.assertNotIn(target,s["candidateMints"])
        self.assertEqual(m.plan_horizon_followups(s,HORIZON),[])
        m.audit(s)

    def test_before_horizon_or_after_expiry_never_fabricates_return(self):
        s,target=fixture()
        self.assertNotIn(target,m.plan_horizon_followups(s,"2026-10-14T23:00:00Z"))
        self.assertNotIn(target,m.plan_horizon_followups(s,"2026-10-15T08:00:00Z"))
        stats=m.sample(s,([],[],[pair(target,5)]),"2026-10-15T08:00:00Z","2026-10-15T08:00:00Z")
        self.assertEqual(stats["sampled"],0)
        self.assertIsNone(s["cases"][target]["first24hMark"])

    def test_horizon_probe_includes_old_mint_in_real_query(self):
        s,target=fixture()
        history=[]
        def stub(path):
            history.append(path)
            if "token-profiles" in path or "token-boosts" in path:
                return []
            if path.startswith("/tokens/v1/solana/"):
                addresses=path.rsplit("/",1)[-1].split(",")
                return [pair(x,2) for x in addresses]
            raise AssertionError("unexpected source")
        with mock.patch.object(m,"fetch_json",stub), mock.patch.object(m,"now_utc",lambda:HORIZON):
            a,b,pairs=m.discover_and_fetch(s)
        self.assertTrue(any(target in x.split("/")[-1].split(",") for x in history if "/tokens/v1/" in x))
        self.assertTrue(any(x["baseToken"]["address"]==target for x in pairs))
        self.assertLessEqual(len(pairs),m.MAX_SAMPLED+m.MAX_HORIZON_FOLLOWUPS)

    def test_limit_and_fairness_prioritizes_first_expiring(self):
        s=m.empty_state()
        for i in range(50):
            s["cases"][mint(i)]={"firstAvailableAt":ORIGIN,
                "first24hMark":None,"baselineClass":"PRICE_ONLY_NON_EXECUTABLE"}
        selected=m.plan_horizon_followups(s,HORIZON)
        self.assertEqual(len(selected),m.MAX_HORIZON_FOLLOWUPS)
        self.assertEqual(selected,sorted(selected))
        self.assertEqual(len(set(selected)),len(selected))
        with self.assertRaisesRegex(ValueError,"horizon_limit_invalid"):
            m.plan_horizon_followups(s,HORIZON,500)

    def test_future_shadow_seal_due_without_first_baseline_mark(self):
        s,target=fixture()
        s["cases"][target]["first24hMark"]={"availableAt":HORIZON,"up":True}
        m.append_event(s,{"type":"SHADOW_NO_TRADE_DECISION",
                          "decisionId":"test-sealed","mint":target,
                          "availableAt":ORIGIN,"observedAt":ORIGIN,
                          "canTrade":False})
        self.assertIn(target,m.plan_horizon_followups(s,HORIZON))
        m.append_event(s,{"type":"SHADOW_SPOT_CENSOR","decisionId":"test-sealed",
                          "availableAt":HORIZON,"observedAt":HORIZON,
                          "isExecutablePnL":False})
        self.assertNotIn(target,m.plan_horizon_followups(s,HORIZON))


if __name__=="__main__":
    unittest.main()
