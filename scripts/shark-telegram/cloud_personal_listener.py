"""Mac-free, owner-controlled cloud enrollment and personal Telegram runtime gate.

This does NOT run in GitHub Actions, Vercel, Cloudflare Workers or CI.
The production release manifest is independently HELD; no flag bypasses it.
Telegram text never leaves the existing ephemeral non-AI listener.
"""
from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
import re
import stat
import sys
from types import SimpleNamespace

from personal_release_gate import (assess_release, read_release_manifest,
                                   ReleaseEvidenceInvalid)
from telegram_intake import (user_reader, verify_telegram_user_identity)

API_HASH = re.compile(r"[a-fA-F0-9]{32}\Z")
POSITIVE = re.compile(r"[0-9]{1,20}\Z")


class CloudHold(RuntimeError):
    """Constant status only. Never include a secret or provider traceback."""


def assert_cloud_environment(env: dict[str, str], *, creating: bool = False,
                             is_mount=None) -> Path:
    """Verify a genuinely mounted dedicated persistent data area and owner scope.

    No directories or sessions are created by a read-only preflight or run.
    The operator must prepare a private, user-owned directory beforehand.
    """
    if any(env.get(k) for k in ("CI", "GITHUB_ACTIONS", "VERCEL", "CF_PAGES")):
        raise CloudHold("CLOUD_LISTENER_FORBIDDEN_IN_BUILD_ENVIRONMENT")
    if env.get("TELEGRAM_BOT_TOKEN") or env.get("TELEGRAM_HMAC_KEY"):
        raise CloudHold("CLOUD_PERSONAL_RUNTIME_MUST_NOT_REUSE_BOT_OR_RESEARCH_SECRETS")
    aid, ahash, owner = (env.get("TELEGRAM_API_ID", ""),
                         env.get("TELEGRAM_API_HASH", ""),
                         env.get("TELEGRAM_ALLOWED_USER_ID", ""))
    if (not POSITIVE.fullmatch(aid) or int(aid) == 0
            or not API_HASH.fullmatch(ahash)
            or not POSITIVE.fullmatch(owner) or int(owner) == 0):
        raise CloudHold("CLOUD_OWNER_CREDENTIAL_PREFLIGHT_FAILED")
    mount_value = env.get("TELEGRAM_CLOUD_MOUNT", "")
    private_value = env.get("TELEGRAM_PRIVATE_DIR", "")
    if not mount_value or not private_value:
        raise CloudHold("CLOUD_DEDICATED_STORAGE_REQUIRED")
    mount, root = Path(mount_value), Path(private_value)
    if not mount.is_absolute() or not root.is_absolute() or root == mount:
        raise CloudHold("CLOUD_PRIVATE_DIR_MUST_BE_INSIDE_DEDICATED_MOUNT")
    if not mount.exists() or mount.is_symlink() or not mount.is_dir():
        raise CloudHold("CLOUD_DEDICATED_MOUNT_UNAVAILABLE")
    check_mount = is_mount if is_mount is not None else os.path.ismount
    if not check_mount(str(mount)):
        raise CloudHold("CLOUD_STORAGE_NOT_PROVEN_MOUNTED")
    if mount.resolve() not in root.resolve().parents:
        raise CloudHold("CLOUD_STORAGE_ESCAPE_REFUSED")
    if root.is_symlink():
        raise CloudHold("CLOUD_PRIVATE_DIR_SYMLINK_REFUSED")
    if not root.is_dir():
        raise CloudHold("CLOUD_PRIVATE_DIR_MISSING_PREPARE_PRIVATELY")
    mode = root.stat()
    if (mode.st_uid != os.geteuid()
            or stat.S_IMODE(mode.st_mode) != 0o700):
        raise CloudHold("CLOUD_PRIVATE_DIR_OWNER_OR_MODE_UNSAFE")
    for filename in ("owner.session", "telegram-worker.lock"):
        candidate = root / filename
        if candidate.is_symlink():
            raise CloudHold("CLOUD_SESSION_OR_LOCK_SYMLINK_REFUSED")
        if candidate.exists() and (not candidate.is_file()
                                  or candidate.stat().st_uid != os.geteuid()
                                  or stat.S_IMODE(candidate.stat().st_mode) != 0o600):
            raise CloudHold("CLOUD_SESSION_OR_LOCK_OWNER_OR_MODE_UNSAFE")
    return root


def assert_session_present(root: Path) -> None:
    session = root / "owner.session"
    if not session.is_file() or session.is_symlink():
        raise CloudHold("CLOUD_OWNER_SESSION_NOT_ENROLLED")


def production_release_held() -> None:
    """Enforce the *existing* release authority; env flags cannot waive it."""
    evidence = Path(__file__).with_name("personal_release_evidence.json")
    try:
        code, _labels = assess_release(read_release_manifest(evidence), "release")
    except ReleaseEvidenceInvalid:
        raise CloudHold("CLOUD_INDEPENDENT_RELEASE_GATE_INVALID") from None
    if code != 0:
        raise CloudHold("CLOUD_PERSONAL_RUNTIME_HELD_PENDING_REAL_CERTIFICATION")


def assert_run_admission(env: dict[str, str], root: Path) -> None:
    assert_session_present(root)
    if (env.get("TELEGRAM_CLOUD_OWNER_APPROVED") != "true"
            or env.get("TELEGRAM_CLOUD_RIGHTS_REVIEWED") != "true"):
        raise CloudHold("CLOUD_OWNER_APPROVAL_AND_RIGHTS_REVIEW_REQUIRED")
    # Independent release gate currently refuses production. Do not override.
    production_release_held()


async def enroll(root: Path, env: dict[str, str]) -> None:
    """Initial OTP/2FA only over the owner's authenticated, interactive SSH TTY.

    No messages subscribed, scraped, forwarded, archived or transmitted to SHARK.
    Nothing identifying the account is printed.
    """
    from telethon import TelegramClient
    client = TelegramClient(str(root / "owner"), int(env["TELEGRAM_API_ID"]),
                            env["TELEGRAM_API_HASH"])
    try:
        await client.start()
        verify_telegram_user_identity(
            await client.get_me(), env["TELEGRAM_ALLOWED_USER_ID"])
    finally:
        await client.disconnect()
    if (root / "owner.session").is_symlink():
        raise CloudHold("CLOUD_SESSION_SYMLINK_REFUSED")
    os.chmod(root / "owner.session", 0o600)
    print("CLOUD_OWNER_ENROLLMENT_MATCHED_NO_LISTENER_STARTED")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Owner-only Telegram cloud preparation")
    parser.add_argument("action", choices=("preflight", "enroll", "run"))
    args = parser.parse_args(argv)
    try:
        os.umask(0o077)
        root = assert_cloud_environment(os.environ)
        if args.action == "preflight":
            assert_session_present(root)
            print("CLOUD_PRIVATE_STORAGE_AND_SESSION_PRESENT_NOT_NETWORK_VERIFIED")
            return 0
        if args.action == "enroll":
            if not sys.stdin.isatty() or os.environ.get("TELEGRAM_CLOUD_ENROLL_APPROVED") != "YES":
                raise CloudHold("CLOUD_ENROLL_REQUIRES_OWNER_SSH_TTY_AND_SEPARATE_CONSENT")
            print("CLOUD_OWNER_TELEGRAM_LOGIN_VIA_PRIVATE_SSH_TERMINAL")
            asyncio.run(enroll(root, os.environ))
            return 0
        assert_run_admission(os.environ, root)
        os.environ["TELEGRAM_CLOUD_NONINTERACTIVE"] = "1"
        # Reuse the sole personal-account event handler, never Bot API getUpdates.
        args_live = SimpleNamespace(
            mode="live", all_chats=True, chats=None, exclude_chats=None,
            days=30, max_per_chat=2000,
        )
        asyncio.run(user_reader(args_live, root, ""))
        return 0
    except (CloudHold, ReleaseEvidenceInvalid) as exc:
        print(str(exc))
        return 1
    except (KeyboardInterrupt, EOFError):
        print("CLOUD_OWNER_TERMINATED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
