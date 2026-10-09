#!/usr/bin/env python3
"""Take one read-only timestamped SHARK paper-health witness from loopback.

Run on the actual owner-controlled worker after service start, again after
genuine 7D outcomes. Not a market feed, not a timer or autonomous worker.
Writes no fabricated outcomes or tests; cannot authorize real trades.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HORIZONS = ("15M", "1H", "4H", "24H", "3D", "7D")


class WitnessError(RuntimeError):
    pass


def read_loopback(port: int, *, fetch=None) -> dict[str, Any]:
    if type(port) is not int or not 1024 <= port <= 65535:
        raise WitnessError("UNSAFE_LOOPBACK_PORT")
    url = f"http://127.0.0.1:{port}/health"
    retrieve = fetch or urllib.request.urlopen
    with retrieve(url, timeout=10) as response:
        if response.status != 200:
            raise WitnessError("PAPER_WORKER_NOT_HEALTHY")
        raw = response.read(512_001)
    if len(raw) > 512_000:
        raise WitnessError("WORKER_HEALTH_PAYLOAD_TOO_LARGE")
    try:
        data = json.loads(raw)
    except (UnicodeDecodeError, ValueError):
        raise WitnessError("PAPER_HEALTH_RESPONSE_INVALID") from None
    if not isinstance(data, dict):
        raise WitnessError("PAPER_HEALTH_RESPONSE_NOT_OBJECT")
    if (data.get("authority") != "SHADOW_LEARNING_ONLY"
            or any(data.get(k) is not False for k in
                   ("canExecute", "canSign", "canBroadcast", "canAuthorizeLive"))):
        raise WitnessError("NON_PAPER_TRADING_AUTHORITY_REJECTED")
    counts = data.get("certification")
    counts = counts if isinstance(counts, dict) else {}
    observation_counts = counts.get("observationCounts", {})
    lesson_counts = counts.get("lessonCounts", {})
    if not isinstance(observation_counts, dict) or not isinstance(lesson_counts, dict):
        raise WitnessError("HORIZON_COUNTS_INVALID")
    def safe_counts(src: dict[str, Any]) -> dict[str, int]:
        if any(type(src.get(k, 0)) is not int or src.get(k, 0) < 0 for k in HORIZONS):
            raise WitnessError("HORIZON_COUNT_INVALID")
        return {k: src.get(k, 0) for k in HORIZONS}
    observed = safe_counts(observation_counts)
    lessons = safe_counts(lesson_counts)
    # Server can claim healthy counters, but only independent feed/license/
    # market provenance and elapsed-time checks certify genuine observations.
    return {
        "schema": "shark.fresh.forward-paper-witness.v1",
        "observedAt": datetime.now(timezone.utc).isoformat(),
        "status": data.get("status"),
        "authority": "SHADOW_LEARNING_ONLY",
        "certification": {
            "observationCounts": observed,
            "lessonCounts": lessons,
        },
        "liveServiceHttp200Observed": True,
        "providerProvenanceIndependentlyVerified": False,
        "genuineSevenDayOutcomeWindowCertified": False,
        "historicalShadowLedgerRecovered": False,
        "canExecute": False, "canSign": False, "canBroadcast": False,
        "canAuthorizeLive": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8094)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_ACTIONS", "").lower() == "true":
            raise WitnessError("REAL_OWNER_HOST_REQUIRED")
        if os.environ.get("JHADINA_HOMEBASE_TRUST_DOMAIN") != "OWNER_CONTROLLED":
            raise WitnessError("OWNER_HOST_AUTHORITY_REQUIRED")
        from shark_fresh_host_operations import append_private_receipt
        state_root = Path(os.environ["SHARK_SHADOW_DATA_DIR"])
        health = read_loopback(args.port)
        append_private_receipt(args.receipt, health, state_root)
        print(json.dumps(health, sort_keys=True))
        return 0
    except (WitnessError, OSError, ValueError, KeyError, TimeoutError):
        print("SHARK_REAL_FORWARD_WITNESS_BLOCKED", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
