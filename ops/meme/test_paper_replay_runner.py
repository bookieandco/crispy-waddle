"""WATCHKEEPER.07 synthetic and read-only observation regression tests."""
import copy
import importlib.util
import pathlib
import unittest
HERE=pathlib.Path(__file__).parent
def load(name):
    s=importlib.util.spec_from_file_location("test_wk07_"+name,HERE/name)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load("paper_replay_runner.py")
f=load("test_single_slot_pool_observer.py")
T0="2026-10-14T12:00:08Z"
T1="2026-10-14T12:00:18Z"
def safety():
    return {"coverage":{k:True for k in m.paper.REQUIRED_COVERAGE},
      "checks":{k:{"evidenceId":"risk-"+k,"source":"independent_fixture",
          "availableAt":"2026-10-14T12:00:07Z"} for k in m.paper.REQUIRED_COVERAGE},
      "rugDisposition":"ALLOW_CANDIDATE","sourceIntegrity":"INDEPENDENT_VERIFIED",
      "moneyRiskDisposition":"PAPER_APPROVED","executionAuthority":False,"canSign":False}
def quote(side="BUY"):
    return {"mint":f.pub(11),"pair":f.pub(10),"side":side,
        "sourceType":"DEX_ROUTE_QUOTE","routeVerified":True,
        "evidenceId":"research-"+side,"observedAt":"2026-10-14T12:00:06Z" if side=="BUY" else "2026-10-14T12:00:13Z",
        "availableAt":"2026-10-14T12:00:07Z" if side=="BUY" else "2026-10-14T12:00:16Z",
        "priceUsdPerToken":0.01 if side=="BUY" else 0.011,
        "routeCapacityUsd":10000.0,"feeBps":20,"slippageBps":40,"impactBps":50}
def case(source="SYNTHETIC_TEST"):
    return {"schema":m.SCHEMA,"caseId":"case-1","mint":f.pub(11),"pair":f.pub(10),
      "strategyId":"shadow-regression","sourceClass":source,
      "decisionAt":T0,"exitAt":T1,
      "exitPlan":{"maxHoldSeconds":1000,"takeProfitBps":1000,"stopLossBps":1000},
      "entryNotionalUsd":10.0,
      "virtualBalanceUsd":100.0,"readOnlyPoolReceipt":None,
      "safety":safety(),"buyQuote":quote(),"sellQuote":quote("SELL"),
      "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,"canBroadcast":False}
def real_partial(source="PUBLIC_SINGLE_SLOT_OBSERVATION"):
    x=case(source)
    c=f.candidate()
    x["readOnlyPoolReceipt"]=f.m.collect(c,f.response(c),
      "2026-10-14T12:00:02Z","2026-10-14T12:00:05Z")
    return x
class PaperRunnerSafety(unittest.TestCase):
    def test_synthetic_counterfactual_only(self):
        x=case();old=copy.deepcopy(x)
        r=m.simulate(x)
        self.assertEqual(r["status"],"COUNTERFACTUAL_CLOSED_UNVERIFIED")
        self.assertEqual(r["actualTradeCount"],0)
        self.assertEqual(r["paperFillCountCertified"],0)
        self.assertFalse(r["inputClaimsIndependentlyAuthenticated"])
        self.assertFalse(r["canExecute"])
        self.assertFalse(r["canAuthorizeLive"])
        self.assertEqual(x,old)

    def test_partial_real_rpc_abstains_despite_fake_full_safety(self):
        r=m.simulate(real_partial())
        self.assertEqual(r["status"],"ABSTAIN")
        self.assertEqual(r["reasonCodes"],["READ_ONLY_POOL_ONLY_NO_INDEPENDENT_SELLABILITY"])
        self.assertEqual(r["actualTradeCount"],0)

    def test_sealed_readonly_rpc_not_automatically_admitted_as_real_fill(self):
        r=m.simulate(real_partial("EXTERNAL_PAPER_RESEARCH"))
        self.assertEqual(r["status"],"COUNTERFACTUAL_CLOSED_UNVERIFIED")
        self.assertFalse(r["realizedProfitCertified"])
        self.assertFalse(r["observationIndependentlyAttested"])

    def test_expired_virtual_timeout_does_not_fake_exit(self):
        x=case();x["sellQuote"]=None
        x["exitPlan"]["maxHoldSeconds"]=5
        r=m.simulate(x)
        self.assertEqual(r["status"],"COUNTERFACTUAL_OPEN_OR_UNSELLABLE")
        self.assertEqual(r["paperExitStudyTag"],"TIMEOUT_WITH_NO_SELL")
        self.assertTrue(r["timeoutThresholdReached"])
        self.assertIsNone(r["netPnlUsdModeled"])
        self.assertEqual(r["actualTradeCount"],0)

    def test_take_profit_and_stop_only_describe_price_observations(self):
        x=case();x["sellQuote"]["priceUsdPerToken"]=0.02
        r=m.simulate(x)
        self.assertEqual(r["paperExitStudyTag"],"PAPER_TP_AT_OBSERVATION")
        self.assertFalse(r["realizedProfitCertified"])
        self.assertEqual(r["modeledExitFeeBps"],20)
        x=case();x["sellQuote"]["priceUsdPerToken"]=0.001
        self.assertEqual(m.simulate(x)["paperExitStudyTag"],"PAPER_STOP_AT_OBSERVATION")

    def test_bad_or_bool_exit_plan_refused(self):
        x=case();x["exitPlan"]["maxHoldSeconds"]=True
        with self.assertRaisesRegex(ValueError,"exit_plan_maxHoldSeconds_invalid"):
            m.simulate(x)
        x=case();x["exitPlan"]["stopLossBps"]=10001
        with self.assertRaisesRegex(ValueError,"exit_plan_stopLossBps_invalid"):
            m.simulate(x)

    def test_sell_missing_is_explicitly_no_fill(self):
        x=case();x["sellQuote"]=None
        r=m.simulate(x)
        self.assertEqual(r["status"],"COUNTERFACTUAL_OPEN_OR_UNSELLABLE")
        self.assertIsNone(r["netPnlUsdModeled"])
        self.assertEqual(r["exitFillClass"],"NO_FILL")

    def test_sell_capacity_unavailable(self):
        x=case();x["sellQuote"]["routeCapacityUsd"]=1
        self.assertEqual(m.simulate(x)["status"],"COUNTERFACTUAL_OPEN_OR_UNSELLABLE")

    def test_stale_sell_cannot_be_closed(self):
        x=case();x["sellQuote"]["availableAt"]="2026-10-14T12:00:00Z"
        self.assertEqual(m.simulate(x)["exitFillClass"],"NO_FILL")

    def test_missing_entry_quote_abstains(self):
        x=case();x["buyQuote"]=None
        self.assertEqual(m.simulate(x)["status"],"ABSTAIN")

    def test_missing_safety_abstains(self):
        x=case();x["safety"]=None
        self.assertIn("SAFETY_RECEIPTS_MISSING",m.simulate(x)["reasonCodes"])

    def test_partial_rug_attestation_does_not_admit(self):
        x=case();x["safety"]["coverage"]["sellability"]=False
        self.assertEqual(m.simulate(x)["status"],"ABSTAIN")

    def test_future_safety_evidence_abstains(self):
        x=case();x["safety"]["checks"]["sellability"]["availableAt"]="2026-10-14T12:00:12Z"
        self.assertEqual(m.simulate(x)["status"],"ABSTAIN")

    def test_time_travel_exit_refused(self):
        x=case();x["exitAt"]="2026-10-14T12:00:07Z"
        with self.assertRaisesRegex(ValueError,"nonprospective_exit"):
            m.simulate(x)

    def test_quote_pair_switch_rejected(self):
        x=case();x["buyQuote"]["pair"]=f.pub(16)
        with self.assertRaisesRegex(ValueError,"entry_pool_mismatch"):
            m.simulate(x)

    def test_digest_tamper_rejected(self):
        x=real_partial()
        x["readOnlyPoolReceipt"]["baseVault"]["amountAtomic"]="999999999"
        with self.assertRaisesRegex(ValueError,"pool_digest_tampered"):
            m.simulate(x)

    def test_wrong_mint_from_pool_rejected(self):
        x=real_partial()
        x["mint"]=f.pub(24)
        with self.assertRaisesRegex(ValueError,"pool_identity_mismatch"):
            m.simulate(x)

    def test_public_stale_pool_refused(self):
        x=real_partial();x["decisionAt"]="2026-10-14T12:01:00Z"
        x["exitAt"]="2026-10-14T12:01:20Z"
        with self.assertRaisesRegex(ValueError,"pool_evidence_future_or_stale"):
            m.simulate(x)

    def test_permissions_refused(self):
        for key in ("canExecute","canSign","canBroadcast"):
            x=case();x[key]=True
            with self.assertRaisesRegex(ValueError,"authority_invalid"):
                m.simulate(x)

    def test_unknown_source_refused(self):
        x=case();x["sourceClass"]="LIVE_ORDER"
        with self.assertRaisesRegex(ValueError,"source_class_invalid"):
            m.simulate(x)

    def test_synthetic_cannot_launder_real_evidence(self):
        x=case();x["readOnlyPoolReceipt"]={"paper":"pretend"}
        with self.assertRaisesRegex(ValueError,"synthetic_not_isolated"):
            m.simulate(x)

    def test_nonlegacy_zero_real_trades_in_batch(self):
        a=real_partial()
        b=case();b["caseId"]="case-2";b["sellQuote"]=None
        r=m.batch([a,b])
        self.assertEqual(r["abstentions"],1)
        self.assertEqual(r["modeledNoSellCases"],1)
        self.assertEqual(r["actualTradeCount"],0)
        self.assertEqual(r["certifiedPaperFills"],0)

    def test_duplicate_batch_cases_refused(self):
        with self.assertRaisesRegex(ValueError,"duplicate_case"):
            m.batch([case(),case()])

    def test_batch_is_deterministic(self):
        a=m.batch([case()]);b=m.batch([case()])
        self.assertEqual(a["receiptDigest"],b["receiptDigest"])

    def test_empty_and_oversized_batch_refused(self):
        with self.assertRaisesRegex(ValueError,"batch_invalid"):m.batch([])
        with self.assertRaisesRegex(ValueError,"batch_invalid"):m.batch([case()]*1001)
if __name__=="__main__":unittest.main()
