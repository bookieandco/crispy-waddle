"""WATCHKEEPER.02: offline Solana direct-pool cost benchmark, NOT executable quotes.

Only pre-existing, independently attested point-in-time pool/quote observations.
No HTTP, RPC, trading keys, wallet, signers, orders, ONNX or account writes.
The benchmark computes *indicative* impact and minimum-output tolerance;
it cannot prove sellability, LP control, pool completeness or realized P&L.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from pathlib import Path

SCHEMA = "SHARK-DEX-COST-02"
VENUES = frozenset({"PUMPSWAP", "RAYDIUM_AMM_V4"})
MAX_AGE_S = 20

def stamp(s):
    if not isinstance(s, str) or not s.endswith("Z"):
        raise ValueError("dex_time_utc_required")
    try:
        x = dt.datetime.fromisoformat(s[:-1] + "+00:00")
    except ValueError as e:
        raise ValueError("dex_time_invalid") from e
    return x

def uint(value, name, positive=True):
    if not isinstance(value, str) or not value.isascii() or not value.isdecimal():
        raise ValueError(name + "_decimal_atoms_required")
    n = int(value)
    if (positive and n <= 0) or (not positive and n < 0) or n >= 2**128:
        raise ValueError(name + "_out_of_range")
    return n

def decimal(value, name, lo, hi):
    if not isinstance(value, str):
        raise ValueError(name + "_decimal_string_required")
    try:
        d = Decimal(value)
    except InvalidOperation as e:
        raise ValueError(name + "_invalid") from e
    if not d.is_finite() or not Decimal(lo) <= d <= Decimal(hi):
        raise ValueError(name + "_out_of_range")
    return d

def identify(obj, name):
    if not isinstance(obj, str) or not obj.strip() or len(obj) > 150:
        raise ValueError(name + "_required")
    return obj

def cost_quote(data: dict) -> dict:
    if not isinstance(data, dict) or data.get("schema") != SCHEMA:
        raise ValueError("dex_schema_invalid")
    at = stamp(data.get("decisionCutoff"))
    venue = data.get("venue")
    if venue not in VENUES or data.get("side") not in ("BUY", "SELL"):
        raise ValueError("dex_venue_or_side_invalid")
    if data.get("authority") != "RESEARCH_ONLY" or any(data.get(k) is not False for k in ("canExecute", "canSign", "canBroadcast")):
        raise ValueError("dex_authority_invalid")
    pool, quote = data.get("pool"), data.get("quote")
    if not isinstance(pool, dict) or not isinstance(quote, dict):
        raise ValueError("dex_pool_quote_required")
    if pool.get("attestation") != "INDEPENDENT_PROGRAM_AND_VAULT_MATCH":
        raise ValueError("dex_pool_attestation_missing")
    if pool.get("venue") != venue or quote.get("venue") != venue:
        raise ValueError("dex_venue_mismatch")
    if pool.get("curve") != "CONSTANT_PRODUCT_AMM":
        raise ValueError("dex_unknown_pool_math")
    trusted = data.get("trustedProgramIds")
    if not isinstance(trusted, dict) or not identify(trusted.get(venue), "dex_trusted_program"):
        raise ValueError("dex_trusted_program_missing")
    if pool.get("programId") != trusted[venue]:
        raise ValueError("dex_pool_program_untrusted")
    for key in ("poolAddress", "inputMint", "outputMint", "poolEvidenceId", "vaultInEvidenceId", "vaultOutEvidenceId"):
        identify(pool.get(key), "dex_" + key)
    if pool["inputMint"] == pool["outputMint"]:
        raise ValueError("dex_identical_assets")
    if len({pool["poolEvidenceId"], pool["vaultInEvidenceId"], pool["vaultOutEvidenceId"]}) != 3:
        raise ValueError("dex_reused_attestation")
    if quote.get("sourceType") != "DIRECT_POOL_READ_ONLY" or quote.get("quoteType") != "INDICATIVE":
        raise ValueError("dex_direct_quote_required")
    if quote.get("poolAddress") != pool["poolAddress"] or quote.get("inputMint") != pool["inputMint"] or quote.get("outputMint") != pool["outputMint"]:
        raise ValueError("dex_route_binding_mismatch")
    identify(quote.get("evidenceId"), "dex_quote_evidence")
    if quote["evidenceId"] in (pool["poolEvidenceId"], pool["vaultInEvidenceId"], pool["vaultOutEvidenceId"]):
        raise ValueError("dex_quote_evidence_not_independent")
    for key, obj in (("pool", pool), ("quote", quote), ("fx", data.get("solUsdPrice"))):
        if not isinstance(obj, dict):
            raise ValueError("dex_missing_" + key)
        observed = stamp(obj.get("observedAt"))
        available = stamp(obj.get("availableAt"))
        if observed > available or available > at or (at - available).total_seconds() > MAX_AGE_S:
            raise ValueError("dex_" + key + "_future_or_stale")
    fx = data["solUsdPrice"]
    if fx.get("sourceType") != "INDEPENDENT_SOL_USD_PRICE":
        raise ValueError("dex_fx_source_unverified")
    identify(fx.get("evidenceId"), "dex_fx_evidence")
    if fx["evidenceId"] in (pool["poolEvidenceId"], pool["vaultInEvidenceId"], pool["vaultOutEvidenceId"], quote["evidenceId"]):
        raise ValueError("dex_fx_reused_evidence")
    sol_usd = decimal(fx.get("priceUsd"), "dex_sol_usd", "0.00001", "1000000")
    input_usd = decimal(data.get("inputNotionalUsd"), "dex_input_usd", "0.00000001", "1000000")
    amount = uint(quote.get("inputAmountAtomic"), "dex_input")
    quote_out = uint(quote.get("outputAmountAtomic"), "dex_quote_output")
    min_out = uint(quote.get("minOutputAmountAtomic"), "dex_min_output")
    if min_out > quote_out:
        raise ValueError("dex_min_output_exceeds_quote")
    reserve_in = uint(pool.get("reserveInAtomic"), "dex_reserve_in")
    reserve_out = uint(pool.get("reserveOutAtomic"), "dex_reserve_out")
    fee = pool.get("poolFeeBps")
    if isinstance(fee, bool) or not isinstance(fee, int) or not 0 <= fee <= 1000:
        raise ValueError("dex_pool_fee_invalid")
    pool_slot, quote_slot = pool.get("slot"), quote.get("slot")
    if not isinstance(pool_slot, int) or isinstance(pool_slot, bool) or pool_slot <= 0 or quote_slot != pool_slot:
        raise ValueError("dex_slot_not_reconciled")
    if amount > reserve_in // 200:  # <=0.5% reserve participation, research ceiling
        return {"schema": SCHEMA, "status": "NO_FILL", "reason": "PARTICIPATION_LIMIT",
                "authority": "RESEARCH_ONLY", "canExecute": False, "canSign": False,
                "canBroadcast": False, "sellabilityProven": False}
    # Constant-product reference ONLY; do not apply to bonding curves / CLMMs.
    ideal_out = reserve_out * amount // reserve_in
    net_in = amount * (10000 - fee) // 10000
    cp_out = reserve_out * net_in // (reserve_in + net_in)
    if ideal_out <= 0 or cp_out <= 0:
        raise ValueError("dex_precision_unresolvable")
    if quote_out > ideal_out:
        return {"schema": SCHEMA, "status": "UNSCORED",
                "reason": "INDICATIVE_QUOTE_ABOVE_POOL_SPOT_REFERENCE",
                "authority": "RESEARCH_ONLY", "canExecute": False, "canSign": False,
                "canBroadcast": False, "sellabilityProven": False}
    base_impact = Decimal(ideal_out - quote_out) * 10000 / ideal_out
    quote_deviation = abs(Decimal(quote_out - cp_out) * 10000 / cp_out)
    tolerance = Decimal(quote_out - min_out) * 10000 / quote_out
    network_lamports = uint(data.get("networkFeeLamports"), "dex_network_fee", positive=False)
    priority_lamports = uint(data.get("priorityFeeLamports"), "dex_priority_fee", positive=False)
    network_usd = Decimal(network_lamports + priority_lamports) * sol_usd / Decimal(10**9)
    network_bps = network_usd * 10000 / input_usd
    # Max tolerance is the preselected acceptable worsening, NOT realized slip.
    projected = base_impact + network_bps
    def rounded(d):
        return str(d.quantize(Decimal("0.01"), rounding=ROUND_DOWN))
    result = {
        "schema": SCHEMA, "status": "INDICATIVE_COST_ONLY", "side": data["side"],
        "venue": venue, "poolAddress": pool["poolAddress"],
        "quoteEvidenceId": quote["evidenceId"], "poolEvidenceId": pool["poolEvidenceId"],
        "slot": pool_slot, "decisionCutoff": data["decisionCutoff"],
        "inputNotionalUsd": str(input_usd), "poolFeeBps": fee,
        "constantProductOutputAtomic": str(cp_out), "unimpactedOutputAtomic": str(ideal_out),
        "quotedOutputAtomic": str(quote_out), "minimumOutputAtomic": str(min_out),
        "quotedCostVsPoolSpotBps": rounded(base_impact),
        "constantProductQuoteDeviationBps": rounded(quote_deviation),
        "maximumUserToleranceBps": rounded(tolerance),
        "networkAndPriorityFeeUsd": rounded(network_usd),
        "networkAndPriorityFeeBps": rounded(network_bps),
        "indicativeCostBpsExcludingTolerance": rounded(projected),
        "exitFillClass": "UNVERIFIED", "sellabilityProven": False,
        "lpControlProven": False, "actualFillVerified": False,
        "authority": "RESEARCH_ONLY", "canExecute": False, "canSign": False, "canBroadcast": False
    }
    result["receiptDigest"] = hashlib.sha256(json.dumps(result, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return result

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    source, dest = Path(a.input), Path(a.out)
    if source.resolve() == dest.resolve() or dest.exists():
        raise ValueError("dex_overwrite_forbidden")
    result = cost_quote(json.loads(source.read_text(encoding="utf-8")))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(result["status"])

if __name__ == "__main__":
    main()
