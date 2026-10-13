"""SHARK / Jhadina read-only Telegram research intake.
Modes: backfill and live (Telethon owner session), forwards (Bot API inbox).
Only owner-approved chats; saves derived token signals, never raw message text.
Never save a Telegram session or token in GitHub, Colab, or Google Drive.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SOL_RE = re.compile(r"(?<![1-9A-HJ-NP-Za-km-z])([1-9A-HJ-NP-Za-km-z]{32,44})(?![1-9A-HJ-NP-Za-km-z])")
EVM_RE = re.compile(r"(?<![A-Za-z0-9])(0[xX][A-Fa-f0-9]{40})(?![A-Za-z0-9])")
CONTEXT = re.compile(r"\b(?:ca|mint|token|address|contract|solana|pump\.fun|pumpswap|raydium|dexscreener)\b", re.I)
TAGS = {
    "MIGRATION_CLAIM": re.compile(r"\b(?:migrat(?:e|ed|es|ing|ion)|graduat(?:e|ed|ion)|bonding\s+curve)\b", re.I),
    "PUMPSWAP_MENTION": re.compile(r"\bpump\s?swap\b", re.I),
    "RAYDIUM_MENTION": re.compile(r"\braydium\b", re.I),
    "RUG_RISK_CLAIM": re.compile(r"\b(?:rug(?:ged|pull)?|honeypot|liquidity\s+pulled)\b", re.I),
}

def utc(value):
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone aware")
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def find_contracts(text):
    """String formats are not blockchain identity or liquidity verification."""
    evms = list(EVM_RE.finditer(text))
    found = {}
    for match in evms:
        a = match.group(1).lower()
        found[("evm_unresolved", a)] = {"chain_id": "evm_unresolved", "address": a}
    for match in SOL_RE.finditer(text):
        if any(match.start() < x.end() and match.end() > x.start() for x in evms):
            continue
        a = match.group(1)
        if a.lower().endswith("pump") or CONTEXT.search(text):
            found[("solana_candidate", a)] = {"chain_id": "solana_candidate", "address": a}
    return list(found.values())

def extract(text, chat_id, message_id, message_at, received_at, secret, mode):
    """No raw texts, sender identities, or unhashed chat identifiers in output."""
    if len(secret.encode()) < 32:
        raise ValueError("TELEGRAM_HMAC_KEY must be at least 32 bytes")
    digest = hmac.new(secret.encode(), f"{chat_id}:{message_id}".encode(), hashlib.sha256).hexdigest()
    labels = [name for name, pattern in TAGS.items() if pattern.search(text)]
    return [{
        "schema_version": "jhadina.telegram.token-signal.v1",
        "message_fingerprint": digest, "source": "owner_authorized_telegram",
        "reader_mode": mode, "message_time_utc": utc(message_at),
        "collected_at_utc": utc(received_at), "chain_id": item["chain_id"],
        "token_address": item["address"], "mentioned_tags": labels,
        "identity_verified": False, "migration_verified_onchain": False,
        "market_quote_verified": False, "scoring_eligible": False,
        "can_authorize_trade": False,
    } for item in find_contracts(text)]

def append_private(path, rows):
    if not rows:
        return 0
    path = Path(path).expanduser()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.is_symlink():
        raise PermissionError("refusing a symlink output")
    flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "a", encoding="utf8", closefd=False) as file:
            for row in rows:
                file.write(json.dumps(row, sort_keys=True) + "\n")
            file.flush()
            os.fsync(file.fileno())
    finally:
        os.close(fd)
    return len(rows)

def settings(mode):
    os.umask(0o077)
    root = Path(os.getenv("TELEGRAM_PRIVATE_DIR", "~/.local/share/jhadina-telegram")).expanduser()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    secret = os.getenv("TELEGRAM_HMAC_KEY", "")
    if len(secret.encode()) < 32:
        raise SystemExit("Set a private 32+ byte TELEGRAM_HMAC_KEY; never commit it")
    return root, secret

async def user_reader(args, root, secret):
    try:
        from telethon import TelegramClient, events, utils
    except ImportError as error:
        raise SystemExit("Install pinned Telethon on your trusted device") from error
    if not args.chats or not 1 <= args.days <= 90 or not 1 <= args.max_per_chat <= 10000:
        raise SystemExit("Specify allowed --chats, --days 1..90, --max-per-chat 1..10000")
    api_id, api_hash = os.getenv("TELEGRAM_API_ID", ""), os.getenv("TELEGRAM_API_HASH", "")
    if not api_id.isdigit() or not api_hash:
        raise SystemExit("Set TELEGRAM_API_ID and TELEGRAM_API_HASH locally from my.telegram.org")
    output = root / "owner-derived-signals.jsonl"
    # Interactive authentication takes place ONLY on the owner's trusted local machine.
    client = TelegramClient(str(root / "owner"), int(api_id), api_hash)
    await client.start()
    try:
        entities = [await client.get_entity(chat) for chat in args.chats]
        approved = {str(utils.get_peer_id(entity)) for entity in entities}
        def capture(message, peer_id):
            if str(peer_id) not in approved or not getattr(message, "message", None):
                return 0
            rows = extract(message.message, str(peer_id), message.id, message.date,
                           datetime.now(timezone.utc), secret, args.mode)
            return append_private(output, rows)
        if args.mode == "backfill":
            minimum = datetime.now(timezone.utc) - timedelta(days=args.days)
            count = 0
            for entity in entities:
                async for msg in client.iter_messages(entity, limit=args.max_per_chat):
                    if not msg.date or msg.date < minimum:
                        break
                    count += capture(msg, utils.get_peer_id(entity))
            print("BACKFILL_COMPLETED", count, "derived mentions; no raw text saved")
        else:
            @client.on(events.NewMessage(chats=entities))
            async def new_message(event):
                count = capture(event.message, event.chat_id)
                if count:
                    print("NEW_TOKEN_MENTIONS", count)
            print("READ_ONLY_LIVE_LISTENER_STARTED", len(approved), "approved chats")
            await client.run_until_disconnected()
    finally:
        await client.disconnect()

def process_bot_update(update, owner_id, secret):
    msg = update.get("message", {})
    if msg.get("chat", {}).get("type") != "private" or msg.get("from", {}).get("id") != owner_id:
        return []
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return []
    return extract(text, str(msg["chat"]["id"]), int(msg["message_id"]),
                   datetime.fromtimestamp(msg["date"], tz=timezone.utc),
                   datetime.now(timezone.utc), secret, "forwarded_bot")

def bot_get_updates(token, offset):
    query = urllib.parse.urlencode({
        "offset": offset, "timeout": 15, "allowed_updates": json.dumps(["message"])
    })
    req = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/getUpdates?" + query,
        headers={"User-Agent": "Jhadina-ResearchOnly/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        obj = json.loads(response.read(2_000_000))
    if not obj.get("ok") or not isinstance(obj.get("result"), list):
        raise RuntimeError("Telegram unavailable")
    return obj["result"]

EXPECTED_BOT_USERNAME = "R2dice2bot"

def verify_bot_identity(identity):
    """Fail closed if the provided secret belongs to a different Telegram bot."""
    if (not isinstance(identity, dict) or identity.get("is_bot") is not True
            or str(identity.get("username", "")).casefold() != EXPECTED_BOT_USERNAME.casefold()):
        raise RuntimeError("TELEGRAM_BOT_USERNAME_MISMATCH: expected @R2dice2bot")
    return {"id": identity.get("id"), "username": identity["username"]}

def bot_readonly_api(token, method):
    if method not in ("getMe", "getWebhookInfo"):
        raise ValueError("only read-only Telegram bot introspection is allowed")
    req = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/" + method,
        headers={"User-Agent": "Jhadina-ResearchOnly/1.0"}
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        payload = json.loads(response.read(32768))
    if not payload.get("ok") or not isinstance(payload.get("result"), dict):
        raise RuntimeError("TELEGRAM_BOT_PREFLIGHT_UNAVAILABLE")
    return payload["result"]

def bot_get_me(token):
    return verify_bot_identity(bot_readonly_api(token, "getMe"))

def assert_bot_polling_safe(webhook_info):
    """Never delete, override, or consume an existing bot webhook."""
    if not isinstance(webhook_info, dict):
        raise RuntimeError("TELEGRAM_WEBHOOK_STATUS_UNAVAILABLE")
    if webhook_info.get("url"):
        raise RuntimeError("TELEGRAM_EXISTING_WEBHOOK_REQUIRES_OWNER_REVIEW")
    return True

def verify_bot_setup(token):
    identity = bot_get_me(token)
    assert_bot_polling_safe(bot_readonly_api(token, "getWebhookInfo"))
    return identity

def pairing_user_id(update, challenge, started_at):
    """Accept an interactive owner pairing only with fresh, exact private challenge."""
    message = update.get("message", {})
    if (message.get("chat", {}).get("type") != "private"
            or message.get("text") != "/pair " + challenge
            or message.get("date", 0) < started_at):
        return None
    sender_id = message.get("from", {}).get("id")
    if not isinstance(sender_id, int) or isinstance(sender_id, bool) or sender_id <= 0:
        return None
    if message.get("chat", {}).get("id") != sender_id:
        return None
    return sender_id

def pair_owner(root):
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN privately on your trusted device")
    identity = verify_bot_setup(token)
    challenge = secrets.token_urlsafe(18)
    started_at = int(time.time())
    expires_at = time.monotonic() + 180
    print("PAIRED_BOT", "@" + identity["username"])
    print("SEND_FROM_YOUR_TELEGRAM_ACCOUNT:", "/pair " + challenge)
    print("Send that command in the bot's private Telegram chat within three minutes.")
    offset = 0
    while time.monotonic() < expires_at:
        try:
            for update in bot_get_updates(token, offset):
                offset = max(offset, int(update["update_id"]) + 1)
                owner_id = pairing_user_id(update, challenge, started_at)
                if owner_id is None:
                    continue
                target = root / "paired-owner-id.txt"
                if target.is_symlink():
                    raise PermissionError("refusing symlink owner ID")
                tmp = root / "paired-owner-id.txt.tmp"
                if tmp.is_symlink():
                    raise PermissionError("refusing symlink pairing file")
                fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0), 0o600)
                try:
                    os.fchmod(fd, 0o600)
                    with os.fdopen(fd, "w", closefd=False) as out:
                        out.write(str(owner_id) + "\n")
                        out.flush()
                        os.fsync(out.fileno())
                finally:
                    os.close(fd)
                tmp.replace(target)
                print("PAIR_SUCCESS: set TELEGRAM_ALLOWED_USER_ID to", owner_id, "on your trusted worker")
                return
        except (OSError, TimeoutError, RuntimeError, ValueError):
            print("PAIR_POLL_RETRY")
            time.sleep(3)
    raise SystemExit("Pairing expired; restart to get a new challenge")

def forwarded_bot(root, secret):
    token, owner = os.getenv("TELEGRAM_BOT_TOKEN", ""), os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
    if not owner and (root / "paired-owner-id.txt").is_file():
        owner = (root / "paired-owner-id.txt").read_text(encoding="ascii").strip()
    if not token or not owner.isdigit():
        raise SystemExit("Set Telegram bot token and allowed owner's numeric Telegram ID locally")
    verified = verify_bot_setup(token)
    print("TELEGRAM_EXPECTED_BOT_VERIFIED", "@" + verified["username"])
    output = root / "forwarded-derived-signals.jsonl"
    checkpoint = root / "forwarded-update-offset.txt"
    offset = int(checkpoint.read_text().strip()) if checkpoint.exists() else 0
    print("OWNER_ONLY_FORWARD_INBOX_ACTIVE; no historical chat access or transactions")
    while True:
        try:
            updates = bot_get_updates(token, offset)
            for update in updates:
                next_id = int(update["update_id"]) + 1
                if next_id <= offset:
                    continue
                rows = process_bot_update(update, int(owner), secret)
                append_private(output, rows)
                # Offset is advanced only after durable local append.
                tmp = checkpoint.with_suffix(".tmp")
                tmp.write_text(str(next_id), encoding="ascii")
                os.chmod(tmp, 0o600)
                tmp.replace(checkpoint)
                offset = next_id
                if rows:
                    print("NEW_TOKEN_MENTIONS", len(rows))
        except (OSError, TimeoutError, ValueError, RuntimeError):
            print("Telegram poll temporarily unavailable; retrying")
            time.sleep(10)

def main():
    parser = argparse.ArgumentParser(description="Research only. No wallet, no trades.")
    parser.add_argument("mode", choices=("backfill", "live", "forwarded-bot", "export", "pair-owner"))
    parser.add_argument("--chats", nargs="+", help="Explicit authorized Telegram chat IDs or @usernames")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--max-per-chat", type=int, default=2000)
    args = parser.parse_args()
    root, secret = settings(args.mode)
    if args.mode == "pair-owner":
        pair_owner(root)
    elif args.mode == "export":
        from telegram_research_bridge import save_private_watchlist
        print("LOCAL_WATCHLIST_CANDIDATES_UNAPPROVED", save_private_watchlist(root))
    elif args.mode == "forwarded-bot":
        forwarded_bot(root, secret)
    else:
        asyncio.run(user_reader(args, root, secret))

if __name__ == "__main__":
    main()
