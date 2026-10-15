"""WATCHKEEPER.13-.14 hermetic on-ledger paired route and fee-model tests."""
import copy
import importlib.util
import pathlib
import unittest
HERE=pathlib.Path(__file__).parent
def load(name):
    sp=importlib.util.spec_from_file_location("test13_"+name,HERE/name)
    m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m
pair=load("paired_route_evidence.py")
cost=load("paired_route_cost_stress.py")
f=load("test_single_slot_pool_observer.py")
double=load("test_dual_rpc_pool_observer.py")
T0="2026-10-14T12:00:00Z"
T1="2026-10-14T12:00:03Z"
T2="2026-10-14T12:00:08Z"
T3="2026-10-14T12:00:09Z"
def state():
    s=pair.obs.empty_state();s["status"]="RUNNING"
    pair.obs.append_event(s,{"type":"CYCLE","observedAt":T0,"availableAt":T0})
    cd=s["events"][-1]["digest"]
    pair.obs.append_event(s,{"type":"JUPITER_ROUTE_DIAGNOSTIC",
      "cycleDigest":cd,"observedAt":T1,"availableAt":T1,
      "status":pair.forward.STATUS_OK,"mint":f.pub(11),
      "inputMint":pair.forward.SOL,"outputMint":f.pub(11),
      "inputAtoms":"10000000","outputAtoms":"500000",
      "source":"jupiter_v2_public_get_order_quote_only",
      "authority":"RESEARCH_ONLY","routeVerified":False,
      "isFill":False,"canTrade":False,"canSign":False,"canBroadcast":False})
    fd=s["events"][-1]["digest"]
    pair.obs.append_event(s,{"type":"JUPITER_REVERSE_ROUTE_DIAGNOSTIC",
      "cycleDigest":cd,"forwardRouteDigest":fd,"observedAt":T2,"availableAt":T2,
      "status":"INDICATIVE_REVERSE_ROUTE_ONLY","mint":f.pub(11),
      "inputTokenAtoms":"500000","outputSolAtoms":"9900000",
      "source":"jupiter_v2_public_get_order_quote_only",
      "authority":"RESEARCH_ONLY","routeVerified":False,
      "isSellabilityProven":False,"canTrade":False,"canSign":False,"canBroadcast":False})
    pair.obs.audit(s)
    return s,cd
def assumptions():
    return {"schema":cost.SCHEMA,
      "solUsdAssumption":"100","networkLamportsPerLeg":"5000",
      "priorityLamportsPerLeg":"10000",
      "extraDexFeeBpsPerLeg":"30","transferFeeBpsPerLeg":"0",
      "extraSlippageBpsPerLeg":"50","extraImpactBpsPerLeg":"25",
      "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
      "canBroadcast":False}
class PairSafety(unittest.TestCase):
    def test_real_hash_chain_paired_ratio_not_sellability(self):
        s,cd=state();old=copy.deepcopy(s)
        r=pair.evaluate(s,cd,T3)
        self.assertEqual(r["status"],"TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE")
        self.assertEqual(r["quotedRoundTripSolRatio"],"0.99000000")
        self.assertEqual(r["quotedRoundTripChangeBps"],"-100.00")
        self.assertFalse(r["singlePoolRouteVerified"])
        self.assertFalse(r["sellabilityVerified"])
        self.assertFalse(r["actualFillVerified"])
        self.assertEqual(s,old)
    def test_no_reverse_is_unscored(self):
        s,cd=state();s["events"].pop();s["lastDigest"]=s["events"][-1]["digest"]
        r=pair.evaluate(s,cd,T3)
        self.assertEqual(r["status"],"NO_TWO_SIDED_EVIDENCE")
        self.assertIsNone(r["quotedRoundTripChangeBps"])
    def test_reverse_amount_mismatch_denied(self):
        s,cd=state()
        # change then rehash valid local chain: self-consistency alone does not verify external source
        s["events"][-1]["inputTokenAtoms"]="500001"
        s["events"][-1].pop("digest")
        s["events"][-1]["digest"]=pair.obs.hashlib.sha256(s["events"][-1]["previousDigest"].encode()+pair.obs.canonical(s["events"][-1])).hexdigest()
        s["lastDigest"]=s["events"][-1]["digest"]
        with self.assertRaisesRegex(ValueError,"reverse_amount_unreconciled"):
            pair.evaluate(s,cd,T3)
    def test_digest_binding_prevents_other_buy(self):
        s,cd=state()
        s["events"][-1]["forwardRouteDigest"]="a"*64
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):pair.evaluate(s,cd,T3)
    def test_future_quote_denied(self):
        s,cd=state()
        with self.assertRaisesRegex(ValueError,"quote_future_or_stale"):
            pair.evaluate(s,cd,"2026-10-14T12:00:06Z")
    def test_old_quote_denied(self):
        s,cd=state()
        with self.assertRaisesRegex(ValueError,"quote_future_or_stale"):
            pair.evaluate(s,cd,"2026-10-14T12:04:00Z")
    def test_wrong_cycle_rejected(self):
        s,cd=state()
        with self.assertRaisesRegex(ValueError,"unknown_cycle"):pair.evaluate(s,"f"*64,T3)
    def test_quote_permission_denied(self):
        s,cd=state();s["events"][-1]["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):pair.evaluate(s,cd,T3)
    def test_self_rehashed_quote_cannot_escalate_authority(self):
        s,cd=state()
        last=s["events"][-1]
        last["canAuthorizeLive"]=True
        last.pop("digest")
        last["digest"]=pair.obs.hashlib.sha256(last["previousDigest"].encode()+pair.obs.canonical(last)).hexdigest()
        s["lastDigest"]=last["digest"]
        with self.assertRaisesRegex(ValueError,"route_authority_escalation"):
            pair.evaluate(s,cd,T3)

    def test_public_aggregator_cannot_call_direct_pool_cost(self):
        s,cd=state();q=pair.evaluate(s,cd,T3)
        self.assertFalse(q["singlePoolRouteVerified"])
        self.assertNotIn("DIRECT_POOL_READ_ONLY",str(q))
    def test_optional_dual_snapshot_keeps_uncertainty(self):
        s,cd=state()
        c,a,b=double.fixtures()
        d=double.w.compare(c,a,b, "2026-10-14T12:00:05Z")
        r=pair.evaluate(s,cd,T3,d)
        self.assertEqual(r["sourcePoolConsistencyReceipt"],d["receiptDigest"])
        self.assertFalse(r["singlePoolRouteVerified"])
    def test_dual_snapshot_future_denied(self):
        s,cd=state();c,a,b=double.fixtures()
        d=double.w.compare(c,a,b,"2026-10-14T12:00:05Z")
        d["asOf"]="2026-10-14T12:01:00Z"
        d["receiptDigest"]=double.w.single.sha({k:v for k,v in d.items() if k!="receiptDigest"})
        with self.assertRaisesRegex(ValueError,"pool_mint_or_future_mismatch"):
            pair.evaluate(s,cd,T3,d)
class CostStress(unittest.TestCase):
    def quote(self):
        s,cd=state();return pair.evaluate(s,cd,T3)
    def test_incremental_cost_explicitly_not_filled(self):
        x=cost.model(self.quote(),assumptions())
        self.assertEqual(x["status"],"HYPOTHETICAL_COST_STRESS_NO_FILL_CERTIFICATION")
        self.assertEqual(x["quotedRoundTripBps"],"-100.00")
        self.assertFalse(x["actualFillVerified"])
        self.assertFalse(x["canScoreForwardReturn"])
        self.assertEqual(x["certifiedPaperFills"],0)
        self.assertIn("COST_ASSUMPTIONS_MAY_OVERLAP_QUOTE",x["reasonCodes"])
    def test_fee_components_reduce_hypothetical_proceeds(self):
        a=assumptions();no=copy.deepcopy(a)
        for k in ("extraDexFeeBpsPerLeg","extraSlippageBpsPerLeg","extraImpactBpsPerLeg"):
            no[k]="0"
        no["networkLamportsPerLeg"]="0";no["priorityLamportsPerLeg"]="0"
        lower=cost.model(self.quote(),a);upper=cost.model(self.quote(),no)
        self.assertLess(int(lower["hypotheticalStressNetSolAtoms"]),int(upper["hypotheticalStressNetSolAtoms"]))
        self.assertEqual(upper["hypotheticalStressNetSolAtoms"],"9900000")
    def test_no_reverse_no_cost_profits(self):
        s,cd=state();s["events"].pop();s["lastDigest"]=s["events"][-1]["digest"]
        q=pair.evaluate(s,cd,T3)
        x=cost.model(q,assumptions())
        self.assertEqual(x["status"],"NO_FILL_ROUTE_UNVERIFIED")
        self.assertIsNone(x["hypotheticalStressUsd"])
    def test_bad_route_digest_denied(self):
        q=self.quote();q["quotedRoundTripSolRatio"]="1000"
        with self.assertRaisesRegex(ValueError,"route_digest_invalid"):
            cost.model(q,assumptions())
    def test_cannot_launder_live_authority(self):
        a=assumptions();a["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"trade_authority_invalid"):
            cost.model(self.quote(),a)
    def test_bad_sol_usd_and_nonfinite(self):
        for value in ("NaN","Infinity","-3"):
            a=assumptions();a["solUsdAssumption"]=value
            with self.assertRaisesRegex(ValueError,"out_of_range"):
                cost.model(self.quote(),a)
    def test_network_priority_bound(self):
        a=assumptions();a["priorityLamportsPerLeg"]="20000000"
        with self.assertRaisesRegex(ValueError,"network_cost_bound_exceeded"):
            cost.model(self.quote(),a)
    def test_unbounded_stress_blocked(self):
        a=assumptions();a["extraDexFeeBpsPerLeg"]="2999";a["extraSlippageBpsPerLeg"]="2999"
        with self.assertRaisesRegex(ValueError,"stress_assumptions_excessive"):
            cost.model(self.quote(),a)
    def test_over_cap_paper_notional_denied(self):
        q=self.quote();q["forwardInputSolAtoms"]="1000000000"
        q["receiptDigest"]=pair.obs.hashlib.sha256(pair.obs.canonical({k:v for k,v in q.items() if k!="receiptDigest"})).hexdigest()
        with self.assertRaisesRegex(ValueError,"paper_notional_out_of_bounds"):
            cost.model(q,assumptions())
    def test_no_unjustified_promotions(self):
        x=cost.model(self.quote(),assumptions())
        self.assertFalse(x["canAuthorizeLive"])
        self.assertFalse(x["isExecutablePnL"])
        self.assertFalse(x["poolRouteIndependentlyVerified"])
        self.assertFalse(x["feeScheduleIndependentlyVerified"])
        self.assertFalse(x["tokenTransferFeesVerified"])
if __name__=="__main__":unittest.main()
