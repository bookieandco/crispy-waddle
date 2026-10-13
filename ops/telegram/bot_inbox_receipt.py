"""One-shot GitHub Actions Telegram Bot API inbox receipt, no owner enrollment.

Intended ONLY for a trusted main-branch workflow_dispatch. Telegram bot tokens
are read from GitHub Actions secrets and never printed, persisted, or uploaded.
No message bodies, user IDs or bot updates are emitted to workflow logs.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BOT_USERNAME = "r2dice2bot"
TAG_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,48}$")
MAX_RESPONSE_BYTES = 2_000_000
MAX_AGE_SECONDS = 15 * 60


class SmokeCheckError(Exception):
    """Messages are intentionally safe to print in public CI logs."""


def bot_api(token: str, method: str, body: dict | None = None) -> dict:
    """The only supported bot methods cannot send a Telegram message."""
    if method not in ("getMe", "getWebhookInfo", "getUpdates"):
        raise SmokeCheckError("UNSUPPORTED_API_METHOD")
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/" + method,
        data=json.dumps(body or {}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Jhadina-Owner-Inbox-Smoke/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            content = response.read(MAX_RESPONSE_BYTES + 1)
        if len(content) > MAX_RESPONSE_BYTES:
            raise SmokeCheckError("TELEGRAM_RESPONSE_TOO_LARGE")
        result = json.loads(content)
        if result.get("ok") is not True:
            raise SmokeCheckError("TELEGRAM_API_BAD_RESPONSE")
        return result
    except urllib.error.HTTPError as error:
        if error.code == 409:
            raise SmokeCheckError("TELEGRAM_UPDATE_CONSUMER_CONFLICT") from None
        raise SmokeCheckError("TELEGRAM_API_HTTP_ERROR") from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise SmokeCheckError("TELEGRAM_API_UNAVAILABLE") from None


def is_expected_receipt(update: object, expected_command: str,
                        now: int, allowed_user_id: int | None) -> bool:
    """No auto-enrollment; only match a recent direct private text message."""
    if not isinstance(update, dict):
        return False
    msg = update.get("message")
    if not isinstance(msg, dict):
        return False
    chat = msg.get("chat")
    sender = msg.get("from")
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return False
    sender_id, chat_id = sender.get("id"), chat.get("id")
    if (chat.get("type") != "private"
            or not isinstance(sender_id, int)
            or isinstance(sender_id, bool) or sender_id <= 0
            or chat_id != sender_id
            or (allowed_user_id is not None and sender_id != allowed_user_id)):
        return False
    # Forwarded text and edits cannot prove the account freshly typed the challenge.
    if (msg.get("forward_origin") or msg.get("forward_from")
            or msg.get("forward_from_chat") or msg.get("via_bot")
            or msg.get("edit_date")):
        return False
    event_time = msg.get("date")
    if (not isinstance(event_time, int) or isinstance(event_time, bool)
            or event_time < now - MAX_AGE_SECONDS or event_time > now + 30):
        return False
    return msg.get("text") == expected_command


def validate_preflight(token: str) -> None:
    me = bot_api(token, "getMe").get("result")
    if (not isinstance(me, dict) or me.get("is_bot") is not True
            or str(me.get("username", "")).casefold() != BOT_USERNAME):
        raise SmokeCheckError("BOT_USERNAME_MISMATCH")
    info = bot_api(token, "getWebhookInfo").get("result")
    if not isinstance(info, dict):
        raise SmokeCheckError("WEBHOOK_PREFLIGHT_UNAVAILABLE")
    if info.get("url"):
        raise SmokeCheckError("EXISTING_WEBHOOK_STOP")


def smoke_once(token: str, tag: str, owner: int | None, now: int) -> str:
    """Calls getUpdates with offset=0: never ACK, delete or skip pending updates."""
    if not TAG_PATTERN.fullmatch(tag):
        raise SmokeCheckError("INVALID_TEST_TAG")
    validate_preflight(token)
    updates = bot_api(token, "getUpdates", {
        "offset": 0,
        "limit": 100,
        "timeout": 0,
    }).get("result")
    if not isinstance(updates, list):
        raise SmokeCheckError("TELEGRAM_UPDATES_UNAVAILABLE")
    cmd = "/research-check " + tag
    if any(is_expected_receipt(item, cmd, now, owner) for item in updates):
        return "LIVE_RECEIPT_OWNER_ALLOWLISTED" if owner is not None else "LIVE_RECEIPT_UNPAIRED"
    return "NO_MATCHING_RECENT_RECEIPT"


def main() -> int:
    # GitHub workflow secrets never appear in logs or exception chains.
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    tag = os.environ.get("TELEGRAM_PROOF_TAG", "")
    allowed_id = os.environ.get("TELEGRAM_ALLOWED_USER_ID", "").strip()
    if not token:
        print("::error::TELEGRAM_BOT_TOKEN_MISSING")
        return 1
    if allowed_id:
        if not allowed_id.isascii() or not allowed_id.isdigit() or int(allowed_id) <= 0:
            print("::error::INVALID_TELEGRAM_ALLOWED_USER_ID_SECRET")
            return 1
        owner = int(allowed_id)
    else:
        owner = None
    try:
        status = smoke_once(token, tag, owner, int(time.time()))
    except SmokeCheckError as error:
        print("::error::" + str(error))
        return 1
    if status == "LIVE_RECEIPT_UNPAIRED":
        print("TELEGRAM_PRIVATE_MESSAGE_RECEIPT_CONFIRMED")
        print("OWNER_AUTHORIZATION_NOT_VERIFIED: test tag is not an identity credential")
        print("NO_UPDATE_ACK; NO_PRIVATE_MESSAGE_STORAGE; NO_TRADE_AUTHORITY")
        return 0
    if status == "LIVE_RECEIPT_OWNER_ALLOWLISTED":
        print("TELEGRAM_OWNER_ALLOWLISTED_MESSAGE_RECEIPT_CONFIRMED")
        print("NO_UPDATE_ACK; NO_PRIVATE_MESSAGE_STORAGE; NO_TRADE_AUTHORITY")
        return 0
    print("::warning::NO_MATCHING_RECENT_RECEIPT")
    print("The last 100 unconfirmed bot updates did not include the exact recent test command.")
    print("NO_UPDATE_ACK; NO_PRIVATE_MESSAGE_STORAGE; NO_TRADE_AUTHORITY")
    return 1


if __name__ == "__main__":
    sys.exit(main())
