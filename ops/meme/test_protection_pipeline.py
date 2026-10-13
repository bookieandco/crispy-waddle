"""Offline regression tests: no network, keys, signed transactions or paid providers."""
import copy
import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


p = load("paper_shadow_lab")
r = load("solana_risk_probe")
T0 = "2026-10-14T01:00:00Z"
T1 = "2026-10-14T01:00:10Z"
MINT = "So11111111111111111111111111111111111111112"
PAIR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"


def safety(t=T0):
    return {
        "coverage": {k: True for k in p.REQUIRED_COVERAGE},
        "checks": {k: {"source": "isolated_test_fixture",
                       "evidenceId": "fixture:" + k,
                       "availableAt": t} for k in p.REQUIRED_COVERAGE},
        "rugDisposition": "ALLOW_CANDIDATE",
        "sourceIntegrity": "INDEPENDENT_VERIFIED",
        "moneyRiskDisposition": "PAPER_APPROVED",
        "executionAuthority": False, "canSign": False
    }


def quote(side, at=T0, price=1.0, liquidity=15000):
    return {"mint": MINT, "pair": PAIR, "side": side,
            "sourceType": "DEX_ROUTE_QUOTE", "routeVerified": True,
            "evidenceId": "isolated_fixture_quote_" + side,
            "observedAt": at, "availableAt": at,
            "priceUsdPerToken": price, "routeCapacityUsd": liquidity,
            "feeBps": 20, "slippageBps": 30, "impactBps": 10}


def account(freeze=None, mint_authority=None):
    return {"context": {"slot": 123456},
            "value": {"owner": TOKEN_PROGRAM,
                      "data": {"parsed": {"type": "mint", "info": {
                          "supply": "1000", "decimals": 6,
                          "mintAuthority": mint_authority,
                          "freezeAuthority": freeze}}}}}


class ResearchRiskPaperTests(unittest.TestCase):
    def test_partial_rpc_proof_never_means_safe(self):
        evidence = r.verify_mint(MINT, account(), None, T0)
        self.assertEqual(evidence["status"], "ONCHAIN_PARTIAL_UNVERIFIED")
        self.assertEqual(evidence["rugVerdict"], "UNDETERMINED")
        self.assertIn("sellability", evidence["unverified"])
        self.assertFalse(evidence["canTrade"])
        self.assertFalse(evidence["canBroadcast"])

    def test_freeze_and_mint_authority_are_observable_risk_not_proven_rug(self):
        evidence = r.verify_mint(MINT, account(MINT, MINT),
                                 {"context": {"slot": 123458},
                                  "value": [{"amount": "900"}, {"amount": "50"}]}, T0)
        self.assertIn("FREEZE_AUTHORITY_ACTIVE", evidence["signals"])
        self.assertIn("MINT_AUTHORITY_ACTIVE", evidence["signals"])
        self.assertIn("TOP_TOKEN_ACCOUNTS_CONCENTRATED_NOT_WALLET_GRAPH", evidence["signals"])
        self.assertEqual(evidence["rugVerdict"], "UNDETERMINED")
        self.assertEqual(evidence["top10TokenAccountsFraction"], .95)

    def test_false_proof_or_stale_slot_rejected(self):
        with self.assertRaisesRegex(ValueError, "mint_program_unknown"):
            r.verify_mint(MINT, {"context": {"slot": 1}, "value": {
                "owner": "not_a_token_program", "data": account()["value"]["data"]}}, None, T0)
        with self.assertRaisesRegex(ValueError, "largest_accounts_stale"):
            r.verify_mint(MINT, account(),
                          {"context": {"slot": 1}, "value": [{"amount": "5"}]}, T0)

    def test_rpc_method_allowlist(self):
        called = []
        def fake_rpc(method, params):
            called.append(method)
            if method == "getAccountInfo":
                return account()
            return {"context": {"slot": 123456}, "value": [{"amount": "600"}]}
        result = r.probe_one(MINT, fake_rpc)
        self.assertEqual(called, ["getAccountInfo", "getTokenLargestAccounts"])
        self.assertFalse(result["canTrade"])

    def test_partial_coverage_never_enters_paper(self):
        missing = safety()
        missing["coverage"]["liquidityControl"] = False
        verdict = p.admit_paper_case(missing, T1)
        self.assertEqual(verdict["admission"], "REJECT")
        with self.assertRaisesRegex(ValueError, "paper_entry_not_admitted"):
            p.simulate_buy(MINT, 20, 100, verdict, missing, quote("BUY"), T1)

    def test_future_and_missing_evidence_rejected(self):
        future = safety("2026-10-15T01:00:00Z")
        self.assertEqual(p.admit_paper_case(future, T1)["admission"], "REJECT")
        no_source = safety()
        no_source["checks"]["sellability"]["source"] = ""
        self.assertEqual(p.admit_paper_case(no_source, T1)["admission"], "REJECT")

    def test_quote_expiry_and_tradability(self):
        passed = safety()
        admit = p.admit_paper_case(passed, T1)
        self.assertEqual(admit["admission"], "REVIEWED_PAPER_CANDIDATE")
        buy = p.simulate_buy(MINT, 20, 100, admit, passed, quote("BUY"), T1)
        self.assertEqual(buy["authority"], "PAPER_SIMULATION_ONLY")
        self.assertFalse(buy["canSign"])
        self.assertFalse(buy["canExecute"])
        self.assertEqual(buy["fillClass"], "COUNTERFACTUAL_ONLY")
        with self.assertRaisesRegex(ValueError, "quote_stale_or_future"):
            p.simulate_buy(MINT, 20, 100, admit, passed, quote("BUY"), "2026-10-14T01:01:00Z")

    def test_insufficient_liquidity_and_funds_rejected(self):
        s = safety()
        a = p.admit_paper_case(s, T1)
        with self.assertRaisesRegex(ValueError, "liquidity_participation_exceeded"):
            p.simulate_buy(MINT, 20, 100, a, s, quote("BUY", liquidity=1000), T1)
        with self.assertRaisesRegex(ValueError, "paper_risk_budget_exceeded"):
            p.simulate_buy(MINT, 51, 100, a, s, quote("BUY"), T1)

    def test_unverified_exit_is_never_invented(self):
        s = safety()
        a = p.admit_paper_case(s, T1)
        buy = p.simulate_buy(MINT, 20, 100, a, s, quote("BUY"), T1)
        self.assertEqual(p.simulate_exit(buy, None, T1)["action"], "NO_FILL")
        close = p.simulate_exit(buy, quote("SELL", price=1.1), T1)
        self.assertEqual(close["action"], "SELL")
        self.assertFalse(close["canBroadcast"])
        self.assertIsInstance(close["pnlUsdModeled"], float)
        moved = quote("SELL", price=1.1)
        moved["pair"] = "11111111111111111111111111111111"
        self.assertEqual(p.simulate_exit(buy, moved, T1)["action"], "NO_FILL")

    def test_no_trade_control_cannot_fabricate_pnl(self):
        self.assertEqual(p.grade_no_trade(None)["grade"], "UNSCORED")
        self.assertEqual(p.grade_no_trade({"up": True})["grade"], "MISSED_SPOT_UP_MOVE")
        self.assertFalse(p.grade_no_trade({"up": False})["isExecutablePnL"])

    def test_summary_counts_only_existing_market_evidence(self):
        s = r.OBSERVER.empty_state()
        x = r.summarize(s)
        self.assertIsNone(x["naive24hUpAccuracy"])
        self.assertIsNone(x["confirmedRugs"])
        self.assertEqual(x["executedTrades"], 0)
        self.assertIn("Verified confirmed rugs: **unknown**", r.render_markdown(x))
        self.assertIn("price-only", r.render_markdown(x).lower())


if __name__ == "__main__":
    unittest.main()
