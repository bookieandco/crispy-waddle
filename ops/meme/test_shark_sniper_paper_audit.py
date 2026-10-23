"""24–25 public-only prospective ledger and friction controls, no credentials."""
from __future__ import annotations
import json
from pathlib import Path
import tempfile
import unittest

import shark_live_intelligence as live
import shark_sniper_paper_audit as audit
from test_shark_live_intelligence import MINT, at, discovery, report


class PaperAuditTests(unittest.TestCase):
    def test_real_canonical_paper_tick_not_second_sniper(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = str(Path(tmp) / "paper.sqlite")
            profile, boost = discovery(MINT)
            monotonic = iter([1_000_000_000, 1_650_000_000])
            with live.local_database(file) as db:
                result = audit.audited_public_paper_cycle(db,
                    source_kind=audit.FIXED_PUBLIC_SOURCE,
                    now=at(seconds=7), profiles=profile, boosts=boost,
                    read_dossier=lambda _: report(),
                    clock_now=lambda: at(seconds=7),
                    monotonic_ns=lambda: next(monotonic))
                self.assertEqual(result["localCycleMs"], 650)
                self.assertEqual(result["publicDiscovery"]["newlyDiscovered"], 1)
                self.assertEqual(result["publicDiscovery"]["paper"]["openProspectiveCases"], 1)
                self.assertEqual(db.execute("SELECT count(*) FROM tokens").fetchone()[0], 1)
                self.assertTrue(result["sniperPaperReadyForReview"])
                self.assertIsNone(result["launchToDecisionMs"])
                self.assertFalse(result["endToEndLatencyCertified"])
                self.assertEqual(result["realTrades"], 0)
                self.assertFalse(result["canSign"])
                self.assertFalse(result["canTrade"])

    def test_rejects_telegram_origin_before_durable_case(self):
        with tempfile.TemporaryDirectory() as tmp:
            p,b=discovery(MINT)
            with live.local_database(str(Path(tmp) / "s.sqlite")) as db:
                for source in ("TELEGRAM", "BOT_INBOX", "PERSONAL_MESSAGES"):
                    with self.assertRaisesRegex(ValueError, "source_denied"):
                        audit.audited_public_paper_cycle(db,
                            source_kind=source, now=at(seconds=7),
                            profiles=p, boosts=b, read_dossier=lambda _: self.fail("RPC reached"),
                            clock_now=lambda: at(seconds=7))
                self.assertEqual(db.execute("SELECT count(*) FROM tokens").fetchone()[0], 0)

    def test_mixed_chat_metadata_denied(self):
        with tempfile.TemporaryDirectory() as tmp:
            p,b=discovery(MINT)
            p[0]["forward_origin"]={"private":True}
            with live.local_database(str(Path(tmp) / "s.sqlite")) as db:
                with self.assertRaisesRegex(ValueError, "mixed_private"):
                    audit.audited_public_paper_cycle(db,
                        source_kind=audit.FIXED_PUBLIC_SOURCE,
                        now=at(seconds=7), profiles=p, boosts=b,
                        read_dossier=lambda _: self.fail("RPC reached"),
                        clock_now=lambda: at(seconds=7))
                self.assertEqual(db.execute("SELECT count(*) FROM tokens").fetchone()[0],0)

    def test_hypothetical_round_trip_deducts_both_sides(self):
        free = audit.hypothetical_round_trip(
            entry_usd="1", exit_usd="1", trade_usd="100",
            entry_fee_bps=0, exit_fee_bps=0, entry_slippage_bps=0,
            exit_slippage_bps=0, network_priority_usd=0)
        costly = audit.hypothetical_round_trip(
            entry_usd="1", exit_usd="1", trade_usd="100",
            entry_fee_bps=100, exit_fee_bps=100,
            entry_slippage_bps=50, exit_slippage_bps=50,
            network_priority_usd="0.1", market_impact_bps=30)
        self.assertEqual(free["hypotheticalNetPnlUsd"],"0.000000")
        self.assertLess(float(costly["hypotheticalNetPnlUsd"]),-3.5)
        self.assertEqual(costly["disposition"],"ASSUMPTIONS_ONLY_NO_LIVE_QUOTES")
        for key in ("actualFeesMeasured","actualSlippageMeasured","fillOccurred",
                    "mevProtectionCertified","quoteAgeMeasured","canTrade",
                    "canSign","canBroadcast"):
            self.assertFalse(costly[key])

    def test_huge_fee_negative_nan_and_zero_rejected(self):
        base = dict(entry_usd="1", exit_usd="1", trade_usd="100",
                    entry_fee_bps=10, exit_fee_bps=10,
                    entry_slippage_bps=10, exit_slippage_bps=10,
                    network_priority_usd="0.01")
        for edits in ({"trade_usd":0},{"trade_usd":"NaN"},
                      {"entry_usd":"Infinity"},{"exit_usd":-1},
                      {"entry_fee_bps":12000},{"network_priority_usd":-1},
                      {"entry_fee_bps":10000},
                      {"trade_usd":True}):
            with self.subTest(edits=edits):
                with self.assertRaises(ValueError):
                    audit.hypothetical_round_trip(**dict(base,**edits))

    def test_bad_clock_cannot_claim_speed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p,b=discovery(MINT)
            with live.local_database(str(Path(tmp) / "s.sqlite")) as db:
                timer=iter([200,100])
                with self.assertRaisesRegex(ValueError,"timer_invalid"):
                    audit.audited_public_paper_cycle(db,
                        source_kind=audit.FIXED_PUBLIC_SOURCE,
                        now=at(seconds=7), profiles=p, boosts=b,
                        read_dossier=lambda _: report(), clock_now=lambda: at(seconds=7),
                        monotonic_ns=lambda: next(timer))


if __name__=="__main__":
    unittest.main()
