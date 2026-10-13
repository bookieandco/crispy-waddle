"""Strict quote-based memecoin paper simulator and Shadow grading.

This is an OFFLINE library. No wallet, signer, broadcast or transaction methods.
Live DexScreener spot prices are not DEX execution quotes, so the current seven-day
observer CANNOT call simulate_buy. A future Money-owned, separately reviewed caller
must supply point-in-time route evidence and independently completed safety gates.
"""
from __future__ import annotations

import datetime as dt
import math

REQUIRED_COVERAGE = frozenset({
    "sellability", "liquidityControl", "authorityControl",
    "holderIndependence", "operatorIdentity"
})
MAX_NOTIONAL_USD = 50.0
MAX_PARTICIPATION = 0.005
MAX_QUOTE_AGE_SECONDS = 20


def parse_z(v: str) -> dt.datetime:
    if not isinstance(v, str) or not v.endswith("Z"):
        raise ValueError("timestamp_utc_required")
    parsed = dt.datetime.fromisoformat(v[:-1] + "+00:00")
    if parsed.tzinfo != dt.timezone.utc:
        raise ValueError("timestamp_utc_required")
    return parsed


def nonnegative(value, name: str, positive: bool = False) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        raise ValueError(name + "_invalid")
    if value < 0 or (positive and value == 0):
        raise ValueError(name + "_invalid")
    return float(value)


def admit_paper_case(safety: dict, information_cutoff: str) -> dict:
    """Fail closed. No social claim or partial Solana mint metadata grants paper entry."""
    cutoff = parse_z(information_cutoff)
    coverage = safety.get("coverage", {})
    checks = safety.get("checks", {})
    reasons = []
    if not isinstance(coverage, dict):
        raise ValueError("coverage_invalid")
    missing = sorted(REQUIRED_COVERAGE - {k for k, v in coverage.items() if v is True})
    if missing:
        reasons.append("CRITICAL_COVERAGE_MISSING:" + ",".join(missing))
    if safety.get("rugDisposition") != "ALLOW_CANDIDATE":
        reasons.append("RUG_DEFENSE_NOT_CLEAR")
    if safety.get("sourceIntegrity") != "INDEPENDENT_VERIFIED":
        reasons.append("SOURCE_INTEGRITY_NOT_VERIFIED")
    if safety.get("moneyRiskDisposition") != "PAPER_APPROVED":
        reasons.append("MONEY_CORE_PAPER_APPROVAL_MISSING")
    if safety.get("executionAuthority") is not False or safety.get("canSign") is not False:
        reasons.append("UNSAFE_EXECUTION_AUTHORITY")
    if not isinstance(checks, dict) or set(checks) < REQUIRED_COVERAGE:
        reasons.append("CHECK_RECEIPTS_MISSING")
    else:
        for key in REQUIRED_COVERAGE:
            proof = checks[key]
            if not isinstance(proof, dict) or not proof.get("evidenceId") or not proof.get("source"):
                reasons.append("CHECK_RECEIPT_INVALID:" + key)
                continue
            try:
                available = parse_z(proof["availableAt"])
                if available > cutoff:
                    reasons.append("FUTURE_EVIDENCE:" + key)
            except (ValueError, KeyError, TypeError):
                reasons.append("INVALID_CHECK_TIMESTAMP:" + key)
    return {
        "admission": "REJECT" if reasons else "REVIEWED_PAPER_CANDIDATE",
        "reasons": sorted(set(reasons)), "authority": "PAPER_SIMULATION_ONLY",
        "canExecute": False, "canSign": False, "canBroadcast": False,
    }


def validate_quote(quote: dict, *, mint: str, side: str, at: str) -> dict:
    """Execution-route snapshot, not spot price. Unsigned + bounded age + exact pair."""
    if not isinstance(quote, dict):
        raise ValueError("quote_missing")
    if quote.get("mint") != mint or quote.get("side") != side or not quote.get("pair"):
        raise ValueError("route_identity_invalid")
    if quote.get("sourceType") != "DEX_ROUTE_QUOTE" or quote.get("routeVerified") is not True:
        raise ValueError("executable_quote_not_verified")
    if not isinstance(quote.get("evidenceId"), str) or not quote["evidenceId"].strip():
        raise ValueError("quote_evidence_missing")
    observed = parse_z(quote["observedAt"])
    available = parse_z(quote["availableAt"])
    chosen = parse_z(at)
    if not observed <= available <= chosen or (chosen - available).total_seconds() > MAX_QUOTE_AGE_SECONDS:
        raise ValueError("quote_stale_or_future")
    price = nonnegative(quote["priceUsdPerToken"], "price", positive=True)
    depth = nonnegative(quote["routeCapacityUsd"], "depth", positive=True)
    fee = nonnegative(quote["feeBps"], "fee")
    slip = nonnegative(quote["slippageBps"], "slippage")
    impact = nonnegative(quote["impactBps"], "impact")
    if any(x > 10000 for x in (fee, slip, impact)):
        raise ValueError("cost_over_100_percent")
    return {"price": price, "capacity": depth, "costBps": fee + slip + impact,
            "pair": quote["pair"], "evidenceId": quote["evidenceId"]}


def simulate_buy(mint: str, notional_usd: float, balance_usd: float,
                 decision: dict, safety: dict, quote: dict, at: str) -> dict:
    """Simulation only. Caller must not treat a route receipt as a real filled order."""
    if decision.get("authority") != "PAPER_SIMULATION_ONLY" or decision.get("admission") != "REVIEWED_PAPER_CANDIDATE":
        raise ValueError("paper_entry_not_admitted")
    if admit_paper_case(safety, at)["admission"] != "REVIEWED_PAPER_CANDIDATE":
        raise ValueError("paper_safety_not_currently_verified")
    notional = nonnegative(notional_usd, "notional", positive=True)
    balance = nonnegative(balance_usd, "balance")
    if notional > MAX_NOTIONAL_USD or notional > balance:
        raise ValueError("paper_risk_budget_exceeded")
    route = validate_quote(quote, mint=mint, side="BUY", at=at)
    if notional > route["capacity"] * MAX_PARTICIPATION:
        raise ValueError("liquidity_participation_exceeded")
    if route["costBps"] >= 10000:
        raise ValueError("paper_buy_not_fundable")
    token_qty = (notional * (1 - route["costBps"] / 10000)) / route["price"]
    return {
        "action": "BUY", "mint": mint, "pair": route["pair"], "asOf": at,
        "notionalUsd": round(notional, 8), "tokens": token_qty,
        "costUsdModeled": round(notional * route["costBps"] / 10000, 8),
        "evidenceIds": [route["evidenceId"]], "fillClass": "COUNTERFACTUAL_ONLY",
        "authority": "PAPER_SIMULATION_ONLY", "canExecute": False,
        "canSign": False, "canBroadcast": False
    }


def simulate_exit(entry: dict, quote: dict | None, at: str) -> dict:
    """Do not fabricate sells when a token is illiquid or a real route is absent."""
    if entry.get("authority") != "PAPER_SIMULATION_ONLY" or entry.get("action") != "BUY":
        raise ValueError("paper_entry_invalid")
    if quote is None:
        return {"action": "NO_FILL", "reason": "SELL_ROUTE_MISSING", "canExecute": False}
    try:
        route = validate_quote(quote, mint=entry["mint"], side="SELL", at=at)
    except (ValueError, KeyError, TypeError):
        return {"action": "NO_FILL", "reason": "SELL_ROUTE_UNVERIFIED", "canExecute": False}
    if route["pair"] != entry["pair"]:
        return {"action": "NO_FILL", "reason": "PAIR_MIGRATION_NOT_RECONCILED", "canExecute": False}
    gross = entry["tokens"] * route["price"]
    if gross > route["capacity"] * MAX_PARTICIPATION or route["costBps"] >= 10000:
        return {"action": "NO_FILL", "reason": "EXIT_CAPACITY_INSUFFICIENT", "canExecute": False}
    net = gross * (1 - route["costBps"] / 10000)
    return {"action": "SELL", "netProceedsUsdModeled": round(net, 8),
            "pnlUsdModeled": round(net - entry["notionalUsd"], 8),
            "fillClass": "COUNTERFACTUAL_ONLY", "evidenceIds": [route["evidenceId"]],
            "canExecute": False, "canSign": False, "canBroadcast": False}


def grade_no_trade(price_only_mark: dict | None) -> dict:
    """A shadow control arm; never equate spot markouts with executable profits."""
    if not price_only_mark or not isinstance(price_only_mark.get("up"), bool):
        return {"grade": "UNSCORED", "reason": "CENSORED_OR_MISSING_HORIZON", "isExecutablePnL": False}
    return {
        "grade": "MISSED_SPOT_UP_MOVE" if price_only_mark["up"] else "AVOIDED_SPOT_NON_UP_MOVE",
        "isExecutablePnL": False, "isRugClassification": False,
        "authority": "SHADOW_LEARNING_ONLY", "canAuthorizeLive": False
    }
