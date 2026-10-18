#!/usr/bin/env python3
"""ALPHA.11: owner-authorized private delivery of separately selected PUBLIC market evidence.

Manual trusted-main workflow only. The mint comes from the GitHub Actions
public_mint input, never from Telegram content. Telegram is used exclusively
to authenticate a fresh private digest request and deliver the result. No
Telegram text, source information or chat IDs reach RPC, DEX, storage or AI.
No automatic trading, predictions, profits, or verified migration claims.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
import time

HERE = Path(__file__).resolve().parent
MEME = HERE.parent / "meme"
if str(MEME) not in sys.path:
    sys.path.insert(0, str(MEME))

import public_mint_dossier as public
from bot_inbox_receipt import (
    SmokeCheckError, TAG_PATTERN, bot_api, is_expected_receipt, validate_preflight,
)
from bot_research_once import _positive_int, send_private_preview

COMMAND = "/research-digest "
MAX_PUBLIC_FINDINGS = 7
LABEL = re.compile(r"^[A-Z][A-Z0-9_]{1,55}$")
DEX_NAME = re.compile(r"^[a-zA-Z0-9_-]{1,36}$")


def owner_authorized(updates: object, owner_id: int, tag: str, now: int) -> bool:
    """Exactly a fresh unedited direct private digest from the allowlisted owner."""
    if not _positive_int(owner_id) or not isinstance(tag, str) or not TAG_PATTERN.fullmatch(tag):
        raise SmokeCheckError("PUBLIC_MARKET_OWNER_OR_TAG_INVALID")
    if not isinstance(updates, list) or len(updates) > 100:
        raise SmokeCheckError("PUBLIC_MARKET_INBOX_UNAVAILABLE")
    return any(is_expected_receipt(u, COMMAND + tag, now, owner_id) for u in updates)


def _money(value: object, *, zero_allowed=False) -> str:
    if (type(value) not in (int, float) or value != value
            or value == float("inf") or value == float("-inf")
            or value < 0 or (value == 0 and not zero_allowed)):
        return "Not verified"
    if value > 1_000_000_000_000:
        return "Not verified"
    return f"{value:.10g}"


def public_reply(mint: str, dossier: object) -> str:
    """Render ONLY bounded public evidence; provider JSON strings never copied verbatim."""
    if not public.market.ADDRESS.fullmatch(mint):
        raise SmokeCheckError("PUBLIC_MARKET_MINT_FORMAT_INVALID")
    known = mint in public.NATIVE_REFERENCE_MINTS
    item = dossier if isinstance(dossier, dict) and dossier.get("mint") == mint else {}
    account = item.get("mintAccount") if isinstance(item.get("mintAccount"), dict) else None
    pair = item.get("marketPair") if isinstance(item.get("marketPair"), dict) else None
    status = item.get("status") if item.get("status") in (
        "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED",
        "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE",
        "QUARANTINED_STALE_PUBLIC_EVIDENCE",
    ) else "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE"
    # Check the local receipt digest and hard safety gates, not a provider signature.
    payload = dict(item)
    receipt = payload.pop("receiptDigest", None)
    integrity = (item.get("schema") == public.SCHEMA
                 and item.get("classification") == (
                     "KNOWN_REFERENCE_ASSET" if known else "PUBLIC_MINT_RESEARCH_ONLY")
                 and item.get("origin") == "EXPLICIT_OWNER_SELECTED_PUBLIC_MINT_NOT_TELEGRAM_HISTORY"
                 and item.get("authority") == "RESEARCH_ONLY"
                 and item.get("sourcesCryptographicallyAttested") is False
                 and all(item.get(k) is False for k in (
                     "canTrade", "canSign", "canBroadcast", "canAuthorizeLive"))
                 and isinstance(receipt, str) and len(receipt) == 64
                 and receipt == public._hash(payload))
    if not integrity:
        account, pair = None, None
        status = "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE"
    elif status == "PUBLIC_MINT_AND_MARKET_PARTIAL_UNVERIFIED" and (
            account is None or pair is None or item.get("missingOrStale") != []):
        status = "QUARANTINED_MISSING_OR_INVALID_PUBLIC_EVIDENCE"
    lines = [
        "Jhadina SHARK | Public Solana market check",
        "PRIVATE / OWNER ONLY | Research, NOT a trade signal",
        "",
        "Owner-selected PUBLIC mint: " + mint,
        "Asset class: " + ("Known native reference asset, NOT a launch lead" if known
                          else "Unverified token research, not a confirmed new launch"),
        "Market evidence: " + status,
        "Mint account parsed: " + ("YES" if account else "NO"),
        "Eligible market pair: " + ("YES" if pair else "NO"),
    ]
    if account:
        lines.extend([
            "Mint authority active: " + ("YES" if account.get("mintAuthorityActive") is True
                                           else "NO" if account.get("mintAuthorityActive") is False
                                           else "UNKNOWN"),
            "Freeze authority active: " + ("YES" if account.get("freezeAuthorityActive") is True
                                             else "NO" if account.get("freezeAuthorityActive") is False
                                             else "UNKNOWN"),
            "Token extension coverage: " + (
                account["extensionCoverage"] if account.get("extensionCoverage") in (
                    "UNKNOWN", "RPC_JSONPARSED_PARTIAL") else "UNVERIFIED"),
        ])
    if pair:
        dex = pair.get("dex")
        lines.extend([
            "DEX: " + (dex if isinstance(dex, str) and DEX_NAME.fullmatch(dex) else "Unverified"),
            "Provider-reported price USD: " + _money(pair.get("priceUsdIndicative")),
            "Provider-reported liquidity USD: " + _money(
                pair.get("liquidityUsdProviderReported"), zero_allowed=True),
        ])
    if integrity:
        flags = item.get("findings") if isinstance(item.get("findings"), list) else []
        clean = [s for s in flags if isinstance(s, str) and LABEL.fullmatch(s)]
        if clean:
            lines.append("Risk/visibility findings: " + ", ".join(sorted(set(clean))[:MAX_PUBLIC_FINDINGS]))
        missing = item.get("missingOrStale") if isinstance(item.get("missingOrStale"), list) else []
        safe_missing = [s for s in missing if isinstance(s, str) and LABEL.fullmatch(s)]
        if safe_missing:
            lines.append("Evidence gaps: " + ", ".join(sorted(set(safe_missing))[:MAX_PUBLIC_FINDINGS]))
    lines.extend([
        "",
        "PROVENANCE: Public RPC and DEX provider responses NOT independently attested.",
        "Mint existence/pair details are partial observations, NOT safety certification.",
        "Migration, holder independence, transferability and sellability NOT verified.",
        "No executable quote, fills, returns, Telegram-source performance or alpha score.",
        "No Telegram message content used in public-data lookup or model training.",
        "No saved market study, wallet access, trading or update ACK.",
    ])
    report = "\n".join(lines)
    if len(report) > 3200:
        raise SmokeCheckError("PUBLIC_MARKET_PRIVATE_REPLY_TOO_LONG")
    return report


def execute_once(token: str, owner_id: int, tag: str, mint: str, now: int,
                 *, reader=None) -> bool:
    # Invalid/unrequested mint rejects before Bot API and before any provider read.
    if (not isinstance(mint, str) or not public.market.ADDRESS.fullmatch(mint)
            or not _positive_int(owner_id)
            or not isinstance(tag, str) or not TAG_PATTERN.fullmatch(tag)):
        raise SmokeCheckError("PUBLIC_MARKET_REQUEST_INVALID")
    validate_preflight(token)
    payload = bot_api(token, "getUpdates", {"offset": 0, "limit": 100, "timeout": 0})
    if not owner_authorized(payload.get("result"), owner_id, tag, now):
        return False
    if reader is None:
        reader = public.manual_read_public_mint
    try:
        report = public_reply(mint, reader(mint))
    except (ValueError, OSError, TypeError, KeyError, OverflowError, TimeoutError):
        report = public_reply(mint, None)
    send_private_preview(token, owner_id, report)
    return True


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    owner = os.environ.get("TELEGRAM_ALLOWED_USER_ID", "").strip()
    tag = os.environ.get("TELEGRAM_RESEARCH_TAG", "")
    mint = os.environ.get("SHARK_PUBLIC_MINT", "")
    if (not token or not owner.isascii() or not owner.isdigit()
            or len(owner) > 20 or not _positive_int(int(owner) if owner else 0)):
        print("::error::TELEGRAM_OWNER_SECRETS_UNAVAILABLE")
        return 1
    try:
        sent = execute_once(token, int(owner), tag, mint, int(time.time()))
    except SmokeCheckError as error:
        print("::error::" + str(error))
        return 1
    if not sent:
        print("::warning::FRESH_OWNER_RESEARCH_COMMAND_NOT_FOUND")
        return 1
    print("PRIVATE_OWNER_PUBLIC_MARKET_REPORT_SENT")
    print("NO_CONTENT_IN_LOGS; NO_TELEGRAM_DATA_TO_PUBLIC_PROVIDERS; NO_TRADING")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
