"""Commissioning-only acceptance contracts for an *unreleased* personal reader.

All inputs are synthetic or operator-supplied. Nothing here authenticates
Telegram, provisions a VM, certifies live latency, records a Telegram message,
grants SHARK authority or permits wallet operations.
"""
from __future__ import annotations

import argparse
from collections import deque
import json
import math
from pathlib import Path
import sys

SCHEMA = "jhadina.telegram.cloud-commission.v1"
STAGES = frozenset({
    "host_isolation_source_contract",
    "ssh_enrollment_source_contract",
    "bounded_session_recovery_source_contract",
    "privacy_safe_handler_timing_source_contract",
    "independent_release_hold_source_contract",
})
EXTERNAL = frozenset({
    "dedicated_host_owner_and_no_charge_approval",
    "persistent_volume_and_encryption_verified",
    "ssh_host_key_and_owner_identity_verified",
    "interactive_owner_telegram_session_authorized",
    "new_incoming_event_received_on_live_host",
    "disconnect_revocation_and_host_restart_observed",
    "telegram_data_rights_review_completed",
    "real_clock_and_latency_coverage_verified",
    "independent_production_release_approval",
})
MAX_MANIFEST_BYTES = 12_288


class CommissionHold(ValueError):
    """Fixed labels only. Never return a sensitive manifest field."""


def source_only_contract(value: object) -> dict:
    """Reject asserted remote success; a local declaration cannot authorize host use."""
    if not isinstance(value, dict) or set(value) != {
        "schema", "mode", "stages", "external", "permissions"
    }:
        raise CommissionHold("CLOUD_COMMISSION_SCHEMA_DENIED")
    if value["schema"] != SCHEMA or value["mode"] != "SOURCE_ONLY":
        raise CommissionHold("CLOUD_COMMISSION_STAGE_DENIED")
    stages = value["stages"]
    if (not isinstance(stages, dict) or set(stages) != STAGES
            or any(status != "AWAITING_EXACT_HEAD_CI" for status in stages.values())):
        raise CommissionHold("CLOUD_COMMISSION_SOURCE_CLAIM_DENIED")
    external = value["external"]
    if (not isinstance(external, dict) or set(external) != EXTERNAL
            or any(status != "UNVERIFIED" for status in external.values())):
        raise CommissionHold("CLOUD_COMMISSION_EXTERNAL_ATTESTATION_DENIED")
    permissions = value["permissions"]
    if (not isinstance(permissions, dict)
            or set(permissions) != {
                "deploy", "run_listener", "read_telegram", "ai_model_ingestion",
                "market_automation", "wallet_signing", "trading", "spend",
            } or any(flag is not False for flag in permissions.values())):
        raise CommissionHold("CLOUD_COMMISSION_PERMISSION_DENIED")
    return {
        "status": "SOURCE_ONLY_NOT_COMMISSIONED",
        "external_evidence_verified": False,
        "real_messages_observed": False,
        "host_cost_approved": False,
        "canDeploy": False,
        "canReadTelegram": False,
        "canUseForModel": False,
        "canTrade": False,
        "canSign": False,
        "canSpend": False,
    }


def load_source_manifest(path: Path) -> dict:
    if path.is_symlink() or not path.is_file():
        raise CommissionHold("CLOUD_COMMISSION_MANIFEST_MISSING")
    if path.stat().st_size > MAX_MANIFEST_BYTES:
        raise CommissionHold("CLOUD_COMMISSION_MANIFEST_SIZE_DENIED")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        raise CommissionHold("CLOUD_COMMISSION_MANIFEST_PARSE_DENIED") from None


class EphemeralHandlerMetrics:
    """Bounded RAM-only same-clock handler timing, not launch detection latency.

    No identifiers, event timestamps, text, addresses or PII are retained.
    Timings prove only local processing duration on the current process.
    They CANNOT establish message availability, missed Telegram posts, chain
    event arrival, host SLA, market order timing or a 600ms live discovery.
    """
    def __init__(self, capacity: int = 256, emit_every: int = 100):
        if (type(capacity) is not int or not 16 <= capacity <= 1024
                or type(emit_every) is not int or not 16 <= emit_every <= 10000):
            raise ValueError("CLOUD_METRICS_POLICY_INVALID")
        self.samples = deque(maxlen=capacity)
        self.count = 0
        self.emit_every = emit_every

    def add(self, started_ns: int, finished_ns: int) -> str:
        if (type(started_ns) is not int or type(finished_ns) is not int
                or started_ns < 0 or finished_ns < started_ns
                or finished_ns - started_ns > 30_000_000_000):
            raise ValueError("CLOUD_METRICS_MONOTONIC_SAMPLE_INVALID")
        self.samples.append((finished_ns - started_ns) / 1_000_000)
        self.count += 1
        if self.count % self.emit_every != 0:
            return ""
        vals = sorted(self.samples)
        def pct(p):
            return vals[math.ceil(p * len(vals)) - 1]
        return ("TELEGRAM_CLOUD_LOCAL_HANDLER_ONLY "
                f"N={len(vals)} "
                f"P50_MS={pct(.50):.3f} "
                f"P95_MS={pct(.95):.3f} "
                f"P99_MS={pct(.99):.3f} "
                "NO_END_TO_END_OR_600MS_CERTIFICATION")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Offline Telegram cloud commission hold")
    parser.add_argument("--mode", choices=("source", "release"), default="source")
    args = parser.parse_args(argv)
    try:
        result = source_only_contract(
            load_source_manifest(Path(__file__).with_name("cloud_commission_evidence.json")))
    except CommissionHold as error:
        print(str(error))
        return 2
    print(json.dumps(result, sort_keys=True))
    if args.mode == "release":
        print("CLOUD_COMMISSION_REQUIRES_REAL_HOST_AND_OWNER_CERTIFICATION")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
