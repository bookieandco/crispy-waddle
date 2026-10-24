#!/usr/bin/env python3
"""One-shot SHARK quote worker. HOLD is the only implicit state."""
from __future__ import annotations
import os
import re
import sys
import quote_probe

UUID = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")
HOST_IDS = ("PROJECT", "ENVIRONMENT", "SERVICE")


def configured_args(env):
    """Fail closed unless explicit smoke, owner approval and expected Railway scope."""
    mode = env.get("SHARK_QUOTE_WORKER_MODE", "hold")
    if mode != "smoke":
        return None
    for key in ("CI", "GITHUB_ACTIONS", "VERCEL", "VERCEL_ENV"):
        if env.get(key) not in (None, "", "0", "false"):
            raise ValueError("UNTRUSTED_EXECUTION_CONTEXT")
    if env.get("SHARK_QUOTE_WORKER_READ_ONLY_APPROVED") != "YES":
        raise ValueError("READ_ONLY_WORKER_APPROVAL_MISSING")
    if env.get("SHARK_QUOTE_WORKER_METERED_BUDGET_APPROVED") != "YES":
        raise ValueError("METERED_BUDGET_APPROVAL_MISSING")
    if env.get("JUPITER_API_KEY"):
        # No key or paid-provider use is needed for the initial 4-pair smoke.
        raise ValueError("UNAPPROVED_PROVIDER_KEY_PRESENT")
    for kind in HOST_IDS:
        actual = env.get("RAILWAY_" + kind + "_ID", "")
        expected = env.get("SHARK_QUOTE_EXPECTED_" + kind + "_ID", "")
        if not (isinstance(actual, str) and isinstance(expected, str)
                and UUID.fullmatch(actual) and UUID.fullmatch(expected)
                and actual == expected):
            raise ValueError("EXPECTED_RAILWAY_HOST_SCOPE_MISMATCH")
    if env.get("RAILWAY_SERVICE_NAME", "").lower().find("telegram") >= 0:
        raise ValueError("TELEGRAM_SERVICE_NOT_AUTHORIZED")
    raw_count = env.get("SHARK_QUOTE_WORKER_SAMPLES", "4")
    if not isinstance(raw_count, str) or not raw_count.isascii() or not raw_count.isdecimal() or not 1 <= len(raw_count) <= 2:
        raise ValueError("SMOKE_SAMPLE_POLICY_INVALID")
    samples = int(raw_count)
    if not 1 <= samples <= 4:
        raise ValueError("SMOKE_SAMPLE_POLICY_INVALID")
    return ["--approve-read-only", "--samples", str(samples),
            "--pause-seconds", "2.5", "--timeout-seconds", "5"]


def main(env=None, execute=None, emit=print):
    env = os.environ if env is None else env
    runner = quote_probe.main if execute is None else execute
    try:
        args = configured_args(env)
    except ValueError as exc:
        emit(str(exc))
        return 2
    if args is None:
        emit("SHARK_QUOTE_WORKER_HELD_NO_NETWORK_NO_TRADES")
        return 0
    emit("SHARK_QUOTE_WORKER_READ_ONLY_ONESHOT_STARTED")
    return runner(args)


if __name__ == "__main__":
    sys.exit(main())
