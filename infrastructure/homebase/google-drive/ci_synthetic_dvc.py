#!/usr/bin/env python3
"""Manual GitHub Actions canary: synthetic bytes ONLY, no production sources.

This is an optional cloud runner path requiring a dedicated service account
shared only with Jhadina's DVC assets folder. Never run Restic/MinIO/NATS,
database dumps, or real personal media on a hosted Actions worker.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import dvc_assets
import dvc_canary


class SyntheticCiError(RuntimeError):
    pass


def authorize(env: dict[str, str]) -> tuple[str, dict]:
    if (env.get("GITHUB_ACTIONS") != "true"
            or env.get("GITHUB_EVENT_NAME") != "workflow_dispatch"
            or env.get("GITHUB_REPOSITORY") != "bookieandco/crispy-waddle"
            or env.get("GOOGLE_HOMEBASE_CI_CANARY_APPROVED") != "SYNTHETIC-ONLY"):
        raise SyntheticCiError("GitHub manual synthetic-only approval required")
    if env.get("GOOGLE_HOMEBASE_CI_STORAGE_MODE") != "SHARED_DRIVE":
        raise SyntheticCiError("Standalone service accounts require a verified Workspace shared drive, not My Drive")
    url = dvc_assets.folder_url(env.get("GOOGLE_HOMEBASE_DVC_FOLDER_ID", "").strip())
    raw = env.get("GDRIVE_CREDENTIALS_DATA", "")
    if not 200 <= len(raw) <= 20000:
        raise SyntheticCiError("Missing or invalid service-account secret")
    try:
        identity = json.loads(raw)
    except ValueError:
        raise SyntheticCiError("Invalid service-account JSON") from None
    if (not isinstance(identity, dict)
            or identity.get("type") != "service_account"
            or not str(identity.get("client_email", "")).endswith(".gserviceaccount.com")
            or not str(identity.get("private_key", "")).startswith("-----BEGIN PRIVATE KEY-----")):
        raise SyntheticCiError("Dedicated Google service account credentials required")
    # Never output, log, or return the parsed private key.
    return url, identity


def run_canary(env: dict[str, str]) -> dict:
    folder, identity = authorize(env)
    with tempfile.TemporaryDirectory(prefix="jh-drive-ci-key-") as tmp:
        key = Path(tmp) / "key.json"
        os.chmod(tmp, 0o700)
        fd = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(identity, out)
        proof = dvc_canary.remote_roundtrip(folder, service_account_file=key)
    return {
        **proof,
        "execution": "GITHUB_MANUAL_SYNTHETIC_CI",
        "full_runtime_google_oauth_verified": False,
        "real_asset_archiving_certified": False,
        "real_database_recovery_certified": False,
    }


def main() -> int:
    try:
        os.umask(0o077)
        result = run_canary(dict(os.environ))
        print(json.dumps(result, sort_keys=True))
        return 0
    except (SyntheticCiError, dvc_assets.DvcSetupError, dvc_canary.CanaryError,
            OSError, ValueError) as err:
        print("GOOGLE_HOMEBASE_SYNTHETIC_CI_BLOCKED: " + str(err), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
