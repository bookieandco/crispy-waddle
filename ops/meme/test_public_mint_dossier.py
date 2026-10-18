"""TELEGRAM-ALPHA.03 hermetic public-market receipts; no Telegram or network calls."""
from __future__ import annotations

import copy
import importlib.util
import io
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch
import unittest

HERE = Path(__file__).resolve().parent
sp = importlib.util.spec_from_file_location("alpha03_subject", HERE / "public_mint_dossier.py")
subject = importlib.util.module_from_spec(sp)
sp.loader.exec_module(subject)

MINT = subject.authority.native.pool_probe.encode_pubkey(bytes([9]) * 32)
WSOL = "So11111111111111111111111111111111111111112"
RPC_AT = "2026-10-17T23:58:00Z"
DEX_AT = "2026-10-17T23:58:30Z"
CUT = "2026-10-17T23:59:00Z"
OLD = "2026-10-17T23:30:00Z"
TOKEN_PROGRAM = subject.authority.LEGACY


def account(*, owner=TOKEN_PROGRAM, mint_auth=False, freeze=False, extensions=None):
    info = {"supply": "100000000", "mintAuthority": MINT if mint_auth else None,
            "freezeAuthority": MINT if freeze else None}
    if extensions is not None:
        info["extensions"] = extensions
    return {"context": {"slot": 12345}, "value": {
        "owner": owner, "data": {"parsed": {"type": "mint", "info": info}}}}


def pair(*, mint=MINT, quote=WSOL, usd=12000, price="0.001", chain="solana"):
    return {"chainId": chain, "pairAddress": subject.authority.native.pool_probe.encode_pubkey(bytes([8]) * 32),
            "baseToken": {"address": mint}, "quoteToken": {"address": quote},
            "priceUsd": price, "liquidity": {"usd": usd},
            "dexId": "pumpswap", "pairCreatedAt": 1790000000000}


def compose(mint=MINT, blob=None, pairs=None, rpc_at=RPC_AT,
            dex_at=DEX_AT, cutoff=CUT):
    return subject.compose_public_dossier(
        mint, account=account() if blob is None else blob,
        pairs=[pair(mint=mint)] if pairs is None else pairs,
        rpc_observed_at=rpc_at, rpc_available_at=rpc_at,
        market_observed_at=dex_at, market_available_at=dex_at,
        information_cutoff=cutoff)


class PublicMarketDossierTests(unittest.TestCase):
    def assert_no_authority(self, result):
        for flag in ("canTrade", "canSign", "canBroadcast", "canAuthorizeLive",
                     "mintLaunchVerified", "migrationVerified", "sellabilityVerified",
                     "executionQuoteVerified", "historicalAlphaScoreAvailable",
                     "predictionOrBacktestAuthorized", "rugConfirmed"):
            self.assertIs(result[flag], False, flag)
        self.assertEqual(result["authority"], "RESEARCH_ONLY")

    def test_mint_and_dex_receipts_are_partial_not_trade_or_alpha(self):
        raw = account()
        pairs = [pair()]
        original = copy.deepcopy((raw, pairs))
        got = compose(blob=raw, pairs=pairs)
        self.assertEqual(got["status"], "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED")
        self.assertEqual(got["classification"], "PUBLIC_MINT_RESEARCH_ONLY")
        self.assertEqual(got["mintAccount"]["slot"], 12345)
        self.assertEqual(got["marketPair"]["priceUsdIndicative"], .001)
        self.assertEqual(got["marketPair"]["liquidityUsdProviderReported"], 12000)
        self.assertFalse(got["sourcesCryptographicallyAttested"])
        self.assert_no_authority(got)
        self.assertEqual((raw,pairs), original)
        self.assertEqual(got["receiptDigest"], compose(blob=raw,pairs=pairs)["receiptDigest"])

    def test_wsol_reference_cannot_become_new_launch(self):
        got = compose(mint=WSOL, blob=account(), pairs=[pair(mint=WSOL)])
        self.assertEqual(got["classification"], "KNOWN_REFERENCE_ASSET")
        self.assertIn("KNOWN_NATIVE_REFERENCE_MINT_NOT_NEW_LAUNCH", got["findings"])
        self.assert_no_authority(got)

    def test_unmatched_or_missing_dex_cannot_claim_market(self):
        missing = compose(pairs=[pair(mint=WSOL)])
        self.assertIsNone(missing["marketPair"])
        self.assertIn("NO_ELIGIBLE_BASE_MINT_PAIR", missing["missingOrStale"])
        self.assertEqual(missing["status"], "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE")
        unavailable = compose(pairs=[])
        self.assertIsNone(unavailable["marketPair"])
        self.assert_no_authority(unavailable)

    def test_missing_mint_and_bad_program_fail_closed(self):
        missing = subject.compose_public_dossier(
            MINT, account=None, pairs=[pair()],
            rpc_observed_at=RPC_AT, rpc_available_at=RPC_AT,
            market_observed_at=DEX_AT, market_available_at=DEX_AT,
            information_cutoff=CUT)
        self.assertIn("RPC_MINT_ACCOUNT_MISSING", missing["missingOrStale"])
        self.assert_no_authority(missing)
        invalid = compose(blob=account(owner="not-a-program"))
        self.assertIn("RPC_MINT_UNPARSEABLE_OR_UNSUPPORTED", invalid["missingOrStale"])
        self.assertIsNone(invalid["mintAccount"])

    def test_permissions_and_fee_extensions_are_unverified_findings(self):
        blob = account(owner=subject.authority.TOKEN_2022,
                       mint_auth=True, freeze=True,
                       extensions=[{"extension": "transferFeeConfig", "state": {}}])
        got = compose(blob=blob)
        for code in ("MINT_AUTHORITY_ACTIVE", "FREEZE_AUTHORITY_ACTIVE",
                     "TRANSFER_FEE_CONTROL", "FEE_SCHEDULE_AMOUNTS_NOT_ATTESTED"):
            self.assertIn(code, got["findings"])
        self.assert_no_authority(got)

    def test_time_staleness_future_and_reverse_clocks(self):
        stale = compose(rpc_at=OLD)
        self.assertIn("RPC_OBSERVATION_STALE", stale["missingOrStale"])
        self.assertEqual(stale["status"], "QUARANTINED_STALE_PUBLIC_EVIDENCE")
        self.assert_no_authority(stale)
        with self.assertRaisesRegex(ValueError, "future_or_inverted"):
            compose(dex_at="2026-10-18T00:20:00Z")
        with self.assertRaisesRegex(ValueError, "future_or_inverted"):
            subject.compose_public_dossier(
                MINT, account=account(), pairs=[pair()],
                rpc_observed_at=CUT, rpc_available_at=RPC_AT,
                market_observed_at=DEX_AT, market_available_at=DEX_AT,
                information_cutoff=CUT)

    def test_invalid_chain_large_response_and_invalid_mint(self):
        bad_chain = compose(pairs=[pair(chain="ethereum")])
        self.assertIsNone(bad_chain["marketPair"])
        with self.assertRaisesRegex(ValueError, "solana_mint_invalid"):
            compose(mint="0x" + "ab" * 20)
        with self.assertRaisesRegex(ValueError, "market_payload_invalid"):
            compose(pairs=[pair()] * 151)

    def test_liquidity_is_reported_not_an_execution_or_safety_proof(self):
        got = compose(pairs=[pair(usd=9999)])
        self.assertIn("LOW_PROVIDER_REPORTED_LIQUIDITY", got["findings"])
        self.assertIs(got["liquidityControlVerified"], False)
        self.assert_no_authority(got)

    def test_explicit_cli_optin_and_exact_readonly_endpoints(self):
        with patch.object(subject, "manual_read_public_mint") as reader:
            with redirect_stderr(io.StringIO()) as errors:
                result = subject.main(["--mint", MINT])
            self.assertEqual(result, 2)
            self.assertIn("PUBLIC_READ_NOT_AUTHORIZED", errors.getvalue())
            reader.assert_not_called()
        calls = []
        times = iter([RPC_AT, RPC_AT, DEX_AT, DEX_AT, CUT])
        def fake_rpc(method, params):
            calls.append((method, params[0]))
            return account()
        def fake_market(path):
            calls.append(("DEX_GET", path))
            return [pair()]
        with patch.object(subject.risk, "rpc", side_effect=fake_rpc), patch.object(
                subject.market, "fetch_json", side_effect=fake_market), patch.object(
                subject.market, "now_utc", side_effect=lambda: next(times)):
            got = subject.manual_read_public_mint(MINT)
        self.assertEqual(calls, [
            ("getAccountInfo", MINT), ("DEX_GET", "/tokens/v1/solana/" + MINT)])
        self.assertEqual(got["status"], "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED")
        self.assert_no_authority(got)

    def test_provider_failure_stays_quarantined(self):
        times = iter([RPC_AT, RPC_AT, DEX_AT, DEX_AT, CUT])
        with patch.object(subject.risk, "rpc", side_effect=ValueError("private stack trace")), patch.object(
                subject.market, "fetch_json", side_effect=ValueError("bad quote")), patch.object(
                subject.market, "now_utc", side_effect=lambda: next(times)):
            got = subject.manual_read_public_mint(MINT)
        self.assertIsNone(got["mintAccount"])
        self.assertIsNone(got["marketPair"])
        self.assertIn("RPC_MINT_ACCOUNT_MISSING", got["missingOrStale"])
        self.assertIn("DEX_PAIRS_MISSING", got["missingOrStale"])
        self.assertEqual(got["status"], "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE")
        self.assertNotIn("private stack trace", str(got))
        self.assert_no_authority(got)


if __name__ == "__main__":
    unittest.main()
