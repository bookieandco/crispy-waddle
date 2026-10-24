#!/usr/bin/env python3
"""Offline structural audit of a bounded V2 quote smoke JSONL capture.

Does NOT attest the actual worker, provider authenticity or trading readiness.
No network, no writes, no source promotion, no deadlines.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime
import json
import math
from pathlib import Path
import sys


class InvalidCapture(ValueError):
    pass


def safe_json(line):
    try:
        return json.loads(line, parse_constant=lambda _v: (_ for _ in ()).throw(ValueError()))
    except (TypeError, ValueError, json.JSONDecodeError):
        raise InvalidCapture("SMOKE_JSON_INVALID") from None


def valid_milliseconds(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 120000


def evaluate_jsonl(raw):
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 131072:
        raise InvalidCapture("SMOKE_CAPTURE_SIZE_INVALID")
    lines = raw.splitlines()
    # The dedicated entrypoint emits exactly one non-JSON startup marker.
    # It is not cryptographic proof of deployment identity.
    if lines and lines[0] == "SHARK_QUOTE_WORKER_READ_ONLY_ONESHOT_STARTED":
        lines = lines[1:]
    if len(lines) < 2 or len(lines) > 5:
        raise InvalidCapture("SMOKE_CAPTURE_LENGTH_INVALID")
    parsed = [safe_json(line) for line in lines]
    if any(type(item) is not dict for item in parsed):
        raise InvalidCapture("SMOKE_RECORD_SHAPE_INVALID")
    samples = parsed[:-1]
    summary = parsed[-1]
    n = len(samples)
    if not 1 <= n <= 4 or summary.get("kind") != "V2_QUOTE_PAIR_SUMMARY":
        raise InvalidCapture("SMOKE_SUMMARY_MISSING")
    if summary.get("requested") != n or summary.get("provider") != "JUPITER_SWAP_V2_ORDER_QUOTE_ONLY":
        raise InvalidCapture("SMOKE_SUMMARY_PROVENANCE_INVALID")
    if any(summary.get(k) is not False for k in ("canTrade", "canSign", "canBroadcast")):
        raise InvalidCapture("SMOKE_FINANCIAL_AUTHORITY_INVALID")
    if summary.get("observedTrades") != 0 or summary.get("observedExits") != 0:
        raise InvalidCapture("SMOKE_EXECUTION_CLAIM_INVALID")
    failures = Counter()
    by_stage = Counter({"forward": 0, "reverse": 0})
    successes = 0
    reverse_attempts = 0
    for index, item in enumerate(samples, 1):
        if item.get("kind") != "V2_QUOTE_PAIR_SAMPLE" or item.get("index") != index:
            raise InvalidCapture("SMOKE_SAMPLE_SEQUENCE_INVALID")
        if item.get("authority") != "READ_ONLY_RESEARCH" or any(
            item.get(k) is not False for k in ("canTrade", "canSign", "canBroadcast")
        ):
            raise InvalidCapture("SMOKE_SAMPLE_AUTHORITY_INVALID")
        ts = item.get("observedAt")
        try:
            d = datetime.fromisoformat(ts)
            if d.tzinfo is None or d.utcoffset() is None:
                raise ValueError()
        except (TypeError, ValueError, OverflowError):
            raise InvalidCapture("SMOKE_TIMESTAMP_INVALID") from None
        if not valid_milliseconds(item.get("forwardAttemptMs")):
            raise InvalidCapture("SMOKE_FORWARD_DURATION_MISSING")
        if "reverseAttemptMs" in item:
            if not valid_milliseconds(item["reverseAttemptMs"]):
                raise InvalidCapture("SMOKE_REVERSE_DURATION_INVALID")
            reverse_attempts += 1
        state = item.get("status")
        if state == "OBSERVED_HYPOTHETICAL_ROUNDTRIP":
            successes += 1
            if "reverseAttemptMs" not in item or any(
                not valid_milliseconds(item.get(key))
                for key in ("forwardHttpMs", "reverseHttpMs", "pairWallMs")
            ) or item.get("contextSlotAvailable") is not False:
                raise InvalidCapture("SMOKE_SUCCESS_EVIDENCE_INVALID")
        elif state == "NO_QUOTE":
            stage, reason = item.get("failureStage"), item.get("reason")
            if stage not in ("forward", "reverse") or not isinstance(reason, str):
                raise InvalidCapture("SMOKE_FAILURE_SHAPE_INVALID")
            if reason not in {
                "PROVIDER_REDIRECT_BLOCKED", "PROVIDER_NON_200",
                "PROVIDER_RATE_LIMIT", "PROVIDER_AUTH_REQUIRED",
                "PROVIDER_HTTP_ERROR", "PROVIDER_UNREACHABLE",
                "PROVIDER_TRANSPORT_ERROR", "MONOTONIC_CLOCK_INVALID",
                "PROVIDER_RESPONSE_TOO_LARGE", "PROVIDER_JSON_INVALID",
                "PROVIDER_QUOTE_INVALID", "PROVIDER_TRANSACTION_OR_TAKER_UNEXPECTED",
                "PROVIDER_QUOTE_ERROR", "PROVIDER_QUOTE_IDENTITY_INVALID",
                "PROVIDER_OUTPUT_AMOUNT_INVALID", "PROVIDER_V2_PROVENANCE_INVALID",
                "PROVIDER_ROUTE_PLAN_INVALID", "PROVIDER_FEE_INVALID",
                "FORWARD_OUTPUT_AMOUNT_INVALID", "REVERSE_OUTPUT_AMOUNT_INVALID",
            }:
                raise InvalidCapture("SMOKE_UNRECOGNIZED_FAILURE_INVALID")
            if stage == "reverse" and "reverseAttemptMs" not in item:
                raise InvalidCapture("SMOKE_REVERSE_FAILURE_WITHOUT_ATTEMPT")
            if stage == "forward" and "reverseAttemptMs" in item:
                raise InvalidCapture("SMOKE_FORWARD_FAILURE_WITH_REVERSE_ATTEMPT")
            failures[reason] += 1
            by_stage[stage] += 1
        else:
            raise InvalidCapture("SMOKE_STATUS_INVALID")
    expected_attempts = {"forward": n, "reverse": reverse_attempts}
    if (summary.get("successfulPairs") != successes or
        summary.get("requestAttempts") != expected_attempts or
        summary.get("failures") != dict(failures) or
        summary.get("failuresByStage") != dict(by_stage) or
        summary.get("successRatio") != round(successes / n, 4)):
        raise InvalidCapture("SMOKE_DENOMINATOR_MISMATCH")
    if summary.get("deadlineStatus") != "INSUFFICIENT_PROSPECTIVE_HOST_DATA":
        raise InvalidCapture("SMOKE_DEADLINE_PROMOTION_BLOCKED")
    return {
        "kind": "SHARK_QUOTE_V2_SMOKE_AUDIT",
        "structuralCheck": "PASS",
        "networkEvidenceDisposition": (
            "ALL_HYPOTHETICAL_PAIRS_REPORTED_UNVERIFIED" if successes == n else
            "PARTIAL_HYPOTHETICAL_PAIRS_WITH_FAILURES" if successes else
            "NO_COMPLETE_PAIR_OBSERVED"
        ),
        "sampleCount": n,
        "hypotheticalCompletePairs": successes,
        "failedPairs": n-successes,
        "failedForward": by_stage["forward"],
        "failedReverse": by_stage["reverse"],
        "runtimeAuthenticated": False,
        "independentProviderAttested": False,
        "deadlineCertified": False,
        "canTrade": False,
        "canSign": False,
        "canBroadcast": False,
    }


def main(args=None):
    params = sys.argv[1:] if args is None else args
    if len(params) != 1:
        print("SMOKE_CAPTURE_PATH_REQUIRED", file=sys.stderr)
        return 2
    path = Path(params[0])
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 131072:
            raise InvalidCapture("SMOKE_INPUT_UNSAFE")
        output = evaluate_jsonl(path.read_text(encoding="utf-8"))
    except (InvalidCapture, OSError, UnicodeError):
        print("SMOKE_EVIDENCE_REJECTED", file=sys.stderr)
        return 2
    print(json.dumps(output, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
