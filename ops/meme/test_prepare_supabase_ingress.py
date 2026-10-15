import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
p=importlib.util.spec_from_file_location("prepare_supabase_ingress",HERE/"prepare_supabase_ingress.py")
m=importlib.util.module_from_spec(p);p.loader.exec_module(m)
AT="2026-10-15T00:42:00Z"
MINT="So11111111111111111111111111111111111111112"
PAIR="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
COMMIT="a"*40
def fixture():
    state=m.obs.empty_state()
    m.obs.append_event(state,{"type":"MARKET_OBSERVATION","mint":MINT,
        "pair":PAIR,"priceUsd":.02,"liquidityUsd":25000,"availableAt":AT,
        "observedAt":AT,"securityStatus":"UNVERIFIED","canTrade":False,
        "flags":["MINT_FREEZE_LP_CONTROL_AND_HOLDERS_UNVERIFIED"]})
    m.obs.append_event(state,{"type":"CYCLE","availableAt":AT,"sampled":1})
    m.obs.append_event(state,{"type":"SHARK_MONEY_PAPER_GUARD",
        "mint":MINT,"disposition":"NO_TRADE","moneyApproval":"ABSENT",
        "informationCutoff":AT,"availableAt":AT,"canTrade":False})
    return state

class IngressPreparation(unittest.TestCase):
    def test_real_cycle_contains_real_market_and_guard_no_authority(self):
        st=fixture();r=m.prepare(st,COMMIT)
        self.assertEqual(r["version"],"SHARK-PAPER-INGRESS-01")
        self.assertEqual(len(r["events"]),2)
        self.assertEqual([e["type"] for e in r["events"]],
                         ["MARKET_OBSERVATION","SHARK_MONEY_PAPER_GUARD"])
        self.assertEqual(r["ledgerHeadDigest"],st["lastDigest"])
        self.assertFalse(r["canTrade"])
        self.assertFalse(r["partialBatch"])
    def test_replay_deterministic_no_clock_replacement(self):
        s=fixture()
        self.assertEqual(m.prepare(s,COMMIT),m.prepare(s,COMMIT))
        self.assertEqual(m.prepare(s,COMMIT)["events"][0]["availableAt"],AT)
    def test_tampering_detected_without_ingress(self):
        s=fixture();s["events"][0]["priceUsd"]=1000
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):m.prepare(s,COMMIT)
    def test_guard_authority_refused_even_on_valid_chain(self):
        s=fixture();s["events"]=[];s["lastDigest"]=m.obs.GENESIS
        m.obs.append_event(s,{"type":"CYCLE","availableAt":AT})
        m.obs.append_event(s,{"type":"SHARK_MONEY_PAPER_GUARD",
            "mint":MINT,"disposition":"NO_TRADE","moneyApproval":"APPROVED",
            "informationCutoff":AT,"availableAt":AT,"canTrade":False})
        with self.assertRaisesRegex(ValueError,"money_abstention_authority_escalated"):
            m.prepare(s,COMMIT)
    def test_empty_real_cycle_is_neutral_not_fabricated(self):
        s=m.obs.empty_state()
        m.obs.append_event(s,{"type":"CYCLE","availableAt":AT})
        self.assertEqual(m.prepare(s,COMMIT)["events"],[])
    def test_stale_market_not_repackaged_current(self):
        s=fixture();later="2026-10-15T01:00:00Z"
        m.obs.append_event(s,{"type":"CYCLE","availableAt":later})
        self.assertEqual(m.prepare(s,COMMIT)["events"],[])
    def test_limit_and_git_commit_guard(self):
        s=fixture()
        with self.assertRaisesRegex(ValueError,"source_data_commit_invalid"):
            m.prepare(s,"not-a-real-sha")
        with self.assertRaisesRegex(ValueError,"ingress_batch_limit_invalid"):
            m.prepare(s,COMMIT,100000)
        r=m.prepare(s,COMMIT,1)
        self.assertTrue(r["partialBatch"])
        self.assertEqual(len(r["events"]),1)
    def test_no_real_cycle_blocks(self):
        with self.assertRaisesRegex(ValueError,"no_real_cycle_available"):
            m.prepare(m.obs.empty_state(),COMMIT)
if __name__=="__main__":unittest.main()
