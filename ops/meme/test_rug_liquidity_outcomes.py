"""Hermetic .15–.18 regression: no live RPC, orders, wallets or P&L."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE=Path(__file__).parent
def load(name):
    sp=importlib.util.spec_from_file_location("rug15tests_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m

e=load("rug_liquidity_exit_research")
o=load("rug_outcome_cohorts")
f=load("test_rug_watchkeeper_fusion")
d=load("test_dual_rpc_pool_observer")
p=load("test_paired_route_research")

B="2026-10-14T12:00:05Z"
A="2026-10-14T12:01:06Z"
CUTOFF="2026-10-14T12:01:07Z"
MID="2026-10-14T12:00:45Z"
SEAL="2026-10-14T12:00:00Z"
DAY2="2026-10-15T12:01:00Z"
ASOF="2026-10-15T13:00:00Z"

def pub(byte):return e.native.pool_probe.encode_pubkey(bytes([byte])*32)
def signature():
    data=bytes([19])*64
    number=int.from_bytes(data,"big");out=""
    while number:
        number,r=divmod(number,58);out=e.B58[r]+out
    return out

def snapshots(*,drain=True):
    sample=f.sample()
    candidate,x,y=d.fixtures()
    before=e.dual.compare(candidate,x,y,B)
    x=copy.deepcopy(x);y=copy.deepcopy(y)
    for v in (x,y):
        v["slot"]=103
        v["observedAt"]="2026-10-14T12:01:04Z"
        v["availableAt"]="2026-10-14T12:01:05Z"
        v["baseVault"]["amountAtomic"]="10000000" if drain else "22000000"
        v["quoteVault"]["amountAtomic"]="9000000" if drain else "18000000"
        v["receiptDigest"]=e._sha({k:z for k,z in v.items() if k!="receiptDigest"})
    after=e.dual.compare(candidate,x,y,A)
    return before,after,sample["pool_proof"]

def tx_fixture(before,after,poolproof):
    sig=signature()
    a=poolproof["baseVault"]["address"]
    b=poolproof["quoteVault"]["address"]
    mint=before["mint"];quote=before["quoteMint"]
    def bal(index,mint,amount):
        return {"accountIndex":index,"mint":mint,"uiTokenAmount":{"amount":amount}}
    return {
       "source":"PUBLIC_SOLANA_GET_TRANSACTION_UNWITNESSED",
       "signature":sig,"availableAt":MID,
       "result":{"slot":101,
        "transaction":{"signatures":[sig],
          "message":{"accountKeys":[a,b,poolproof["pool"]],
          "instructions":[{"programId":poolproof["poolProgram"],"accounts":[0,1]}]}},
        "meta":{"err":None,"preTokenBalances":[bal(0,mint,before["observedBaseAtomic"]),
                    bal(1,quote,before["observedQuoteAtomic"])],
             "postTokenBalances":[bal(0,mint,after["observedBaseAtomic"]),
                    bal(1,quote,after["observedQuoteAtomic"])]}}
    }

def route_fixture():
    st,cd=p.state()
    return e.route.evaluate(st,cd,p.T3)

def other_quote(*,family="SECOND_PUBLIC_AGGREGATOR",status="INDICATIVE_SELL_QUOTE_ONLY"):
    r=route_fixture()
    return {"sourceFamily":family,"quoteId":"fixture-quote-1",
        "sourceContentDigest":"a"*64,"availableAt":p.T3,
        "inputMint":r["mint"],"outputMint":e.route.forward.SOL,
        "inputAtoms":r["reverseInputTokenAtoms"],"outputAtoms":"9800000",
        "status":status,"authority":"RESEARCH_ONLY",
        "canTrade":False,"canSign":False,"canBroadcast":False,
        "canAuthorizeLive":False}

def universe(*, two=True):
    state=o.observer.empty_state()
    pairs=[(pub(11),pub(10)),(pub(22),pub(25))] if two else [(pub(11),pub(10))]
    for mint,pair in pairs:
        o.observer.append_event(state,{"type":"MARKET_OBSERVATION",
           "mint":mint,"pair":pair,"securityStatus":"UNVERIFIED",
           "canTrade":False,"observedAt":"2026-10-14T11:59:50Z",
           "availableAt":"2026-10-14T11:59:50Z"})
    groups={mint:"actor-"+str(i) for i,(mint,_) in enumerate(pairs)}
    return state,groups,o.seal_prospective_universe(state,sealed_at=SEAL,
           cohort_id="synthetic-research-cohort",actor_groups=groups)

def report_for(case,kind="MONITORED_NO_INCIDENT_REPORTED",receipt=None):
    return {
        "caseId":case["caseId"],"kind":kind,"observedAt":"2026-10-15T12:10:00Z",
        "availableAt":"2026-10-15T12:10:01Z",
        "sourceFamilies":["public-rpc-claim","separate-research-review"],
        "sourceEvidenceDigests":["a"*64,"b"*64],
        "monitoringFrom":SEAL if kind=="MONITORED_NO_INCIDENT_REPORTED" else None,
        "monitoringThrough":DAY2 if kind=="MONITORED_NO_INCIDENT_REPORTED" else None,
        "liquidityReceipt":receipt,"externalWitnessVerified":False}

class LiquidityResearchTests(unittest.TestCase):
    def test_two_vault_declines_remain_unwitnessed(self):
        before,after,pp=snapshots()
        original=copy.deepcopy((before,after,pp))
        result=e.assess_liquidity_withdrawal(before,after,pp,CUTOFF)
        self.assertEqual(result["status"],"TWO_VAULT_DECLINES_NO_TX")
        self.assertEqual(result["baseAtomsDelta"],"-10000000")
        self.assertTrue(result["twoAssetReserveDeclineObserved"])
        self.assertFalse(result["rugConfirmed"])
        self.assertFalse(result["withdrawalCauseProven"])
        self.assertFalse(result["canTrade"])
        self.assertEqual((before,after,pp),original)
    def test_token_balance_bound_signature_gives_candidate_not_rug(self):
        before,after,pp=snapshots()
        receipt=e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,
                                              tx_fixture(before,after,pp))
        self.assertEqual(receipt["status"],"TWO_VAULT_DECLINES_TX_PATTERN_UNVERIFIED")
        self.assertFalse(receipt["lpOwnershipVerified"])
        self.assertFalse(receipt["actorAttributionVerified"])
        self.assertFalse(receipt["rugConfirmed"])
        self.assertIsNotNone(receipt["transactionSignature"])
    def test_transaction_account_wrong_or_missing_rejected(self):
        before,after,pp=snapshots()
        tx=tx_fixture(before,after,pp)
        tx["result"]["meta"]["postTokenBalances"][0]["uiTokenAmount"]["amount"]="5"
        with self.assertRaisesRegex(ValueError,"tx_changes_disagree"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,tx)
        tx=tx_fixture(before,after,pp)
        tx["result"]["transaction"]["message"]["instructions"]=[]
        with self.assertRaisesRegex(ValueError,"tx_no_direct_pool_program"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,tx)
    def test_failed_or_replayed_transaction_rejected(self):
        before,after,pp=snapshots();tx=tx_fixture(before,after,pp)
        tx["result"]["meta"]["err"]={"InstructionError":[0,"Custom"]}
        with self.assertRaisesRegex(ValueError,"tx_failed"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,tx)
        tx=tx_fixture(before,after,pp);tx["result"]["slot"]=100
        with self.assertRaisesRegex(ValueError,"tx_slot_not_between"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,tx)
    def test_no_both_sides_decrease_no_drain(self):
        before,after,pp=snapshots(drain=False)
        result=e.assess_liquidity_withdrawal(before,after,pp,CUTOFF)
        self.assertEqual(result["status"],"NO_DUAL_VAULT_DECLINE")
        with self.assertRaisesRegex(ValueError,"tx_claim_without_two_asset_decline"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF,
                                           tx_fixture(before,after,pp))
    def test_self_rehashed_false_pool_and_future_rejected(self):
        before,after,pp=snapshots()
        pp["baseVault"]["atoms"]="1"
        with self.assertRaisesRegex(ValueError,"pool_proof_not_bound"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF)
        before,after,pp=snapshots()
        with self.assertRaisesRegex(ValueError,"future_pool_snapshot"):
            e.assess_liquidity_withdrawal(before,after,pp,B)
        before,after,pp=snapshots()
        after["observedQuoteAtomic"]="0"
        with self.assertRaisesRegex(ValueError,"pool_snapshot_digest_invalid"):
            e.assess_liquidity_withdrawal(before,after,pp,CUTOFF)

class ExitResearchTests(unittest.TestCase):
    def test_cross_source_quote_indicative_never_executes(self):
        auth=f.sample()["authority_receipt"]
        q=other_quote();r=route_fixture()
        result=e.assess_exit_routes(r,[q],auth,p.T3)
        self.assertEqual(result["status"],"MULTI_PROVIDER_INDICATIVE_EXIT_ONLY")
        self.assertEqual(result["indicativeIndependentFamilies"],1)
        self.assertFalse(result["providerIndependenceAttested"])
        self.assertFalse(result["sellabilityVerified"])
        self.assertFalse(result["canTrade"])
        self.assertFalse(result["canEnterPaper"])
    def test_one_provider_and_bad_route_do_not_prove_exit(self):
        out=e.assess_exit_routes(route_fixture(),[],f.sample()["authority_receipt"],p.T3)
        self.assertEqual(out["status"],"ABSTAIN_ONE_AGGREGATOR_ONLY")
    def test_transfer_hook_restriction_blocks_crosssource_allow(self):
        auth=f.sample(extension=[{"extension":"transferHook","state":{}}])["authority_receipt"]
        result=e.assess_exit_routes(route_fixture(),[other_quote()],auth,p.T3)
        self.assertEqual(result["status"],"REVIEW_TRANSFER_RESTRICTIONS_UNVERIFIED")
    def test_external_quote_zeros_or_conflict_not_authority(self):
        x=other_quote(status="NO_ROUTE")
        x["outputAtoms"]="0"
        r=e.assess_exit_routes(route_fixture(),[x],f.sample()["authority_receipt"],p.T3)
        self.assertEqual(r["status"],"QUOTE_SOURCES_CONFLICT")
        self.assertFalse(r["sellabilityVerified"])
    def test_duplicate_family_and_source_mismatch_rejected(self):
        x=other_quote()
        with self.assertRaisesRegex(ValueError,"duplicated_provider_family"):
            e.assess_exit_routes(route_fixture(),[x,x],f.sample()["authority_receipt"],p.T3)
        x=other_quote();x["inputAtoms"]="123"
        with self.assertRaisesRegex(ValueError,"quote_size_mismatch"):
            e.assess_exit_routes(route_fixture(),[x],f.sample()["authority_receipt"],p.T3)
    def test_quote_future_and_permission_escalation_rejected(self):
        q=other_quote();q["availableAt"]="2026-10-15T13:00:00Z"
        with self.assertRaisesRegex(ValueError,"external_quote_future_or_stale"):
            e.assess_exit_routes(route_fixture(),[q],f.sample()["authority_receipt"],p.T3)
        q=other_quote();q["canTrade"]=True
        with self.assertRaisesRegex(ValueError,"external_quote_execution_authority"):
            e.assess_exit_routes(route_fixture(),[q],f.sample()["authority_receipt"],p.T3)
    def test_forged_canonical_digest_rejected(self):
        q=route_fixture();q["sellabilityVerified"]=True
        with self.assertRaisesRegex(ValueError,"canonical_route_digest_invalid"):
            e.assess_exit_routes(q,[],f.sample()["authority_receipt"],p.T3)

class ProspectiveUniverseTests(unittest.TestCase):
    def test_every_known_mint_included_no_labels_or_authority(self):
        state,groups,u=universe()
        self.assertEqual(u["eligiblePopulationCount"],2)
        self.assertEqual(u["eligibleCasesExcluded"],0)
        self.assertEqual(len(u["caseRegistry"]),2)
        self.assertEqual(u["sourceHeadDigest"],state["lastDigest"])
        self.assertFalse(u["externalSealWitnessed"])
        self.assertFalse(u["canTrainCalibratedModel"])
    def test_group_missing_duplicate_and_training_leak_rejected(self):
        state,groups,u=universe()
        groups.pop(pub(22))
        with self.assertRaisesRegex(ValueError,"universe_membership"):
            o.seal_prospective_universe(state,sealed_at=SEAL,
                                         cohort_id="bad",actor_groups=groups)
        state,groups,u=universe()
        groups[pub(22)]=groups[pub(11)]
        with self.assertRaisesRegex(ValueError,"duplicate_or_leaked"):
            o.seal_prospective_universe(state,sealed_at=SEAL,
                                         cohort_id="bad",actor_groups=groups)
    def test_future_event_and_short_controls_denied(self):
        state,groups,u=universe()
        o.observer.append_event(state,{"type":"CYCLE","observedAt":DAY2,"availableAt":DAY2})
        with self.assertRaisesRegex(ValueError,"ledger_contains_future"):
            o.seal_prospective_universe(state,sealed_at=SEAL,cohort_id="bad",actor_groups=groups)
        state,groups,u=universe()
        with self.assertRaisesRegex(ValueError,"horizon_too_short"):
            o.seal_prospective_universe(state,sealed_at=SEAL,
                                         cohort_id="bad",actor_groups=groups,
                                         minimum_horizon_seconds=60)
    def test_mutated_cohort_hash_denied(self):
        _,_,u=universe()
        u["caseRegistry"].pop()
        with self.assertRaisesRegex(ValueError,"cohort_seal_tampered"):
            o.adjudicate_reports(u,[],as_of=ASOF)

class OutcomeReviewTests(unittest.TestCase):
    def test_missing_unknown_monitored_not_fraud_labels(self):
        _,_,u=universe()
        r=o.adjudicate_reports(u,[],as_of=ASOF)
        self.assertEqual(r["outcomeReviewCounts"]["PENDING_NO_REPORT"],2)
        self.assertFalse(r["canExportCertifiedLabels"])
        self.assertFalse(r["canTrainCalibratedModel"])
        case=u["caseRegistry"][0]
        reported=o.adjudicate_reports(u,[report_for(case)],as_of=ASOF)
        self.assertEqual(reported["outcomeReviewCounts"]["PENDING_NO_REPORT"],1)
        self.assertIn("MONITORED_WINDOW_NO_INCIDENT_REPORTED_NOT_SAFE",reported["outcomeReviewCounts"])
        self.assertIsNone(reported["cases"][0]["verifiedLabel"])
    def test_drain_report_not_confirmed_rug(self):
        _,_,u=universe()
        before,after,pp=snapshots()
        evidence=e.assess_liquidity_withdrawal(before,after,pp,CUTOFF)
        target=next(v for v in u["caseRegistry"] if v["mint"]==before["mint"])
        r=o.adjudicate_reports(u,[report_for(target,"DUAL_VAULT_DECLINE_REPORTED",evidence)],as_of=ASOF)
        self.assertIn("REPORTED_RESERVE_DECLINE_NOT_CONFIRMED_RUG",r["outcomeReviewCounts"])
        self.assertFalse(r["canExportCertifiedLabels"])
        self.assertFalse(r["canTrade"])
    def test_conflicting_reports_remain_unknown(self):
        _,_,u=universe()
        x=report_for(u["caseRegistry"][0]);y=report_for(u["caseRegistry"][0],"UNKNOWN")
        y["sourceFamilies"]=[];y["sourceEvidenceDigests"]=[]
        r=o.adjudicate_reports(u,[x,y],as_of=ASOF)
        self.assertEqual(r["outcomeReviewCounts"]["CONFLICTED_SOURCES_UNKNOWN"],1)
    def test_short_monitor_and_one_source_denied(self):
        _,_,u=universe();x=report_for(u["caseRegistry"][0])
        x["monitoringThrough"]=SEAL
        with self.assertRaisesRegex(ValueError,"control_observation_window_incomplete"):
            o.adjudicate_reports(u,[x],as_of=ASOF)
        x=report_for(u["caseRegistry"][0])
        x["sourceFamilies"]=["just-one"];x["sourceEvidenceDigests"]=["a"*64]
        with self.assertRaisesRegex(ValueError,"two_source_families"):
            o.adjudicate_reports(u,[x],as_of=ASOF)
    def test_hindsight_outcomes_refused(self):
        _,_,u=universe();x=report_for(u["caseRegistry"][0])
        x["observedAt"]="2026-10-13T00:00:00Z"
        with self.assertRaisesRegex(ValueError,"lookahead_or_preseal"):
            o.adjudicate_reports(u,[x],as_of=ASOF)
    def test_fabricated_external_verification_denied(self):
        _,_,u=universe();x=report_for(u["caseRegistry"][0])
        x["externalWitnessVerified"]=True
        with self.assertRaisesRegex(ValueError,"externally_verified_label_without_proof"):
            o.adjudicate_reports(u,[x],as_of=ASOF)
    def test_future_outcome_not_censored_as_safe(self):
        _,_,u=universe();x=report_for(u["caseRegistry"][0])
        with self.assertRaisesRegex(ValueError,"lookahead_or_preseal"):
            o.adjudicate_reports(u,[x],as_of=SEAL)
    def test_wrong_case_and_duplicate_outcome_caps(self):
        _,_,u=universe();x=report_for(u["caseRegistry"][0])
        x["caseId"]="invented"
        with self.assertRaisesRegex(ValueError,"unknown_case"):
            o.adjudicate_reports(u,[x],as_of=ASOF)

if __name__=="__main__":unittest.main()
