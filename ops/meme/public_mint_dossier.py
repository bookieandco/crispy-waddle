#!/usr/bin/env python3
"""TELEGRAM-ALPHA.03 — explicit public-mint evidence check, NOT Telegram ingestion.

This tool takes an owner-selected *public* Solana mint. It reuses SHARK's
existing mint-authority and DEX pair parsers. It never reads Telegram, touches
a wallet, writes a database, or turns claims into signals/trading authority.
Provider responses are not cryptographically attested; even a successful
read remains partial evidence, not a token safety or launch certification.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
MAX_PAIR_ROWS = 150
MAX_PAIR_BYTES = 250_000
MAX_AGE_SECONDS = 15 * 60
SCHEMA = "JHADINA-SHARK-PUBLIC-MINT-DOSSIER-V1"
# Exact deterministic reference classifications; keep aligned with the
# separately drafted Telegram preview's pinned native-mint list.
NATIVE_REFERENCE_MINTS = frozenset({
    "So11111111111111111111111111111111111111112",
    "9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP",
})


def _load_existing(name: str):
    spec = importlib.util.spec_from_file_location("alpha03_" + name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


market = _load_existing("experiment_7day")
risk = _load_existing("solana_risk_probe")
authority = _load_existing("token_authority_forensics")


def _hash(value: dict) -> str:
    return hashlib.sha256(json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")).hexdigest()


def compose_public_dossier(
    mint: str,
    *,
    account: dict | None,
    pairs: list | None,
    rpc_observed_at: str,
    rpc_available_at: str,
    market_observed_at: str,
    market_available_at: str,
    information_cutoff: str,
) -> dict:
    """Offline composition of owner-supplied public provider responses.

    Receipts are labelled unwitnessed: an injected fixture and a real public
    fetch have the same JSON shape. The calling environment must separately
    attest provider origin; no provenance, outcomes or claims are inferred.
    """
    if not isinstance(mint, str) or not market.ADDRESS.fullmatch(mint):
        raise ValueError("alpha03_solana_mint_invalid")
    cutoff = market.timestamp(information_cutoff)
    rpc_start = market.timestamp(rpc_observed_at)
    rpc_end = market.timestamp(rpc_available_at)
    dex_start = market.timestamp(market_observed_at)
    dex_end = market.timestamp(market_available_at)
    if not (rpc_start <= rpc_end <= cutoff and dex_start <= dex_end <= cutoff):
        raise ValueError("alpha03_future_or_inverted_evidence")
    if pairs is not None:
        if (not isinstance(pairs, list) or len(pairs) > MAX_PAIR_ROWS
                or len(json.dumps(pairs, allow_nan=False)) > MAX_PAIR_BYTES):
            raise ValueError("alpha03_market_payload_invalid")
    if account is not None and not isinstance(account, dict):
        raise ValueError("alpha03_rpc_payload_invalid")
    reference = mint in NATIVE_REFERENCE_MINTS
    findings: list[str] = []
    gap: list[str] = []
    account_part: dict | None = None
    market_part: dict | None = None
    rpc_age = (cutoff - rpc_end).total_seconds()
    market_age = (cutoff - dex_end).total_seconds()
    if rpc_age > MAX_AGE_SECONDS:
        gap.append("RPC_OBSERVATION_STALE")
    if market_age > MAX_AGE_SECONDS:
        gap.append("MARKET_OBSERVATION_STALE")

    if account is None:
        gap.append("RPC_MINT_ACCOUNT_MISSING")
    else:
        try:
            audited = authority.audit_mint_account(
                mint, account, observed_at=rpc_observed_at,
                available_at=rpc_available_at,
                information_cutoff=information_cutoff)
            # No raw RPC account, owner identities or provider error strings
            # are copied into the bounded public dossier.
            account_part = {
                "slot": audited["slot"], "tokenProgram": audited["tokenProgram"],
                "mintAuthorityActive": audited["mintAuthorityActive"],
                "freezeAuthorityActive": audited["freezeAuthorityActive"],
                "extensionCoverage": audited["extensionCoverage"],
                "extensionFamilies": audited["extensionFamilies"],
                "mintReceiptDigest": audited["mintReceiptDigest"],
                "authorityReceiptDigest": audited["receiptDigest"],
                "source": audited["evidenceSource"],
            }
            findings.extend(audited["findings"])
        except (ValueError, TypeError, KeyError, OverflowError):
            gap.append("RPC_MINT_UNPARSEABLE_OR_UNSUPPORTED")

    if pairs is None:
        gap.append("DEX_PAIRS_MISSING")
    else:
        try:
            selected = market.choose_pair(pairs, mint)
            if selected is None:
                gap.append("NO_ELIGIBLE_BASE_MINT_PAIR")
            else:
                market_part = {
                    "pair": selected["pair"],
                    "dex": selected["dex"],
                    "quoteMint": selected["quoteMint"],
                    "priceUsdIndicative": selected["priceUsd"],
                    "liquidityUsdProviderReported": selected["liquidityUsd"],
                    "pairCreatedAtProviderClaim": selected["pairCreatedAt"],
                    "source": "DEXSCREENER_PUBLIC_PAIR_RESPONSE_UNATTESTED",
                    "marketReceiptDigest": hashlib.sha256(json.dumps(
                        pairs, sort_keys=True, separators=(",", ":"),
                        allow_nan=False).encode()).hexdigest(),
                }
                if selected["liquidityUsd"] < market.PRICE_FLOOR_USD:
                    findings.append("LOW_PROVIDER_REPORTED_LIQUIDITY")
        except (ValueError, TypeError, KeyError, OverflowError):
            gap.append("DEX_PAIRS_INVALID_OR_UNVERIFIED")

    if reference:
        findings.append("KNOWN_NATIVE_REFERENCE_MINT_NOT_NEW_LAUNCH")
    if account_part is None or market_part is None:
        status = "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE"
    elif gap:
        status = "QUARANTINED_STALE_PUBLIC_EVIDENCE"
    else:
        status = "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED"
    item = {
        "schema": SCHEMA, "mint": mint,
        "classification": "KNOWN_REFERENCE_ASSET" if reference else "PUBLIC_MINT_RESEARCH_ONLY",
        "origin": "EXPLICIT_OWNER_SELECTED_PUBLIC_MINT_NOT_TELEGRAM_HISTORY",
        "informationCutoff": information_cutoff,
        "rpcObservedAt": rpc_observed_at, "rpcAvailableAt": rpc_available_at,
        "marketObservedAt": market_observed_at,
        "marketAvailableAt": market_available_at,
        "marketPair": market_part, "mintAccount": account_part,
        "findings": sorted(set(findings)),
        "missingOrStale": sorted(set(gap)),
        "status": status, "sourcesCryptographicallyAttested": False,
        "mintLaunchVerified": False, "migrationVerified": False,
        "liquidityControlVerified": False, "holderIndependenceVerified": False,
        "transferabilityVerified": False, "sellabilityVerified": False,
        "rugConfirmed": False, "executionQuoteVerified": False,
        "historicalAlphaScoreAvailable": False,
        "predictionOrBacktestAuthorized": False,
        "authority": "RESEARCH_ONLY", "canTrade": False, "canSign": False,
        "canBroadcast": False, "canAuthorizeLive": False,
    }
    return {**item, "receiptDigest": _hash(item)}


def manual_read_public_mint(mint: str) -> dict:
    """One explicit, bounded public GET + 1–2 readonly RPC requests.

    No Telegram content, state persistence, paid RPC or secret inputs.
    Failure cannot invent a mint, quote or liquidity. The caller must invoke
    this manually; scheduled/automatic code paths must not use this function.
    """
    if not isinstance(mint, str) or not market.ADDRESS.fullmatch(mint):
        raise ValueError("alpha03_solana_mint_invalid")
    rpc_start = market.now_utc()
    try:
        account = risk.rpc("getAccountInfo", [
            mint, {"encoding": "jsonParsed", "commitment": "confirmed"}])
    except (ValueError, OSError):
        account = None
    rpc_end = market.now_utc()
    dex_start = market.now_utc()
    try:
        pairs = market.fetch_json("/tokens/v1/solana/" + mint)
    except (ValueError, OSError):
        pairs = None
    dex_end = market.now_utc()
    return compose_public_dossier(
        mint, account=account, pairs=pairs,
        rpc_observed_at=rpc_start, rpc_available_at=rpc_end,
        market_observed_at=dex_start, market_available_at=dex_end,
        information_cutoff=market.now_utc(),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mint", required=True, help="Public Solana mint, not a wallet key")
    parser.add_argument("--read-public", action="store_true",
                        help="Opt into a one-shot read of fixed public endpoints")
    args = parser.parse_args(argv)
    if not args.read_public:
        print("ALPHA03_PUBLIC_READ_NOT_AUTHORIZED", file=sys.stderr)
        return 2
    try:
        report = manual_read_public_mint(args.mint)
        print(json.dumps(report, sort_keys=True, separators=(",", ":"), allow_nan=False))
        return 0
    except (ValueError, TypeError, OSError, OverflowError):
        # Do not print a provider exception, URL, raw payload or credential.
        print("ALPHA03_INVALID_OR_UNAVAILABLE_PUBLIC_EVIDENCE", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
