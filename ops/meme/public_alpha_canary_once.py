#!/usr/bin/env python3
"""TELEGRAM-ALPHA.07 — manually opted-in public Solana observation canary.

Uses SHARK's existing ALPHA.03 fixed public RPC/DEX clients. Never reads
Telegram, saves messages, trains a model, stores evidence, or sends trades.
A successful canary means a partial public-provider read, not proof of
authentic source timestamps, profitable alpha, sellability, or launch.
"""
from __future__ import annotations

import argparse
import json
import sys

import public_mint_dossier as public
import public_alpha_study as study

EXPECTED_CONFIRMATION = "PUBLIC-MARKET-ONLY"
CANARY_VERSION = "SHARK-PUBLIC-ALPHA-CANARY-07"


def classify_result(mint: str, raw: object) -> dict:
    """Finite, redacted health classification; do not leak provider payloads."""
    result = {
        "schema": CANARY_VERSION,
        "status": "QUARANTINED_PUBLIC_EVIDENCE_INCOMPLETE",
        "publicProviderReadAttempted": True,
        "knownReferenceAsset": mint in public.NATIVE_REFERENCE_MINTS,
        "parsedMintAccount": False,
        "eligibleMarketPair": False,
        "observationUsableForLocalPaperStudy": False,
        "providerOriginIndependentlyAttested": False,
        "futureAlphaPredictionVerified": False,
        "telegramDataUsed": False,
        "aiModelUsed": False,
        "historyBackfilled": False,
        "durablyPersisted": False,
        "canTrade": False,
        "canSign": False,
        "canBroadcast": False,
    }
    if not isinstance(raw, dict) or raw.get("mint") != mint:
        return result
    result["parsedMintAccount"] = isinstance(raw.get("mintAccount"), dict)
    result["eligibleMarketPair"] = isinstance(raw.get("marketPair"), dict)
    if result["knownReferenceAsset"]:
        # An expected mint address must NEVER substitute for actual evidence.
        # Empty/missing provider reads remain quarantined; even an intact
        # fixture-like receipt is only partial, not provider-authenticated.
        dossier = dict(raw)
        receipt = dossier.pop("receiptDigest", None)
        valid_reference = (
            dossier.get("schema") == public.SCHEMA
            and dossier.get("classification") == "KNOWN_REFERENCE_ASSET"
            and dossier.get("origin") == "EXPLICIT_OWNER_SELECTED_PUBLIC_MINT_NOT_TELEGRAM_HISTORY"
            and dossier.get("status") == "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED"
            and dossier.get("missingOrStale") == []
            and dossier.get("sourcesCryptographicallyAttested") is False
            and dossier.get("authority") == "RESEARCH_ONLY"
            and all(dossier.get(k) is False for k in (
                "canTrade", "canSign", "canBroadcast", "canAuthorizeLive"))
            and isinstance(receipt, str)
            and receipt == public._hash(dossier)
            and result["parsedMintAccount"]
            and result["eligibleMarketPair"]
        )
        if valid_reference:
            result["status"] = "KNOWN_REFERENCE_MINT_TEST_ONLY"
        return result
    try:
        study.exact_public_dossier(raw)
    except (ValueError, TypeError, KeyError, OverflowError):
        return result
    result["status"] = "PUBLIC_MARKET_PARTIAL_NOT_ALPHA"
    result["observationUsableForLocalPaperStudy"] = True
    return result


def run(mint: str, *, confirm: str, reader=public.manual_read_public_mint) -> dict:
    # Explicit known public mint; a Telegram message/username or private key
    # is not a valid input to the code path. No chat APIs are imported.
    if (confirm != EXPECTED_CONFIRMATION or not isinstance(mint, str)
            or not public.market.ADDRESS.fullmatch(mint)):
        raise ValueError("PUBLIC_CANARY_CONSENT_OR_MINT_INVALID")
    # Exact WSOL reference mints can test connectivity but never count as alpha.
    raw = reader(mint)
    return classify_result(mint, raw)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--public-mint", required=True)
    ap.add_argument("--confirm", required=True)
    args = ap.parse_args(argv)
    try:
        result = run(args.public_mint, confirm=args.confirm)
    except (ValueError, OSError, TypeError, KeyError, OverflowError):
        # No private IDs, token/account bytes, response bodies, or exception strings.
        result = {
            "schema": CANARY_VERSION, "status": "PUBLIC_READ_NOT_VERIFIED",
            "publicProviderReadAttempted": args.confirm == EXPECTED_CONFIRMATION,
            "telegramDataUsed": False, "aiModelUsed": False,
            "durablyPersisted": False, "canTrade": False,
            "canSign": False, "canBroadcast": False,
        }
        print(json.dumps(result, sort_keys=True))
        return 1
    print(json.dumps(result, sort_keys=True))
    # The workflow can report a known-reference success for transport validation
    # while clearly preventing reference inclusion in real candidate results.
    return 0 if result["status"] in (
        "KNOWN_REFERENCE_MINT_TEST_ONLY", "PUBLIC_MARKET_PARTIAL_NOT_ALPHA") else 2


if __name__ == "__main__":
    raise SystemExit(main())
