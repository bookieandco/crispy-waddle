"""Local-only research-candidate aggregation from authorized Telegram-derived events.
Research candidates never automatically turn into trade or model-training signals.
"""
from __future__ import annotations
import json
import os
from pathlib import Path

def build_watchlist(root: Path, limit: int = 30000) -> dict:
    seen = set()
    by_token = {}
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
                event = (chain, address, fingerprint)
                if event in seen:
                    continue
                seen.add(event)
                group = (chain, address)
                timestamp = item["message_time_utc"]
                record = by_token.setdefault(group, {
                    "chain_id": chain, "token_address": address,
                    "mention_count": 0, "migration_claim_count": 0,
                    "first_mention_utc": timestamp, "last_mention_utc": timestamp,
                    "approved_for_market_collection": False,
                    "onchain_migration_verified": False,
                })
                record["mention_count"] += 1
                if "MIGRATION_CLAIM" in item.get("mentioned_tags", []):
                    record["migration_claim_count"] += 1
                record["first_mention_utc"] = min(record["first_mention_utc"], timestamp)
                record["last_mention_utc"] = max(record["last_mention_utc"], timestamp)
    return {
        "schema_version": "jhadina.telegram.watchlist-candidates.v1",
        "source": "owner_authorized_telegram_derived_signals",
        "contains_raw_messages": False, "unique_message_token_pairs": len(seen),
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
