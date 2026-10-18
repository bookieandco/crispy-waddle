"""ALPHA.07 public-canary: hermetic no-secret, no-Telegram, no-trade contract."""
from __future__ import annotations

import importlib.util
import io
import json
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("alpha07_canary", HERE / "public_alpha_canary_once.py")
canary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canary)

MINT = canary.public.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
PAIR = canary.public.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32)
WSOL = "So11111111111111111111111111111111111111112"
CONFIRM = canary.EXPECTED_CONFIRMATION
AT = "2026-10-17T23:58:00Z"


def receipt(mint=MINT, *, pair=True):
    info = {"supply": "100000000", "mintAuthority": None, "freezeAuthority": None}
    account = {"context": {"slot": 1234}, "value": {
        "owner": canary.public.authority.LEGACY,
        "data": {"parsed": {"type": "mint", "info": info}}}}
    market = ([{"chainId": "solana", "pairAddress": PAIR,
        "baseToken": {"address": mint},
        "quoteToken": {"address": WSOL}, "priceUsd": "0.001",
        "liquidity": {"usd": 20000}, "dexId": "pumpswap"}] if pair else [])
    return canary.public.compose_public_dossier(
        mint, account=account, pairs=market,
        rpc_observed_at=AT, rpc_available_at=AT,
        market_observed_at=AT, market_available_at=AT,
        information_cutoff=AT)


class CanaryTests(unittest.TestCase):
    def assert_safe(self, value):
        self.assertFalse(value["canTrade"])
        self.assertFalse(value["canSign"])
        self.assertFalse(value["canBroadcast"])
        self.assertFalse(value["telegramDataUsed"])
        self.assertFalse(value["aiModelUsed"])
        self.assertFalse(value["durablyPersisted"])

    def test_valid_partial_public_market_never_certifies_alpha(self):
        calls = []
        result = canary.run(MINT, confirm=CONFIRM, reader=lambda mint: (
            calls.append(mint), receipt())[1])
        self.assertEqual(calls, [MINT])
        self.assertEqual(result["status"], "PUBLIC_MARKET_PARTIAL_NOT_ALPHA")
        self.assertTrue(result["observationUsableForLocalPaperStudy"])
        self.assertFalse(result["providerOriginIndependentlyAttested"])
        self.assertFalse(result["futureAlphaPredictionVerified"])
        self.assert_safe(result)
        self.assertNotIn(MINT, json.dumps(result))

    def test_native_reference_is_not_an_alpha_candidate(self):
        result = canary.run(WSOL, confirm=CONFIRM,
                            reader=lambda _: receipt(WSOL))
        self.assertEqual(result["status"], "KNOWN_REFERENCE_MINT_TEST_ONLY")
        self.assertTrue(result["knownReferenceAsset"])
        self.assertFalse(result["observationUsableForLocalPaperStudy"])
        self.assert_safe(result)

    def test_missing_market_and_bad_evidence_stay_quarantined(self):
        incomplete = canary.run(MINT, confirm=CONFIRM, reader=lambda _: receipt(pair=False))
        self.assertEqual(incomplete["status"], "QUARANTINED_PUBLIC_EVIDENCE_INCOMPLETE")
        self.assertFalse(incomplete["eligibleMarketPair"])
        bad = canary.run(MINT, confirm=CONFIRM, reader=lambda _: {"mint": MINT})
        self.assertEqual(bad["status"], "QUARANTINED_PUBLIC_EVIDENCE_INCOMPLETE")
        self.assert_safe(incomplete)
        self.assert_safe(bad)

    def test_consent_and_bad_addresses_do_not_read_network(self):
        calls = []
        def reader(_):
            calls.append(True)
        for mint, confirm in ((MINT, "YES"), ("0x" + "a" * 40, CONFIRM),
                              ("PRIVATE-TELEGRAM-CHAT", CONFIRM)):
            with self.assertRaisesRegex(ValueError, "CONSENT_OR_MINT_INVALID"):
                canary.run(mint, confirm=confirm, reader=reader)
        self.assertEqual(calls, [])

    def test_wrong_mint_and_tampered_digest_never_promote(self):
        altered = receipt()
        altered["receiptDigest"] = "0" * 64
        result = canary.run(MINT, confirm=CONFIRM, reader=lambda _: altered)
        self.assertEqual(result["status"], "QUARANTINED_PUBLIC_EVIDENCE_INCOMPLETE")
        other = canary.run(MINT, confirm=CONFIRM, reader=lambda _: receipt(WSOL))
        self.assertEqual(other["status"], "QUARANTINED_PUBLIC_EVIDENCE_INCOMPLETE")

    def test_cli_mocks_reader_and_emits_only_redacted_summary(self):
        stream = io.StringIO()
        with patch.object(canary, "run", return_value=canary.classify_result(MINT, receipt())):
            with redirect_stdout(stream):
                exit_status = canary.main(["--public-mint", MINT, "--confirm", CONFIRM])
        self.assertEqual(exit_status, 0)
        output = stream.getvalue()
        self.assertIn("PUBLIC_MARKET_PARTIAL_NOT_ALPHA", output)
        self.assertNotIn(MINT, output)
        self.assertNotIn(PAIR, output)

    def test_cli_failure_cannot_print_provider_exception_or_secrets(self):
        stream = io.StringIO()
        with patch.object(canary, "run", side_effect=ValueError("PRIVATE_SESSION_SECRET")):
            with redirect_stdout(stream):
                code = canary.main(["--public-mint", MINT, "--confirm", CONFIRM])
        self.assertEqual(code, 1)
        self.assertIn("PUBLIC_READ_NOT_VERIFIED", stream.getvalue())
        self.assertNotIn("PRIVATE_SESSION_SECRET", stream.getvalue())
        self.assertNotIn(MINT, stream.getvalue())


if __name__ == "__main__":
    unittest.main()
