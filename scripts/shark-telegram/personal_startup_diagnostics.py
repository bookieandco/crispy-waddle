"""TELEGRAM-LIVE.12: local, OFFLINE personal Telegram startup diagnostics.

Read-only. No account sign-in, Bot API, chats, network, secret values,
session reads, write operations, or token/model/trading permissions.
"""
from __future__ import annotations

from importlib import metadata
from pathlib import Path
import os
import sys

EXPECTED_TELETHON = "1.45.0"
MIN_PYTHON = (3, 11)


def startup_diagnostic(root: Path, *, python_version=None, telethon_version=None):
    """Return (can_attempt_login, public-only status labels).

    Private root/session validation is delegated to the existing guards.
    Injected version parameters exist solely for hermetic tests.
    This does NOT establish connectivity or ownership of a live session.
    """
    # Imported lazily so this module can be tested without installing Telethon.
    from telegram_intake import safe_operator_status
    if any(os.getenv(key) for key in ("GITHUB_ACTIONS", "CI", "VERCEL")):
        return False, ("PREFLIGHT_LOCAL_ONLY_CLOUD_FORBIDDEN", "NETWORK_NOT_CHECKED")
    versions = sys.version_info if python_version is None else python_version
    if tuple(versions[:2]) < MIN_PYTHON:
        return False, ("PREFLIGHT_PYTHON_TOO_OLD", "NETWORK_NOT_CHECKED")
    try:
        installed = metadata.version("Telethon") if telethon_version is None else telethon_version
    except metadata.PackageNotFoundError:
        return False, ("PREFLIGHT_TELETHON_MISSING", "NETWORK_NOT_CHECKED")
    if installed != EXPECTED_TELETHON:
        return False, ("PREFLIGHT_TELETHON_PIN_MISMATCH", "NETWORK_NOT_CHECKED")
    try:
        status = safe_operator_status(root)
    except (PermissionError, OSError):
        return False, ("PREFLIGHT_PRIVATE_STORAGE_UNSAFE", "NETWORK_NOT_CHECKED")
    # Keep the local lock state distinct from Telegram connectivity.
    return True, ("PREFLIGHT_LOCAL_READY_TO_ATTEMPT_LOGIN", status,
                  "NO_TELEGRAM_AUTH_NO_NETWORK_NO_MESSAGE_READ")


def main() -> int:
    root = Path(os.environ.get(
        "TELEGRAM_PRIVATE_DIR", "~/.local/share/jhadina-telegram")).expanduser()
    ready, lines = startup_diagnostic(root)
    for line in lines:
        print(line)
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
