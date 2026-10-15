"""WATCHKEEPER.06 hermetic fake-RPC tests: no wallet, no live network."""
import base64
import copy
import importlib.util
import io
import json
import pathlib
import unittest
from urllib.request import Request

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("single_slot_pool_observer",HERE/"single_slot_pool_observer.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
T0="2026-10-14T12:00:00Z";T1="2026-10-14T12:00:02Z"
T2="2026-10-14T12:00:05Z"
B=m.probe.encode_pubkey
def pub(i):return B(bytes([i])*32)
def candidate(dex="pumpswap"):
    return {"schema":m.SCHEMA,"dex":dex,"pair":pub(10),"mint":pub(11),
      "quoteMint":pub(12),"baseVault":pub(13),"quoteVault":pub(14),
      "sourceMarketDigest":"b"*64,"sourceAvailableAt":T0,
      "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,"canBroadcast":False}
def vault(mint,amount=20000000,frozen=False):
    buf=bytearray(165)
    buf[:32]=mint
    buf[32:64]=bytes([99])*32
    buf[64:72]=amount.to_bytes(8,"little")
    buf[108]=2 if frozen else 1
    return {"owner":next(iter(m.risk.TOKEN_PROGRAMS)),
            "data":[base64.b64encode(buf).decode(),"base64"]}
def response(c=None,slot=100):
    c=c or candidate()
    program,minimum,offsets=m.PROGRAMS[c["dex"]]
    data=bytearray(minimum)
    for i,v in zip(offsets,(11,12,13,14)):
        data[i:i+32]=bytes([v])*32
    return {"provider":"SOLANA_PUBLIC_MAINNET",
      "result":{"context":{"slot":slot},"value":[
        {"owner":program,"data":[base64.b64encode(data).decode(),"base64"]},
        vault(bytes([11])*32),vault(bytes([12])*32)]}}
class FakeResponse:
    status=200
    def __init__(self,raw):self.buf=io.BytesIO(raw)
    def __enter__(self):return self
    def __exit__(self,*unused):return False
    def read(self,n):return self.buf.read(n)
class SingleSlotProof(unittest.TestCase):
    def test_one_context_partial_not_paper(self):
        c=candidate();before=copy.deepcopy(c)
        x=m.collect(c,response(c),T1,T2)
        self.assertEqual(x["slot"],100)
        self.assertTrue(x["singleRpcSlotObserved"])
        self.assertEqual(x["baseVault"]["amountAtomic"],"20000000")
        self.assertFalse(x["sellabilityVerified"])
        self.assertFalse(x["canEnterPaper"])
        self.assertFalse(x["canTrade"])
        self.assertEqual(c,before)
        self.assertEqual(x["receiptDigest"],m.collect(c,response(c),T1,T2)["receiptDigest"])

    def test_support_raydium_v4_predefined_layout(self):
        c=candidate("raydium")
        self.assertEqual(m.collect(c,response(c),T1,T2)["poolProgramId"],m.probe.RAYDIUM_AMM_V4)

    def test_malformed_program_refused(self):
        c=candidate();r=response(c)
        r["result"]["value"][0]["owner"]=pub(30)
        with self.assertRaisesRegex(ValueError,"pool_owner_program_mismatch"):
            m.collect(c,r,T1,T2)

    def test_wrong_pool_vault_mapping_refused(self):
        c=candidate();r=response(c)
        c["baseVault"]=pub(27)
        with self.assertRaisesRegex(ValueError,"accounts_mismatch"):
            m.collect(c,r,T1,T2)

    def test_wrong_vault_mint_refused(self):
        c=candidate();r=response(c)
        r["result"]["value"][1]=vault(bytes([22])*32)
        with self.assertRaisesRegex(ValueError,"mint_or_state_mismatch"):
            m.collect(c,r,T1,T2)

    def test_token_program_refused(self):
        c=candidate();r=response(c)
        r["result"]["value"][2]["owner"]=pub(22)
        with self.assertRaisesRegex(ValueError,"token_program_unverified"):
            m.collect(c,r,T1,T2)

    def test_zeros_are_not_liquid(self):
        c=candidate();r=response(c)
        r["result"]["value"][2]=vault(bytes([12])*32,0)
        v=m.collect(c,r,T1,T2)
        self.assertIn("ZERO_RAW_RESERVE",v["reasonCodes"])
        self.assertFalse(v["canEnterPaper"])

    def test_frozen_vault_flag(self):
        c=candidate();r=response(c)
        r["result"]["value"][1]=vault(bytes([11])*32,200,True)
        self.assertIn("FROZEN_VAULT",m.collect(c,r,T1,T2)["reasonCodes"])

    def test_old_or_future_evidence_refused(self):
        c=candidate();c["sourceAvailableAt"]="2026-10-14T12:01:00Z"
        with self.assertRaisesRegex(ValueError,"future_source"):
            m.collect(c,response(),T1,T2)
        c=candidate()
        with self.assertRaisesRegex(ValueError,"slow_read"):
            m.collect(c,response(),"2026-10-14T12:00:02Z","2026-10-14T12:00:32Z")

    def test_no_fake_same_slot_on_separate_responses(self):
        c=candidate();r=response(c)
        r["result"]["context"]["slot"]=None
        with self.assertRaisesRegex(ValueError,"context_slot_invalid"):
            m.collect(c,r,T1,T2)

    def test_duplicate_account_addresses_rejected(self):
        c=candidate();c["baseVault"]=c["quoteVault"]
        with self.assertRaisesRegex(ValueError,"duplicate_account_identity"):
            m.collect(c,response(),T1,T2)

    def test_rpc_only_allowlisted_get_multiple_accounts(self):
        with self.assertRaisesRegex(ValueError,"method_not_allowlisted"):
            m.public_rpc("sendTransaction",[[pub(10)],{}],lambda *a,**k:None)

    def test_rpc_no_private_urls_and_expected_json_method(self):
        captured=[]
        def fake_open(req,timeout):
            self.assertIsInstance(req,Request)
            self.assertEqual(req.get_method(),"POST")
            self.assertTrue(req.full_url in m.RPCS)
            self.assertNotIn("key",req.full_url.lower())
            body=json.loads(req.data)
            self.assertEqual(body["method"],"getMultipleAccounts")
            captured.append(body)
            return FakeResponse(json.dumps({"jsonrpc":"2.0","result":response()["result"]}).encode())
        res=m.public_rpc("getMultipleAccounts",[[pub(10),pub(13),pub(14)],
          {"encoding":"base64","commitment":"confirmed"}],fake_open)
        self.assertEqual(res["provider"],"SOLANA_PUBLIC_MAINNET")
        self.assertEqual(len(captured),1)

    def test_rpc_transaction_params_refused(self):
        with self.assertRaisesRegex(ValueError,"params_not_allowlisted"):
            m.public_rpc("getMultipleAccounts",[[pub(10),pub(13),pub(14)],{"commitment":"processed"}])

    def test_public_rpc_does_not_claim_independence(self):
        c=candidate()
        r=m.sample(c,provider=lambda method,params:response(c),clock=lambda:T1)
        self.assertFalse(r["independentRpcAgreementVerified"])
        self.assertFalse(r["poolControlVerified"])
        self.assertFalse(r["feeScheduleVerified"])
        self.assertFalse(r["realizedFillVerified"])

    def test_provider_cannot_inject_trade_authority(self):
        c=candidate();r=response(c);r["provider"]="PRIVATE_SIGNING_SERVICE"
        with self.assertRaisesRegex(ValueError,"untrusted_rpc_provider"):
            m.collect(c,r,T1,T2)

    def test_signing_request_from_candidate_refused(self):
        c=candidate();c["canSign"]=True
        with self.assertRaisesRegex(ValueError,"authority_escalation"):
            m.collect(c,response(),T1,T2)
if __name__=="__main__":unittest.main()
