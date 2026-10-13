"""Run Jhadina's *personal-account* Telegram listener on an owner's trusted Mac.

Prompts for your Telegram app ID/hash and your independently verified
numeric personal account ID. Nothing is sent to GitHub, Vercel, a website,
or a cloud secrets manager. No credentials are written to disk by this
launcher. Telethon stores its OWN sensitive authentication session locally
under ~/.local/share/jhadina-telegram/owner.session (mode 0600).

This opt-in mode observes ALL new incoming Telegram cloud messages, but
only runs ephemeral regex token-count checks. No raw/derived Telegram data
is saved, no AI/ML training, no wallet/trade access or model scoring.
"""
from __future__ import annotations

import getpass
import os
from pathlib import Path
import re
import subprocess
import sys

API_HASH_RE = re.compile(r"[0-9a-fA-F]{32}")
NUMERIC_RE = re.compile(r"[0-9]{1,20}")


class SecureSetupError(ValueError):
    """A safe error message, never containing secret data."""


def build_private_environment(base_env: dict[str, str],
                              api_id: str, api_hash: str, owner_id: str) -> dict[str, str]:
    """Validate credentials without logging and pass only to a local subprocess."""
    api_id = api_id.strip()
    api_hash = api_hash.strip()
    owner_id = owner_id.strip()
    if not NUMERIC_RE.fullmatch(api_id) or int(api_id) <= 0:
        raise SecureSetupError("INVALID_TELEGRAM_APP_ID")
    if not API_HASH_RE.fullmatch(api_hash):
        raise SecureSetupError("INVALID_TELEGRAM_APP_HASH")
    if not NUMERIC_RE.fullmatch(owner_id) or int(owner_id) <= 0:
        raise SecureSetupError("INVALID_VERIFIED_OWNER_ID")
    env = dict(base_env)
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_HMAC_KEY", "TELEGRAM_API_ID",
                "TELEGRAM_API_HASH", "TELEGRAM_ALLOWED_USER_ID"):
        env.pop(key, None)
    env["TELEGRAM_API_ID"] = api_id
    env["TELEGRAM_API_HASH"] = api_hash
    env["TELEGRAM_ALLOWED_USER_ID"] = owner_id
    return env


def prepare_live_command(python_executable: str, script_dir: Path,
                         excluded: list[str] | None = None) -> list[str]:
    """No arbitrary shell expansions or code injection."""
    command = [python_executable, str(script_dir / "telegram_intake.py"),
               "live", "--all-chats"]
    if excluded:
        if any(not entry or not entry.strip() or entry.startswith("-") for entry in excluded):
            raise SecureSetupError("INVALID_EXCLUDED_CHAT")
        command.extend(["--exclude-chats", *excluded])
    return command


def main() -> int:
    if any(os.environ.get(key) for key in ("GITHUB_ACTIONS", "CI", "VERCEL")):
        print("::error::TELEGRAM_PERSONAL_SESSION_FORBIDDEN_IN_CLOUD_BUILD")
        return 1
    if not sys.stdin.isatty():
        print("RUN_ON_TRUSTED_MAC_TERMINAL_ONLY")
        return 1
    print("JHADINA — TELEGRAM PERSONAL ACCOUNT SETUP")
    print("Runs ONLY on this computer. Do not type secrets into GitHub Actions or chat.")
    print("Watch ALL NEW incoming cloud messages; local, ephemeral regex counts only.")
    print("No message archive, no AI training, no trading.")
    print("To stop monitoring, press Control-C in this Terminal.")
    consent = input("Begin personal Telegram login on THIS Mac? Type YES: ").strip()
    if consent != "YES":
        print("SETUP_CANCELLED")
        return 1
    api_id = getpass.getpass("App api_id (input hidden): ")
    api_hash = getpass.getpass("App api_hash (input hidden): ")
    owner_id = getpass.getpass("Your numeric account ID from @R2dice2bot (hidden): ")
    try:
        env = build_private_environment(os.environ, api_id, api_hash, owner_id)
        command = prepare_live_command(sys.executable, Path(__file__).resolve().parent)
    except SecureSetupError as error:
        print(str(error))
        return 1
    # Avoid retaining copies of these values in the launcher longer than needed.
    del api_id, api_hash, owner_id
    print("STARTING_LOCAL_TELEGRAM_LOGIN")
    print("Any Telegram phone number, verification code or 2FA prompt appears")
    print("ONLY here in your trusted Mac Terminal. Never share those values.")
    try:
        outcome = subprocess.run(command, env=env, check=False)
        return outcome.returncode
    except KeyboardInterrupt:
        print("LOCAL_LISTENER_STOPPED")
        return 130


if __name__ == "__main__":
    sys.exit(main())
