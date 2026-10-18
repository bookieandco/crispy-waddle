#!/usr/bin/env python3
"""SHARK-LIVE.FINAL-COMMISSION.01-.04: evidence gates, NOT a deployment.

No network activity, model, Telegram client, wallet, payments or scheduler.
An operator has to authorize and execute deployment, real observations and
device receipt independently. Local files/boot IDs do not attest remote data.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

import shark_host_acceptance as host
import shark_live_commission as commission
import shark_live_intelligence as worker

SCHEMA = "SHARK-LIVE-FINAL-COMMISSION-01-04"
RESTART_SCHEMA = SCHEMA + "-RESTART-RECEIPT"
RESTART_CONFIRM = "RECORD-SHARK-PRIVATE-RESTART-BASELINE"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
BOOT_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
MAX_RECEIPT_BYTES = 4096


def _boot_id() -> str:
    """An OS boot identifier, not an independent provider attestation."""
    value = Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip().lower()
    if not BOOT_RE.fullmatch(value):
        raise ValueError("boot_identifier_unavailable")
    return value


def _secure_state(path: str) -> tuple[str, dict]:
    commission._secure_file(path, must_exist=True)
    parent = str(Path(path).parent)
    # Read-only report of current local host conditions. No env grant implies
    # a commissioned service without external operator evidence.
    conditions = host.host_status(parent)
    with worker.local_database(path) as db:
        checked = commission.audit_db(db)
    return parent, checked | {"hostPreflight": conditions}


def host_review(state_dir: str) -> dict:
    report = host.host_status(state_dir)
    return {
        "schema": SCHEMA,
        "status": "LOCAL_HOST_REVIEW_ONLY_NO_PRODUCTION_APPROVAL",
        "privateStateDirObserved": report["isolatedOwnerPrivateDirectory"],
        "dedicatedMountObserved": report["dedicatedMountObserved"],
        "nonRootIdentityObserved": report["nonRootIdentity"],
        "freeSpaceThresholdMet": report["freeSpaceThresholdMet"],
        "operatorGrantFlagPresent": report["explicitHostCommissioningGrant"],
        "hostRebootContinuityProven": False,
        "ownerCostApprovalVerified": False,
        "encryptedOffHostRestoreVerified": False,
        "longRunningProviderLatencyCertified": False,
        "ownerPhoneAlertReadbackVerified": False,
        "commissioned": False, "canTrade": False,
    }


def _write_new(path: str, value: dict) -> None:
    dest = commission._secure_file(path, must_exist=False)
    parent = host._private_dir(str(dest.parent))
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode() + b"\n"
    if len(data) > MAX_RECEIPT_BYTES:
        raise ValueError("local_receipt_size_limit")
    fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        with os.fdopen(fd, "wb") as file:
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        dfd = os.open(parent, os.O_RDONLY)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise


def record_before_restart(state: str, out: str, confirm: str) -> dict:
    if confirm != RESTART_CONFIRM:
        raise ValueError("restart_owner_confirmation_required")
    parent, audited = _secure_state(state)
    if Path(out).parent != Path(parent):
        raise ValueError("restart_receipt_must_live_on_same_private_volume")
    host._require_host(audited["hostPreflight"])
    receipt = {
        "schema": RESTART_SCHEMA,
        "stateFingerprint": audited["fingerprint"],
        "bootId": _boot_id(),
        "stateFile": Path(state).name,
        "publicRecords": audited["totalPublicMints"],
        "authority": "RESEARCH_ONLY",
        "outboundMessages": False,
        "hostRebootAlreadyVerified": False,
    }
    # Local-only receipt, in an explicitly mounted private volume; absolutely
    # no external backup, host reboot, clock or phone evidence asserted.
    _write_new(out, receipt)
    return {
        "schema": SCHEMA, "status": "OWNER_PRIVATE_RESTART_BASELINE_RECORDED",
        "publicRecords": audited["totalPublicMints"],
        "baselineFingerprint": audited["fingerprint"],
        "newHostBootObserved": False, "offHostRestoreVerified": False,
        "notificationsSent": False, "canTrade": False,
    }


def _read_receipt(path: str) -> dict:
    target = commission._secure_file(path, must_exist=True)
    if not 0 < target.stat().st_size <= MAX_RECEIPT_BYTES:
        raise ValueError("restart_receipt_size_invalid")
    obj = json.loads(target.read_text(encoding="utf-8"))
    if (not isinstance(obj, dict) or obj.get("schema") != RESTART_SCHEMA
            or obj.get("authority") != "RESEARCH_ONLY"
            or obj.get("hostRebootAlreadyVerified") is not False
            or obj.get("outboundMessages") is not False
            or type(obj.get("publicRecords")) is not int
            or obj["publicRecords"] < 0
            or not isinstance(obj.get("stateFile"), str)
            or "/" in obj["stateFile"]
            or not BOOT_RE.fullmatch(str(obj.get("bootId", "")))
            or not SHA256_RE.fullmatch(str(obj.get("stateFingerprint", "")))):
        raise ValueError("restart_receipt_invalid")
    return obj


def review_after_restart(state: str, before: str) -> dict:
    parent, audited = _secure_state(state)
    host._require_host(audited["hostPreflight"])
    if Path(before).parent != Path(parent):
        raise ValueError("restart_evidence_not_on_same_private_volume")
    prior = _read_receipt(before)
    if prior["stateFile"] != Path(state).name:
        raise ValueError("restart_wrong_ledger")
    if prior["bootId"] == _boot_id():
        raise ValueError("no_distinct_operating_system_boot_observed")
    if (prior["stateFingerprint"] != audited["fingerprint"]
            or prior["publicRecords"] != audited["totalPublicMints"]):
        raise ValueError("restart_state_fingerprint_changed")
    return {
        "schema": SCHEMA,
        "status": "LOCAL_DISTINCT_OS_BOOT_SAME_LEDGER_OBSERVED",
        "localLedgerContinuityObserved": True,
        "localLedgerFingerprint": audited["fingerprint"],
        "encryptedOffHostRestoreVerified": False,
        "separateDatacenterFailoverVerified": False,
        "providerDataAuthenticityVerified": False,
        "ownerPhoneAlertReadbackVerified": False,
        "continuousServiceCommissioned": False,
        "canTrade": False,
    }


def paper_review(state: str) -> dict:
    _secure_state(state)
    with worker.local_database(state) as db:
        # Reject inconsistent on-disk chain before summarizing outcomes.
        commission.audit_db(db)
        cycles = [worker._utc(x[0]) for x in db.execute(
            "SELECT available_at FROM cycles")]
        reviewed = scored = censored = ungraded = 0
        for raw, status in db.execute("SELECT study_json,status FROM tokens"):
            if not raw:
                if status.startswith(("CENSORED_", "QUARANTINED")):
                    censored += 1
                continue
            study = worker.paper.check_study(json.loads(raw))
            reviewed += 1
            if study["status"] == "OPEN":
                if status.startswith("CENSORED_"):
                    censored += 1
                else:
                    ungraded += 1
                continue
            last = study["events"][-1]
            if last["type"] != "PRICE_ONLY_UNVERIFIED":
                censored += 1
                continue
            first_time = worker._utc(study["events"][0]["availableAt"])
            last_time = worker._utc(last["availableAt"])
            age_hours = (last_time - first_time).total_seconds() / 3600
            # A local case must have a contemporaneous cycle for both reads.
            # This is only a *consistency check*, not an authenticated
            # provider receipt, independent return, or verified executed P&L.
            if (24 <= age_hours <= 30
                    and any(0 <= (c - first_time).total_seconds() <= 900 for c in cycles)
                    and any(0 <= (c - last_time).total_seconds() <= 900 for c in cycles)):
                scored += 1
            else:
                raise ValueError("paper_mark_missing_prospective_cycle")
        fingerprint = commission._fp(db)
    return {
        "schema": SCHEMA,
        "status": "LOCAL_PAPER_RECEIPTS_UNATTESTED" if scored
                  else "NO_LOCAL_PROSPECTIVE_24H_MARKS",
        "locallyConsistent24To30hPriceOnlyMarks": scored,
        "missingOrCensored": censored,
        "openUnscoredCases": ungraded,
        "publicStudiesReviewed": reviewed,
        "localLedgerFingerprint": fingerprint,
        "historicalSyntheticCasesRuledOut": False,
        "providerEvidenceIndependentlyAttested": False,
        "executableReturnsVerified": False,
        "calibratedProfitableAlphaVerified": False,
        "canTrade": False,
    }


def alert_review(state: str) -> dict:
    _secure_state(state)
    with worker.local_database(state) as db:
        commission.audit_db(db)
        counters = dict(db.execute(
            "SELECT delivery,COUNT(*) FROM outbox GROUP BY delivery").fetchall())
    return {
        "schema": SCHEMA,
        "status": "PRIVATE_ALERT_LEDGER_REVIEW_NOT_PHONE_CONFIRMATION",
        "senderAcknowledgedRecords": counters.get("ACKNOWLEDGED", 0),
        "uncertainNotRetriedCount": counters.get("UNCERTAIN_NO_RETRY", 0),
        "alertAttemptsCurrentlyPending": counters.get("ATTEMPTED", 0),
        "outboundDisabledRecords": counters.get("DISABLED", 0),
        "telegramMessagesRead": False,
        "ownerPhoneAlertReadbackVerified": False,
        "ownerPhoneAttestationRequired": True,
        "notificationsSentByThisAudit": False,
        "canTrade": False,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mode", choices=[
        "host-review", "before-restart", "after-restart", "paper-review",
        "alert-review"], required=True)
    p.add_argument("--state", default="")
    p.add_argument("--state-dir", default="")
    p.add_argument("--receipt", default="")
    p.add_argument("--confirm", default="")
    a = p.parse_args(argv)
    try:
        if a.mode == "host-review" and a.state_dir:
            result = host_review(a.state_dir)
        elif a.mode == "before-restart" and a.state and a.receipt:
            result = record_before_restart(a.state, a.receipt, a.confirm)
        elif a.mode == "after-restart" and a.state and a.receipt:
            result = review_after_restart(a.state, a.receipt)
        elif a.mode == "paper-review" and a.state:
            result = paper_review(a.state)
        elif a.mode == "alert-review" and a.state:
            result = alert_review(a.state)
        else:
            raise ValueError("final_commission_mode_or_input_invalid")
        print(json.dumps(result, sort_keys=True, allow_nan=False))
        return 0
    except (ValueError, OSError, sqlite3.Error, TypeError, KeyError, OverflowError,
            UnicodeError, json.JSONDecodeError):
        print("SHARK_FINAL_COMMISSION_FAIL_CLOSED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
