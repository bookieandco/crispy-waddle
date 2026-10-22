"""TELEGRAM-LIVE.13: fail-closed personal Telegram release-readiness gate.

Intentionally does NOT authenticate Telegram or accept self-declared success
as proof of a real user-account session. Offline CI may validate code-only
evidence and required HOLD status. Only a future separately reviewed,
authenticated owner-device certification can change release policy.

Never prints manifest contents, Telegram account IDs, tokens, chat names,
addresses, SMS/2FA codes, or arbitrary error strings.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCHEMA = "jhadina.telegram.personal-release-gate.v1"
CODE_KEYS = frozenset((
    "owner_identity_mismatch_denied",
    "source_privacy_no_telegram_data_persistence",
    "malformed_event_rejection",
    "bounded_reconnect_with_owner_recheck",
    "local_startup_diagnostics",
    "credentials_denied_in_ci",
))
LIVE_KEYS = frozenset((
    "trusted_owner_host_login",
    "real_owner_account_match",
    "fresh_incoming_crypto_message",
    "disconnect_reconnect_and_sleep",
    "telegram_session_revoke",
    "telegram_data_use_review",
    "independent_operator_release_approval",
))
DENIED_PERMISSIONS = frozenset((
    "ai_training", "trading", "raw_message_storage",
    "historical_all_chat_backfill", "production_personal_listener",
))
MAX_MANIFEST_SIZE = 16_384


class ReleaseEvidenceInvalid(ValueError):
    """Safe fixed-error type: no original content echoed."""


def read_release_manifest(path: Path):
    if path.is_symlink() or not path.is_file():
        raise ReleaseEvidenceInvalid("RELEASE_MANIFEST_MISSING_OR_LINKED")
    if path.stat().st_size > MAX_MANIFEST_SIZE:
        raise ReleaseEvidenceInvalid("RELEASE_MANIFEST_OVERSIZED")
    try:
        contents = path.read_text(encoding="utf-8")
        data = json.loads(contents)
    except (OSError, UnicodeError, ValueError):
        raise ReleaseEvidenceInvalid("RELEASE_MANIFEST_INVALID_JSON") from None
    return data


def evaluate_code_only_gate(manifest):
    """Return fixed public-safe status labels; not external live certification.

    The known manifest is a *declaration* of CI-tested design constraints,
    not an independent representation of a completed live Telegram sign-in.
    Invalid, missing, or self-promoted live items must fail CI.
    """
    if not isinstance(manifest, dict) or set(manifest) != {
        "schema_version", "target", "repository", "pull_request", "audit_issue",
        "stage", "code_checks", "live_checks", "permissions",
    }:
        raise ReleaseEvidenceInvalid("RELEASE_MANIFEST_UNEXPECTED_STRUCTURE")
    for key, expected in (
        ("schema_version", SCHEMA),
        ("target", "personal_telegram_all_new_incoming_cloud_messages"),
        ("repository", "bookieandco/crispy-waddle"),
        ("pull_request", 1230),
        ("audit_issue", 1238),
        ("stage", "CODE_ONLY"),
    ):
        value = manifest.get(key)
        if type(value) is not type(expected) or value != expected:
            raise ReleaseEvidenceInvalid("RELEASE_MANIFEST_IDENTITY_OR_SCOPE_MISMATCH")
    code = manifest.get("code_checks")
    live = manifest.get("live_checks")
    permissions = manifest.get("permissions")
    if not isinstance(code, dict) or set(code) != CODE_KEYS or any(
        value != "OFFLINE_TESTED" for value in code.values()
    ):
        raise ReleaseEvidenceInvalid("RELEASE_CODE_CHECKS_NOT_CERTIFIED_OFFLINE")
    if not isinstance(live, dict) or set(live) != LIVE_KEYS or any(
        value != "UNVERIFIED" for value in live.values()
    ):
        raise ReleaseEvidenceInvalid("RELEASE_LIVE_EVIDENCE_MUST_REMAIN_UNVERIFIED")
    if not isinstance(permissions, dict) or set(permissions) != DENIED_PERMISSIONS or any(
        value is not False for value in permissions.values()
    ):
        raise ReleaseEvidenceInvalid("RELEASE_UNAUTHORIZED_CAPABILITY_PRESENT")
    return (
        "TELEGRAM_LIVE13_CODE_CONTRACT_VALID",
        "TELEGRAM_LIVE13_LIVE_EVIDENCE_NOT_VERIFIED",
        "TELEGRAM_LIVE13_PRODUCTION_PERSONAL_LISTENER_HELD",
        "NO_AI_TRAINING_NO_TRADE_NO_HISTORICAL_BACKFILL",
    )


def assess_release(manifest, mode):
    labels = evaluate_code_only_gate(manifest)
    if mode == "ci":
        return 0, labels
    if mode == "release":
        # Deliberately no --approve, --force, or 'live evidence' override.
        # Production admission belongs in a later, independently audited
        # owner-device process, not a mutable GitHub JSON declaration.
        return 1, labels + ("RELEASE_REQUIRES_SEPARATE_OWNER_DEVICE_CERTIFICATION",)
    raise ReleaseEvidenceInvalid("INVALID_RELEASE_MODE")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Offline Telegram personal reader release contract; never logs in."
    )
    parser.add_argument("--mode", choices=("ci", "release"), default="ci")
    args = parser.parse_args(argv)
    path = Path(__file__).with_name("personal_release_evidence.json")
    try:
        data = read_release_manifest(path)
        code, labels = assess_release(data, args.mode)
    except ReleaseEvidenceInvalid as error:
        # error classes are fixed; never forward arbitrary JSON or traceback.
        print("TELEGRAM_LIVE13_RELEASE_GATE_INVALID", str(error))
        return 2
    for label in labels:
        print(label)
    return code


if __name__ == "__main__":
    sys.exit(main())
