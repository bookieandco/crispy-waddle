"""WATCHKEEPER.02 hermetic DEX cost-model contract tests, no network."""
from __future__ import annotations
import copy
import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).with_name("dex_cost_benchmark.py")
spec=importlib.util.spec_from_file_location("dexcost",path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
    return {
      "schema":m.SCHEMA,"decisionCutoff":"2026-10-15T03:00:10Z",
      "venue":"PUMPSWAP","side":"BUY","authority":"RESEARCH_ONLY",
      "canExecute":False,"canSign":False,"canBroadcast":False,
      "trustedProgramIds":{"PUMPSWAP":"trusted-program-fixture"},
      "inputNotionalUsd":"0.5","networkFeeLamports":"5000",
      "priorityFeeLamports":"10000",
      "solUsdPrice":{"sourceType":"INDEPENDENT_SOL_USD_PRICE","priceUsd":"100",
        "evidenceId":"fx-1","observedAt":"2026-10-15T03:00:02Z",
        "availableAt":"2026-10-15T03:00:04Z"},
      "pool":{"venue":"PUMPSWAP","curve":"CONSTANT_PRODUCT_AMM",
        "attestation":"INDEPENDENT_PROGRAM_AND_VAULT_MATCH",
        "programId":"trusted-program-fixture","poolAddress":"pool-1",
        "inputMint":"SOL","outputMint":"TOKEN",
        "poolEvidenceId":"pool-e1","vaultInEvidenceId":"vault-e2",
        "vaultOutEvidenceId":"vault-e3","slot":20,
        "observedAt":"2026-10-15T03:00:01Z","availableAt":"2026-10-15T03:00:04Z",
        "reserveInAtomic":"100000000000","reserveOutAtomic":"1000000000000",
        "poolFeeBps":30},
      "quote":{"venue":"PUMPSWAP","sourceType":"DIRECT_POOL_READ_ONLY",
        "quoteType":"INDICATIVE","evidenceId":"quote-e4",
        "poolAddress":"pool-1","inputMint":"SOL","outputMint":"TOKEN",
        "slot":20,"observedAt":"2026-10-15T03:00:03Z",
        "availableAt":"2026-10-15T03:00:05Z",
        "inputAmountAtomic":"100000000","outputAmountAtomic":"995000000",
        "minOutputAmountAtomic":"990000000"}
    }

class DexCosts(unittest.TestCase):
    def test_pass_indicative_and_no_execution(self):
        x=fixture()
        r=m.cost_quote(x)
        self.assertEqual(r["status"],"INDICATIVE_COST_ONLY")
        self.assertEqual(r["quoteEvidenceId"],"quote-e4")
        self.assertEqual(r["poolFeeBps"],30)
        self.assertFalse(r["sellabilityProven"])
        self.assertFalse(r["lpControlProven"])
        self.assertFalse(r["actualFillVerified"])
        for k in ("canExecute","canSign","canBroadcast"):
            self.assertFalse(r[k])

    def test_cost_tolerance_separate(self):
        r=m.cost_quote(fixture())
        self.assertGreater(float(r["quotedCostVsPoolSpotBps"]),0)
        self.assertGreater(float(r["maximumUserToleranceBps"]),0)
        self.assertLess(float(r["indicativeCostBpsExcludingTolerance"]),float(r["quotedCostVsPoolSpotBps"])+1000)
        self.assertEqual(r["networkAndPriorityFeeUsd"],"0.00") # 0.0015 USD rounds DOWN to 0.00

    def test_no_network_and_deterministic(self):
        x=fixture(); before=copy.deepcopy(x)
        a=m.cost_quote(x);b=m.cost_quote(x)
        self.assertEqual(a["receiptDigest"],b["receiptDigest"])
        self.assertEqual(x,before)

    def test_bad_pool_program(self):
        x=fixture();x["pool"]["programId"]="other"
        with self.assertRaisesRegex(ValueError,"untrusted"):
            m.cost_quote(x)

    def test_unproven_pool_rejected(self):
        x=fixture();x["pool"]["attestation"]="UNKNOWN"
        with self.assertRaisesRegex(ValueError,"attestation_missing"):
            m.cost_quote(x)

    def test_cross_pool_route_rejected(self):
        x=fixture();x["quote"]["poolAddress"]="wrong"
        with self.assertRaisesRegex(ValueError,"binding_mismatch"):
            m.cost_quote(x)

    def test_jupiter_indicative_not_direct_pool(self):
        x=fixture();x["quote"]["sourceType"]="JUPITER_AGGREGATED"
        with self.assertRaisesRegex(ValueError,"direct_quote_required"):
            m.cost_quote(x)

    def test_stale_quote_and_future_fx(self):
        x=fixture();x["quote"]["availableAt"]="2026-10-15T02:59:20Z"
        with self.assertRaisesRegex(ValueError,"quote_future_or_stale"):
            m.cost_quote(x)
        x=fixture();x["solUsdPrice"]["availableAt"]="2026-10-15T03:01:00Z"
        with self.assertRaisesRegex(ValueError,"fx_future_or_stale"):
            m.cost_quote(x)

    def test_quote_observed_after_available(self):
        x=fixture();x["quote"]["observedAt"]="2026-10-15T03:00:09Z"
        with self.assertRaisesRegex(ValueError,"quote_future_or_stale"):
            m.cost_quote(x)

    def test_overparticipation_no_fill(self):
        x=fixture();x["quote"]["inputAmountAtomic"]="600000000"
        r=m.cost_quote(x)
        self.assertEqual(r["status"],"NO_FILL")
        self.assertNotIn("indicativeCostBpsExcludingTolerance",r)

    def test_min_output_bound(self):
        x=fixture();x["quote"]["minOutputAmountAtomic"]="996000000"
        with self.assertRaisesRegex(ValueError,"min_output_exceeds_quote"):
            m.cost_quote(x)

    def test_fee_cannot_be_nan_or_negative(self):
        x=fixture();x["networkFeeLamports"]="-1"
        with self.assertRaisesRegex(ValueError,"decimal_atoms_required"):
            m.cost_quote(x)
        x=fixture();x["inputNotionalUsd"]="NaN"
        with self.assertRaisesRegex(ValueError,"out_of_range"):
            m.cost_quote(x)

    def test_permission_never_accepted(self):
        for key in ("canExecute","canSign","canBroadcast"):
            x=fixture();x[key]=True
            with self.assertRaisesRegex(ValueError,"authority_invalid"):
                m.cost_quote(x)

    def test_repeated_evidence_not_independent(self):
        x=fixture();x["quote"]["evidenceId"]="pool-e1"
        with self.assertRaisesRegex(ValueError,"not_independent"):
            m.cost_quote(x)

    def test_untrusted_pool_math_not_applied(self):
        x=fixture();x["pool"]["curve"]="BONDING_CURVE"
        with self.assertRaisesRegex(ValueError,"unknown_pool_math"):
            m.cost_quote(x)

    def test_slot_mismatch_rejected(self):
        x=fixture();x["quote"]["slot"]=21
        with self.assertRaisesRegex(ValueError,"slot_not_reconciled"):
            m.cost_quote(x)

    def test_quote_better_than_reference_is_unscored(self):
        x=fixture();x["quote"]["outputAmountAtomic"]="2000000000"
        r=m.cost_quote(x)
        self.assertEqual(r["status"],"UNSCORED")
        self.assertFalse(r["canExecute"])

    def test_false_quote_authority_rejected(self):
        x=fixture();x["authority"]="TRADE_APPROVED"
        with self.assertRaisesRegex(ValueError,"authority_invalid"):
            m.cost_quote(x)

if __name__=="__main__":
    unittest.main()
