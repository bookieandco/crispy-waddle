"""Fail-closed tests for SHARK research-to-bot boundary (never a signer)."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("shark_paper_bot_handoff_test", HERE / "paper_bot_handoff.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
obs = m.obs
MINT = "So11111111111111111111111111111111111111112"
PAIR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
AT = "2026-10-18T12:00:00Z"


def state():
    s = obs.empty_state()
    obs.append_event(s, {
        "type": "MARKET_OBSERVATION",
        "mint": MINT, "pair": PAIR,
        "observedAt": AT, "availableAt": AT,
        "securityStatus": "UNVERIFIED", "canTrade": False,
        "priceUsd": 0.00001, "liquidityUsd": 3000,
        "flags": ["LOW_LIQUIDITY"],
    })
    return s


class BotHandoff(unittest.TestCase):
    def test_both_bots_get_same_provenance_but_no_authority(self):
        s = state()
        original = copy.deepcopy(s)
        for bot in ("SNIPER_BOT", "MEME_BOT"):
            receipt = m.build(s, bot=bot, mint=MINT, as_of=AT)
            self.assertEqual(receipt["sourceEventDigest"], s["events"][0]["digest"])
            self.assertEqual(receipt["sourceLedgerHead"], s["lastDigest"])
            self.assertEqual(receipt["proposalDisposition"], "DEFER")
            for key in ("canTrade", "canLaunch", "canSign", "canBroadcast",
                        "canSpend", "canChangePolicies", "operatorApprovalGranted",
                        "actualSellabilityVerified", "expectedProfitVerified"):
                self.assertIs(receipt[key], False, key)
            self.assertNotIn("privateKey", receipt)
            self.assertNotIn("wallet", receipt)
            self.assertIn("PAPER_", receipt["reviewType"])
        self.assertEqual(s, original)

    def test_bots_cannot_escalate_target_or_use_unknown_mint(self):
        s = state()
        with self.assertRaisesRegex(ValueError, "unknown_target"):
            m.build(s, bot="LIVE_TRADER", mint=MINT, as_of=AT)
        with self.assertRaisesRegex(ValueError, "invalid_mint"):
            m.build(s, bot="MEME_BOT", mint="token", as_of=AT)
        with self.assertRaisesRegex(ValueError, "no_available_observation"):
            m.build(s, bot="SNIPER_BOT", mint=PAIR, as_of=AT)

    def test_no_future_data_asof_and_no_out_of_window(self):
        s = state()
        with self.assertRaisesRegex(ValueError, "no_available_observation"):
            m.build(s, bot="MEME_BOT", mint=MINT, as_of="2026-10-18T11:59:00Z")
        with self.assertRaisesRegex(ValueError, "outside_study"):
            m.build(s, bot="SNIPER_BOT", mint=MINT, as_of="2026-10-21T01:00:00Z")

    def test_tampering_and_executable_events_fail_closed(self):
        s = state()
        bad = copy.deepcopy(s)
        bad["events"][0]["liquidityUsd"] = 1
        with self.assertRaisesRegex(ValueError, "event_digest_invalid"):
            m.build(bad, bot="SNIPER_BOT", mint=MINT, as_of=AT)
        obs.append_event(s, {
            "type": "SIGNED_TRANSACTION",
            "availableAt": AT, "observedAt": AT,
        })
        with self.assertRaisesRegex(ValueError, "executable_event"):
            m.build(s, bot="MEME_BOT", mint=MINT, as_of=AT)


if __name__ == "__main__":
    unittest.main()
