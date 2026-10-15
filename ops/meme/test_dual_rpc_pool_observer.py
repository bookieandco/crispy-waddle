"""WATCHKEEPER.12 hermetic dual RPC provenance & fail-closed fixtures."""
from __future__ import annotations
import copy
import importlib.util
import io
import json
import pathlib
import unittest
HERE=pathlib.Path(__file__).parent
def load(name):
    sp=importlib.util.spec_from_file_location("testw12_"+name,HERE/name)
    obj=importlib.util.module_from_spec(sp);sp.loader.exec_module(obj);return obj
w=load("dual_rpc_pool_observer.py")
f=load("test_single_slot_pool_observer.py")
A="2026-10-14T12:00:02Z";B="2026-10-14T12:00:05Z"
def fixtures(slot=100):
    c=f.candidate()
    x=f.response(c,slot)
    y=copy.deepcopy(x)
    y["provider"]="PUBLICNODE_PUBLIC"
    return c,w.single.collect(c,x,A,B),w.single.collect(c,y,A,B)
class DualTests(unittest.TestCase):
    def test_matching_slot_and_images_are_still_not_proof_of_sells(self):
        c,a,b=fixtures();r=w.compare(c,a,b,B)
        self.assertEqual(r["status"],"TWO_PUBLIC_ENDPOINTS_CONSISTENT_NOT_CRYPTO_VERIFIED")
        self.assertTrue(r["sameSlot"])
        self.assertTrue(r["sameAccountImages"])
        self.assertFalse(r["independentlyAuthenticatedProviders"])
        self.assertFalse(r["canEnterPaper"])
        self.assertFalse(r["sameRouteSellabilityVerified"])
        self.assertFalse(r["actualFillVerified"])
        self.assertEqual(r["receiptDigest"],w.compare(c,a,b,B)["receiptDigest"])
    def test_slot_drift_denied_not_rebased(self):
        c,a,b=fixtures()
        b["slot"]=101;b["receiptDigest"]=w.single.sha({k:v for k,v in b.items() if k!="receiptDigest"})
        r=w.compare(c,a,b,B)
        self.assertEqual(r["status"],"RPC_COMPARISON_UNVERIFIED")
        self.assertIn("DIFFERENT_RPC_CONTEXT_SLOTS",r["reasonCodes"])
    def test_vault_balance_drift_denied(self):
        c,a,b=fixtures()
        b["quoteVault"]["amountAtomic"]="21000000"
        b["receiptDigest"]=w.single.sha({k:v for k,v in b.items() if k!="receiptDigest"})
        self.assertFalse(w.compare(c,a,b,B)["sameAccountImages"])
    def test_wrong_owner_cannot_be_laundered_by_rehash(self):
        c,a,b=fixtures()
        a["poolProgramId"]=f.pub(77)
        a["receiptDigest"]=w.single.sha({k:v for k,v in a.items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"pool_program_not_trusted"):
            w.compare(c,a,b,B)

    def test_source_timestamp_mismatch_denied(self):
        c,a,b=fixtures()
        b["sourceAvailableAt"]="2026-10-14T11:59:00Z"
        b["receiptDigest"]=w.single.sha({k:v for k,v in b.items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"identity_mismatch"):
            w.compare(c,a,b,B)

    def test_source_digest_tamper_denied(self):
        c,a,b=fixtures();a["baseVault"]["amountAtomic"]="900"
        with self.assertRaisesRegex(ValueError,"source_checksum_bad"):w.compare(c,a,b,B)
    def test_spoofed_public_node_identity_denied(self):
        c,a,b=fixtures();b["rpcProvider"]="SOLANA_PUBLIC_MAINNET"
        b["receiptDigest"]=w.single.sha({k:v for k,v in b.items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"provider_identity_mismatch"):w.compare(c,a,b,B)
    def test_future_read_denied(self):
        c,a,b=fixtures()
        with self.assertRaisesRegex(ValueError,"mismatched_observation_window"):
            w.compare(c,a,b,"2026-10-14T12:00:04Z")
    def test_old_read_denied(self):
        c,a,b=fixtures()
        with self.assertRaisesRegex(ValueError,"mismatched_observation_window"):
            w.compare(c,a,b,"2026-10-14T12:01:00Z")
    def test_missing_rpc_account_denied_at_source(self):
        c=f.candidate();x=f.response(c);x["result"]["value"][1]=None
        with self.assertRaises(ValueError):w.single.collect(c,x,A,B)
    def test_bad_dex_venue_denied(self):
        c,a,b=fixtures();c["dex"]="malicious"
        with self.assertRaisesRegex(ValueError,"venue_not_supported"):w.compare(c,a,b,B)
    def test_authority_escalation_denied(self):
        c,a,b=fixtures();a["canEnterPaper"]=True
        a["receiptDigest"]=w.single.sha({k:v for k,v in a.items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"source_escalation"):w.compare(c,a,b,B)
    def test_two_queries_fixed_hosts_allowlisted_method(self):
        c=f.candidate();calls=[]
        class Res:
            status=200
            def __enter__(self):return self
            def __exit__(self,*a):return None
            def read(self,n):return json.dumps({"result":f.response(c)["result"]}).encode()
        def fake(req,timeout):
            calls.append(req)
            self.assertIn(req.full_url,w.single.RPCS)
            self.assertEqual(json.loads(req.data)["method"],"getMultipleAccounts")
            return Res()
        for index in (0,1):
            r=w.fetch_one(index,c,fake)
            self.assertEqual(r["provider"],w.PROVIDERS[index])
        self.assertEqual([x.full_url for x in calls],list(w.single.RPCS))
    def test_no_unlisted_provider(self):
        with self.assertRaisesRegex(ValueError,"provider_index_invalid"):
            w.fetch_one(3,f.candidate())
    def test_clock_forward_requests_bounded(self):
        c=f.candidate()
        def fake(index,candidate):
            r=f.response(candidate)
            r["provider"]=w.PROVIDERS[index]
            return r
        times=iter([A,B,B])
        r=w.snapshot(c,fake,lambda:next(times))
        self.assertTrue(r["sameSlot"])
        self.assertFalse(r["canAuthorizeLive"])
if __name__=="__main__":unittest.main()
