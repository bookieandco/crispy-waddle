"""Coordinated .12/.13 SHARK-WATCHKEEPER fusion offline adversarial tests."""
import base64
import copy
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).parent
def load(path):
    sp=importlib.util.spec_from_file_location("fusion_tests_"+path,HERE/(path+".py"))
    m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m
f=load("rug_watchkeeper_fusion")
test_dual=load("test_dual_rpc_pool_observer")
test_pair=load("test_paired_route_research")
T1="2026-10-14T12:00:03Z"
ASOF=test_pair.T3

def address_bytes(pubkey):
    alphabet=f.native.pool_probe.B58
    x=0
    for ch in pubkey:x=x*58+alphabet.index(ch)
    return x.to_bytes(32,"big")

def sample(freeze=False,extension=None):
    candidate,a,b=test_dual.fixtures()
    mint=candidate["mint"]
    token=f.authority.TOKEN_2022 if extension is not None else f.authority.LEGACY
    info={"supply":"10000000","decimals":6,"mintAuthority":None,
          "freezeAuthority":mint if freeze else None}
    if extension is not None:info["extensions"]=extension
    mint_account={"context":{"slot":100},"value":{"owner":token,
       "data":{"parsed":{"type":"mint","info":info}}}}
    mp=f.native.mint_probe.verify_mint(mint,mint_account,None,T1)
    auth=f.authority.audit_mint_account(mint,mint_account,observed_at=T1,
                             available_at=T1,information_cutoff=ASOF)
    program,minlen,offsets=f.native.pool_probe.PROGRAMS[candidate["dex"]]
    buf=bytearray(minlen)
    for pos,key in zip(offsets,[candidate["mint"],candidate["quoteMint"],
                                 candidate["baseVault"],candidate["quoteVault"]]):
        buf[pos:pos+32]=address_bytes(key)
    pool={"context":{"slot":100},"value":{"owner":program,
      "data":[base64.b64encode(buf).decode(),"base64"]}}
    def vault(mint,atoms):
        return {"context":{"slot":101},"value":{
            "owner":f.authority.LEGACY,"data":{"parsed":{"type":"account","info":{
                "mint":mint,"owner":candidate["pair"],
                "tokenAmount":{"amount":str(atoms),"decimals":6}}}}}}
    pair={"dex":candidate["dex"],"mint":candidate["mint"],
          "quoteMint":candidate["quoteMint"],"pair":candidate["pair"],
          "digest":"synthetic-market"}
    pp=f.native.pool_probe.attest_pool(pair,pool,
         vault(mint,20000000),vault(candidate["quoteMint"],20000000),T1)
    dual=f.dual.compare(candidate,a,b,test_dual.B)
    state,cycle=test_pair.state()
    return {"mint":mint,"information_cutoff":ASOF,"mint_proof":mp,
       "pool_proof":pp,"authority_receipt":auth,"dual_receipt":dual,
       "state":state,"cycle_digest":cycle,"stress_assumptions":test_pair.assumptions()}

class FusedResearchSafety(unittest.TestCase):
    def test_full_receipt_convergence_still_not_safety_or_authority(self):
        inp=sample();raw=copy.deepcopy(inp)
        out=f.fuse(**inp)
        self.assertEqual(out["status"],"WATCH_UNCERTIFIED_NO_TRADE")
        self.assertEqual(out["dualRpcStatus"],"TWO_PUBLIC_ENDPOINTS_CONSISTENT_NOT_CRYPTO_VERIFIED")
        self.assertEqual(out["indicativeRouteStatus"],
              "TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE")
        self.assertEqual(out["hypotheticalCostStatus"],
              "HYPOTHETICAL_COST_STRESS_NO_FILL_CERTIFICATION")
        self.assertFalse(out["sellabilityVerified"])
        self.assertFalse(out["safeTokenCertified"])
        self.assertFalse(out["lpControlVerified"])
        self.assertFalse(out["canEnterPaper"])
        self.assertFalse(out["canTrade"])
        self.assertFalse(out["canAuthorizeExit"])
        self.assertFalse(out["canAuthorizeLive"])
        self.assertEqual(inp,raw)
        self.assertEqual(out["receiptDigest"],f.fuse(**inp)["receiptDigest"])
    def test_missing_canonical_inputs_remain_abstention(self):
        inp=sample()
        inp["dual_receipt"]=None
        inp["state"]=None;inp["cycle_digest"]=None;inp["stress_assumptions"]=None
        out=f.fuse(**inp)
        self.assertEqual(out["status"],"ABSTAIN_INCOMPLETE_EVIDENCE")
        self.assertFalse(out["canTrade"])
    def test_freeze_authority_never_auto_claims_rug(self):
        out=f.fuse(**sample(freeze=True))
        self.assertEqual(out["status"],"REVIEW_RISK_CONTROLS")
        self.assertIn("FREEZE_AUTHORITY_ACTIVE",out["reasonCodes"])
        self.assertFalse(out["rugConfirmed"])
    def test_token_2022_transfer_hook_flags_without_execution(self):
        inp=sample(extension=[{"extension":"transferHook","state":{"authority":inp if False else None}}])
        out=f.fuse(**inp)
        self.assertEqual(out["status"],"REVIEW_RISK_CONTROLS")
        self.assertIn("TRANSFER_HOOK_RESTRICTION_POSSIBLE",out["reasonCodes"])
        self.assertFalse(out["tokenTransferabilityVerified"])
    def test_pair_inconsistent_public_rpc_quarantined(self):
        inp=sample()
        inp["dual_receipt"]["status"]="RPC_COMPARISON_UNVERIFIED"
        inp["dual_receipt"]["sameSlot"]=False
        inp["dual_receipt"]["reasonCodes"]=["DIFFERENT_RPC_CONTEXT_SLOTS"]
        inp["dual_receipt"]["receiptDigest"]=f.dual.single.sha({k:v for k,v in
                   inp["dual_receipt"].items() if k!="receiptDigest"})
        out=f.fuse(**inp)
        self.assertEqual(out["status"],"QUARANTINE_CONFLICTED_EVIDENCE")
        self.assertFalse(out["canEnterPaper"])
    def test_spoofed_digest_rejected(self):
        inp=sample()
        inp["dual_receipt"]["sameSlot"]=False
        with self.assertRaisesRegex(ValueError,"dual_digest_invalid"):
            f.fuse(**inp)
    def test_wrong_pool_identity_rejected(self):
        inp=sample()
        inp["dual_receipt"]["pool"]=f.native.pool_probe.encode_pubkey(bytes([44])*32)
        inp["dual_receipt"]["receiptDigest"]=f.dual.single.sha({k:v for k,v in
                   inp["dual_receipt"].items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"dual_identity_or_proof_escalation"):
            f.fuse(**inp)
    def test_authority_cannot_detach_from_mint_proof(self):
        inp=sample()
        inp["authority_receipt"]["mintReceiptDigest"]="f"*64
        inp["authority_receipt"]["receiptDigest"]=f.authority._sha({k:v for k,v in
              inp["authority_receipt"].items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"authority_mint_receipt_not_bound"):
            f.fuse(**inp)
    def test_quote_asof_and_ledger_tampering_rejected(self):
        inp=sample()
        inp["state"]["events"][-1]["outputSolAtoms"]="999999999999999"
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            f.fuse(**inp)
    def test_quote_mint_mismatch_and_trade_permissions_rejected(self):
        inp=sample()
        inp["mint"]=f.native.pool_probe.encode_pubkey(bytes([88])*32)
        with self.assertRaises(ValueError):
            f.fuse(**inp)
        inp=sample()
        inp["authority_receipt"]["canTrade"]=True
        inp["authority_receipt"]["receiptDigest"]=f.authority._sha({k:v for k,v in
              inp["authority_receipt"].items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"authority_authority_invalid"):
            f.fuse(**inp)
    def test_future_dual_source_rejected(self):
        inp=sample()
        inp["dual_receipt"]["asOf"]="2026-10-15T12:00:05Z"
        inp["dual_receipt"]["receiptDigest"]=f.dual.single.sha({k:v for k,v in
                   inp["dual_receipt"].items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"dual_snapshot_future_or_stale"):
            f.fuse(**inp)
    def test_stress_never_works_without_canonical_ledger(self):
        inp=sample()
        inp["state"]=None;inp["cycle_digest"]=None
        with self.assertRaisesRegex(ValueError,"cost_stress_requires_ledger_route"):
            f.fuse(**inp)

if __name__=="__main__":unittest.main()
