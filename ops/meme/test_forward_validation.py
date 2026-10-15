"""WATCHKEEPER.04 tests: prospective plan, missing outcomes, fake restore must fail closed."""
from __future__ import annotations
import copy
import hashlib
import importlib.util
import json
import pathlib
import unittest
HERE=pathlib.Path(__file__).parent
def load(name):
    s=importlib.util.spec_from_file_location("test_"+name,HERE/name)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
t=load("test_strategy_proposal_journal.py")
s=importlib.util.spec_from_file_location("forward_validation",HERE/"forward_validation.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
AT="2026-10-15T12:03:00Z"
LATER="2026-10-15T12:04:00Z"

def proposal_journal():
    events=t.events()
    r=t.j.review_assertion(events[0]["payload"],t.review())
    return t.j.append(events,"REVIEW_DECLARED",r,t.T4)
def plan(n=36):
    return {"schema":m.SCHEMA,"cohortId":"cohort01",
      "strategyId":"NEW_PAIR_POST_BUNDLE_DIP","marketRegime":"PUMPSWAP",
      "hardLimitsHash":"a"*64,"sealedAt":AT,"proposalId":"prop-01",
      "sourceHeadHash":"f"*64,"authority":"RESEARCH_ONLY",
      "canExecute":False,"canSign":False,"canBroadcast":False,
      "cases":[{"caseId":f"case-{i}","independentGroup":f"launch-{i}",
        "mint":f"mint-{i}","decisionAt":AT,"evidenceIds":[f"source-{i}"],
        "baselineId":"baseline","candidateId":"candidate"}
        for i in range(n)]}
def arms(k,ret):
    return {"sourceClass":"DEX_ROUTE_COUNTERFACTUAL","authority":"PAPER_SIMULATION_ONLY",
      "canExecute":False,"canSign":False,"canBroadcast":False,
      "fillStatus":"COUNTERFACTUAL_ONLY","returnBps":ret,
      "costBps":45,"quoteAvailableAt":LATER,
      "quoteEvidenceIds":[f"quote-{k}"],"exitFeasible":True}
def observations(n=36):
    return [{"caseId":f"case-{i}","outcomeAvailableAt":LATER,
      "candidate":{"strategyId":"candidate",**arms(i*2,-320)},
      "baseline":{"strategyId":"baseline",**arms(i*2+1,80)}} for i in range(n)]

class ForwardSafety(unittest.TestCase):
    def test_seal_then_forward_report_explicitly_incomplete(self):
        x=m.seal_plan(plan(),proposal_journal())
        r=m.evaluate(x,observations(),LATER,"INDEPENDENT_VERIFIED")
        self.assertEqual(r["assessment"]["verdict"],"PROPOSE_STRATEGY_REVIEW")
        self.assertEqual(r["status"],"INCOMPLETE_EXTERNAL_CERTIFICATION")
        self.assertFalse(r["sourceSealTimeVerified"])
        self.assertFalse(r["fullDatabaseRestored"])
        self.assertFalse(r["genuineFillsVerified"])
        self.assertFalse(r["tradePerformanceCertified"])
        self.assertFalse(r["canExecute"])
        self.assertFalse(r["canAuthorizeLive"])

    def test_missing_forward_data_is_censored(self):
        x=m.seal_plan(plan(),proposal_journal())
        r=m.evaluate(x,observations(31),LATER,"INDEPENDENT_VERIFIED")
        self.assertEqual(r["observedCaseCount"],31)
        self.assertEqual(len(r["missingObservationCaseIds"]),5)
        self.assertEqual(r["assessment"]["unscoredPairs"],5)
        self.assertEqual(r["status"],"INCOMPLETE_EXTERNAL_CERTIFICATION")

    def test_preseal_quote_must_not_be_reused_as_forward_outcome(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations()
        y[0]["candidate"]["quoteAvailableAt"]=AT
        with self.assertRaisesRegex(ValueError,"retroactive_quote_evidence"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_no_outcomes_cannot_certify(self):
        x=m.seal_plan(plan(),proposal_journal())
        r=m.evaluate(x,[],LATER,"UNKNOWN")
        self.assertEqual(r["observedCaseCount"],0)
        self.assertEqual(r["assessment"]["verdict"],"ABSTAIN")

    def test_no_proposal_review_rejected(self):
        x=t.events()
        with self.assertRaisesRegex(ValueError,"review_request_missing"):
            m.seal_plan(plan(),x)

    def test_review_rejects_hard_limits(self):
        x=plan();x["hardLimitsHash"]="b"*64
        with self.assertRaisesRegex(ValueError,"context_mismatch"):
            m.seal_plan(x,proposal_journal())

    def test_no_retroactive_outcome(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations();y[0]["outcomeAvailableAt"]=AT
        with self.assertRaisesRegex(ValueError,"not_prospective"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_future_observations_rejected(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations();y[0]["outcomeAvailableAt"]="2026-10-20T12:04:00Z"
        with self.assertRaisesRegex(ValueError,"not_prospective"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_duplicate_cohort_rejected(self):
        x=plan();x["cases"][1]["independentGroup"]="launch-0"
        with self.assertRaisesRegex(ValueError,"dependent_cohort"):
            m.seal_plan(x,proposal_journal())

    def test_outcome_cannot_swap_strategy(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations();y[0]["candidate"]["strategyId"]="evil"
        with self.assertRaisesRegex(ValueError,"strategy_changed"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_not_present_in_preseal_is_rejected(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations();y[0]["caseId"]="new"
        with self.assertRaisesRegex(ValueError,"unsealed_or_repeated"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_duplicate_actual_outcome_rejected(self):
        x=m.seal_plan(plan(),proposal_journal())
        y=observations();y.append(copy.deepcopy(y[0]))
        with self.assertRaisesRegex(ValueError,"unsealed_or_repeated"):
            m.evaluate(x,y,LATER,"INDEPENDENT_VERIFIED")

    def test_sealed_manifest_tampering_rejected(self):
        x=m.seal_plan(plan(),proposal_journal())
        x["cases"][0]["baselineId"]="different"
        with self.assertRaisesRegex(ValueError,"seal_hash_invalid"):
            m.evaluate(x,observations(),LATER,"UNKNOWN")

    def test_bad_trading_authority_never_passes(self):
        x=plan();x["canExecute"]=True
        with self.assertRaisesRegex(ValueError,"authority_invalid"):
            m.seal_plan(x,proposal_journal())
        x=m.seal_plan(plan(),proposal_journal());x["canAuthorizeLive"]=True
        x["sealDigest"]=t.j.digest({k:v for k,v in x.items() if k!="sealDigest"})
        with self.assertRaisesRegex(ValueError,"authority_invalid"):
            m.evaluate(x,[],LATER,"UNKNOWN")

    def test_reject_apparent_owner_signature(self):
        x=m.seal_plan(plan(),proposal_journal())
        self.assertFalse(x["ownerApprovalSignatureVerified"])
        self.assertFalse(x["sealTimestampIndependentlyWitnessed"])

    def test_restore_local_copy_not_full_postgres(self):
        e=proposal_journal()
        data=("\n".join(json.dumps(x,sort_keys=True) for x in e)+"\n").encode()
        sha=hashlib.sha256(data).hexdigest()
        r=m.verify_local_restore(data,data,sha)
        self.assertEqual(r["status"],"LOCAL_BYTES_AND_JOURNAL_MATCH_ONLY")
        self.assertFalse(r["realProductionPostgresRestoreVerified"])
        self.assertFalse(r["externalIndependentDownloadVerified"])

    def test_corrupted_copy_fails(self):
        e=proposal_journal()
        data=(json.dumps(e[0])+"\n"+json.dumps(e[1])).encode()
        with self.assertRaisesRegex(ValueError,"local_restore_mismatch"):
            m.verify_local_restore(data,data+b"!",hashlib.sha256(data).hexdigest())

    def test_forged_anchor_fails(self):
        e=proposal_journal()
        data=(json.dumps(e[0])+"\n"+json.dumps(e[1])).encode()
        with self.assertRaisesRegex(ValueError,"source_anchor_mismatch"):
            m.verify_local_restore(data,data,"f"*64)

    def test_empty_source_is_not_backup(self):
        with self.assertRaisesRegex(ValueError,"empty_journal"):
            m.verify_local_restore(b"",b"",hashlib.sha256(b"").hexdigest())

    def test_cannot_seal_after_invalid_proposal_head(self):
        z=proposal_journal();z[0]["payload"]["candidateRuleText"]="changed after seal"
        with self.assertRaisesRegex(ValueError,"hash_mismatch"):
            m.seal_plan(plan(),z)

if __name__=="__main__":
    unittest.main()
