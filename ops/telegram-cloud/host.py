"""Railway volume bootstrap and inert, privilege-dropped staging process.

Not a Telegram receiver. The only runtime mode is 'hold'. Does not read the
account session, contact Telegram, open sockets or authorize SHARK trades.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import pwd
import stat
import sys
import time

MOUNT = Path("/var/lib/jhadina-telegram")
PRIVATE = MOUNT / "private"
OWNER = "jhadina"
SENSITIVE_FILES = ("owner.session", "telegram-worker.lock")


class HostHold(RuntimeError):
    pass


def prepare_volume(mount: Path, private: Path, owner_uid: int,
                   owner_gid: int, *, is_mount=None) -> None:
    """Create only the secret-free initial directory, never repair session files."""
    check_mount = is_mount if is_mount is not None else os.path.ismount
    if (not mount.is_absolute() or not private.is_absolute()
            or private.parent != mount or mount.is_symlink()
            or not mount.is_dir() or not check_mount(str(mount))):
        raise HostHold("TELEGRAM_CLOUD_PERSISTENT_VOLUME_NOT_VERIFIED")
    m = mount.stat()
    if (not stat.S_ISDIR(m.st_mode)
            or m.st_uid not in (0, owner_uid)):
        raise HostHold("TELEGRAM_CLOUD_VOLUME_OWNER_DENIED")
    if not private.exists() and not private.is_symlink():
        private.mkdir(mode=0o700)
        if os.geteuid() == 0:
            os.chown(private, owner_uid, owner_gid)
    if private.is_symlink() or not private.is_dir():
        raise HostHold("TELEGRAM_CLOUD_PRIVATE_FOLDER_UNSAFE")
    p = private.stat()
    if (p.st_uid != owner_uid or p.st_gid != owner_gid
            or stat.S_IMODE(p.st_mode) != 0o700):
        raise HostHold("TELEGRAM_CLOUD_PRIVATE_FOLDER_OWNER_OR_MODE_DENIED")
    for name in SENSITIVE_FILES:
        file = private / name
        if file.is_symlink():
            raise HostHold("TELEGRAM_CLOUD_SESSION_OR_LOCK_SYMLINK_DENIED")
        if file.exists():
            f = file.stat()
            if (not stat.S_ISREG(f.st_mode) or f.st_uid != owner_uid
                    or stat.S_IMODE(f.st_mode) != 0o600):
                raise HostHold("TELEGRAM_CLOUD_SESSION_OR_LOCK_OWNER_OR_MODE_DENIED")
    # The mount itself may initially be owned by root, but no other account.
    # Bring only its directory owner/mode under the single service identity.
    if os.geteuid() == 0 and (m.st_uid, m.st_gid) != (owner_uid, owner_gid):
        os.chown(mount, owner_uid, owner_gid)
    if os.geteuid() == 0:
        os.chmod(mount, 0o700)
    elif mount.stat().st_uid != owner_uid:
        raise HostHold("TELEGRAM_CLOUD_VOLUME_OWNER_DENIED")


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "hold"))
    args = parser.parse_args(argv)
    try:
        if args.mode == "prepare":
            if os.geteuid() != 0:
                raise HostHold("TELEGRAM_CLOUD_BOOTSTRAP_REQUIRES_ROOT")
            identity = pwd.getpwnam(OWNER)
            prepare_volume(MOUNT, PRIVATE, identity.pw_uid, identity.pw_gid)
            print("TELEGRAM_CLOUD_VOLUME_PREPARED_NO_ACCOUNT_LOGIN")
            return 0
        if os.geteuid() == 0:
            raise HostHold("TELEGRAM_CLOUD_INERT_PROCESS_MUST_BE_NONROOT")
        if os.environ.get("TELEGRAM_CLOUD_PROCESS_MODE", "hold") != "hold":
            raise HostHold("TELEGRAM_CLOUD_PRODUCTION_RUNTIME_HELD")
        if not PRIVATE.is_dir() or PRIVATE.is_symlink():
            raise HostHold("TELEGRAM_CLOUD_PRIVATE_STORAGE_MISSING")
        print("TELEGRAM_CLOUD_HELD_NO_TELEGRAM_CONNECTION_NO_TRADES", flush=True)
        while True:
            time.sleep(3600)
    except (HostHold, PermissionError, OSError, KeyError):
        # Never include paths, account IDs or private filesystem contents.
        print("TELEGRAM_CLOUD_HOST_STARTUP_DENIED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
