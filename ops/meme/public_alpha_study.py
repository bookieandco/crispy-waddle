#!/usr/bin/env python3
"""TELEGRAM-ALPHA.04–05: local prospective public-market receipts, no Telegram ingestion.

Accepts only a *separate*, explicitly owner-selected public-market dossier.
A local hash chain detects accidental modification, not forged provider/time
evidence. No model training, broker execution, wallet, database or scheduling.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys

from public_mint_dossier import SCHEMA as DOSSIER_SCHEMA, NATIVE_REFERENCE_MINTS
from public_mint_dossier import market

SCHEMA = "JHADINA-SHARK-ALPHA-PUBLIC-PAPER-STUDY-V1"
GENESIS = "0" * 64
MIN_HOURS, MAX_HOURS = 24, 30
MAX_EVENTS = 40
MAX_FILE_BYTES = 200_000


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def exact_public_dossier(raw: object) -> dict:
    """Read an offline public-only receipt; never accept private Telegram envelope."""
    if not isinstance(raw, dict) or raw.get("schema") != DOSSIER_SCHEMA:
        raise ValueError("alpha04_dossier_schema_invalid")
    d = dict(raw)
    receipt = d.pop("receiptDigest", None)
    if not isinstance(receipt, str) or len(receipt) != 64 or digest(d) != receipt:
        raise ValueError("alpha04_dossier_digest_invalid")
    mint = d.get("mint")
    if not isinstance(mint, str) or not market.ADDRESS.fullmatch(mint):
        raise ValueError("alpha04_mint_invalid")
    if (mint in NATIVE_REFERENCE_MINTS or
            d.get("classification") != "PUBLIC_MINT_RESEARCH_ONLY" or
            d.get("origin") != "EXPLICIT_OWNER_SELECTED_PUBLIC_MINT_NOT_TELEGRAM_HISTORY"):
        raise ValueError("alpha04_reference_or_source_prohibited")
    if (d.get("authority") != "RESEARCH_ONLY" or
            d.get("sourcesCryptographicallyAttested") is not False or
            d.get("historicalAlphaScoreAvailable") is not False or
            d.get("predictionOrBacktestAuthorized") is not False or
            any(d.get(key) is not False for key in (
                "canTrade", "canSign", "canBroadcast", "canAuthorizeLive",
                "mintLaunchVerified", "migrationVerified", "executionQuoteVerified",
                "sellabilityVerified", "rugConfirmed"))):
        raise ValueError("alpha04_dossier_authority_invalid")
    cutoff = market.timestamp(d.get("informationCutoff"))
    available = market.timestamp(d.get("marketAvailableAt"))
    if not available <= cutoff:
        raise ValueError("alpha04_future_dossier")
    # Inexact or retroactive provider snapshots must not be promoted to a mark.
    if d.get("status") != "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED" or d.get("missingOrStale"):
        raise ValueError("alpha04_incomplete_or_stale_dossier")
    p, a = d.get("marketPair"), d.get("mintAccount")
    if not isinstance(p, dict) or not isinstance(a, dict) or type(a.get("slot")) is not int or a["slot"] < 1:
        raise ValueError("alpha04_account_or_pair_missing")
    if (not isinstance(p.get("pair"), str) or not market.ADDRESS.fullmatch(p["pair"]) or
            p.get("source") != "DEXSCREENER_PUBLIC_PAIR_RESPONSE_UNATTESTED" or
            not isinstance(p.get("marketReceiptDigest"), str) or
            len(p["marketReceiptDigest"]) != 64):
        raise ValueError("alpha04_pair_provenance_invalid")
    price = p.get("priceUsdIndicative")
    liquidity = p.get("liquidityUsdProviderReported")
    if (isinstance(price, bool) or not isinstance(price, (int, float)) or
            not 0 < price < float("inf") or
            isinstance(liquidity, bool) or not isinstance(liquidity, (int, float)) or
            not 0 <= liquidity < float("inf")):
        raise ValueError("alpha04_price_or_liquidity_invalid")
    return raw


def append_event(study: dict, item: dict) -> None:
    if len(study["events"]) >= MAX_EVENTS:
        raise ValueError("alpha04_event_cap")
    event = dict(item)
    event["previousDigest"] = study["lastDigest"]
    event["digest"] = hashlib.sha256(study["lastDigest"].encode("ascii") + canonical(event)).hexdigest()
    study["events"].append(event)
    study["lastDigest"] = event["digest"]


def check_study(raw: object) -> dict:
    if not isinstance(raw, dict) or raw.get("schema") != SCHEMA:
        raise ValueError("alpha04_study_schema_invalid")
    study = raw
    if (study.get("authority") != "RESEARCH_ONLY" or
            any(study.get(k) is not False for k in ("canTrade", "canSign", "canBroadcast",
                                                   "canAuthorizeLive", "backtestAuthorized")) or
            study.get("source") != "OWNER_SELECTED_PUBLIC_MARKET_NO_TELEGRAM" or
            not isinstance(study.get("events"), list) or
            not 1 <= len(study["events"]) <= MAX_EVENTS):
        raise ValueError("alpha04_study_authority_invalid")
    first = study["events"][0]
    if (not isinstance(first, dict) or first.get("type") != "FIRST_UNATTESTED_PUBLIC_MARKET" or
            study.get("mint") != first.get("mint") or
            study.get("pair") != first.get("pair") or
            study.get("openedAt") != first.get("availableAt")):
        raise ValueError("alpha04_first_receipt_invalid")
    previous = GENESIS
    seen = set()
    last_time = None
    terminal = False
    for index, event in enumerate(study["events"]):
        if not isinstance(event, dict) or event.get("previousDigest") != previous:
            raise ValueError("alpha04_event_chain_broken")
        payload = {k: v for k, v in event.items() if k != "digest"}
        if hashlib.sha256(previous.encode("ascii") + canonical(payload)).hexdigest() != event.get("digest"):
            raise ValueError("alpha04_event_digest_invalid")
        if event.get("mint") != study["mint"] or not isinstance(event.get("dossierDigest"), str):
            raise ValueError("alpha04_event_identity_invalid")
        at = market.timestamp(event.get("availableAt"))
        if (last_time is not None and at < last_time) or event["dossierDigest"] in seen:
            raise ValueError("alpha04_event_replay_or_clock")
        seen.add(event["dossierDigest"])
        last_time = at
        if index > 0 and event.get("type") not in (
            "PRE_HORIZON_OBSERVATION", "PRICE_ONLY_UNVERIFIED", "HORIZON_MISSED_CENSORED",
            "PAIR_SWITCH_CENSORED", "MISSING_OR_INVALID_EVIDENCE_CENSORED"):
            raise ValueError("alpha04_event_type_invalid")
        if terminal:
            raise ValueError("alpha04_event_after_terminal")
        if index > 0 and event["type"] != "PRE_HORIZON_OBSERVATION":
            terminal = True
        previous = event["digest"]
    if study.get("lastDigest") != previous or (study.get("status") == "CLOSED") != terminal:
        raise ValueError("alpha04_head_or_status_invalid")
    if study.get("status") not in ("OPEN", "CLOSED"):
        raise ValueError("alpha04_status_invalid")
    return study


def start(dossier: dict) -> dict:
    d = exact_public_dossier(dossier)
    item = d["marketPair"]
    study = {
        "schema": SCHEMA, "caseId": "public-paper:" + digest({
            "mint": d["mint"], "dossier": d["receiptDigest"]
        }), "mint": d["mint"], "pair": item["pair"],
        "openedAt": d["marketAvailableAt"], "status": "OPEN",
        "source": "OWNER_SELECTED_PUBLIC_MARKET_NO_TELEGRAM",
        "authority": "RESEARCH_ONLY", "canTrade": False, "canSign": False,
        "canBroadcast": False, "canAuthorizeLive": False,
        "backtestAuthorized": False, "events": [], "lastDigest": GENESIS,
    }
    append_event(study, {
        "type": "FIRST_UNATTESTED_PUBLIC_MARKET", "mint": d["mint"],
        "pair": item["pair"], "priceUsd": item["priceUsdIndicative"],
        "liquidityUsd": item["liquidityUsdProviderReported"],
        "availableAt": d["marketAvailableAt"], "dossierDigest": d["receiptDigest"],
    })
    return check_study(study)


def follow(study: dict, dossier: dict) -> dict:
    """Only same-pool, *after* prospectively sealed first observation can grade."""
    current = copy.deepcopy(check_study(study))
    if current["status"] != "OPEN":
        raise ValueError("alpha05_case_already_closed")
    d = exact_public_dossier(dossier)
    if d["mint"] != current["mint"]:
        raise ValueError("alpha05_mint_mismatch")
    if d["receiptDigest"] in {e["dossierDigest"] for e in current["events"]}:
        return current  # Exactly repeated read has no new evidence.
    now = market.timestamp(d["marketAvailableAt"])
    opened = market.timestamp(current["openedAt"])
    last = market.timestamp(current["events"][-1]["availableAt"])
    if now <= last:
        raise ValueError("alpha05_nonprospective_clock")
    hours = (now - opened).total_seconds() / 3600
    p = d["marketPair"]
    event = {
        "mint": d["mint"], "pair": p["pair"],
        "priceUsd": p["priceUsdIndicative"],
        "liquidityUsd": p["liquidityUsdProviderReported"],
        "availableAt": d["marketAvailableAt"], "dossierDigest": d["receiptDigest"],
        "ageHours": round(hours, 6), "priceOnlyReturnPct": None,
        "hypotheticalNetReturnPct": None, "executableReturnPct": None,
        "realizedFill": False, "feesKnown": False, "authority": "RESEARCH_ONLY",
    }
    if p["pair"] != current["pair"]:
        event["type"] = "PAIR_SWITCH_CENSORED"
    elif hours > MAX_HOURS:
        event["type"] = "HORIZON_MISSED_CENSORED"
    elif hours < MIN_HOURS:
        event["type"] = "PRE_HORIZON_OBSERVATION"
    else:
        first = current["events"][0]
        event["type"] = "PRICE_ONLY_UNVERIFIED"
        event["priceOnlyReturnPct"] = round(
            100 * (p["priceUsdIndicative"] / first["priceUsd"] - 1), 6)
        event["liquidityChangePctReported"] = round(
            100 * (p["liquidityUsdProviderReported"] /
                   first["liquidityUsd"] - 1), 6) if first["liquidityUsd"] > 0 else None
    append_event(current, event)
    if event["type"] != "PRE_HORIZON_OBSERVATION":
        current["status"] = "CLOSED"
    return check_study(current)


def summary(study: dict) -> dict:
    s = check_study(study)
    terminal = s["events"][-1] if s["status"] == "CLOSED" else None
    graded = terminal is not None and terminal["type"] == "PRICE_ONLY_UNVERIFIED"
    return {
        "schema": SCHEMA + "-SUMMARY", "caseId": s["caseId"], "mint": s["mint"],
        "originalPair": s["pair"], "observations": len(s["events"]),
        "status": s["status"], "mark": terminal["type"] if terminal else "UNSCORED_OPEN",
        "priceOnlyReturnPct": terminal["priceOnlyReturnPct"] if graded else None,
        "liquidityChangePctReported": terminal.get("liquidityChangePctReported") if graded else None,
        "hypotheticalNetReturnPct": None, "executableReturnPct": None,
        "feeAdjustedPerformance": None, "profitableTradeCount": None,
        "providerEvidenceCryptographicallyAttested": False,
        "outcomesVerifiedIndependentOfSource": False,
        "paperEntries": 0, "executedTrades": 0, "canTrade": False,
        "authority": "RESEARCH_ONLY", "lastDigest": s["lastDigest"],
    }


def read_json(path: str) -> dict:
    p = Path(path)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("alpha05_input_missing_or_unsafe")
    value = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("alpha05_input_not_object")
    return value


def write_new(path: str, payload: dict) -> None:
    """Exclusive local output with fsync. No overwriting an old sealed case."""
    target = Path(path)
    data = canonical(payload) + b"\n"
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("alpha05_study_size_cap")
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
    except BaseException:
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["begin", "follow", "summary"])
    parser.add_argument("--dossier", help="Locally saved ALPHA.03 public-only JSON")
    parser.add_argument("--study", help="Existing local paper study JSON")
    parser.add_argument("--out", help="New output path, must not exist")
    args = parser.parse_args(argv)
    try:
        if args.mode == "begin" and args.dossier and args.out and not args.study:
            write_new(args.out, start(read_json(args.dossier)))
        elif args.mode == "follow" and args.dossier and args.study and args.out:
            write_new(args.out, follow(read_json(args.study), read_json(args.dossier)))
        elif args.mode == "summary" and args.study and not args.out and not args.dossier:
            print(json.dumps(summary(read_json(args.study)), sort_keys=True))
        else:
            raise ValueError("alpha05_cli_arguments_invalid")
        return 0
    except (ValueError, OSError, TypeError, KeyError, OverflowError, json.JSONDecodeError):
        print("ALPHA05_LOCAL_RESEARCH_INPUT_INVALID_OR_UNAVAILABLE", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
