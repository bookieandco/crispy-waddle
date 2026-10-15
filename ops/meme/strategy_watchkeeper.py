"""Research-only SHARK strategy watchkeeper; neither execution nor strategy rewrite.

Owner reference ideas independently implemented without copying third-party source.
Consumes paired forward paper outcomes (not DexScreener spot marks).
Missing exits are never invented; recommendations require human review.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "SHARK-WATCHKEEPER-01"
ARM_CLASS = "DEX_ROUTE_COUNTERFACTUAL"
FILL_CLASS = "COUNTERFACTUAL_ONLY"
MIN_PAIRS = 30
MIN_COVERAGE = .80

def _time(value: object) -> dt.datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("watchkeeper_timestamp_utc_required")
    try:
        parsed = dt.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError("watchkeeper_timestamp_invalid") from exc
    if parsed.utcoffset() != dt.timedelta(0):
        raise ValueError("watchkeeper_timestamp_not_utc")
    return parsed

def _num(value: object, name: str, low: float, high: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
        raise ValueError(name + "_invalid")
    if not low <= value <= high:
        raise ValueError(name + "_outside_bounds")
    return float(value)

def _arm(value: object, cutoff: dt.datetime) -> tuple[bool, float | None, str | None]:
    if not isinstance(value, dict):
        raise ValueError("watchkeeper_arm_required")
    if value.get("sourceClass") != ARM_CLASS or value.get("authority") != "PAPER_SIMULATION_ONLY":
        raise ValueError("watchkeeper_unverified_source_class")
    if any(value.get(flag) is not False for flag in ("canExecute", "canSign", "canBroadcast")):
        raise ValueError("watchkeeper_authority_escalation")
    fill = value.get("fillStatus")
    if fill not in (FILL_CLASS, "NO_FILL", "UNSCORED"):
        raise ValueError("watchkeeper_fill_status_invalid")
    if fill != FILL_CLASS:
        if value.get("returnBps") is not None:
            raise ValueError("watchkeeper_unscored_cannot_have_return")
        return False, None, fill
    if value.get("exitFeasible") is not True:
        raise ValueError("watchkeeper_exit_route_missing")
    quote = value.get("quoteEvidenceIds")
    if not isinstance(quote, list) or not quote or any(not isinstance(q, str) or not q.strip() for q in quote):
        raise ValueError("watchkeeper_quote_evidence_required")
    if len(quote) != len(set(quote)):
        raise ValueError("watchkeeper_duplicate_quote_evidence")
    if _time(value.get("quoteAvailableAt")) > cutoff:
        raise ValueError("watchkeeper_future_quote")
    net_return = _num(value.get("returnBps"), "watchkeeper_return_bps", -10000, 10000)
    _num(value.get("costBps"), "watchkeeper_cost_bps", 0, 10000)
    return True, net_return, None

def assess(scorecard: dict) -> dict:
    if not isinstance(scorecard, dict) or scorecard.get("schema") != SCHEMA:
        raise ValueError("watchkeeper_schema_invalid")
    strategy, regime = scorecard.get("strategyId"), scorecard.get("marketRegime")
    if not all(isinstance(x, str) and x.strip() for x in (strategy, regime)):
        raise ValueError("watchkeeper_strategy_or_regime_required")
    hard_hash = scorecard.get("hardLimitsHash")
    if not isinstance(hard_hash, str) or len(hard_hash) != 64 or any(c not in "0123456789abcdef" for c in hard_hash):
        raise ValueError("watchkeeper_hard_limits_hash_invalid")
    asof = _time(scorecard.get("asOf"))
    rows = scorecard.get("pairs")
    if not isinstance(rows, list) or not rows or len(rows) > 5000:
        raise ValueError("watchkeeper_pairs_missing_or_excessive")
    seen_cases: set[str] = set()
    seen_groups: set[str] = set()
    seen_quotes: set[str] = set()
    deltas: list[float] = []
    no_fill = unscored = 0
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("watchkeeper_case_invalid")
        case_id, group = row.get("caseId"), row.get("independentGroup")
        if not all(isinstance(x, str) and x.strip() for x in (case_id, group)):
            raise ValueError("watchkeeper_case_provenance_required")
        if case_id in seen_cases or group in seen_groups:
            raise ValueError("watchkeeper_duplicate_or_dependent_case")
        seen_cases.add(case_id)
        seen_groups.add(group)
        if row.get("marketRegime") != regime:
            raise ValueError("watchkeeper_cross_regime_comparison")
        sealed = _time(row.get("sealedAt"))
        available = _time(row.get("outcomeAvailableAt"))
        if sealed >= available or available > asof:
            raise ValueError("watchkeeper_future_or_unsealed_outcome")
        cand_ok, cand_return, cand_gap = _arm(row.get("candidate"), available)
        base_ok, base_return, base_gap = _arm(row.get("baseline"), available)
        if cand_gap == "NO_FILL" or base_gap == "NO_FILL":
            no_fill += 1
        if not cand_ok or not base_ok:
            unscored += 1
            continue
        case_quotes = set(row["candidate"]["quoteEvidenceIds"] + row["baseline"]["quoteEvidenceIds"])
        if seen_quotes.intersection(case_quotes):
            raise ValueError("watchkeeper_reused_cross_case_evidence")
        seen_quotes.update(case_quotes)
        # Input returns are reported net of costs. Never substitute spot P&L.
        deltas.append(cand_return - base_return)
    n, total = len(deltas), len(rows)
    coverage = n / total
    reasons: list[str] = []
    if n < MIN_PAIRS:
        reasons.append("INSUFFICIENT_INDEPENDENT_PAIRED_CASES")
    if coverage < MIN_COVERAGE:
        reasons.append("UNSCORED_COVERAGE_TOO_HIGH")
    if no_fill:
        reasons.append("NO_FILL_CASES_PRESENT")
    if scorecard.get("safetyStatus") != "INDEPENDENT_VERIFIED":
        reasons.append("SAFETY_NOT_INDEPENDENTLY_VERIFIED")
    mean = sum(deltas) / n if n else None
    interval = None
    if n >= 2:
        variance = sum((x - mean) ** 2 for x in deltas) / (n - 1)
        half = 1.96 * math.sqrt(variance / n)
        interval = [round(mean - half, 2), round(mean + half, 2)]
    if not reasons and interval is not None and mean is not None and mean < -100 and interval[1] < 0:
        verdict = "PROPOSE_STRATEGY_REVIEW"
        reasons.append("SIMULATED_PAIRED_UNDERPERFORMANCE")
    elif reasons:
        verdict = "ABSTAIN"
    else:
        verdict = "MONITOR_SIMULATION"
        reasons.append("NO_ROBUST_UNDERPERFORMANCE_SIGNAL")
    result = {
        "schema": SCHEMA, "strategyId": strategy, "marketRegime": regime,
        "asOf": scorecard["asOf"], "hardLimitsHash": hard_hash,
        "totalPairs": total, "scoredPairs": n, "unscoredPairs": unscored,
        "noFillPairs": no_fill, "coverage": round(coverage, 5),
        "meanPairedDeltaBps": round(mean, 2) if mean is not None else None,
        "descriptive95IntervalBps": interval, "verdict": verdict,
        "reasonCodes": sorted(set(reasons)), "authority": "RESEARCH_ONLY",
        "canExecute": False, "canSign": False, "canBroadcast": False,
        "canRewriteRules": False, "canChangeHardLimits": False,
        "canAuthorizeLive": False, "tradePerformanceCertified": False,
    }
    result["receiptDigest"] = hashlib.sha256(json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    return result

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scorecard", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    data = json.loads(Path(args.scorecard).read_text(encoding="utf-8"))
    out = assess(data)
    dest = Path(args.out)
    if dest.resolve() == Path(args.scorecard).resolve():
        raise ValueError("watchkeeper_input_output_overlap")
    if dest.exists():
        raise ValueError("watchkeeper_no_overwrite")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"verdict": out["verdict"], "scoredPairs": out["scoredPairs"], "authority": out["authority"]}))

if __name__ == "__main__":
    main()
