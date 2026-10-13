import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("experiment_7day",HERE/"experiment_7day.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ALPH="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def mint(n):
    return "1"*30+ALPH[n//58]+ALPH[n%58]

def feeds(ids):
    return ([{"chainId":"solana","tokenAddress":x} for x in ids],[],[])

class RollingWatchPool(unittest.TestCase):
    def test_keeps_admitting_new_mints_after_reaching_ninety(self):
        s=m.empty_state()
        first=[mint(i) for i in range(90)]
        first_result=m.sample(s,feeds(first),"2026-10-14T01:00:00Z","2026-10-14T01:00:00Z")
        self.assertEqual(first_result["newlyDiscovered"],90)
        self.assertEqual(len(s["candidateMints"]),90)
        incoming=[mint(i) for i in range(90,110)]
        outcome=m.sample(s,feeds(incoming),"2026-10-14T02:00:00Z","2026-10-14T02:00:00Z")
        self.assertEqual(outcome["newlyDiscovered"],20)
        self.assertEqual(outcome["watchPoolEvictions"],20)
        self.assertEqual(outcome["unscoredEvictions"],20)
        self.assertEqual(len(s["candidateMints"]),90)
        self.assertEqual(len(s["seenMints"]),110)
        self.assertNotIn(first[0],s["candidateMints"])
        self.assertIn(incoming[0],s["candidateMints"])
        m.audit(s)

    def test_does_not_re_admit_evicted_or_repeat_discoveries(self):
        s=m.empty_state()
        m.sample(s,feeds([mint(i) for i in range(95)]),"2026-10-14T01:00:00Z","2026-10-14T01:00:00Z")
        previous=list(s["candidateMints"])
        count=m.sample(s,feeds([mint(i) for i in range(6)]),"2026-10-14T02:00:00Z","2026-10-14T02:00:00Z")
        self.assertEqual(count["newlyDiscovered"],0)
        self.assertEqual(s["candidateMints"],previous)
        self.assertEqual(len(s["seenMints"]),95)

    def test_existing_cases_survive_eviction_and_remain_unscored(self):
        s=m.empty_state()
        target=mint(0)
        a=feeds([target])
        a[2].append({"chainId":"solana","baseToken":{"address":target},
                     "quoteToken":{"address":"quote"},
                     "pairAddress":mint(120),"priceUsd":"1",
                     "liquidity":{"usd":25000},"dexId":"pumpswap"})
        m.sample(s,a,"2026-10-14T01:00:00Z","2026-10-14T01:00:00Z")
        self.assertIn(target,s["cases"])
        m.sample(s,feeds([mint(i) for i in range(1,101)]),
                 "2026-10-14T02:00:00Z","2026-10-14T02:00:00Z")
        self.assertNotIn(target,s["candidateMints"])
        self.assertIn(target,s["cases"])
        self.assertIsNone(s["cases"][target]["first24hMark"])
        m.audit(s)

    def test_malformed_active_to_seen_history_fails_audit(self):
        s=m.empty_state()
        s["candidateMints"]=[mint(0)]
        s["seenMints"]=[]
        with self.assertRaisesRegex(ValueError,"active_watch_history_inconsistent"):
            m.audit(s)

if __name__=="__main__":
    unittest.main()
