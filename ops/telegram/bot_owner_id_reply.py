"""One-shot Telegram ID self-discovery via a direct reply to the same private chat.

Manual main-branch GitHub Actions only. The ID never enters workflow output;
the bot privately tells the requesting account its own numeric ID. This does
NOT grant ownership. The owner must separately save it to GitHub Actions Secrets.
No scraping, message ingestion, wallet access, or update acknowledgements.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

from bot_inbox_receipt import (
    SmokeCheckError, TAG_PATTERN, bot_api, is_expected_receipt, validate_preflight,
    MAX_RESPONSE_BYTES,
)

IDENTIFY_COMMAND = "/jhadina-id "
MAX_AGE_SECONDS = 10 * 60


def eligible_private_sender(update: object, tag: str, now: int) -> int | None:
    """Validate a fresh, original private message; return only its owner's ID."""
    if not is_expected_receipt(update, IDENTIFY_COMMAND + tag, now, None):
        return None
    message = update["message"]
    timestamp = message["date"]
    if timestamp < now - MAX_AGE_SECONDS:
        return None
    return message["from"]["id"]


def send_self_id(token: str, own_chat_id: int) -> None:
    """Only the requesting chat gets its own ID, using Telegram sendMessage."""
    if not isinstance(own_chat_id, int) or isinstance(own_chat_id, bool) or own_chat_id <= 0:
        raise SmokeCheckError("INVALID_ID_RECIPIENT")
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        data=json.dumps({
            "chat_id": own_chat_id,
            "text": (
                "Your Telegram numeric account ID is: " + str(own_chat_id)
                + "\n\nTo authorize your account for Jhadina, save that number "
                "in GitHub Actions as a repository secret named "
                "TELEGRAM_ALLOWED_USER_ID. Do not paste your Telegram bot token "
                "into messages, commits or pull requests.\n\n"
                "This message alone does not pair or activate the research reader."
            ),
            "protect_content": True,
            "disable_notification": True,
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Jhadina-Owner-ID-Self-Discovery/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            data = response.read(MAX_RESPONSE_BYTES + 1)
        if len(data) > MAX_RESPONSE_BYTES:
            raise SmokeCheckError("SEND_RESPONSE_TOO_LARGE")
        payload = json.loads(data)
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            raise SmokeCheckError("PRIVATE_REPLY_UNAVAILABLE")
    except urllib.error.HTTPError:
        raise SmokeCheckError("PRIVATE_REPLY_HTTP_ERROR") from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise SmokeCheckError("PRIVATE_REPLY_UNAVAILABLE") from None


def identify_once(token: str, tag: str, now: int) -> str:
    """No updates are acknowledged; never print IDs, raw updates, or tokens."""
    if not TAG_PATTERN.fullmatch(tag) or len(tag) < 12:
        raise SmokeCheckError("INVALID_ID_CHALLENGE_TAG")
    validate_preflight(token)
    payload = bot_api(token, "getUpdates", {"offset": 0, "limit": 100, "timeout": 0})
    updates = payload.get("result")
    if not isinstance(updates, list):
        raise SmokeCheckError("TELEGRAM_UPDATES_UNAVAILABLE")
    matching = {found for update in updates if (found := eligible_private_sender(update, tag, now)) is not None}
    if not matching:
        return "NO_MATCHING_RECENT_PRIVATE_COMMAND"
    if len(matching) != 1:
        raise SmokeCheckError("AMBIGUOUS_IDENTIFY_REQUESTS_REFUSED")
    send_self_id(token, matching.pop())
    return "PRIVATE_ACCOUNT_ID_REPLY_SENT"


def main() -> int:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    tag = os.getenv("TELEGRAM_ID_TAG", "")
    if not token:
        print("::error::BOT_SECRET_MISSING")
        return 1
    try:
        status = identify_once(token, tag, int(time.time()))
    except SmokeCheckError as error:
        print("::error::" + str(error))
        return 1
    if status != "PRIVATE_ACCOUNT_ID_REPLY_SENT":
        print("::warning::NO_MATCHING_RECENT_PRIVATE_COMMAND")
        print("Try sending the exact /jhadina-id command again, then manually re-run.")
        return 1
    print("PRIVATE_ACCOUNT_ID_REPLY_SENT")
    print("NO_OWNER_AUTOPAIRENROLLMENT; NO_ID_IN_LOGS; NO_UPDATE_ACK; NO_TRADE_AUTHORITY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
