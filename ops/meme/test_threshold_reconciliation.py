"""SHARK-CLOSE.01/.02 regressions: provenance, first crossing and dedup."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("shark_peak_lookout_test", HERE / "threshold_reconciliation.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
obs = m.obs
MINT = "So11111111111111111111111111111111111111112"
PAIR_A = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
PAIR_B = "11111111111111111111111111111111"


def add(state, at, price, liquidity, *, pair=PAIR_A, flags=()):
    obs.append_event(state, {
        "type": "MARKET_OBSERVATION", "mint": MINT, "pair": pair,
        "priceUsd": price, "liquidityUsd": liquidity,
        "availableAt": at, "observedAt": at,
        "canTrade": False, "securityStatus": "UNVERIFIED", "flags": list(flags),
    })


class PeakLookout(unittest.TestCase):
    def test_first_crossing_sticks_across_later_observations_and_rescans(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100)
        add(s, "2026-10-17T11:00:00Z", 5, 90)
        add(s, "2026-10-17T12:00:00Z", 2, 80)
        add(s, "2026-10-17T13:00:00Z", 1, 70)
        warnings = m.reconcile(s)
        self.assertEqual(len(warnings), 1)
        w = warnings[0]
        self.assertEqual(w["kind"], "PRICE_COLLAPSE")
        self.assertEqual(w["baselineAt"], "2026-10-17T10:00:00Z")
        self.assertEqual(w["crossingAt"], "2026-10-17T12:00:00Z")
        self.assertEqual(w["declinePct"], 80)
        self.assertFalse(w["collectorFlagPresent"])
        self.assertFalse(w["canTrade"])
        self.assertFalse(w["canLaunch"])
        self.assertEqual(m.reconcile(s, since="2026-10-17T12:00:00Z"), [])
        self.assertEqual(m.reconcile(s, already_alerted=[w["alertId"]]), [])

    def test_new_liquidity_crossing_same_mint_is_distinct_alert(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100)
        add(s, "2026-10-17T12:00:00Z", 2, 40)
        add(s, "2026-10-17T14:00:00Z", 1, 29,
            flags=["SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG"])
        out = m.reconcile(s, since="2026-10-17T13:00:00Z")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["kind"], "LIQUIDITY_VALUATION_DECLINE")
        self.assertTrue(out[0]["collectorFlagPresent"])
        self.assertNotEqual(out[0]["alertId"], m.alert_id(MINT, "PRICE_COLLAPSE"))

    def test_pair_switch_does_not_compare_incompatible_pools(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100, pair=PAIR_A)
        add(s, "2026-10-17T11:00:00Z", 1, 5, pair=PAIR_B)
        self.assertEqual(m.reconcile(s), [])
        add(s, "2026-10-17T12:00:00Z", 0.1, 0.5, pair=PAIR_B)
        out = m.reconcile(s)
        self.assertEqual(len(out), 2)
        self.assertTrue(all(x["pair"] == PAIR_B for x in out))

    def test_peak_not_latest_sample_is_comparison_baseline(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 200)
        add(s, "2026-10-17T11:00:00Z", 8, 190)
        add(s, "2026-10-17T12:00:00Z", 2.9, 190)
        out = m.reconcile(s)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["baselineValue"], 10)
        self.assertEqual(out[0]["declinePct"], 71)

    def test_zero_liquidity_is_only_observation_not_verified_withdrawal(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100)
        add(s, "2026-10-17T11:00:00Z", 10, 0)
        out = m.reconcile(s)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["declinePct"], 100)
        self.assertFalse(out[0]["liquidityWithdrawalVerified"])
        self.assertFalse(out[0]["rugConfirmed"])
        self.assertFalse(out[0]["profitOrSellabilityVerified"])
        self.assertIn("NOT A CONFIRMED RUG", out[0]["caveat"])

    def test_rejects_unverified_mutation_to_ledger(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100)
        add(s, "2026-10-17T12:00:00Z", 2, 90)
        broken = copy.deepcopy(s)
        broken["events"][0]["priceUsd"] = 100
        with self.assertRaisesRegex(ValueError, "event_digest_invalid"):
            m.reconcile(broken)

    def test_no_fabricated_event_or_mutation(self):
        s = obs.empty_state()
        add(s, "2026-10-17T10:00:00Z", 10, 100)
        untouched = copy.deepcopy(s)
        self.assertEqual(m.reconcile(s), [])
        self.assertEqual(s, untouched)

    def test_invalid_ack_and_identity_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "lookout_identity_invalid"):
            m.alert_id("broken", "PRICE_COLLAPSE")
        with self.assertRaisesRegex(ValueError, "lookout_ack_identity_invalid"):
            m.reconcile(obs.empty_state(), already_alerted=["not-a-digest"])


if __name__ == "__main__":
    unittest.main()
