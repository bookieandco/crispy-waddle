"""WATCHKEEPER.08: sealed shadow + research replay matching, no P&L certification."""
from __future__ import annotations
import copy
import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
def load(name):
    s=importlib.util.spec_from_file_location("test_w08_"+name,HERE/name)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
bridge=load("shadow_evidence_bridge.py")
scenario=load("test_paper_replay_runner.py")
study=load("test_shadow_sealer.py")
T0="2026-10-14T12:00:00Z"
T1="2026-10-14T12:00:02Z"
ASOF="2026-10-14T12:00:20Z"

def state():
    obs=study.observer
    s=obs.empty_state()
    mint=scenario.f.pub(11)
    pair=scenario.f.pub(10)
    a,b,ps=study.feed(2)
    a[0]["tokenAddress"]=mint
    ps[0]["pairAddress"]=pair
    ps[0]["baseToken"]["address"]=mint
    stats=obs.sample(s,(a,b,ps),T0,T0)
    obs.append_event(s,{"type":"CYCLE","observedAt":T0,"availableAt":T0,**stats})
    result=study.shadow.reconcile(s,T1)
    assert result["newNoTradeDecisions"]==1,result
    obs.audit(s)
    return s

def dataset(*,unsold=False):
    c=scenario.real_partial("EXTERNAL_PAPER_RESEARCH")
    if unsold:c["sellQuote"]=None
    return bridge.paper.batch([c])

def manifest(s,b):
    decision=next(e for e in s["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION")
    return {"schema":bridge.SCHEMA,"experimentId":study.observer.ID,
      "stateHeadDigest":s["lastDigest"],"batchDigest":b["receiptDigest"],
      "asOf":ASOF,
      "links":[{"shadowDecisionId":decision["decisionId"],"paperCaseId":"case-1"}],
      "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,
      "canBroadcast":False,"canRewriteRules":False,"canAuthorizeLive":False}

def rehash(b):
    for r in b["records"]:
        if r["status"]!="ABSTAIN":
            r["receiptDigest"]=bridge.journal.digest({k:v for k,v in r.items() if k!="receiptDigest"})
    b["receiptDigest"]=bridge.journal.digest({k:v for k,v in b.items() if k!="receiptDigest"})

class ShadowReceiptBridgeSafety(unittest.TestCase):
    def test_one_sealed_shadow_to_unverified_counterfactual(self):
        s=state();b=dataset();m=manifest(s,b)
        ss,bb,mm=copy.deepcopy(s),copy.deepcopy(b),copy.deepcopy(m)
        r=bridge.correlate(s,b,m)
        self.assertEqual(r["verdict"],"RESEARCH_RECONCILIATION_ONLY")
        self.assertEqual(r["joinedCases"],1)
        self.assertEqual(r["actualTradesVerified"],0)
        self.assertEqual(r["independentPaperFillCount"],0)
        self.assertEqual(r["findings"][0]["spotOutcomeClass"],"PENDING_SPOT_ONLY")
        self.assertEqual(r["findings"][0]["paperResearchClass"],"COUNTERFACTUAL_CLOSED_UNVERIFIED")
        self.assertIs(r["canExportAsWatchkeeper04Outcome"],False)
        self.assertIs(r["canProposeRuleChange"],False)
        self.assertEqual(s,ss);self.assertEqual(b,bb);self.assertEqual(m,mm)
        self.assertEqual(r["receiptDigest"],bridge.correlate(s,b,m)["receiptDigest"])

    def test_unsold_cannot_score_and_records_gap(self):
        s=state();b=dataset(unsold=True)
        r=bridge.correlate(s,b,manifest(s,b))
        self.assertEqual(r["openOrUnsellable"],1)
        self.assertIsNone(r["findings"][0]["paperModeledNetPnlUsdUnverified"])
        self.assertIn("PAPER_SELL_ROUTE_GAPS",r["reasonCodes"])

    def test_spot_only_censored_stays_unscored(self):
        s=state()
        study.shadow.reconcile(s,"2026-10-15T18:01:00Z")
        b=dataset()
        m=manifest(s,b);m["asOf"]="2026-10-15T18:01:10Z"
        r=bridge.correlate(s,b,m)
        self.assertEqual(r["censoredSpotHorizon"],1)
        self.assertEqual(r["findings"][0]["spotOutcomeClass"],"CENSORED_SPOT_ONLY")
        self.assertFalse(r["canExportAsWatchkeeper04Outcome"])

    def test_source_head_change_never_silently_relinks(self):
        s=state();b=dataset();m=manifest(s,b)
        s["lastDigest"]="0"*64
        with self.assertRaisesRegex(ValueError,"chain_head_invalid"):
            bridge.correlate(s,b,m)

    def test_spoofed_digest_caught(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["netPnlUsdModeled"]=1000000
        with self.assertRaisesRegex(ValueError,"batch_digest_invalid"):
            bridge.correlate(s,b,m)

    def test_self_consistent_hash_does_not_grant_real_fill(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["realizedProfitCertified"]=True
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"row_execution_claim"):
            bridge.correlate(s,b,m)

    def test_unbound_synthetic_not_laundered_into_shadow(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["sourceClass"]="SYNTHETIC_TEST"
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"synthetic_or_unverified_public_case"):
            bridge.correlate(s,b,m)

    def test_readonly_rpc_only_not_repackaged_as_fill(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["sourceClass"]="PUBLIC_SINGLE_SLOT_OBSERVATION"
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"synthetic_or_unverified_public_case"):
            bridge.correlate(s,b,m)

    def test_unknown_link_rejected(self):
        s=state();b=dataset();m=manifest(s,b)
        m["links"][0]["shadowDecisionId"]="invented"
        with self.assertRaisesRegex(ValueError,"unsealed_or_missing_pair"):
            bridge.correlate(s,b,m)

    def test_duplicate_link_rejected(self):
        s=state();b=dataset();m=manifest(s,b)
        m["links"].append(dict(m["links"][0]))
        with self.assertRaisesRegex(ValueError,"duplicate_or_dependent_link"):
            bridge.correlate(s,b,m)

    def test_mint_pair_mismatch_rejected(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["pair"]=scenario.f.pub(22)
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"mint_or_pool_mismatch"):
            bridge.correlate(s,b,m)

    def test_future_replay_rejected(self):
        s=state();b=dataset();m=manifest(s,b)
        m["asOf"]="2026-10-14T12:00:10Z"
        with self.assertRaisesRegex(ValueError,"retroactive_stale_or_future_replay"):
            bridge.correlate(s,b,m)

    def test_late_replay_not_forward_condition(self):
        s=state();b=dataset();m=manifest(s,b)
        row=b["records"][0]
        row["decisionAt"]="2026-10-14T12:20:00Z"
        row["exitAt"]="2026-10-14T12:20:05Z"
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        m["asOf"]="2026-10-14T12:25:00Z"
        with self.assertRaisesRegex(ValueError,"retroactive_stale_or_future_replay"):
            bridge.correlate(s,b,m)

    def test_abstain_does_not_have_mint_and_cannot_link(self):
        s=state()
        c=scenario.real_partial("PUBLIC_SINGLE_SLOT_OBSERVATION")
        b=bridge.paper.batch([c]);m=manifest(s,b)
        with self.assertRaisesRegex(ValueError,"unbound_abstention_cannot_join"):
            bridge.correlate(s,b,m)

    def test_unsold_fabricated_pnl_rejected_even_with_rehash(self):
        s=state();b=dataset(unsold=True);m=manifest(s,b)
        b["records"][0]["netPnlUsdModeled"]=25.0
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"unsold_has_pnl"):
            bridge.correlate(s,b,m)

    def test_manifest_authority_never_allowed(self):
        s=state();b=dataset();m=manifest(s,b)
        m["canAuthorizeLive"]=True
        with self.assertRaisesRegex(ValueError,"manifest_authority_invalid"):
            bridge.correlate(s,b,m)

    def test_no_trade_decision_claim_cannot_be_signed(self):
        s=state();b=dataset();m=manifest(s,b)
        row=next(e for e in s["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION")
        row["canSign"]=True
        with self.assertRaisesRegex(ValueError,"event_digest_invalid"):
            bridge.correlate(s,b,m)

    def test_evidence_overlap_cannot_count_as_two_sided(self):
        s=state();b=dataset();m=manifest(s,b)
        b["records"][0]["exitEvidenceIds"]=b["records"][0]["entryEvidenceIds"]
        rehash(b);m["batchDigest"]=b["receiptDigest"]
        with self.assertRaisesRegex(ValueError,"entry_exit_evidence_reused"):
            bridge.correlate(s,b,m)

    def test_unreviewed_scorecard_not_automatically_generated(self):
        s=state();b=dataset();r=bridge.correlate(s,b,manifest(s,b))
        self.assertNotIn("scorecard",r)
        self.assertFalse(r["canProposeRuleChange"])
        self.assertIn("NO_INDEPENDENT_FILL_WITNESS",r["reasonCodes"])

if __name__=="__main__":
    unittest.main()
