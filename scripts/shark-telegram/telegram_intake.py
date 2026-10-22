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
import urllib.error
import fcntl
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

class BotPollingConflict(RuntimeError):
    """Another consumer is using the Telegram bot updates queue."""

def safe_telegram_response(request, timeout, max_bytes):
    """Do not expose bot-token-bearing HTTP URLs in errors or cause chains."""
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise RuntimeError("TELEGRAM_RESPONSE_TOO_LARGE")
        return json.loads(data)
    except urllib.error.HTTPError as error:
        if error.code == 409:
            raise BotPollingConflict("TELEGRAM_BOT_POLLING_CONFLICT_STOP") from None
        raise RuntimeError("TELEGRAM_API_REQUEST_FAILED") from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise RuntimeError("TELEGRAM_API_REQUEST_FAILED") from None

def assert_persistent_runtime_storage(root):
    """Railway worker must use its attached durable volume, not container scratch."""
    if not os.getenv("RAILWAY_ENVIRONMENT_ID"):
        return
    volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if not volume:
        raise RuntimeError("RAILWAY_PERSISTENT_VOLUME_REQUIRED")
    mount = Path(volume).resolve()
    directory = Path(root).resolve()
    if mount not in (directory, *directory.parents):
        raise RuntimeError("TELEGRAM_PRIVATE_DIR_MUST_BE_INSIDE_RAILWAY_VOLUME")

def exclusive_worker_lock(root):
    """Exclusive advisory lock guards against two readers in the same volume."""
    path = root / "telegram-worker.lock"
    if path.is_symlink():
        raise PermissionError("refusing symlink lock")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        os.fchmod(fd, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BaseException:
        os.close(fd)
        raise
    return fd

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

def extract(text, chat_id, message_id, message_at, received_at, secret, mode, *, edit_at=None, event_kind=None):
    """No raw texts, sender identities, or unhashed chat identifiers in output."""
    if message_at.tzinfo is None or received_at.tzinfo is None:
        raise ValueError("Telegram timestamps must be timezone aware")
    if len(secret.encode()) < 32:
        raise ValueError("TELEGRAM_HMAC_KEY must be at least 32 bytes")
    digest = hmac.new(secret.encode(), f"{chat_id}:{message_id}".encode(), hashlib.sha256).hexdigest()
    source = hmac.new(secret.encode(), f"telegram-source:{chat_id}".encode(), hashlib.sha256).hexdigest()
    text_digest = hmac.new(secret.encode(), ("telegram-text:" + text).encode(), hashlib.sha256).hexdigest()
    if event_kind is None:
        event_kind = "BACKFILL" if mode == "backfill" else "NEW"
    if event_kind not in ("BACKFILL", "NEW", "EDIT"):
        raise ValueError("invalid Telegram event kind")
    if edit_at is not None and (edit_at.tzinfo is None or edit_at < message_at):
        raise ValueError("invalid Telegram edit date")
    content_version_time = edit_at or message_at
    if received_at < content_version_time:
        raise ValueError("Telegram content version cannot be in the future")
    labels = [name for name, pattern in TAGS.items() if pattern.search(text)]
    return [{
        "schema_version": "jhadina.telegram.token-signal.v1",
        "message_fingerprint": digest, "source": "owner_authorized_telegram",
        "source_fingerprint": source, "text_hmac_sha256": text_digest,
        "reader_mode": mode, "message_time_utc": utc(message_at),
        "event_kind": event_kind, "content_version_time_utc": utc(content_version_time),
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

def settings(mode, *, ephemeral_only=False):
    os.umask(0o077)
    root = Path(os.getenv("TELEGRAM_PRIVATE_DIR", "~/.local/share/jhadina-telegram")).expanduser()
    assert_persistent_runtime_storage(root)
    if root.is_symlink():
        raise SystemExit("TELEGRAM_PRIVATE_DIR_SYMLINK_REFUSED")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    secret = os.getenv("TELEGRAM_HMAC_KEY", "")
    # All-chat mode never persists, fingerprints or exports Telegram content,
    # so it doesn't require or invent a research-data HMAC key.
    if not ephemeral_only and len(secret.encode()) < 32:
        raise SystemExit("Set a private 32+ byte TELEGRAM_HMAC_KEY; never commit it")
    return root, secret

def validate_user_monitor_scope(args):
    """Explicitly opt into all new chats; backfill remains allowlist-only."""
    if not 1 <= args.days <= 90 or not 1 <= args.max_per_chat <= 10000:
        raise SystemExit("Use --days 1..90 and --max-per-chat 1..10000")
    chats = args.chats or []
    excluded = args.exclude_chats or []
    if args.mode == "backfill":
        if not chats or args.all_chats or excluded:
            raise SystemExit("BACKFILL_REQUIRES_EXPLICIT_CHATS; all-chat history is forbidden")
    elif args.mode == "live":
        if args.all_chats:
            if chats:
                raise SystemExit("Choose --all-chats OR --chats, not both")
        elif not chats or excluded:
            raise SystemExit("LIVE_REQUIRES_CHATS_OR_ALL_CHATS; exclusions require --all-chats")
    else:
        raise SystemExit("INVALID_USER_MONITOR_MODE")
    return chats, excluded


def should_capture_user_peer(peer_id, approved, excluded, all_chats):
    """Pure authorization boundary: never write messages from excluded peers."""
    if isinstance(peer_id, bool) or not isinstance(peer_id, int) or peer_id == 0:
        return False
    return peer_id not in excluded and (all_chats or peer_id in approved)


def verify_telegram_user_identity(user, owner_value):
    """All-inbox mode must use the same personal account verified with the bot."""
    if (not isinstance(owner_value, str) or not owner_value.isascii()
            or not owner_value.isdigit() or len(owner_value) > 20
            or int(owner_value) <= 0):
        raise SystemExit("Set TELEGRAM_ALLOWED_USER_ID locally to the verified owner numeric ID")
    user_id = getattr(user, "id", None)
    if (not isinstance(user_id, int) or isinstance(user_id, bool)
            or user_id != int(owner_value) or getattr(user, "bot", False)):
        raise SystemExit("TELEGRAM_PERSONAL_ACCOUNT_ID_MISMATCH_STOP")
    return True


def assert_telegram_user_session_host(root):
    """Personal Telegram login/session never runs in cloud CI or ephemeral builds."""
    if any(os.getenv(name) for name in ("GITHUB_ACTIONS", "VERCEL", "CI")):
        raise SystemExit("TELEGRAM_PERSONAL_SESSION_FORBIDDEN_IN_CI_OR_VERCEL")
    session = root / "owner.session"
    if session.is_symlink():
        raise PermissionError("refusing symlink Telegram owner session")
    if session.exists() and session.stat().st_mode & 0o077:
        raise PermissionError("Telegram owner session permissions must be 0600")
    return session


def ephemeral_crypto_observation(text):
    """Public-safe local counters, NOT a record of a Telegram message.

    Counts are transient, non-AI, address-free and never promoted to
    predictions, identity, chain, migrations, real quotes or trades.
    """
    if not isinstance(text, str) or len(text) > 16000:
        return {"candidates": 0, "solana_candidate": 0,
                "evm_unresolved": 0, "migration_claim": 0,
                "pumpswap_mention": 0, "rug_risk_claim": 0}
    candidates = find_contracts(text)
    n = len(candidates)
    return {
        "candidates": n,
        "solana_candidate": sum(x["chain_id"] == "solana_candidate" for x in candidates),
        "evm_unresolved": sum(x["chain_id"] == "evm_unresolved" for x in candidates),
        "migration_claim": int(bool(n and TAGS["MIGRATION_CLAIM"].search(text))),
        "pumpswap_mention": int(bool(n and TAGS["PUMPSWAP_MENTION"].search(text))),
        "rug_risk_claim": int(bool(n and TAGS["RUG_RISK_CLAIM"].search(text))),
    }


def ephemeral_local_notice(event_kind, signal):
    """No message text, address, source, sender, account ID, or timestamps."""
    if event_kind not in ("NEW", "EDIT") or not isinstance(signal, dict):
        raise ValueError("INVALID_LOCAL_EVENT_KIND")
    if not signal["candidates"]:
        return ""
    heading = "NEW_TOKEN_MENTIONS" if event_kind == "NEW" else "EDITED_TOKEN_MENTIONS"
    return (
        f"{heading} {signal['candidates']}"
        f" SOLANA_FORMAT {signal['solana_candidate']}"
        f" EVM_CHAIN_UNRESOLVED {signal['evm_unresolved']}"
        f" MIGRATION_CLAIM_ONLY {signal['migration_claim']}"
        f" PUMPSWAP_MENTION_ONLY {signal['pumpswap_mention']}"
        f" RUG_RISK_CLAIM_ONLY {signal['rug_risk_claim']}"
        " UNVERIFIED_NO_AI_NO_TRADE"
    )


def capture_user_message(message, peer_id, approved, excluded, all_chats,
                         mode, secret, output):
    """Read permitted new Telegram text; all-chat path is NON-AI and non-persistent.

    Telegram's API terms prohibit using its data to build or improve AI/ML.
    All-chat opt-in therefore does local deterministic pattern checks ONLY:
    no raw or derived Telegram record is saved, queued or sent to an AI model.
    """
    if not should_capture_user_peer(peer_id, approved, excluded, all_chats):
        return 0
    body = getattr(message, "message", None)
    if not isinstance(body, str) or not body:
        return 0
    if all_chats:
        # No AI learning, no export, no persistent content/source fingerprints.
        return ephemeral_crypto_observation(body)["candidates"]
    rows = extract(body, str(peer_id), message.id, message.date,
                   datetime.now(timezone.utc), secret, mode,
                   edit_at=message.edit_date,
                   event_kind="BACKFILL" if mode == "backfill"
                   else ("EDIT" if message.edit_date else "NEW"))
    return append_private(output, rows)


async def supervise_personal_connection(client, owner_value, *, sleeper=None,
                                        backoff_seconds=(2, 5, 15, 30, 60)):
    """Retry *transport* failures only; never silently reauthorize another user.

    Telethon handles many disconnects internally. When a recoverable transport
    exception nevertheless escapes, use bounded retries and reconfirm the
    independently verified owner on each successful reconnect. Cancellation,
    explicit shutdown, authentication errors, and malformed credentials do
    not retry. Status labels contain no exception messages or private IDs.
    """
    if sleeper is None:
        sleeper = asyncio.sleep
    try:
        await client.run_until_disconnected()
        print("TELEGRAM_LOCAL_LISTENER_STOPPED")
        return True
    except (ConnectionError, OSError, TimeoutError, asyncio.TimeoutError):
        print("TELEGRAM_CONNECTION_INTERRUPTED")

    for attempt, delay in enumerate(backoff_seconds, 1):
        if not isinstance(delay, int) or isinstance(delay, bool) or not 1 <= delay <= 120:
            raise ValueError("INVALID_RECONNECT_POLICY")
        print("TELEGRAM_RECONNECT_ATTEMPT", attempt)
        await sleeper(delay)
        try:
            await client.connect()
            verify_telegram_user_identity(await client.get_me(), owner_value)
            print("TELEGRAM_CONNECTION_RECOVERED_OWNER_VERIFIED")
            try:
                await client.run_until_disconnected()
                print("TELEGRAM_LOCAL_LISTENER_STOPPED")
                return True
            except (ConnectionError, OSError, TimeoutError, asyncio.TimeoutError):
                print("TELEGRAM_CONNECTION_INTERRUPTED")
        except (ConnectionError, OSError, TimeoutError, asyncio.TimeoutError):
            # Do not print Telegram/Telethon exceptions. May contain secrets,
            # sender names or other account context in a traceback.
            print("TELEGRAM_RECONNECT_TRANSPORT_UNAVAILABLE")
    print("TELEGRAM_RECONNECT_EXHAUSTED_NO_HISTORY_REPLAY")
    raise SystemExit("TELEGRAM_LOCAL_LISTENER_OFFLINE")


def safe_operator_status(root):
    """Local-only status. Session *presence* and lock; NO network health proof.

    Never open/read SQLite session bytes, enumerate chats or log any identifiers.
    Lock held means only that a local process has acquired the advisory lock.
    """
    assert_telegram_user_session_host(root)
    if root.is_symlink():
        raise PermissionError("TELEGRAM_PRIVATE_DIR_SYMLINK_REFUSED")
    if not root.exists():
        return "TELEGRAM_SESSION_ABSENT LOCAL_WORKER_LOCK_FREE NETWORK_NOT_CHECKED"
    if not root.is_dir() or root.stat().st_mode & 0o077:
        raise PermissionError("TELEGRAM_PRIVATE_DIR_PERMISSIONS_UNSAFE")
    session = root / "owner.session"
    lock = root / "telegram-worker.lock"
    if lock.is_symlink():
        raise PermissionError("TELEGRAM_WORKER_LOCK_SYMLINK_REFUSED")
    engaged = False
    if lock.exists():
        fd = os.open(lock, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                engaged = True
            else:
                fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)
    return ("TELEGRAM_SESSION_" + ("PRESENT" if session.exists() else "ABSENT")
            + " LOCAL_WORKER_LOCK_" + ("HELD" if engaged else "FREE")
            + " NETWORK_NOT_CHECKED")


async def user_reader(args, root, secret):
    try:
        from telethon import TelegramClient, events, utils
    except ImportError as error:
        raise SystemExit("Install pinned Telethon on your trusted device") from error
    chats, excluded = validate_user_monitor_scope(args)
    # Selected-chat metadata persistence needs a separate terms/rights review.
    if not args.all_chats:
        raise SystemExit("TELEGRAM_SELECTED_CHAT_PERSISTENCE_HELD_RIGHTS_REVIEW")
    api_id, api_hash = os.getenv("TELEGRAM_API_ID", ""), os.getenv("TELEGRAM_API_HASH", "")
    if not api_id.isdigit() or not api_hash:
        raise SystemExit("Set TELEGRAM_API_ID and TELEGRAM_API_HASH locally from my.telegram.org")
    assert_telegram_user_session_host(root)
    try:
        lock_fd = exclusive_worker_lock(root)
    except BlockingIOError:
        raise SystemExit("TELEGRAM_PERSONAL_SESSION_ALREADY_RUNNING") from None
    output = root / "owner-derived-signals.jsonl"
    # Sensitive .session file and Telegram login remain ONLY on the trusted host.
    # Protect the lock even if Telethon constructor or shutdown raises.
    client = None
    try:
        client = TelegramClient(str(root / "owner"), int(api_id), api_hash)
        if os.getenv("TELEGRAM_CLOUD_NONINTERACTIVE") == "1":
            # A headless service must NEVER prompt for a phone/OTP/2FA or
            # silently bootstrap a replacement owner account on restart.
            await client.connect()
            if not await client.is_user_authorized():
                raise SystemExit("TELEGRAM_CLOUD_SESSION_REVOKED_OR_EXPIRED_STOP")
        else:
            await client.start()
        # Every personal-session read, including explicit chat backfill, must
        # prove this is the same owner's account as the verified bot pairing.
        user = await client.get_me()
        verify_telegram_user_identity(user, os.getenv("TELEGRAM_ALLOWED_USER_ID", ""))
        entities = [await client.get_entity(chat) for chat in chats]
        exclusions = [await client.get_entity(chat) for chat in excluded]
        approved_ids = {utils.get_peer_id(entity) for entity in entities}
        excluded_ids = {utils.get_peer_id(entity) for entity in exclusions}

        def capture(message, peer_id):
            return capture_user_message(message, peer_id, approved_ids, excluded_ids,
                                        args.all_chats, args.mode, secret, output)

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
            # No chats filter intentionally: includes new conversations and
            # channels joined AFTER the listener starts, unlike a snapshot list.
            new_filter = (events.NewMessage(incoming=True)
                          if args.all_chats else events.NewMessage(chats=entities, incoming=True))
            edit_filter = (events.MessageEdited(incoming=True)
                           if args.all_chats else events.MessageEdited(chats=entities, incoming=True))

            @client.on(new_filter)
            async def new_message(event):
                try:
                    count = capture(event.message, event.chat_id)
                except (AttributeError, TypeError, ValueError, OverflowError):
                    # Telethon may suppress handler exceptions; print a sanitized
                    # local status, never the incoming content, peer or traceback.
                    print("TELEGRAM_SCAN_EVENT_REJECTED")
                    return
                if count:
                    summary = ephemeral_crypto_observation(event.message.message) if args.all_chats else None
                    print(ephemeral_local_notice("NEW", summary) if summary else "NEW_TOKEN_MENTIONS " + str(count))

            @client.on(edit_filter)
            async def edited_message(event):
                try:
                    count = capture(event.message, event.chat_id)
                except (AttributeError, TypeError, ValueError, OverflowError):
                    print("TELEGRAM_SCAN_EVENT_REJECTED")
                    return
                if count:
                    summary = ephemeral_crypto_observation(event.message.message) if args.all_chats else None
                    print(ephemeral_local_notice("EDIT", summary) if summary else "EDITED_TOKEN_MENTIONS " + str(count))
            print("READ_ONLY_LIVE_LISTENER_STARTED",
                  "ALL_NEW_INCOMING_CLOUD_CHATS" if args.all_chats else "APPROVED_CHATS_ONLY",
                  "NO_AI_TRAINING; ALL_CHATS_EPHEMERAL_ONLY; NO_TRADES")
            await supervise_personal_connection(
                client, os.getenv("TELEGRAM_ALLOWED_USER_ID", ""))
    finally:
        try:
            if client is not None:
                await client.disconnect()
        finally:
            os.close(lock_fd)


def process_bot_update(update, owner_id, secret):
    is_edit = "edited_message" in update
    msg = update.get("edited_message", {}) if is_edit else update.get("message", {})
    chat = msg.get("chat", {})
    sender = msg.get("from", {})
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return []
    chat_id, sender_id = chat.get("id"), sender.get("id")
    if (chat.get("type") != "private"
            or not isinstance(owner_id, int) or isinstance(owner_id, bool) or owner_id <= 0
            or not isinstance(chat_id, int) or isinstance(chat_id, bool) or chat_id != owner_id
            or not isinstance(sender_id, int) or isinstance(sender_id, bool) or sender_id != owner_id):
        return []
    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return []
    edit_timestamp = msg.get("edit_date") if is_edit else None
    if is_edit and (isinstance(edit_timestamp, bool) or not isinstance(edit_timestamp, int)):
        return []  # malformed edits are not admitted as research data
    edit_at = datetime.fromtimestamp(edit_timestamp, tz=timezone.utc) if edit_timestamp else None
    rows = extract(text, str(msg["chat"]["id"]), int(msg["message_id"]),
                   datetime.fromtimestamp(msg["date"], tz=timezone.utc),
                   datetime.now(timezone.utc), secret, "forwarded_bot",
                   edit_at=edit_at, event_kind="EDIT" if is_edit else "NEW")
    origin = msg.get("forward_origin") or {}
    source_date = origin.get("date") if isinstance(origin, dict) else None
    source_chat = origin.get("chat") if isinstance(origin, dict) else None
    source_id = source_chat.get("id") if isinstance(source_chat, dict) else None
    source_id = source_id if isinstance(source_id, int) and not isinstance(source_id, bool) else None
    upstream_fingerprint = (
        hmac.new(secret.encode(), f"telegram-upstream-channel:{source_id}".encode(), hashlib.sha256).hexdigest()
        if origin.get("type") == "channel" and source_id is not None else None
    ) if isinstance(origin, dict) else None
    if isinstance(source_date, int) and not isinstance(source_date, bool) and source_date > 0:
        original_time = utc(datetime.fromtimestamp(source_date, tz=timezone.utc))
    else:
        original_time = None
    for row in rows:
        row["event_time_role"] = "telegram_forward_received" if origin else "telegram_direct_received"
        row["forward_origin_date_utc"] = original_time
        row["upstream_channel_fingerprint"] = upstream_fingerprint
        row["historical_source_discovered_at_collection"] = bool(origin)
    return rows

def bot_get_updates(token, offset):
    query = urllib.parse.urlencode({
        "offset": offset, "timeout": 15, "allowed_updates": json.dumps(["message", "edited_message"])
    })
    req = urllib.request.Request(
        "https://api.telegram.org/bot" + token + "/getUpdates?" + query,
        headers={"User-Agent": "Jhadina-ResearchOnly/1.0"}
    )
    obj = safe_telegram_response(req, 30, 2_000_000)
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
    payload = safe_telegram_response(req, 20, 32768)
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
    try:
        lock_fd = exclusive_worker_lock(root)
    except BlockingIOError:
        raise SystemExit("TELEGRAM_WORKER_ALREADY_RUNNING_ON_THIS_VOLUME") from None
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
        except BotPollingConflict:
            raise SystemExit("Another service is consuming this Telegram bot; stop to protect it") from None
        except (OSError, TimeoutError, RuntimeError, ValueError):
            print("PAIR_POLL_RETRY")
            time.sleep(3)
    raise SystemExit("Pairing expired; restart to get a new challenge")

def resolve_owner_id(root):
    owner = os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
    paired = root / "paired-owner-id.txt"
    if not owner and paired.is_file() and not paired.is_symlink():
        owner = paired.read_text(encoding="ascii").strip()
    if not owner.isdigit() or int(owner) <= 0:
        raise SystemExit("Set verified TELEGRAM_ALLOWED_USER_ID or run pair-owner on a trusted host")
    return int(owner)

def save_checkpoint(checkpoint, next_id):
    """Move ack forward only after the corresponding message metadata is fsynced."""
    if checkpoint.is_symlink():
        raise PermissionError("refusing symlink checkpoint")
    temp = checkpoint.with_suffix(".tmp")
    if temp.is_symlink():
        raise PermissionError("refusing symlink checkpoint temp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temp, flags, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="ascii", closefd=False) as stream:
            stream.write(str(next_id))
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        os.close(fd)
    temp.replace(checkpoint)
    flags_dir = getattr(os, "O_DIRECTORY", 0) | os.O_RDONLY
    directory_fd = os.open(checkpoint.parent, flags_dir)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)

def persist_bot_update(update, offset, owner, secret, output, checkpoint):
    """Crash-consistent at-least-once: a replay is possible but never silently lost."""
    update_id = update.get("update_id")
    if isinstance(update_id, bool) or not isinstance(update_id, int) or update_id < 0:
        raise ValueError("invalid telegram update ID")
    next_id = update_id + 1
    if next_id <= offset:
        return offset, 0
    rows = process_bot_update(update, owner, secret)
    append_private(output, rows)
    save_checkpoint(checkpoint, next_id)
    return next_id, len(rows)

def doctor(root):
    """Read-only Telegram preflight; never polls, sends messages, or stores tokens."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN privately on the authorized host")
    owner = resolve_owner_id(root)
    identity = verify_bot_setup(token)
    print("PREFLIGHT_READY_TO_START", "@" + identity["username"],
          "OWNER_ID_PRESENT", owner > 0, "STORAGE_CONFIGURED", True)

def forwarded_bot(root, secret):
    # RECOVER.02: avoid competing with the owner's main-branch one-shot getUpdates.
    raise SystemExit("TELEGRAM_PERSISTENT_BOT_CONSUMER_HELD_SINGLE_OWNER_REQUIRED")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN privately on the trusted host")
    owner = resolve_owner_id(root)
    verified = verify_bot_setup(token)
    print("TELEGRAM_EXPECTED_BOT_VERIFIED", "@" + verified["username"])
    try:
        lock_fd = exclusive_worker_lock(root)
    except BlockingIOError:
        raise SystemExit("TELEGRAM_WORKER_ALREADY_RUNNING_ON_THIS_VOLUME") from None
    # Keep lock_fd open for the entire process. Released automatically on shutdown.
    output = root / "forwarded-derived-signals.jsonl"
    checkpoint = root / "forwarded-update-offset.txt"
    offset = int(checkpoint.read_text().strip()) if checkpoint.exists() else 0
    print("OWNER_ONLY_FORWARD_INBOX_ACTIVE; no historical chat access or transactions")
    while True:
        try:
            updates = bot_get_updates(token, offset)
            for update in updates:
                offset, mention_count = persist_bot_update(
                    update, offset, owner, secret, output, checkpoint
                )
                if mention_count:
                    print("NEW_TOKEN_MENTIONS", mention_count)
        except BotPollingConflict:
            raise SystemExit("TELEGRAM_BOT_POLLING_CONFLICT_STOP; another integration owns getUpdates") from None
        except (OSError, TimeoutError, ValueError, RuntimeError):
            print("Telegram poll temporarily unavailable; retrying")
            time.sleep(10)

def main():
    parser = argparse.ArgumentParser(description="Research only. No wallet, no trades.")
    parser.add_argument("mode", choices=("backfill", "live", "forwarded-bot", "export", "migration-review", "pair-owner", "doctor", "operator-status"))
    parser.add_argument("--chats", nargs="+", help="Explicit authorized Telegram chat IDs or @usernames")
    parser.add_argument("--all-chats", action="store_true",
                        help="Opt in to ALL NEW incoming cloud messages on verified personal account; no history")
    parser.add_argument("--exclude-chats", nargs="+",
                        help="Personal Telegram chats to deny, only together with --all-chats")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--max-per-chat", type=int, default=2000)
    args = parser.parse_args()
    if args.mode == "operator-status":
        # No bot token, API hash, HMAC secret or Telethon sign-in required.
        root = Path(os.getenv("TELEGRAM_PRIVATE_DIR",
                           "~/.local/share/jhadina-telegram")).expanduser()
        print(safe_operator_status(root))
        return
    root, secret = settings(args.mode,
                            ephemeral_only=(args.mode == "live" and args.all_chats))
    if args.mode == "doctor":
        doctor(root)
    elif args.mode == "pair-owner":
        pair_owner(root)
    elif args.mode == "export":
        from telegram_research_bridge import save_private_watchlist
        print("LOCAL_WATCHLIST_CANDIDATES_UNAPPROVED", save_private_watchlist(root))
    elif args.mode == "migration-review":
        from telegram_research_bridge import save_private_migration_review_queue
        print("LOCAL_MIGRATION_CLAIMS_NEED_ONCHAIN_VERIFICATION",
              save_private_migration_review_queue(root))
    elif args.mode == "forwarded-bot":
        forwarded_bot(root, secret)
    else:
        asyncio.run(user_reader(args, root, secret))

if __name__ == "__main__":
    main()
