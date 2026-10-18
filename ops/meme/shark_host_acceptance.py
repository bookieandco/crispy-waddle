#!/usr/bin/env python3
"""SHARK-LIVE.HOST.01–.04 — isolated PRE-commissioning gates.

No cloud account mutations, Telegram inbox reads, ML ingestion, wallet access,
market orders or enabled background work. The optional public-once call and
Telegram output need separate, explicit operator approval on a private host.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time

import shark_live_commission as commission
import shark_live_intelligence as worker

SCHEMA = "SHARK-LIVE-HOST-01-04"
MIN_DISK_FREE_BYTES = 128 * 1024 * 1024
MAX_ARCHIVE_BYTES = 150 * 1024 * 1024
AGE_RECIPIENT = re.compile(r"^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$")
PUBLIC_CONFIRM = "SHARK-PUBLIC-MARKET-ONLY"
NOTIFY_CONFIRM = "SHARK-OWNER-PRIVATE-RESEARCH-ALERT"


def _private_dir(value: str) -> Path:
    p = Path(value)
    if not p.is_absolute() or p.is_symlink() or not p.is_dir():
        raise ValueError("host_state_directory_invalid")
    st = p.stat()
    if st.st_uid != os.geteuid() or st.st_mode & 0o077:
        raise ValueError("host_state_not_owner_private")
    return p


def _mountpoints(text: str) -> set[str]:
    """Linux mountinfo field 5, not a cloud-provider volume attestation."""
    mounts: set[str] = set()
    for row in text.splitlines():
        cells = row.split(" ")
        if len(cells) >= 6 and " - " in row:
            mounts.add(cells[4].replace("\\040", " "))
    return mounts


def host_status(path: str, *, mounts: set[str] | None = None) -> dict:
    result = {
        "schema": SCHEMA, "status": "NOT_COMMISSIONED",
        "isolatedOwnerPrivateDirectory": False,
        "dedicatedMountObserved": False, "nonRootIdentity": os.geteuid() != 0,
        "freeSpaceThresholdMet": False,
        "explicitHostCommissioningGrant": os.environ.get("SHARK_PUBLIC_HOST_COMMISSIONED") == "true",
        "postRestartPersistenceObserved": False,
        "encryptedOffHostRestoreObserved": False,
        "publicProviderReadObserved": False,
        "ownerPhoneAlertReadbackObserved": False,
        "noTradingAuthority": True,
    }
    try:
        p = _private_dir(path)
        result["isolatedOwnerPrivateDirectory"] = True
        stat = os.statvfs(p)
        result["freeSpaceThresholdMet"] = stat.f_bavail * stat.f_frsize >= MIN_DISK_FREE_BYTES
        if mounts is None:
            with open("/proc/self/mountinfo", encoding="utf-8") as file:
                mounts = _mountpoints(file.read())
        result["dedicatedMountObserved"] = str(p) in mounts
    except (ValueError, OSError):
        return result
    # These local checks cannot certify restart, off-host backup or phone readback.
    if (result["isolatedOwnerPrivateDirectory"] and result["nonRootIdentity"]
            and result["dedicatedMountObserved"] and result["freeSpaceThresholdMet"]
            and result["explicitHostCommissioningGrant"]):
        result["status"] = "LOCAL_PRECHECK_ONLY_EXTERNAL_CERTIFICATIONS_REQUIRED"
    return result


def _require_host(gates: dict) -> None:
    required = ("isolatedOwnerPrivateDirectory", "nonRootIdentity",
                "dedicatedMountObserved", "freeSpaceThresholdMet",
                "explicitHostCommissioningGrant")
    if not all(gates[k] is True for k in required):
        raise ValueError("dedicated_private_host_not_ready")


def _age_binary() -> str:
    binary = shutil.which("age")
    if not binary:
        raise ValueError("age_encryption_tool_unavailable")
    return binary


def _age_call(binary: str, args: list[str]) -> None:
    """Avoid shell interpolation and suppress sensitive process details."""
    try:
        result = subprocess.run([binary, *args], stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                check=False, timeout=90)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("age_operation_unavailable") from None
    if result.returncode != 0:
        raise ValueError("age_operation_failed")


def encrypt_snapshot(*, state_path: str, encrypted_destination: str,
                     public_recipient: str) -> dict:
    """Real age encryption when installed, but still ONLY a local archive.

    Caller must subsequently carry the ciphertext to approved off-host custody
    and separately verify a restore on another host before commissioning.
    """
    if not isinstance(public_recipient, str) or not AGE_RECIPIENT.fullmatch(public_recipient):
        raise ValueError("invalid_age_recipient")
    binary = _age_binary()
    state = commission._secure_file(state_path, must_exist=True)
    dest = commission._secure_file(encrypted_destination, must_exist=False)
    if state == dest or state.parent == dest.parent and state.name == dest.name:
        raise ValueError("archive_cannot_replace_state")
    with worker.local_database(str(state)) as db:
        first = commission.audit_db(db)
        with tempfile.TemporaryDirectory(prefix=".shark-age-", dir=str(dest.parent)) as directory:
            temp = Path(directory)
            private_snapshot = temp / "snapshot.sqlite"
            ciphertext = temp / "snapshot.age"
            commission._backup(db, private_snapshot)
            _age_call(binary, ["-r", public_recipient, "-o", str(ciphertext),
                               str(private_snapshot)])
            if ciphertext.is_symlink() or not ciphertext.is_file():
                raise ValueError("age_encrypted_artifact_missing")
            size = ciphertext.stat().st_size
            if not 64 <= size <= MAX_ARCHIVE_BYTES:
                raise ValueError("age_encrypted_artifact_size_invalid")
            os.chmod(ciphertext, 0o600)
            with open(ciphertext, "rb") as file:
                os.fsync(file.fileno())
            os.link(ciphertext, dest)  # never overwrite user backup
            dfd = os.open(dest.parent, os.O_RDONLY)
            try:
                os.fsync(dfd)
            finally:
                os.close(dfd)
    return {
        "schema": SCHEMA, "status": "LOCAL_AGE_CIPHERTEXT_CREATED",
        "localStudyFingerprint": first["fingerprint"],
        "encryptedOffHostBackupVerified": False,
        "differentHostRestoreVerified": False,
        "ownerPhoneAlertReadbackVerified": False, "noTradingAuthority": True,
    }


def check_encrypted_restore(*, encrypted_source: str, identity_path: str,
                            expected_fingerprint: str) -> dict:
    """Decrypt into a private temporary directory and audit a SQLite copy.

    This cannot independently prove the ciphertext left the original host.
    """
    if (not isinstance(expected_fingerprint, str)
            or not re.fullmatch(r"[0-9a-f]{64}", expected_fingerprint)):
        raise ValueError("expected_fingerprint_required")
    source = commission._secure_file(encrypted_source, must_exist=True)
    identity = commission._secure_file(identity_path, must_exist=True)
    if not 64 <= source.stat().st_size <= MAX_ARCHIVE_BYTES:
        raise ValueError("archive_size_invalid")
    binary = _age_binary()
    with tempfile.TemporaryDirectory(prefix="shark-age-verify-") as directory:
        target = Path(directory) / "restored.sqlite"
        _age_call(binary, ["-d", "-i", str(identity), "-o", str(target),
                           str(source)])
        if target.is_symlink() or not target.is_file():
            raise ValueError("decrypted_snapshot_missing")
        with sqlite3.connect(str(target)) as db:
            result = commission.audit_db(db)
        if result["fingerprint"] != expected_fingerprint:
            raise ValueError("encrypted_restore_fingerprint_mismatch")
    return {
        "schema": SCHEMA, "status": "LOCAL_AGE_DECRYPT_AND_SQLITE_RESTORE_MATCH",
        "restoredFingerprint": result["fingerprint"],
        "differentHostRestoreVerified": False,
        "encryptedOffHostBackupVerified": False,
        "noTradingAuthority": True,
    }


def public_accept_once(*, state_path: str, public_confirm: str,
                       notify_confirm: str = "", runner=None,
                       mounts: set[str] | None = None) -> dict:
    """Public data only; optional private *outbound* notification after 2nd grant."""
    if public_confirm != PUBLIC_CONFIRM:
        raise ValueError("public_market_owner_grant_missing")
    parent = str(Path(state_path).parent)
    gates = host_status(parent, mounts=mounts)
    _require_host(gates)
    state = Path(state_path)
    if state.is_symlink() or not state.is_absolute():
        raise ValueError("public_state_path_invalid")
    notify = notify_confirm == NOTIFY_CONFIRM
    if notify and not commission.notifications_ready(explicit_owner_ack=True)[
            "enabledWithExplicitOwnerConsent"]:
        raise ValueError("owner_private_notification_not_authorized")
    if notify_confirm not in ("", NOTIFY_CONFIRM):
        raise ValueError("owner_notification_confirmation_invalid")
    runner = runner or worker.main
    args = ["--mode", "once", "--state", str(state),
            "--confirm", "PUBLIC-MARKET-RESEARCH-ONLY"]
    if notify:
        args.append("--notify")
    start = time.monotonic()
    status = runner(args)
    seconds = round(time.monotonic() - start, 3)
    if status != 0:
        raise ValueError("public_market_acceptance_failed")
    return {
        "schema": SCHEMA, "status": "MANUAL_ONE_SHOT_COMPLETE_NOT_CONTINUOUS",
        "runDurationSeconds": seconds,
        "telegramMessagesIngested": False,
        "publicDataSourceIndependentAttestation": False,
        "samePoolProspectiveOutcomeVerified": False,
        "privateAlertAttemptEnabled": notify,
        "ownerPhoneAlertReadbackVerified": False,
        "continuousHostCommissioned": False,
        "noTradingAuthority": True,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", required=True,
                        choices=["preflight", "encrypt-local", "decrypt-check", "public-once"])
    parser.add_argument("--state-dir")
    parser.add_argument("--state")
    parser.add_argument("--encrypted-out")
    parser.add_argument("--recipient")
    parser.add_argument("--archive")
    parser.add_argument("--identity")
    parser.add_argument("--expected-fingerprint")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--private-alert-confirm", default="")
    args = parser.parse_args(argv)
    try:
        if args.mode == "preflight" and args.state_dir:
            result = host_status(args.state_dir)
        elif args.mode == "encrypt-local" and all((args.state, args.encrypted_out, args.recipient)):
            result = encrypt_snapshot(state_path=args.state,
                                      encrypted_destination=args.encrypted_out,
                                      public_recipient=args.recipient)
        elif args.mode == "decrypt-check" and all(
                (args.archive, args.identity, args.expected_fingerprint)):
            result = check_encrypted_restore(
                encrypted_source=args.archive, identity_path=args.identity,
                expected_fingerprint=args.expected_fingerprint)
        elif args.mode == "public-once" and args.state:
            result = public_accept_once(
                state_path=args.state, public_confirm=args.confirm,
                notify_confirm=args.private_alert_confirm)
        else:
            raise ValueError("host_mode_input_invalid")
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ValueError, OSError, sqlite3.Error, KeyError, TypeError):
        # Do not leak identity path, recipient, bot credentials or provider data.
        print("SHARK_HOST_ACCEPTANCE_FAIL_CLOSED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
