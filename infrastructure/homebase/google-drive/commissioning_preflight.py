#!/usr/bin/env python3
"""GOOGLE-HOMEBASE-LIVE.1: zero-network, read-only owner/worker preflight.

This does not access Google Drive, execute Docker, discover/print secrets,
trigger backups, or authorize a machine. Presence of binaries and environment
settings is NOT evidence of a commissioned, recoverable Homebase.

Examples:
  python3 commissioning_preflight.py
  python3 commissioning_preflight.py --profile trusted-worker
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import stat
import sys
from pathlib import Path

REQUIRED_BINARIES = ("python3", "rclone", "restic", "docker", "mc", "nats", "nats-server", "dvc")
FOLDER_ID = re.compile(r"[A-Za-z0-9_-]{10,128}\Z")
REMOTE_NAME = re.compile(r"[A-Za-z][A-Za-z0-9_-]{1,60}\Z")
ABSOLUTE_PATH = re.compile(r"^/")


def private_secret_file(path: str) -> bool:
    """Stat only: never open, read, copy or log the Restic passphrase."""
    if not path:
        return False
    source = Path(path)
    if not source.is_absolute() or source.is_symlink():
        return False
    try:
        info = source.stat()
    except (OSError, ValueError):
        return False
    return stat.S_ISREG(info.st_mode) and not (stat.S_IMODE(info.st_mode) & 0o077)


def audit(*, env: dict[str, str], profile: str, present: dict[str, bool],
          secret_file_private: bool) -> dict:
    if profile not in ("iphone", "trusted-worker"):
        raise ValueError("Unrecognized preflight profile")

    gates = {
        "existing_approved_trusted_worker": False,
        "scoped_machine_google_oauth": False,
        "restic_snapshot_byte_recovery": False,
        "postgres_disposable_database_restore": False,
        "minio_api_restore": False,
        "nats_stream_and_consumer_recovery": False,
        "scheduled_backup_and_delivered_failure_alert": False,
        "cross_subsystem_end_to_end": False,
    }
    # The phone interface is never a canonical infrastructure runtime.
    if profile == "iphone":
        return {
            "schema": "jhadina.google-homebase.live-preflight.v1",
            "profile": "IPHONE_OPERATOR",
            "mode": "CONTROL_ONLY",
            "checks": {
                "requires_local_server_on_iphone": False,
                "chat_drive_credentials_are_worker_oauth": False,
            },
            "live_gates": gates,
            "source_merged": True,
            "new_billable_server_provisioned": False,
            "production_authority_changed": False,
            "overall_live_ready": False,
            "next_action": "IDENTIFY_EXISTING_TRUSTED_RUNTIME",
        }

    hosted = env.get("GITHUB_ACTIONS", "").lower() == "true"
    declared = (env.get("JHADINA_HOMEBASE_TRUST_DOMAIN") == "OWNER_CONTROLLED"
                and env.get("JHADINA_HOMEBASE_PREFLIGHT_APPROVED") == "YES")
    remote = env.get("GOOGLE_HOMEBASE_RCLONE_REMOTE", "")
    backup_id = env.get("GOOGLE_HOMEBASE_BACKUP_FOLDER_ID", "")
    storage_root = env.get("JHADINA_BACKUP_ROOT", "")
    config = {
        "execution_not_hosted_actions": not hosted,
        "operator_declared_owner_controlled_host": declared,
        "rclone_remote_name_syntax_valid": bool(REMOTE_NAME.fullmatch(remote)),
        "private_drive_backup_folder_id_syntax_valid": bool(FOLDER_ID.fullmatch(backup_id)),
        "restic_password_file_private": secret_file_private,
        "backup_root_absolute": bool(storage_root and ABSOLUTE_PATH.match(storage_root)),
    }
    bin_checks = {f"{binary.replace('-', '_')}_installed": bool(present.get(binary, False))
                  for binary in REQUIRED_BINARIES}

    # No machine in this script is ever approved by env text alone.
    if hosted:
        next_action = "MOVE_TO_OWNER_CONTROLLED_RUNTIME"
    elif not declared:
        next_action = "REVIEW_RUNTIME_TRUST_AND_APPROVAL"
    elif not all(config.values()) or not all(bin_checks.values()):
        next_action = "COMPLETE_TRUSTED_WORKER_LOCAL_DEPENDENCIES"
    else:
        next_action = "RUN_SEPARATELY_APPROVED_REAL_OAUTH_AND_RESTORE_DRILLS"

    return {
        "schema": "jhadina.google-homebase.live-preflight.v1",
        "profile": "TRUSTED_WORKER_CANDIDATE",
        "mode": "LOCAL_DEPENDENCY_READ_ONLY",
        "checks": {**config, **bin_checks},
        "live_gates": gates,
        "source_merged": True,
        "new_billable_server_provisioned": False,
        "production_authority_changed": False,
        "overall_live_ready": False,
        "next_action": next_action,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("iphone", "trusted-worker"),
                        default="iphone")
    args = parser.parse_args(argv)
    try:
        env = dict(os.environ)
        present = {name: shutil.which(name) is not None for name in REQUIRED_BINARIES}
        result = audit(
            env=env,
            profile=args.profile,
            present=present,
            secret_file_private=private_secret_file(env.get("RESTIC_PASSWORD_FILE", "")),
        )
    except (OSError, ValueError) as error:
        # Never print environment values or credential-bearing paths.
        print("GOOGLE_HOMEBASE_PREFLIGHT_BLOCKED: invalid local configuration", file=sys.stderr)
        return 2

    print(json.dumps(result, sort_keys=True))
    # Return 0 for a successful READ-ONLY assessment, not for live readiness.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
