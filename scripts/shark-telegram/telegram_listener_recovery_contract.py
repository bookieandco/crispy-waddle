"""RECOVER.03/.08: crash-safe *metadata-only* inbox and latency acceptance.

This is an offline, dormant replacement contract for the uncommissioned durable
Bot API reader. It NEVER calls Telegram, reads messages, exports identities,
feeds models, or trades. The already verified manual bot preview keeps ownership.
"""
from __future__ import annotations

import math
import os
from pathlib import Path
import re
import sqlite3

HEX_HMAC = re.compile(r"[a-f0-9]{64}\Z")
OUTCOMES = frozenset({"DERIVED_RESEARCH_ONLY", "EMPTY", "UNAUTHORIZED",
                      "QUARANTINED_INVALID"})
STAGES = frozenset({"intake", "verification", "public_quote", "paper_decision"})


def _safe_directory(path: Path) -> None:
    if path.is_symlink():
        raise PermissionError("TELEGRAM_DIRECTORY_SYMLINK_DENIED")
    path.mkdir(parents=True, mode=0o700, exist_ok=True)
    if path.stat().st_mode & 0o077:
        raise PermissionError("TELEGRAM_DIRECTORY_PERMISSIONS_DENIED")


class OwnerUpdateLedger:
    """Atomic SQLite update-id receipts, not a reader or an evidence archive.

    An update is acknowledged by a *future owner-only consumer* only after the
    transaction is durable; a deterministic malformed update can be quarantined
    by its ID/HMAC instead of poisoning the queue. Unclassified exceptions do
    not call commit and MUST NOT advance an acknowledgement.
    """

    def __init__(self, database: Path):
        os.umask(0o077)
        self.path = Path(database)
        _safe_directory(self.path.parent)
        if self.path.is_symlink() or (self.path.exists() and
                                      self.path.stat().st_mode & 0o077):
            raise PermissionError("TELEGRAM_LEDGER_UNSAFE_PATH")
        self.conn = sqlite3.connect(str(self.path), isolation_level=None,
                                    timeout=3)
        os.chmod(self.path, 0o600)
        self.conn.execute("PRAGMA journal_mode=DELETE")
        self.conn.execute("PRAGMA synchronous=FULL")
        self.conn.execute("""CREATE TABLE IF NOT EXISTS updates (
          update_id INTEGER PRIMARY KEY,
          event_hmac TEXT NOT NULL,
          disposition TEXT NOT NULL,
          gap_before INTEGER NOT NULL DEFAULT 0,
          CHECK(disposition IN ('DERIVED_RESEARCH_ONLY','EMPTY',
                                'UNAUTHORIZED','QUARANTINED_INVALID'))
        )""")
        self.conn.execute("""CREATE TABLE IF NOT EXISTS checkpoint (
          id INTEGER PRIMARY KEY CHECK(id=1),
          next_offset INTEGER NOT NULL CHECK(next_offset>=0)
        )""")
        self.conn.execute("INSERT OR IGNORE INTO checkpoint VALUES (1,0)")

    def close(self) -> None:
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    @property
    def next_offset(self) -> int:
        return int(self.conn.execute(
            "SELECT next_offset FROM checkpoint WHERE id=1").fetchone()[0])

    def commit(self, update_id: int, event_hmac: str, disposition: str) -> dict:
        if (type(update_id) is not int or not 0 <= update_id < (2**63 - 1) or
            type(event_hmac) is not str or not HEX_HMAC.fullmatch(event_hmac) or
            disposition not in OUTCOMES):
            raise ValueError("TELEGRAM_LEDGER_RECEIPT_INVALID")
        self.conn.execute("BEGIN IMMEDIATE")
        try:
            offset = self.next_offset
            if update_id < offset:
                self.conn.execute("COMMIT")
                return {"accepted": False, "next_offset": offset,
                        "status": "DUPLICATE_OR_ALREADY_CHECKPOINTED",
                        "canTrade": False}
            gap = update_id - offset
            # Store no raw text, token addresses, chat IDs, sender IDs,
            # provider payloads or model-training features.
            self.conn.execute(
                "INSERT INTO updates(update_id,event_hmac,disposition,gap_before)"
                " VALUES (?,?,?,?)",
                (update_id, event_hmac, disposition, gap))
            offset = update_id + 1
            self.conn.execute(
                "UPDATE checkpoint SET next_offset=? WHERE id=1", (offset,))
            self.conn.execute("COMMIT")
            return {"accepted": True, "next_offset": offset, "gap_before": gap,
                    "status": "LOCAL_METADATA_DURABLE_NOT_BOT_ACKNOWLEDGED",
                    "canTrade": False}
        except BaseException:
            self.conn.execute("ROLLBACK")
            raise


class LatencyAcceptance:
    """No mock or self-entered values can certify live latency.

    Observe independent *public-chain* receipt stages only. Synthetic tests
    exercise math; production receipts need a separate authentic source audit.
    """
    def __init__(self, max_receipts: int = 4096):
        if type(max_receipts) is not int or not 1 <= max_receipts <= 4096:
            raise ValueError("LATENCY_CAP_INVALID")
        self.max_receipts = max_receipts
        self.by_stage = {stage: [] for stage in STAGES}
        self.rejected = 0

    def observe_synthetic(self, stage: str, started_ms: float,
                          completed_ms: float) -> None:
        if (stage not in STAGES or not all(
                type(v) in (int, float) and math.isfinite(v)
                for v in (started_ms, completed_ms)) or
                completed_ms < started_ms or
                len(self.by_stage[stage]) >= self.max_receipts):
            self.rejected += 1
            raise ValueError("LATENCY_RECEIPT_INVALID_OR_CAPACITY")
        self.by_stage[stage].append(completed_ms - started_ms)

    @staticmethod
    def _percentile(values: list[float], p: float):
        if not values:
            return None
        ordered = sorted(values)
        return ordered[math.ceil(p * len(ordered)) - 1]

    def report(self) -> dict:
        return {
            "status": "SYNTHETIC_ONLY_NO_LIVE_LATENCY_CERTIFICATION",
            "p50_p95_p99_ms": {
                stage: {"samples": len(values),
                        "p50": self._percentile(values, .50),
                        "p95": self._percentile(values, .95),
                        "p99": self._percentile(values, .99)}
                for stage, values in sorted(self.by_stage.items())
            },
            "invalid_receipts": self.rejected,
            "canTrade": False,
            "canClaim600msLive": False,
            "sessionVerified": False,
        }
