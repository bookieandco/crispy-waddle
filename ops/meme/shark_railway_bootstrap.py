#!/usr/bin/env python3
"""Railway root-mounted volume bootstrap: minimally privileged, fail-closed.

Railway mounts volumes as root. RAILWAY_RUN_UID=0 is allowed ONLY for this
startup shim; it MUST drop to UID/GID 10001 before any SHARK worker, provider
read, Telegram output, or SQLite operation. No recursive chown. No service
provisioning, billing mutation, polling, Telegram read or wallet access here.
"""
from __future__ import annotations

import os
from pathlib import Path
import stat
import sys

UID = 10001
GID = 10001
MOUNT = "/state"
STATE = "/state/observations.sqlite3"
DEFAULT = ["--mode", "preflight", "--state-dir", MOUNT]
REQUIRED_RAILWAY_KEYS = (
    "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID",
    "RAILWAY_ENVIRONMENT_ID", "RAILWAY_VOLUME_NAME",
)
WORKER_MODES = ("once", "serve")


def _route(arguments: list[str], environment: dict) -> tuple[str, list[str]]:
    """Accept only exact preflight or separately armed research worker."""
    if arguments == DEFAULT:
        return "shark_host_acceptance.py", arguments
    if not arguments or arguments[0] != "--worker":
        raise ValueError("unrecognized_railway_start_command")
    if environment.get("SHARK_RAILWAY_WORKER_ENABLED") != "true":
        raise ValueError("railway_worker_not_operator_enabled")
    args = arguments[1:]
    if (args.count("--mode") != 1 or args.count("--state") != 1 or
            args.count("--confirm") != 1):
        raise ValueError("railway_worker_arguments_incomplete")
    try:
        mode = args[args.index("--mode") + 1]
        state = args[args.index("--state") + 1]
        confirm = args[args.index("--confirm") + 1]
    except IndexError:
        raise ValueError("railway_worker_arguments_incomplete") from None
    if (mode not in WORKER_MODES or state != STATE or
            confirm != "PUBLIC-MARKET-RESEARCH-ONLY"):
        raise ValueError("railway_worker_operation_not_allowlisted")
    if "--notify" in args and environment.get("SHARK_RAILWAY_ALERTS_ENABLED") != "true":
        raise ValueError("railway_private_alert_not_operator_enabled")
    if args.count("--notify") > 1:
        raise ValueError("railway_duplicate_notify_option")
    # Worker argparse enforces all remaining option names/values, and the
    # original independent host, provider, Telegram and research-only gates.
    return "shark_live_intelligence.py", args


def prepare_root_mounted_volume(environment: dict, *, mounts: set[str] | None = None) -> None:
    """Validate actual mount + existing entries, then ONLY chown mount root."""
    if os.geteuid() != 0 or os.getegid() != 0:
        raise ValueError("railway_bootstrap_requires_root")
    if (environment.get("SHARK_RAILWAY_VOLUME_BOOTSTRAP") != "true"
            or environment.get("RAILWAY_RUN_UID") != "0"
            or environment.get("RAILWAY_VOLUME_MOUNT_PATH") != MOUNT
            or any(not environment.get(k, "").strip()
                   for k in REQUIRED_RAILWAY_KEYS)):
        raise ValueError("railway_root_bootstrap_not_authorized")
    import shark_host_acceptance as host
    folder = Path(MOUNT)
    if folder.is_symlink() or os.path.realpath(MOUNT) != MOUNT:
        raise ValueError("railway_mount_path_untrusted")
    item = os.lstat(MOUNT)
    if not stat.S_ISDIR(item.st_mode) or item.st_uid not in (0, UID):
        raise ValueError("railway_mount_directory_untrusted")
    if mounts is None:
        with open("/proc/self/mountinfo", encoding="utf-8") as handle:
            mounts = host._mountpoints(handle.read())
    if MOUNT not in mounts or not os.path.ismount(MOUNT):
        raise ValueError("railway_explicit_volume_not_observed")
    # Fail closed on preexisting content not already owned by the unprivileged
    # worker. A root-owned database is NOT silently migrated or rewritten.
    with os.scandir(MOUNT) as entries:
        for entry in entries:
            meta = entry.stat(follow_symlinks=False)
            if (entry.name == "lost+found" and
                    stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0):
                continue
            if (stat.S_ISLNK(meta.st_mode) or
                    meta.st_uid != UID or meta.st_mode & 0o077):
                raise ValueError("railway_preexisting_state_requires_manual_repair")
    os.chown(MOUNT, UID, GID)
    os.chmod(MOUNT, 0o700)
    after = os.lstat(MOUNT)
    if (not stat.S_ISDIR(after.st_mode) or after.st_uid != UID or
            after.st_gid != GID or stat.S_IMODE(after.st_mode) != 0o700):
        raise ValueError("railway_volume_permission_change_unverified")


def drop_privileges() -> None:
    """Irreversibly drop supplementary groups, GID and UID before exec."""
    os.setgroups([])
    os.setgid(GID)
    os.setuid(UID)
    if os.geteuid() != UID or os.getegid() != GID:
        raise ValueError("railway_uid_drop_unverified")


def main(argv: list[str] | None = None) -> int:
    try:
        arguments = sys.argv[1:] if argv is None else argv
        environment = dict(os.environ)
        module, rest = _route(arguments, environment)
        uid = os.geteuid()
        if uid == 0:
            prepare_root_mounted_volume(environment)
            drop_privileges()
        elif uid != UID or os.getegid() != GID:
            raise ValueError("railway_nonroot_identity_invalid")
        script = Path(__file__).resolve().parent / module
        os.execv(sys.executable, [sys.executable, "-u", str(script), *rest])
    except (ValueError, OSError, PermissionError):
        # No credentials, internal file paths, message bodies or provider data.
        print("SHARK_RAILWAY_BOOTSTRAP_FAIL_CLOSED", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
