#!/usr/bin/env python3
"""SHARK V2 owner-host quote latency probe. Read-only GET; no wallet/order execution."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.jup.ag/swap/v2/order"
SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
MAX_BYTES = 131072
ROUTERS = frozenset({"metis", "jupiterz", "dflow", "okx"})
MODES = frozenset({"ultra", "manual"})
MAX_AMOUNT = 10**18


class QuoteFailure(Exception):
    """Bounded, safe code only. Never include raw response, IDs or credentials."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise QuoteFailure("PROVIDER_REDIRECT_BLOCKED")


def validate_mint(value):
    if not isinstance(value, str) or not 32 <= len(value) <= 44 or any(
        c not in "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" for c in value
    ):
        raise ValueError("INVALID_BASE58_MINT")
    return value


def positive_amount(value):
    return type(value) is int and 1 <= value <= MAX_AMOUNT


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[math.ceil(len(ordered) * fraction) - 1], 2)


def parse_v2_quote(payload, input_mint, output_mint, amount):
    """V2 /order quote-only: no taker and mandatory null transaction."""
    if not isinstance(payload, dict):
        raise QuoteFailure("PROVIDER_QUOTE_INVALID")
    if payload.get("transaction", "MISSING") is not None or payload.get("taker") is not None:
        raise QuoteFailure("PROVIDER_TRANSACTION_OR_TAKER_UNEXPECTED")
    if "errorCode" in payload or payload.get("error"):
        raise QuoteFailure("PROVIDER_QUOTE_ERROR")
    if (payload.get("inputMint") != input_mint or
        payload.get("outputMint") != output_mint or
        payload.get("inAmount") != str(amount)):
        raise QuoteFailure("PROVIDER_QUOTE_IDENTITY_INVALID")
    out = payload.get("outAmount")
    if (not isinstance(out, str) or not out.isascii() or not out.isdecimal() or
        len(out) > 19 or not positive_amount(int(out))):
        raise QuoteFailure("PROVIDER_OUTPUT_AMOUNT_INVALID")
    router = payload.get("router")
    mode = payload.get("mode")
    request_id = payload.get("requestId")
    if (router not in ROUTERS or mode not in MODES or
        not isinstance(request_id, str) or not 1 <= len(request_id) <= 256):
        raise QuoteFailure("PROVIDER_V2_PROVENANCE_INVALID")
    # RFQ routers may lack Metis routePlan or contextSlot. Do NOT require either.
    route_plan = payload.get("routePlan")
    if route_plan is not None and (not isinstance(route_plan, list) or len(route_plan) > 64):
        raise QuoteFailure("PROVIDER_ROUTE_PLAN_INVALID")
    fee_bps = payload.get("feeBps")
    if fee_bps is not None and (
        type(fee_bps) not in (int, float) or
        not math.isfinite(fee_bps) or not 0 <= fee_bps <= 10000
    ):
        raise QuoteFailure("PROVIDER_FEE_INVALID")
    return {
        "outAmount": int(out),
        "router": router,
        "mode": mode,
        "feeBps": fee_bps,
        "requestIdDigest": hashlib.sha256(request_id.encode("utf-8")).hexdigest()[:16],
        "routePlanPresent": bool(route_plan),
        "providerContextSlot": None,
        "contextSlotAvailable": False,
    }


def read_quote(input_mint, output_mint, amount, timeout_s=5.0, opener=None,
               clock=time.perf_counter, api_key=None):
    validate_mint(input_mint)
    validate_mint(output_mint)
    if input_mint == output_mint or not positive_amount(amount):
        raise ValueError("INVALID_QUOTE_ARGUMENTS")
    if (type(timeout_s) not in (int, float) or not math.isfinite(timeout_s)
            or not 0 < timeout_s <= 10):
        raise ValueError("UNSAFE_PROBE_POLICY")
    # Only exact 3 parameters; no taker, receiver, payer, swap mode, transaction or POST.
    query = urllib.parse.urlencode({
        "inputMint": input_mint, "outputMint": output_mint, "amount": str(amount)
    })
    headers = {"Accept": "application/json"}
    if api_key is not None:
        if not isinstance(api_key, str) or not 1 <= len(api_key) <= 512 or any(
            ord(c) < 33 or ord(c) > 126 for c in api_key
        ):
            raise ValueError("INVALID_API_KEY")
        headers["x-api-key"] = api_key
    request = urllib.request.Request(BASE + "?" + query, headers=headers, method="GET")
    fetch = opener if opener is not None else urllib.request.build_opener(NoRedirect()).open
    started = clock()
    try:
        with fetch(request, timeout=timeout_s) as response:
            if response.status != 200:
                raise QuoteFailure("PROVIDER_NON_200")
            raw = response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise QuoteFailure("PROVIDER_RATE_LIMIT") from None
        if exc.code in (401, 403):
            raise QuoteFailure("PROVIDER_AUTH_REQUIRED") from None
        raise QuoteFailure("PROVIDER_HTTP_ERROR") from None
    except urllib.error.URLError:
        raise QuoteFailure("PROVIDER_UNREACHABLE") from None
    except (TimeoutError, OSError):
        raise QuoteFailure("PROVIDER_TRANSPORT_ERROR") from None
    duration = (clock() - started) * 1000
    if not math.isfinite(duration) or duration < 0:
        raise QuoteFailure("MONOTONIC_CLOCK_INVALID")
    if len(raw) > MAX_BYTES:
        raise QuoteFailure("PROVIDER_RESPONSE_TOO_LARGE")
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise QuoteFailure("PROVIDER_JSON_INVALID") from None
    checked = parse_v2_quote(payload, input_mint, output_mint, amount)
    return {**checked, "elapsedMs": round(duration, 2)}


def run_probe(samples, pause_s, timeout_s, input_mint, output_mint, amount,
              quote=read_quote, clock=time.perf_counter, sleeper=time.sleep, emit=print):
    if (type(samples) is not int or not 1 <= samples <= 100 or
        type(pause_s) not in (float, int) or not math.isfinite(pause_s) or pause_s < 2.5 or
        type(timeout_s) not in (float, int) or not math.isfinite(timeout_s) or
        not 0 < timeout_s <= 10 or not positive_amount(amount)):
        raise ValueError("UNSAFE_PROBE_POLICY")
    validate_mint(input_mint)
    validate_mint(output_mint)
    if input_mint == output_mint:
        raise ValueError("DUPLICATE_MINT")
    last_start = None
    good, failed = [], {}
    durations = {"forward": [], "reverse": []}
    stage_failures = {"forward": 0, "reverse": 0}
    for index in range(samples):
        pair_started = clock()
        record = {"kind": "V2_QUOTE_PAIR_SAMPLE", "index": index + 1,
                  "observedAt": datetime.now(timezone.utc).isoformat(),
                  "authority": "READ_ONLY_RESEARCH", "canTrade": False,
                  "canSign": False, "canBroadcast": False}
        stage = "forward"
        try:
            if last_start is not None:
                sleeper(max(0, pause_s - (clock() - last_start)))
            last_start = clock()
            try:
                forward = quote(input_mint, output_mint, amount, timeout_s)
            finally:
                elapsed = (clock() - last_start) * 1000
                if not math.isfinite(elapsed) or elapsed < 0:
                    raise QuoteFailure("MONOTONIC_CLOCK_INVALID")
                record["forwardAttemptMs"] = round(elapsed, 2)
                durations["forward"].append(record["forwardAttemptMs"])
            if not isinstance(forward, dict) or not positive_amount(forward.get("outAmount")):
                raise QuoteFailure("FORWARD_OUTPUT_AMOUNT_INVALID")
            stage = "reverse"
            sleeper(max(0, pause_s - (clock() - last_start)))
            last_start = clock()
            try:
                reverse = quote(output_mint, input_mint, forward["outAmount"], timeout_s)
            finally:
                elapsed = (clock() - last_start) * 1000
                if not math.isfinite(elapsed) or elapsed < 0:
                    raise QuoteFailure("MONOTONIC_CLOCK_INVALID")
                record["reverseAttemptMs"] = round(elapsed, 2)
                durations["reverse"].append(record["reverseAttemptMs"])
            if not isinstance(reverse, dict) or not positive_amount(reverse.get("outAmount")):
                raise QuoteFailure("REVERSE_OUTPUT_AMOUNT_INVALID")
            record.update(status="OBSERVED_HYPOTHETICAL_ROUNDTRIP",
                          forwardHttpMs=forward["elapsedMs"], reverseHttpMs=reverse["elapsedMs"],
                          pairWallMs=round((clock() - pair_started) * 1000, 2),
                          forwardRouter=forward["router"], reverseRouter=reverse["router"],
                          forwardFeeBps=forward.get("feeBps"), reverseFeeBps=reverse.get("feeBps"),
                          contextSlotAvailable=False)
            good.append(record)
        except QuoteFailure as exc:
            reason = str(exc)
            failed[reason] = failed.get(reason, 0) + 1
            stage_failures[stage] += 1
            record.update(status="NO_QUOTE", reason=reason, failureStage=stage)
        emit(json.dumps(record, separators=(",", ":"), allow_nan=False))
    metric = lambda v: {label: percentile(v, q) for label, q in
                        (("p50", .5), ("p95", .95), ("p99", .99))}
    summary = {"kind": "V2_QUOTE_PAIR_SUMMARY", "requested": samples,
               "successfulPairs": len(good), "failures": failed,
               "failuresByStage": stage_failures,
               "requestAttempts": {k: len(v) for k, v in durations.items()},
               "successRatio": round(len(good) / samples, 4),
               "forwardAttemptMsIncludingErrors": metric(durations["forward"]),
               "reverseAttemptMsIncludingErrors": metric(durations["reverse"]),
               "forwardHttpMs": metric([r["forwardHttpMs"] for r in good]),
               "reverseHttpMs": metric([r["reverseHttpMs"] for r in good]),
               "pairWallMsIncludingPublicRatePacing": metric([r["pairWallMs"] for r in good]),
               "provider": "JUPITER_SWAP_V2_ORDER_QUOTE_ONLY",
               "sourceSlotAvailable": False, "observedTrades": 0, "observedExits": 0,
               "deadlineStatus": "INSUFFICIENT_PROSPECTIVE_HOST_DATA" if len(good) < 100
                   else "REVIEW_REQUIRED_NO_AUTOMATIC_SLA",
               "canTrade": False, "canSign": False, "canBroadcast": False}
    emit(json.dumps(summary, separators=(",", ":"), allow_nan=False))
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approve-read-only", action="store_true")
    parser.add_argument("--samples", type=int, default=4)
    parser.add_argument("--pause-seconds", type=float, default=2.5)
    parser.add_argument("--timeout-seconds", type=float, default=5.0)
    parser.add_argument("--input-mint", default=SOL)
    parser.add_argument("--output-mint", default=USDC)
    parser.add_argument("--amount-atomic", type=int, default=10000000)
    args = parser.parse_args(argv)
    if not args.approve_read_only:
        parser.error("explicit --approve-read-only required; no network used")
    try:
        # Explicit optional key only; keyless is default. Never print key.
        key = os.environ.get("JUPITER_API_KEY")
        def quote(a, b, amt, timeout):
            return read_quote(a, b, amt, timeout, api_key=key)
        run_probe(args.samples, args.pause_seconds, args.timeout_seconds,
                  args.input_mint, args.output_mint, args.amount_atomic, quote=quote)
    except (ValueError, QuoteFailure) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    sys.exit(main())
