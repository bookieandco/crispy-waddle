import importlib.util
import json
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location("reverse_quote_probe",HERE/"reverse_quote_probe.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
AT="2026-10-14T22:00:00Z"
class Resp:
    status=200
    def __enter__(self):return self
    def __exit__(self,*a):return False
    def read(self,n):return json.dumps({"outAmount":"9999900","transaction":None}).encode()

def seeded(success=True):
    st=m.obs.empty_state()
    m.obs.append_event(st,{"type":"CYCLE","observedAt":AT,"availableAt":AT})
    dig=st["events"][-1]["digest"]
    m.obs.append_event(st,{"type":"JUPITER_ROUTE_DIAGNOSTIC","observedAt":AT,"availableAt":AT,
         "cycleDigest":dig,"mint":MINT,"outputAtoms":"3000000000",
         "status":m.route.STATUS_OK if success else m.route.STATUS_UNAVAILABLE,
         "routeVerified":False,"canTrade":False,"isFill":False})
    return st


class ReadOnlyReverse(unittest.TestCase):
    def test_round_trip_is_two_gets_no_wallet_and_not_sellability(self):
        reqs=[]
        def opener(req,timeout):
            reqs.append(req)
            return Resp()
        verdict=m.reverse_quote(MINT,"3000000000",opener)
        self.assertEqual(verdict["status"],"INDICATIVE_REVERSE_ROUTE_ONLY")
        self.assertFalse(verdict["isSellabilityProven"])
        self.assertFalse(verdict["canSign"])
        self.assertEqual(reqs[0].get_method(),"GET")
        self.assertIn("inputMint="+MINT,reqs[0].full_url)
        self.assertIn("outputMint="+m.route.SOL,reqs[0].full_url)
        self.assertNotIn("taker=",reqs[0].full_url)
        self.assertNotIn("key",str(reqs[0].headers).lower())

    def test_no_forward_prevents_reverse_hindsight(self):
        st=seeded(False)
        self.assertEqual(m.reconcile(st,AT)["newReverseObservation"],0)
        self.assertEqual(len(st["events"]),2)

    def test_replay_idempotent_and_claims_never_escalate(self):
        st=seeded()
        good=lambda mint,atoms: {"status":"INDICATIVE_REVERSE_ROUTE_ONLY",
                                "inputTokenAtoms":atoms,
                                "isSellabilityProven":False,"routeVerified":False,
                                "canTrade":False,"canSign":False,"canBroadcast":False}
        self.assertEqual(m.reconcile(st,AT,good)["newReverseObservation"],1)
        self.assertEqual(m.reconcile(st,AT,good)["newReverseObservation"],0)
        self.assertFalse(st["events"][-1]["isSellabilityProven"])
        m.obs.audit(st)
        st2=seeded()
        bad=lambda mint,atoms: {"status":"LIE","isSellabilityProven":True,
                               "routeVerified":True,"canTrade":True}
        result=m.reconcile(st2,AT,bad)
        self.assertEqual(result["status"],"REVERSE_ROUTE_UNVERIFIED")
        self.assertFalse(st2["events"][-1]["canTrade"])

    def test_unavailable_no_fabricated_fill(self):
        def offline(*args,**kw):
            raise m.urllib.error.URLError("no network")
        r=m.reverse_quote(MINT,"3000000000",offline)
        self.assertEqual(r["status"],"REVERSE_ROUTE_UNAVAILABLE_OR_KEY_REQUIRED")
        self.assertFalse(r["isSellabilityProven"])

    def test_bad_amount_or_token_rejected_before_network(self):
        with self.assertRaisesRegex(ValueError,"invalid_buy_quoted_atoms"):
            m.reverse_quote(MINT,"0")
        with self.assertRaisesRegex(ValueError,"invalid_buy_quoted_atoms"):
            m.reverse_quote(MINT,str(2**64))
        with self.assertRaisesRegex(ValueError,"invalid_token"):
            m.reverse_quote(m.route.SOL,"10")


if __name__=="__main__":unittest.main()
