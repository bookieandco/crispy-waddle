#!/usr/bin/env python3
"""Bounded one-shot read-only Railway host entrypoint. Default: HOLD, no network."""
from __future__ import annotations
import os
import sys
import quote_probe


def configured_args(env):
    """Only an exact deliberate smoke toggle produces CLI quote arguments."""
    mode = env.get("SHARK_QUOTE_WORKER_MODE", "hold")
    if mode != "smoke":
        return None  # Unknown modes are held, never guess activation.
    if env.get("SHARK_QUOTE_WORKER_READ_ONLY_APPROVED") != "YES":
        raise ValueError("READ_ONLY_WORKER_APPROVAL_MISSING")
    raw_count = env.get("SHARK_QUOTE_WORKER_SAMPLES", "4")
    if not raw_count.isascii() or not raw_count.isdecimal() or not 1 <= len(raw_count) <= 2:
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
