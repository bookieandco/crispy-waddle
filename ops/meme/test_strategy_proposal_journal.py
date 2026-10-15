"""WATCHKEEPER.03: independently checked no-promotion journal tests."""
import copy
import importlib.util
import pathlib
import tempfile
import unittest

HERE=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location("proposal_journal",HERE/"strategy_proposal_journal.py")
j=importlib.util.module_from_spec(s);s.loader.exec_module(j)
T0="2026-10-13T12:00:00Z";T1="2026-10-14T12:00:00Z";T2="2026-10-15T12:00:00Z"
T3="2026-10-15T12:01:00Z";T4="2026-10-15T12:02:00Z"

def scorecard(n=36):
    arms=lambda k, ret:{"sourceClass":"DEX_ROUTE_COUNTERFACTUAL","authority":"PAPER_SIMULATION_ONLY",
      "canExecute":False,"canSign":False,"canBroadcast":False,"fillStatus":"COUNTERFACTUAL_ONLY",
      "returnBps":ret,"costBps":40,"quoteAvailableAt":T1,"quoteEvidenceIds":[f"quote-{k}"],"exitFeasible":True}
    return {"schema":"SHARK-WATCHKEEPER-01","strategyId":"NEW_PAIR_POST_BUNDLE_DIP",
      "marketRegime":"PUMPSWAP","asOf":T2,"hardLimitsHash":"a"*64,
      "safetyStatus":"INDEPENDENT_VERIFIED",
      "pairs":[{"caseId":f"case-{i}","independentGroup":f"launch-{i}",
          "marketRegime":"PUMPSWAP","sealedAt":T0,"outcomeAvailableAt":T1,
          "candidate":arms(i*2,-320),"baseline":arms(i*2+1,80)} for i in range(n)]}
def draft():
    return {"proposalId":"prop-01","strategyId":"NEW_PAIR_POST_BUNDLE_DIP",
      "marketRegime":"PUMPSWAP","hardLimitsHash":"a"*64,
      "proposedAt":T3,"candidateRuleText":"Research reduced aggressiveness on illiquid launches.",
      "rationale":"Paper-only matched comparison needs review.",
      "sourceClass":"LLM_UNTRUSTED_TEXT","evidenceIds":["case-list"],
      "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,
      "canBroadcast":False,"canRewriteRules":False,
      "canChangeHardLimits":False,"canAuthorizeLive":False}
def review():
    return {"proposalId":"prop-01","decision":"REQUEST_PAPER_TEST",
      "reviewedAt":T4,"hardLimitsHash":"a"*64,
      "authority":"RESEARCH_ONLY","canAuthorizeLive":False}
def events():
    p=j.propose(scorecard(),draft())
    return j.append([], "PROPOSED",p,T3)

class ProposalSafety(unittest.TestCase):
    def test_propose_only_review_not_rule_change(self):
        p=j.propose(scorecard(),draft())
        self.assertEqual(p["status"],"AWAITING_OWNER_REVIEW")
        self.assertFalse(p["operatorIdentityVerified"])
        for key in j.CONTROLLED:
            self.assertIs(p[key],False)

    def test_non_underperforming_rejected(self):
        x=scorecard()
        for r in x["pairs"]:r["candidate"]["returnBps"]=400
        with self.assertRaisesRegex(ValueError,"unreviewable"):
            j.propose(x,draft())

    def test_new_fields_for_risk_mutation_fail(self):
        x=draft();x["maxSlippageBps"]=5000
        with self.assertRaisesRegex(ValueError,"not_allowlisted"):
            j.propose(scorecard(),x)

    def test_hard_limits_identity_required(self):
        x=draft();x["hardLimitsHash"]="b"*64
        with self.assertRaisesRegex(ValueError,"hard_limits_mismatch"):
            j.propose(scorecard(),x)

    def test_untrusted_model_cannot_grant_execution(self):
        for key in j.CONTROLLED:
            x=draft();x[key]=True
            with self.assertRaisesRegex(ValueError,"authority_invalid"):
                j.propose(scorecard(),x)

    def test_proposal_cannot_precede_evidence(self):
        x=draft();x["proposedAt"]=T0
        with self.assertRaisesRegex(ValueError,"before_evidence"):
            j.propose(scorecard(),x)

    def test_review_is_never_owner_verified(self):
        p=events()[0]["payload"]
        r=j.review_assertion(p,review())
        self.assertFalse(r["approvalSignatureVerified"])
        self.assertFalse(r["ownerIdentityVerified"])
        self.assertFalse(r["mayRunUnattendedPaper"])
        self.assertFalse(r["mayTrade"])
        self.assertEqual(r["decision"],"REQUEST_PAPER_TEST")
        for key in j.CONTROLLED:
            self.assertIs(r[key],False)

    def test_review_in_wrong_risk_context_rejected(self):
        x=review();x["hardLimitsHash"]="b"*64
        with self.assertRaisesRegex(ValueError,"binding_mismatch"):
            j.review_assertion(events()[0]["payload"],x)

    def test_review_not_auto_promotion(self):
        es=events()
        payload=j.review_assertion(es[0]["payload"],review())
        es=j.append(es,"REVIEW_DECLARED",payload,T4)
        self.assertEqual(len(es),2)
        self.assertEqual(j.audit(es),es[-1]["hash"])
        self.assertEqual(es[1]["payload"]["authority"],"RESEARCH_ONLY")

    def test_prevent_replay_and_duplicate_review(self):
        es=events()
        with self.assertRaisesRegex(ValueError,"duplicate_or_unsealed"):
            j.append(es,"PROPOSED",es[0]["payload"],T4)
        r=j.review_assertion(es[0]["payload"],review())
        new=j.append(es,"REVIEW_DECLARED",r,T4)
        with self.assertRaisesRegex(ValueError,"review_unlinked"):
            j.append(new,"REVIEW_DECLARED",r,T4)

    def test_tamper_proof_only_relative_to_digest(self):
        es=events();mutated=copy.deepcopy(es)
        mutated[0]["payload"]["candidateRuleText"]="Unreviewed edit."
        with self.assertRaisesRegex(ValueError,"hash_mismatch"):
            j.audit(mutated)

    def test_missing_proposal_review_rejected(self):
        x=j.review_assertion(events()[0]["payload"],review())
        with self.assertRaisesRegex(ValueError,"review_unlinked"):
            j.append([],"REVIEW_DECLARED",x,T4)

    def test_future_temporal_monotonic(self):
        es=events()
        r=j.review_assertion(es[0]["payload"],review())
        with self.assertRaisesRegex(ValueError,"out_of_order"):
            j.append(es,"REVIEW_DECLARED",r,T0)

    def test_disk_roundtrip_single_writer(self):
        es=events()
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/"review.jsonl"
            head=j.write_next(path,[],es)
            self.assertEqual(head,j.load(path)[-1]["hash"])
            r=j.review_assertion(es[0]["payload"],review())
            nxt=j.append(es,"REVIEW_DECLARED",r,T4)
            j.write_next(path,es,nxt)
            self.assertEqual(j.load(path),nxt)

    def test_stale_writer_cannot_duplicate_journal_entry(self):
        es=events()
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/"research.jsonl"
            j.write_next(path,[],es)
            with self.assertRaisesRegex(ValueError,"concurrent_journal_change"):
                j.write_next(path,[],es)
            self.assertEqual(j.load(path),es)

    def test_no_symlink_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/"real"
            path.write_text("")
            alias=pathlib.Path(tmp)/"link"
            alias.symlink_to(path)
            with self.assertRaisesRegex(ValueError,"symlink"):
                j.load(alias)

    def test_no_hidden_review_authority(self):
        es=events()
        r=j.review_assertion(es[0]["payload"],review())
        r["mayTrade"]=True
        with self.assertRaisesRegex(ValueError,"unverified_authority"):
            j.append(es,"REVIEW_DECLARED",r,T4)

if __name__=="__main__":
    unittest.main()
