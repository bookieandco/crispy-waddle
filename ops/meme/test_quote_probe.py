import importlib.util
import json
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location("quote_probe",HERE/"quote_probe.py")
m=importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
obs=m.obs
MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
T0="2026-10-14T01:00:00Z"
T1="2026-10-14T01:00:05Z"


class Response:
    status=200
    def __init__(self,body):self.body=body
    def __enter__(self):return self
    def __exit__(self,*a):return False
    def read(self,n):return json.dumps(self.body).encode()


def seed():
    state=obs.empty_state()
    obs.append_event(state,{"type":"CYCLE","observedAt":T0,"availableAt":T0})
    obs.append_event(state,{"type":"SHADOW_NO_TRADE_DECISION","mint":MINT,"action":"NO_TRADE",
                            "canTrade":False,"observedAt":T1,"availableAt":T1})
    return state


class QuoteStudy(unittest.TestCase):
    def test_quote_request_is_read_only_and_keyless(self):
        called=[]
        def reader(req,timeout):
            called.append(req)
            return Response({"outAmount":"12000000","router":"metis","feeBps":5,"transaction":None})
        q=m.read_quote(MINT,opener=reader)
        self.assertEqual(q["status"],m.STATUS_OK)
        self.assertFalse(q["routeVerified"])
        self.assertFalse(q["isFill"])
        self.assertFalse(q["canTrade"])
        self.assertEqual(called[0].get_method(),"GET")
        self.assertNotIn("key",str(called[0].headers).lower())
        self.assertNotIn("taker=",called[0].full_url)
        self.assertIn("/swap/v2/order",called[0].full_url)

    def test_provider_error_never_counts_as_route(self):
        def broken(*args,**kwargs):
            raise m.urllib.error.HTTPError("url",401,"Unauthorized",{},None)
        q=m.read_quote(MINT,opener=broken)
        self.assertEqual(q["status"],m.STATUS_UNAVAILABLE)
        self.assertFalse(q["canTrade"])

    def test_unexpected_unsigned_transaction_rejected(self):
        def unsafe(req,timeout):
            return Response({"outAmount":"10","transaction":"base64-should-not-be-retained"})
        self.assertEqual(m.read_quote(MINT,opener=unsafe)["status"],m.STATUS_UNAVAILABLE)

    def test_one_receipt_per_cycle_and_no_orders(self):
        s=seed()
        before=len(s["events"])
        q=m.reconcile(s,T1,provider=lambda mint:{
            "status":m.STATUS_OK,"inputMint":m.SOL,"outputMint":mint,
            "outputAtoms":"123","source":"fixture",
            "routeVerified":False,"canTrade":False,"canSign":False,
            "canBroadcast":False,"isFill":False
        })
        self.assertEqual(q["newQuotes"],1)
        self.assertEqual(len(s["events"]),before+1)
        self.assertFalse(s["events"][-1]["isFill"])
        self.assertEqual(m.reconcile(s,T1)["newQuotes"],0)
        obs.audit(s)

    def test_malicious_provider_trade_claim_hard_fails(self):
        s=seed()
        with self.assertRaisesRegex(ValueError,"claimed_trade_authority"):
            m.reconcile(s,T1,provider=lambda x:{
                "status":m.STATUS_OK,"routeVerified":True,"canTrade":True
            })


if __name__=="__main__":
    unittest.main()
