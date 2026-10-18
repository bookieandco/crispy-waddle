#!/usr/bin/env python3
"""SHARK-CLOSE.01/.02: reconcile first severe same-pair observations, read only.

Collector flags compare with the *immediately prior* observed sample; these
retrospective peak-to-current warnings deliberately answer a different
question. A missing collector flag is a comparison-window discrepancy, not
proof that collection failed or that liquidity was withdrawn on-chain.
No writes, wallets, signing, provider requests, money or strategy promotion.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("shark_close_observation", HERE / "experiment_7day.py")
obs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(obs)

SCHEMA = "SHARK-PEAK-LOOKOUT-01"
KIND_FIELDS = (
    ("PRICE_COLLAPSE", "priceUsd", "PRICE_COLLAPSE_NOT_PROVEN_RUG"),
    ("LIQUIDITY_VALUATION_DECLINE", "liquidityUsd", "SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG"),
)
CAVEAT = "NOT A CONFIRMED RUG / NOT TRADING ADVICE"


def _number(value, *, allow_zero: bool) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    result = float(value)
    if not math.isfinite(result) or result < 0 or (not allow_zero and result == 0):
        return None
    return result


def alert_id(mint: str, kind: str) -> str:
    """Stable mint + risk-kind identity, including after process restarts."""
    if kind not in {item[0] for item in KIND_FIELDS} or not obs.ADDRESS.fullmatch(mint):
        raise ValueError("lookout_identity_invalid")
    return hashlib.sha256(f"{SCHEMA}|{mint}|{kind}".encode("ascii")).hexdigest()


def reconcile(state: dict, *, since: str | None = None, already_alerted=()) -> list[dict]:
    """Return first qualifying historical comparisons, optionally after cutoff.

    Always scans the complete hash-verified ledger BEFORE filtering by cutoff
    or IDs. A crossing from an earlier audit cannot be resurrected by later
    observations. Mint+kind dedup allows newly qualifying liquidity on a mint
    whose price collapse has already been reported. Pairs never mix.
    """
    obs.audit(state)
    cutoff = obs.timestamp(since) if since is not None else None
    known = set(already_alerted)
    if any(not isinstance(key, str) or len(key) != 64 for key in known):
        raise ValueError("lookout_ack_identity_invalid")
    peaks: dict[tuple[str, str, str], dict] = {}
    first_seen: set[tuple[str, str]] = set()
    results: list[dict] = []
    for event in state["events"]:
        if event.get("type") != "MARKET_OBSERVATION":
            continue
        mint, pair = event["mint"], event["pair"]
        at = obs.timestamp(event["availableAt"])
        for kind, field, collector_flag in KIND_FIELDS:
            value = _number(event.get(field), allow_zero=field == "liquidityUsd")
            if value is None:
                continue
            key = (mint, pair, kind)
            previous = peaks.get(key)
            identity = (mint, kind)
            if (previous is not None and previous["value"] > 0
                    and at > previous["at"]
                    and value <= 0.30 * previous["value"]
                    and identity not in first_seen):
                first_seen.add(identity)
                identifier = alert_id(mint, kind)
                if (cutoff is None or at > cutoff) and identifier not in known:
                    results.append({
                        "schema": SCHEMA,
                        "alertId": identifier,
                        "kind": kind,
                        "mint": mint,
                        "pair": pair,
                        "baselineAt": previous["availableAt"],
                        "crossingAt": event["availableAt"],
                        "baselineValue": previous["value"],
                        "crossingValue": value,
                        "declinePct": round(100 * (1 - value / previous["value"]), 4),
                        "baselineDigest": previous["digest"],
                        "observationDigest": event["digest"],
                        "collectorFlagPresent": collector_flag in event.get("flags", []),
                        "comparison": "SAME_PAIR_HISTORICAL_PEAK_NOT_IMMEDIATE_PRIOR_SAMPLE",
                        "source": "dexscreener_public_api_indicative",
                        "caveat": CAVEAT,
                        "liquidityWithdrawalVerified": False,
                        "rugConfirmed": False,
                        "profitOrSellabilityVerified": False,
                        "authority": "RESEARCH_ONLY",
                        "canTrade": False,
                        "canLaunch": False,
                        "canSign": False,
                        "canBroadcast": False,
                    })
            if previous is None or value > previous["value"]:
                peaks[key] = {
                    "value": value, "at": at,
                    "availableAt": event["availableAt"], "digest": event["digest"],
                }
    return results


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", required=True)
    parser.add_argument("--since")
    parser.add_argument("--ack-file", help="Optional local JSON array of acknowledged alert IDs; never written")
    args = parser.parse_args()
    state = json.loads(Path(args.state).read_text(encoding="utf-8"))
    acks = json.loads(Path(args.ack_file).read_text(encoding="utf-8")) if args.ack_file else []
    if not isinstance(acks, list):
        raise ValueError("lookout_ack_list_required")
    print(json.dumps({"schema": SCHEMA, "alerts": reconcile(state, since=args.since,
                                                             already_alerted=acks)}, sort_keys=True))


if __name__ == "__main__":
    main()
