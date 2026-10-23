"""Offline public-source admission and Telegram quarantine tests."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import shark_public_source_gate as gate
from test_public_alpha_canary_once import MINT, WSOL, CONFIRM, receipt


class SourceGateTests(unittest.TestCase):
    def test_valid_public_mint_produces_paper_only_not_trade(self):
        seen = []
        result = gate.public_market_probe(
            source_kind=gate.ORIGIN, mint=MINT, confirm=CONFIRM,
            reader=lambda value: (seen.append(value), receipt())[1])
        self.assertEqual(seen, [MINT])
        self.assertEqual(result["status"], "PAPER_REVIEW_ELIGIBLE")
        self.assertEqual(result["marketProviderHealth"], "PUBLIC_MARKET_PARTIAL_NOT_ALPHA")
        for key in ("canSign", "canTrade", "canBroadcast", "telegramRead",
                    "telegramDataImported", "modelTraining", "persistentSignal",
                    "sharkAutomatedIngressStarted", "sniperTradeIntent",
                    "providerOriginIndependentlyAttested", "sourceIndependenceProvenByCode"):
            self.assertFalse(result[key])
        self.assertNotIn(MINT, json.dumps(result))

    def test_telegram_source_categories_denied_before_provider(self):
        calls = []
        for kind in (*gate.DISALLOWED_SOURCE_TYPES, "WHATSAPP", "UNKNOWN"):
            with self.assertRaises(gate.PublicOnlySourceDenied):
                gate.public_market_probe(source_kind=kind, mint=MINT,
                    confirm=CONFIRM, reader=lambda _: calls.append(True))
        self.assertEqual(calls, [])

    def test_known_reference_not_alpha(self):
        result = gate.public_market_probe(source_kind=gate.ORIGIN, mint=WSOL,
            confirm=CONFIRM, reader=lambda _: receipt(WSOL))
        self.assertEqual(result["status"], "QUARANTINED_OR_REFERENCE_ONLY")
        self.assertFalse(result["publicResearchPartial"])

    def test_missing_market_not_paper(self):
        result = gate.public_market_probe(source_kind=gate.ORIGIN, mint=MINT,
            confirm=CONFIRM, reader=lambda _: receipt(pair=False))
        self.assertEqual(result["status"], "QUARANTINED_OR_REFERENCE_ONLY")
        self.assertFalse(result["publicResearchPartial"])

    def test_wrong_consent_no_provider(self):
        called = []
        with self.assertRaisesRegex(ValueError, "CONSENT_OR_MINT_INVALID"):
            gate.public_market_probe(source_kind=gate.ORIGIN, mint=MINT,
                confirm="TELEGRAM", reader=lambda _: called.append(True))
        self.assertEqual(called, [])

    def test_malformed_mint_no_provider(self):
        called = []
        with self.assertRaises(ValueError):
            gate.public_market_probe(source_kind=gate.ORIGIN,
                mint="private-chat-text-not-a-public-mint", confirm=CONFIRM,
                reader=lambda _: called.append(True))
        self.assertEqual(called, [])

    def test_attested_only_by_owner_never_claim_source_proven(self):
        result = json.loads(gate.classify_without_network(
            source_kind=gate.ORIGIN, mint=MINT, confirm=CONFIRM,
            reader=lambda _: receipt()))
        self.assertFalse(result["sourceIndependenceProvenByCode"])
        self.assertFalse(result["providerOriginIndependentlyAttested"])


if __name__ == "__main__":
    unittest.main()
