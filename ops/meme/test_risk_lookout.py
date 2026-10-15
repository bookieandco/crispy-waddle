"""Safety tests for non-accusatory public-mint risk lookout."""
import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("solana_risk_probe",HERE/"solana_risk_probe.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
obs=m.OBSERVER

BASE="2026-10-14T20:00:00Z"
TOKENS=["1"*30+v for v in ["11","12","13","14","15","16","17"]]


class ReadOnlyRiskLookout(unittest.TestCase):
    def sample(self):
        s=obs.empty_state()
        for i,mint in enumerate(TOKENS):
            for j in range(2):
                obs.append_event(s,{
                    "type":"MARKET_OBSERVATION",
                    "mint":mint,"pair":"11111111111111111111111111111111",
                    "observedAt":BASE,"availableAt":BASE,
                    "priceUsd":1/(1+i+j),"liquidityUsd":12000,
                    "flags":["PRICE_COLLAPSE_NOT_PROVEN_RUG",
                             "MINT_FREEZE_LP_CONTROL_AND_HOLDERS_UNVERIFIED"],
                    "securityStatus":"UNVERIFIED","canTrade":False,
                    "rugVerdict":"UNDETERMINED",
                })
        obs.append_event(s,{"type":"CYCLE","observedAt":BASE,"availableAt":BASE,
                            "sampled":14,"suspiciousObservations":14})
        return s

    def test_dedupes_by_distinct_mint_not_14_rugs(self):
        s=self.sample()
        summary=m.summarize(s)
        self.assertEqual(summary["suspiciousMarketObservationsNotConfirmedRugs"],14)
        self.assertEqual(summary["distinctUnverifiedRiskMints"],7)
        self.assertEqual(len(summary["recentUnverifiedLookouts"]),5)
        self.assertFalse(all(item["confirmedRug"] for item in summary["recentUnverifiedLookouts"]))
        self.assertEqual(len({item["mint"] for item in summary["recentUnverifiedLookouts"]}),5)
        self.assertFalse(summary["canTrade"])
        obs.audit(s)

    def test_report_includes_actual_timestamps_hashes_uncertainty(self):
        summary=m.summarize(self.sample())
        md=m.render_markdown(summary)
        self.assertIn("\n## Recent unverified risk lookouts",md)
        self.assertIn("(NOT a confirmed rug)\n",md)
        self.assertIn(BASE,md)
        self.assertIn("evidence \x60",md)
        self.assertNotIn("confirmed rugs: **7**",md)
        self.assertIn("Verified confirmed rugs: **unknown**",md)

    def test_no_warnings_are_not_safety_certification(self):
        s=obs.empty_state()
        t=m.summarize(s)
        self.assertEqual(t["recentUnverifiedLookouts"],[])
        output=m.render_markdown(t)
        self.assertIn("No severe price/liquidity warnings in sampled markets.",output)
        self.assertIn("Missing on-chain liquidity",output)


if __name__=="__main__":
    unittest.main()
