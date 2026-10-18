#!/usr/bin/env python3
"""SHARK-LIVE.ACCEPT.09-.11: manual ephemeral PUBLIC-MARKET-ONLY probe.

Runs canonical SHARK-LIVE worker once with a fresh private temporary SQLite
database, fixed bounded public DEX/RPC readers and no Telegram/AI/trading
credentials or persistent worker. Exposes redacted research acceptance status.
A partial public-provider response is NOT independently attested alpha.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

import shark_live_intelligence as live

SCHEMA = "SHARK-LIVE-EPHEMERAL-PUBLIC-ACCEPT-09-11"
CONFIRM = "PUBLIC-SHARK-ONCE-NO-TRADES"
LIMIT_SECONDS = 115
MAX_STDOUT = 16000


def _count(value: object, upper: int) -> int:
    if type(value) is not int or not 0 <= value <= upper:
        raise ValueError("invalid_public_counter")
    return value


def classify(worker_result: object, elapsed: float) -> tuple[dict, int]:
    """Fail closed if any worker contract is missing or not restrictive."""
    if not isinstance(worker_result, dict) or worker_result.get("schema") != live.SCHEMA:
        raise ValueError("unexpected_public_worker_schema")
    if any(worker_result.get(flag) is not False for flag in (
        "canTrade", "canSign", "canBroadcast", "telegramDataIngested",
        "providerEvidenceIndependentlyAttested", "continuousLatencyCertified",
    )):
        raise ValueError("public_worker_authority_escalation")
    checked = _count(worker_result.get("checkedPublicMints"), live.MAX_CHECKS)
    newly = _count(worker_result.get("newlyDiscovered"), live.MAX_NEW)
    quarantined = _count(worker_result.get("quarantined"), checked)
    attempted = _count(worker_result.get("alertsAttempted"), 0)
    ack = _count(worker_result.get("alertsAcknowledged"), 0)
    graded = _count(worker_result.get("priceOnlyCasesGraded"), 0)
    paper = worker_result.get("paper")
    if not isinstance(paper, dict) or paper.get("calibratedEntryOrExitSignal") is not False:
        raise ValueError("public_worker_paper_contract_invalid")
    if paper.get("actualProfitsVerified") is not False or paper.get("canTrade") is not False:
        raise ValueError("public_worker_paper_authority_escalation")
    opened = _count(paper.get("openProspectiveCases"), live.MAX_NEW)
    _count(paper.get("observedPublicTokens"), live.MAX_NEW)
    if attempted != 0 or ack != 0 or graded != 0 or opened > checked - quarantined:
        raise ValueError("unexpected_public_worker_actions")
    usable = checked > quarantined and opened > 0
    result = {
        "schema": SCHEMA,
        "status": "PARTIAL_PUBLIC_RESEARCH_RECEIVED_NOT_ALPHA" if usable
                  else "INCONCLUSIVE_NO_USABLE_PUBLIC_RESEARCH",
        "publicFeedAccessAttempted": True,
        "newPublicMintCandidates": newly,
        "publicMintChecks": checked,
        "quarantinedEvidence": quarantined,
        "freshProspectivePaperCases": opened,
        "providerLatencySecondsEntireCycle": round(elapsed, 3),
        "temporaryRunnerStateDeletedAtEnd": True,
        "publicProviderOriginCryptographicallyAttested": False,
        "oneShotRepresentativeOfContinuousLatency": False,
        "privateTelegramReadOrWrite": False,
        "aiModelTraining": False,
        "notificationAttempted": False,
        "walletActionEnabled": False,
        "canTrade": False,
        "canBroadcast": False,
        "noSustainedMonitoring": True,
    }
    return result, 0 if usable else 2


def run_once(*, confirm: str, runner=None, clock=None) -> tuple[dict, int]:
    if confirm != CONFIRM:
        raise ValueError("public_market_single_run_consent_required")
    runner = runner or subprocess.run
    clock = clock or time.monotonic
    # tempfile dir has 0700 permissions; workspace state never checked in.
    with tempfile.TemporaryDirectory(prefix="shark-public-once-") as root:
        src = Path(__file__).resolve().parent / "shark_live_intelligence.py"
        child_env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": root,
            "PYTHONDONTWRITEBYTECODE": "1",
            "SHARK_PUBLIC_HOST_COMMISSIONED": "false",
            "ENABLE_SHARK_PUBLIC_ALERTS": "false",
        }
        args = [sys.executable, str(src), "--mode", "once",
                "--state", str(Path(root) / "evidence.sqlite3"),
                "--confirm", "PUBLIC-MARKET-RESEARCH-ONLY"]
        start = clock()
        try:
            completed = runner(
                args, env=child_env, capture_output=True, text=True,
                timeout=LIMIT_SECONDS, check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            raise ValueError("public_provider_read_failed_closed") from None
        elapsed = clock() - start
        if (completed.returncode != 0 or not isinstance(completed.stdout, str)
                or len(completed.stdout) > MAX_STDOUT or
                elapsed < 0 or elapsed > LIMIT_SECONDS + 5):
            raise ValueError("public_provider_read_incomplete")
        # Only parse the worker's redacted JSON; never echo stdout/stderr.
        try:
            raw = json.loads(completed.stdout)
        except (json.JSONDecodeError, TypeError):
            raise ValueError("public_worker_receipt_missing") from None
        return classify(raw, elapsed)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm", default="")
    args = parser.parse_args(argv)
    try:
        result, code = run_once(confirm=args.confirm)
    except (ValueError, OSError, TypeError):
        result, code = ({
            "schema": SCHEMA,
            "status": "PUBLIC_PROVIDER_NOT_VERIFIED_FAIL_CLOSED",
            "privateTelegramReadOrWrite": False,
            "aiModelTraining": False,
            "notificationAttempted": False,
            "walletActionEnabled": False,
            "canTrade": False,
            "canBroadcast": False,
        }, 1)
    print(json.dumps(result, sort_keys=True, allow_nan=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
