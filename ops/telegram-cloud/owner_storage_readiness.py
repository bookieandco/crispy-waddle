"""Read-only Telegram cloud storage attestation; never starts or reads Telegram.

Use only from an authenticated private SSH session on the dedicated worker.
This source-only utility is NOT included in the live pinned Railway image yet.
No API IDs, hashes, chats, phone numbers or account data enter its report.
"""
from __future__ import annotations

import argparse
import json
import os
import stat
from pathlib import Path

BASE = Path("/var/lib/jhadina-telegram")
OWNER = BASE / "private"
STATUS_SCHEMA = "jhadina.telegram.storage-readiness.v1"


def _safe_regular_file(path: Path, uid: int) -> bool:
    if path.is_symlink():
        return False
    if not path.exists():
        return True
    try:
        detail = path.stat()
    except OSError:
        return False
    return (stat.S_ISREG(detail.st_mode)
            and detail.st_uid == uid
            and stat.S_IMODE(detail.st_mode) == 0o600)


def storage_readiness(base: Path, private: Path, *,
                      uid: int, gid: int, is_mount=None) -> dict:
    """No filesystem mutations; do not open, hash or inspect session bytes."""
    result = {
        "schema": STATUS_SCHEMA,
        "status": "BLOCKED",
        "volumeMounted": False,
        "privateDirectoryVerified": False,
        "sessionFilePresent": False,
        "authorizedOwnerVerified": False,
        "sshHostKeyVerified": False,
        "telegramConnected": False,
        "sharkIntakeConnected": False,
        "aiTrainingEnabled": False,
        "tradingEnabled": False,
        "canSign": False,
    }
    try:
        mountcheck = is_mount if is_mount is not None else os.path.ismount
        if (not base.is_absolute() or base.is_symlink()
                or not base.is_dir() or not mountcheck(str(base))):
            return result
        base_info = base.stat()
        if (base_info.st_uid != uid or base_info.st_gid != gid
                or stat.S_IMODE(base_info.st_mode) != 0o700):
            return result
        result["volumeMounted"] = True
        if (not private.is_absolute() or private.parent != base
                or private.is_symlink() or not private.is_dir()):
            return result
        private_info = private.stat()
        if (private_info.st_uid != uid or private_info.st_gid != gid
                or stat.S_IMODE(private_info.st_mode) != 0o700):
            return result
        if not (_safe_regular_file(private / "owner.session", uid)
                and _safe_regular_file(private / "telegram-worker.lock", uid)):
            return result
        result["privateDirectoryVerified"] = True
        result["sessionFilePresent"] = (private / "owner.session").is_file()
        result["status"] = "STORAGE_ONLY_READY"
    except (OSError, PermissionError, ValueError):
        return result
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Read-only private-storage attestation")
    parser.add_argument("--offline-self-test", action="store_true")
    args = parser.parse_args(argv)
    # The actual service must have dropped root. No private strings printed.
    if args.offline_self_test:
        report = storage_readiness(BASE, OWNER, uid=os.geteuid(), gid=os.getegid(),
                                   is_mount=lambda _: False)
        assert report["status"] == "BLOCKED"
        print("TELEGRAM_STORAGE_GATE_SOURCE_ONLY_OK")
        return 0
    if os.geteuid() == 0:
        print(json.dumps({"schema": STATUS_SCHEMA, "status": "NONROOT_REQUIRED"}))
        return 2
    report = storage_readiness(BASE, OWNER, uid=os.geteuid(), gid=os.getegid())
    print(json.dumps(report, sort_keys=True))
    return 0 if report["status"] == "STORAGE_ONLY_READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
