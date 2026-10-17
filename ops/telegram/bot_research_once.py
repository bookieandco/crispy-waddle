"""One-shot, owner-only Telegram forward research preview.

Runs only by explicit manual GitHub Actions dispatch on trusted main.
Requires a fresh direct /research-digest TAG after forwarding messages to
@R2dice2bot. Reads up to 100 *unacknowledged* updates with offset 0 and
does not consume, store or export their contents. No channel/source
identities are copied or logged. Candidate contracts and claims are sent
only to the previously allowlisted owner's private Telegram chat.

This is an ephemeral preview, NOT durable SHARK ingestion, source learning,
on-chain verification, investment advice, market data or trading authority.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

from bot_inbox_receipt import (
    SmokeCheckError, TAG_PATTERN, bot_api, is_expected_receipt,
    validate_preflight, MAX_RESPONSE_BYTES,
)

COMMAND = "/research-digest "
DIRECT_TOKEN_COMMAND = "/research-token "
DIRECT_NOTE_COMMAND = "/research-note "
WINDOW_SECONDS = 6 * 60 * 60
MAX_MESSAGE_BYTES = 12000
MAX_REPLY_ITEMS = 5
SOLANA_PATTERN = re.compile(
    r"(?<![1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,44})(?![1-9A-HJ-NP-Za-km-z])"
)
EVM_PATTERN = re.compile(r"(?<![A-Za-z0-9])(0[xX][0-9A-Fa-f]{40})(?![A-Za-z0-9])")
TOKEN_CONTEXT = re.compile(
    r"\b(?:CA|mint|token|address|contract|solana|pump\.fun|pumpswap|raydium|dexscreener)\b", re.I
)
MIGRATION = re.compile(
    r"\b(?:migrat(?:e|ed|es|ing|ion)|graduat(?:e|ed|ion)|bonding\s+curve)\b", re.I
)
PUMPSWAP = re.compile(r"\bpump\s?swap\b", re.I)
RUG = re.compile(r"\b(?:rug(?:ged|pull)?|honeypot|liquidity\s+pulled)\b", re.I)


def _positive_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _owner_message(update: object, owner_id: int) -> dict | None:
    if not isinstance(update, dict):
        return None
    msg = update.get("message")
    if not isinstance(msg, dict):
        return None
    sender, chat = msg.get("from"), msg.get("chat")
    if not isinstance(sender, dict) or not isinstance(chat, dict):
        return None
    if (not _positive_int(owner_id)
            or chat.get("type") != "private"
            or not _positive_int(sender.get("id"))
            or not _positive_int(chat.get("id"))
            or sender["id"] != owner_id or chat["id"] != owner_id):
        return None
    return msg


def _is_forward(msg: dict) -> bool:
    return any(msg.get(key) for key in (
        "forward_origin", "forward_from", "forward_from_chat",
        "forward_sender_name", "forward_date",
    ))


def _manual_research_body(msg: dict) -> str | None:
    """Only direct, unedited, owner-typed research commands; never arbitrary DMs."""
    if msg.get("edit_date") or msg.get("via_bot"):
        return None
    text = msg.get("text")
    if not isinstance(text, str):
        return None
    if text.startswith(DIRECT_TOKEN_COMMAND):
        token = text[len(DIRECT_TOKEN_COMMAND):].strip()
        if not (SOLANA_PATTERN.fullmatch(token) or EVM_PATTERN.fullmatch(token)):
            return None
        return "CA " + token
    if text.startswith(DIRECT_NOTE_COMMAND):
        note = text[len(DIRECT_NOTE_COMMAND):]
        return note if note.strip() else None
    return None


def _contracts(text: str) -> list[tuple[str, str]]:
    """Format-only candidates. No identity, chain or mint checks."""
    found: dict[tuple[str, str], None] = {}
    evms = list(EVM_PATTERN.finditer(text))
    for match in evms:
        found[("evm_unresolved", match.group(1).lower())] = None
    for match in SOLANA_PATTERN.finditer(text):
        if any(match.start() < x.end() and match.end() > x.start() for x in evms):
            continue
        candidate = match.group(1)
        if candidate.lower().endswith("pump") or TOKEN_CONTEXT.search(text):
            found[("solana_candidate", candidate)] = None
    return list(found)


def collect_preview(updates: object, owner_id: int, tag: str, now: int) -> dict | None:
    """No output until an owner-sent fresh, unforwarded matching command."""
    if not TAG_PATTERN.fullmatch(tag) or not _positive_int(owner_id):
        raise SmokeCheckError("INVALID_OWNER_OR_TAG")
    if not isinstance(updates, list):
        raise SmokeCheckError("TELEGRAM_UPDATES_UNAVAILABLE")
    commands = []
    for update in updates:
        msg = _owner_message(update, owner_id)
        if (msg and _positive_int(update.get("update_id")) and
                is_expected_receipt(update, COMMAND + tag, now, owner_id)):
            commands.append((update["update_id"], msg["date"]))
    if not commands:
        return None
    command_update, command_time = max(commands)
    earliest = max(now - WINDOW_SECONDS, command_time - WINDOW_SECONDS)
    candidates: dict[tuple[str, str], dict] = {}
    forwarded_seen = 0
    direct_seen = 0
    for update in updates:
        msg = _owner_message(update, owner_id)
        if not msg or not _positive_int(update.get("update_id")):
            continue
        if update["update_id"] >= command_update:
            continue
        when = msg.get("date")
        if (not _positive_int(when) or when < earliest
                or when > command_time or when > now + 30):
            continue
        # The bot inbox receipt is the first time the forward became
        # available. Never backdate it to the upstream channel's date.
        is_forward = _is_forward(msg)
        body = ((msg.get("text") or msg.get("caption") or "") if is_forward
                else _manual_research_body(msg))
        if not isinstance(body, str) or len(body.encode("utf-8")) > MAX_MESSAGE_BYTES:
            continue
        if is_forward:
            forwarded_seen += 1
        else:
            direct_seen += 1
        unique = set(_contracts(body))
        for key in unique:
            entry = candidates.setdefault(key, {
                "chain": key[0], "address": key[1],
                "mentions": 0, "owner_forwarded_mentions": 0,
                "owner_direct_mentions": 0, "migration_claims": 0,
                "pumpswap_mentions": 0, "rug_risk_claims": 0,
            })
            entry["mentions"] += 1
            entry["owner_forwarded_mentions" if is_forward else "owner_direct_mentions"] += 1
            entry["migration_claims"] += bool(MIGRATION.search(body))
            entry["pumpswap_mentions"] += bool(PUMPSWAP.search(body))
            entry["rug_risk_claims"] += bool(RUG.search(body))
    ranked = sorted(candidates.values(),
                    key=lambda x: (-x["mentions"], x["chain"], x["address"]))
    return {
        "forwarded_message_count": forwarded_seen,
        "direct_message_count": direct_seen,
        "candidate_count": len(ranked),
        "candidates": ranked[:MAX_REPLY_ITEMS],
        "more_count": max(0, len(ranked) - MAX_REPLY_ITEMS),
        "source": "owner_submitted_bot_inbox",
        "durably_stored": False,
        "chain_verified": False,
        "market_data_verified": False,
        "trade_approved": False,
    }


def format_private_preview(preview: dict) -> str:
    lines = [
        "Jhadina SHARK | Telegram research preview",
        "PRIVATE / OWNER ONLY | Unverified claims",
        "",
        "Forwarded messages checked: " + str(preview["forwarded_message_count"]),
        "Direct owner submissions checked: " + str(preview["direct_message_count"]),
        "Distinct token-format candidates: " + str(preview["candidate_count"]),
    ]
    for i, candidate in enumerate(preview["candidates"], 1):
        chain = "Solana-format" if candidate["chain"] == "solana_candidate" else "EVM (chain unknown)"
        lines.extend([
            "",
            str(i) + ". " + chain,
            "Contract candidate: " + candidate["address"],
            "Owner-forwarded mentions: " + str(candidate["owner_forwarded_mentions"]),
            "Owner-direct mentions: " + str(candidate["owner_direct_mentions"]),
            "Migration CLAIMS: " + str(candidate["migration_claims"]),
            "PumpSwap MENTIONS: " + str(candidate["pumpswap_mentions"]),
            "Risk CLAIMS: " + str(candidate["rug_risk_claims"]),
        ])
    if preview["candidate_count"] == 0:
        lines.append("\nNo token-format candidates detected in qualifying submissions.")
    if preview["more_count"]:
        lines.append("\nAdditional candidate contracts omitted: " + str(preview["more_count"]))
    lines.extend([
        "",
        "None of these contracts, claims or migrations were verified on-chain.",
        "No prices, returns, trades or SHARK model scores were computed.",
        "Nothing was saved as durable memory. Older forwarded messages are NOT early predictions.",
        "The read-only inbox probe does not ACK Telegram updates.",
        "A permanent listener requires separate secure storage and approval.",
    ])
    return "\n".join(lines)


def send_private_preview(token: str, owner_id: int, message: str) -> None:
    """Private bot reply; redact HTTP errors containing the secret-bearing URL."""
    if not _positive_int(owner_id) or len(message) > 3700:
        raise SmokeCheckError("INVALID_PRIVATE_PREVIEW")
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        data=json.dumps({
            "chat_id": owner_id, "text": message,
            "protect_content": True, "disable_notification": True,
        }).encode("utf-8"),
        headers={"Content-Type": "application/json",
                 "User-Agent": "Jhadina-SHARK-OneShot/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise SmokeCheckError("PRIVATE_REPLY_TOO_LARGE")
        result = json.loads(body)
        if not isinstance(result, dict) or result.get("ok") is not True:
            raise SmokeCheckError("PRIVATE_REPLY_UNAVAILABLE")
    except urllib.error.HTTPError:
        raise SmokeCheckError("PRIVATE_REPLY_HTTP_ERROR") from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise SmokeCheckError("PRIVATE_REPLY_UNAVAILABLE") from None


def execute_once(token: str, owner_id: int, tag: str, now: int) -> bool:
    validate_preflight(token)
    payload = bot_api(token, "getUpdates", {"offset": 0, "limit": 100, "timeout": 0})
    preview = collect_preview(payload.get("result"), owner_id, tag, now)
    if preview is None:
        return False
    send_private_preview(token, owner_id, format_private_preview(preview))
    return True


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    user = os.environ.get("TELEGRAM_ALLOWED_USER_ID", "").strip()
    tag = os.environ.get("TELEGRAM_RESEARCH_TAG", "")
    if not token or not user or not user.isascii() or not user.isdigit() or len(user) > 20:
        print("::error::TELEGRAM_BOT_OR_OWNER_SECRET_MISSING")
        return 1
    owner_id = int(user)
    if not _positive_int(owner_id):
        print("::error::INVALID_OWNER_ALLOWLIST")
        return 1
    try:
        sent = execute_once(token, owner_id, tag, int(time.time()))
    except SmokeCheckError as error:
        print("::error::" + str(error))
        return 1
    if not sent:
        print("::warning::FRESH_OWNER_RESEARCH_COMMAND_NOT_FOUND")
        print("Forward posts to your bot then send the exact /research-digest TAG and re-run manually.")
        return 1
    print("PRIVATE_OWNER_RESEARCH_PREVIEW_SENT")
    print("NO_CONTENT_IN_LOGS; NO_PERSISTENCE; NO_UPDATE_ACK; NO_TRADING")
    return 0


if __name__ == "__main__":
    sys.exit(main())
