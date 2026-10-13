"""Private, ungraded SHARK Telegram token watchlist aggregated by message identity.

A forwarded/backfilled historical quote is never a pre-registered prediction.
A later edit cannot rewrite what the original Telegram message contained.
No raw message text, real channel ID, or sender identity is exported.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ALLOWED_KINDS = {"NEW", "EDIT", "BACKFILL"}
MIGRATION_CLAIM = "MIGRATION_CLAIM"


def build_watchlist(root: Path, limit: int = 30000) -> dict:
    unique_versions = set()
    messages = {}
    lines = 0
    for filename in ("owner-derived-signals.jsonl", "forwarded-derived-signals.jsonl"):
        source = root / filename
        if not source.exists():
            continue
        if source.is_symlink():
            raise PermissionError("refusing symlink input")
        with source.open(encoding="utf-8") as stream:
            for line in stream:
                lines += 1
                if lines > limit:
                    raise ValueError("record count exceeds safe bounded export")
                item = json.loads(line)
                if item.get("schema_version") != "jhadina.telegram.token-signal.v1":
                    raise ValueError("unexpected signal schema")
                chain, address = item.get("chain_id"), item.get("token_address")
                fingerprint = item.get("message_fingerprint")
                if chain not in ("solana_candidate", "evm_unresolved") or not address or not fingerprint:
                    raise ValueError("malformed signal")
                kind = item.get("event_kind", "BACKFILL" if item.get("reader_mode") == "backfill" else "NEW")
                if kind not in ALLOWED_KINDS:
                    raise ValueError("unexpected telegram event kind")
                version_time = item.get("content_version_time_utc", item.get("message_time_utc"))
                receipt = item.get("collected_at_utc")
                source_sent = item.get("message_time_utc")
                if not all(isinstance(value, str) and value.endswith("Z")
                           for value in (version_time, receipt, source_sent)):
                    raise ValueError("missing Telegram provenance timestamps")
                if receipt < version_time or version_time < source_sent:
                    raise ValueError("impossible Telegram provenance chronology")
                labels = item.get("mentioned_tags")
                if not isinstance(labels, list) or any(not isinstance(t, str) for t in labels):
                    raise ValueError("invalid telegram evidence tags")
                message_key = (chain, address, fingerprint)
                version_key = (message_key, kind,
                               item.get("text_hmac_sha256", fingerprint), version_time)
                if version_key in unique_versions:
                    continue
                unique_versions.add(version_key)
                state = messages.setdefault(message_key, {
                    "source_sent": source_sent,
                    "first_detected": receipt,
                    "last_detected": receipt,
                    "events": {},
                })
                state["source_sent"] = min(state["source_sent"], source_sent)
                state["first_detected"] = min(state["first_detected"], receipt)
                state["last_detected"] = max(state["last_detected"], receipt)
                latest = state["events"].get(kind)
                if latest is None or (version_time, receipt) > (latest[0], latest[1]):
                    state["events"][kind] = (version_time, receipt, MIGRATION_CLAIM in labels)

    by_token = {}
    for (chain, address, _fingerprint), state in messages.items():
        token_key = (chain, address)
        row = by_token.setdefault(token_key, {
            "chain_id": chain, "token_address": address,
            "mention_count": 0,
            "new_message_migration_claim_count": 0,
            "historical_snapshot_migration_claim_count": 0,
            "edited_message_migration_claim_count": 0,
            "edited_message_count": 0,
            "first_source_sent_utc": state["source_sent"],
            "first_detected_utc": state["first_detected"],
            "last_detected_utc": state["last_detected"],
            "approved_for_market_collection": False,
            "onchain_migration_verified": False,
        })
        row["mention_count"] += 1
        row["first_source_sent_utc"] = min(row["first_source_sent_utc"], state["source_sent"])
        row["first_detected_utc"] = min(row["first_detected_utc"], state["first_detected"])
        row["last_detected_utc"] = max(row["last_detected_utc"], state["last_detected"])
        events = state["events"]
        if "NEW" in events and events["NEW"][2]:
            row["new_message_migration_claim_count"] += 1
        if "BACKFILL" in events and events["BACKFILL"][2]:
            row["historical_snapshot_migration_claim_count"] += 1
        if "EDIT" in events:
            row["edited_message_count"] += 1
            if events["EDIT"][2]:
                row["edited_message_migration_claim_count"] += 1

    return {
        "schema_version": "jhadina.telegram.watchlist-candidates.v2",
        "source": "owner_authorized_telegram_derived_signals",
        "contains_raw_messages": False,
        "no_prediction_or_profitability_claims": True,
        "unique_message_token_pairs": len(messages),
        "unique_content_versions": len(unique_versions),
        "tokens": sorted(by_token.values(), key=lambda r: (r["chain_id"], r["token_address"])),
    }


def save_private_watchlist(root: Path) -> int:
    data = build_watchlist(root)
    destination = root / "telegram-watchlist-candidates.json"
    temporary = root / "telegram-watchlist-candidates.json.tmp"
    if destination.is_symlink() or temporary.is_symlink():
        raise PermissionError("refusing symlink output")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temporary, flags, 0o600)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8", closefd=False) as file:
            json.dump(data, file, sort_keys=True, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
    finally:
        os.close(fd)
    temporary.replace(destination)
    return len(data["tokens"])
