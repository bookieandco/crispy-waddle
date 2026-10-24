#!/usr/bin/env python3
"""Opt-in, read-only Jupiter quote timing diagnostic. Never signs or swaps."""
from __future__ import annotations
import argparse
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.jup.ag/swap/v1/quote"
SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
MAX_BYTES = 131072


class QuoteFailure(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise QuoteFailure("PROVIDER_REDIRECT_BLOCKED")


def validate_mint(value):
    if not isinstance(value, str) or not (32 <= len(value) <= 44) or any(
        c not in "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" for c in value
    ):
        raise ValueError("INVALID_BASE58_MINT")
    return value


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    return round(ordered[math.ceil(len(ordered) * fraction) - 1], 2)


def read_quote(input_mint, output_mint, amount, timeout_s=5.0, opener=None, clock=time.perf_counter):
    validate_mint(input_mint)
    validate_mint(output_mint)
    if input_mint == output_mint or type(amount) is not int or not (1 <= amount <= 10**18):
        raise ValueError("INVALID_QUOTE_ARGUMENTS")
    params = urllib.parse.urlencode({
        "inputMint": input_mint, "outputMint": output_mint,
        "amount": str(amount), "slippageBps": "50",
    })
    request = urllib.request.Request(BASE + "?" + params, headers={"Accept": "application/json"}, method="GET")
    fetch = opener or urllib.request.build_opener(NoRedirect()).open
    start = clock()
    try:
        with fetch(request, timeout=timeout_s) as response:
            if response.status != 200:
                raise QuoteFailure("PROVIDER_NON_200")
            payload = response.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise QuoteFailure("PROVIDER_RATE_LIMIT" if exc.code == 429 else "PROVIDER_HTTP_ERROR") from None
    except urllib.error.URLError:
        raise QuoteFailure("PROVIDER_UNREACHABLE") from None
    except (TimeoutError, OSError):
        raise QuoteFailure("PROVIDER_TRANSPORT_ERROR") from None
    elapsed_ms = round((clock() - start) * 1000, 2)
    if len(payload) > MAX_BYTES:
        raise QuoteFailure("PROVIDER_RESPONSE_TOO_LARGE")
    try:
        obj = json.loads(payload)
        if (not isinstance(obj, dict) or obj.get("inputMint") != input_mint or
            obj.get("outputMint") != output_mint or obj.get("inAmount") != str(amount) or
            not isinstance(obj.get("outAmount"), str) or
            not obj["outAmount"].isdigit() or int(obj["outAmount"]) <= 0 or
            not isinstance(obj.get("routePlan"), list) or not obj["routePlan"]):
            raise QuoteFailure("PROVIDER_QUOTE_INVALID")
        slot = obj.get("contextSlot")
        if type(slot) is not int or slot < 0:
            raise QuoteFailure("PROVIDER_SLOT_UNKNOWN")
        return {"elapsedMs": elapsed_ms, "outAmount": int(obj["outAmount"]), "contextSlot": slot}
    except (ValueError, KeyError, TypeError):
        raise QuoteFailure("PROVIDER_JSON_INVALID") from None


def run_probe(samples, pause_s, timeout_s, input_mint, output_mint, amount, quote=read_quote,
              clock=time.perf_counter, sleeper=time.sleep, emit=print):
    # Report the entire attempted-request denominator, including partial pairs.
    # Provider HTTP figures from a completed pair alone have survivorship bias.
    if (type(samples) is not int or not 1 <= samples <= 100 or
        type(pause_s) not in (float, int) or not math.isfinite(pause_s) or pause_s < 2.5 or
        type(timeout_s) not in (float, int) or not math.isfinite(timeout_s) or
        timeout_s <= 0 or timeout_s > 10 or type(amount) is not int or
        not 1 <= amount <= 10**18):
        raise ValueError("UNSAFE_PROBE_POLICY")
    validate_mint(input_mint)
    validate_mint(output_mint)
    if input_mint == output_mint:
        raise ValueError("DUPLICATE_MINT")
    last_request_start = None
    good, failed = [], {}
    attempts = {"forward": [], "reverse": []}
    failures_by_stage = {"forward": 0, "reverse": 0}
    for i in range(samples):
        pair_start = clock()
        result = {"kind": "QUOTE_PAIR_SAMPLE", "index": i + 1,
                  "observedAt": datetime.now(timezone.utc).isoformat(),
                  "authority": "READ_ONLY_RESEARCH", "canTrade": False, "canSign": False}
        stage = "forward"
        try:
            if last_request_start is not None:
                sleeper(max(0, pause_s - (clock() - last_request_start)))
            last_request_start = clock()
            try:
                forward = quote(input_mint, output_mint, amount, timeout_s)
            finally:
                delta = (clock() - last_request_start) * 1000
                if not math.isfinite(delta) or delta < 0:
                    raise QuoteFailure("MONOTONIC_CLOCK_INVALID")
                result["forwardAttemptMs"] = round(delta, 2)
                attempts["forward"].append(result["forwardAttemptMs"])
            forward_amount = forward.get("outAmount") if isinstance(forward, dict) else None
            if type(forward_amount) is not int or not 1 <= forward_amount <= 10**18:
                raise QuoteFailure("FORWARD_OUTPUT_AMOUNT_INVALID")
            stage = "reverse"
            sleeper(max(0, pause_s - (clock() - last_request_start)))
            last_request_start = clock()
            try:
                reverse = quote(output_mint, input_mint, forward_amount, timeout_s)
            finally:
                delta = (clock() - last_request_start) * 1000
                if not math.isfinite(delta) or delta < 0:
                    raise QuoteFailure("MONOTONIC_CLOCK_INVALID")
                result["reverseAttemptMs"] = round(delta, 2)
                attempts["reverse"].append(result["reverseAttemptMs"])
            if (not isinstance(reverse, dict) or
                type(reverse.get("outAmount")) is not int or reverse["outAmount"] <= 0):
                raise QuoteFailure("REVERSE_OUTPUT_AMOUNT_INVALID")
            result.update(status="OBSERVED_HYPOTHETICAL_ROUNDTRIP",
                          forwardHttpMs=forward["elapsedMs"], reverseHttpMs=reverse["elapsedMs"],
                          pairWallMs=round((clock() - pair_start) * 1000, 2),
                          forwardSlot=forward["contextSlot"], reverseSlot=reverse["contextSlot"])
            good.append(result)
        except QuoteFailure as exc:
            reason = str(exc)
            failed[reason] = failed.get(reason, 0) + 1
            failures_by_stage[stage] += 1
            result.update(status="NO_QUOTE", failureStage=stage, reason=reason,
                          pairWallMs=round((clock() - pair_start) * 1000, 2))
        emit(json.dumps(result, separators=(",", ":")))
    total = len(good) + sum(failed.values())
    metric = lambda values: {q: percentile(values, n) for q, n in
                             (("p50", 0.5), ("p95", 0.95), ("p99", 0.99))}
    summary = {"kind": "QUOTE_PAIR_SUMMARY", "requested": samples, "successfulPairs": len(good),
               "failures": failed, "failuresByStage": failures_by_stage,
               "requestAttempts": {"forward": len(attempts["forward"]),
                                   "reverse": len(attempts["reverse"])},
               "successRatio": round(len(good) / total, 4),
               "forwardAttemptMsIncludingErrors": metric(attempts["forward"]),
               "reverseAttemptMsIncludingErrors": metric(attempts["reverse"]),
               "forwardHttpMs": metric([r["forwardHttpMs"] for r in good]),
               "reverseHttpMs": metric([r["reverseHttpMs"] for r in good]),
               "pairWallMsIncludingPublicRatePacing": metric([r["pairWallMs"] for r in good]),
               "host": "REPORTING_HOST_ONLY", "observedTrades": 0, "observedExits": 0,
               "deadlineStatus": "INSUFFICIENT_PROSPECTIVE_HOST_DATA" if len(good) < 100 else "REVIEW_REQUIRED_NO_AUTOMATIC_SLA",
               "canTrade": False, "canSign": False}
    emit(json.dumps(summary, separators=(",", ":")))
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
        parser.error("explicit --approve-read-only required; no network was used")
    try:
        run_probe(args.samples, args.pause_seconds, args.timeout_seconds,
                  args.input_mint, args.output_mint, args.amount_atomic)
    except (ValueError, QuoteFailure) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    sys.exit(main())
