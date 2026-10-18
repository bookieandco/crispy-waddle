#!/usr/bin/env python3
"""SHARK-LIVE.INTELLIGENCE.01-.05: bounded, owner-operated PUBLIC-market research.

No Telegram ingestion, AI training on messages, orders, or wallets. State holds
only independently requested public market observations on an owner-controlled
host. A process must be commissioned to run this continuously; no GitHub
Actions runner or completed PR implies an always-on service.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import time

import experiment_7day as feed
import public_mint_dossier as public
import public_alpha_study as paper

SCHEMA = "SHARK-LIVE-PUBLIC-INTELLIGENCE-01-05"
MAX_NEW = 4
MAX_CHECKS = 6
MAX_FOLLOWUPS = 3
MAX_ACTIVE = 60
MAX_RETAINED = 2500
RESEARCH_WINDOW_HOURS = 36
MAX_ALERTS_PER_CYCLE = 2
CHECK_COOLDOWN_SECONDS = 600
REFERENCE_P_UP = 0.5  # No-edge benchmark, NOT a prediction or learned model.
RESEARCH_FLAGS = {
    "MINT_AUTHORITY_ACTIVE", "FREEZE_AUTHORITY_ACTIVE",
    "TRANSFER_FEE_CONTROL", "TRANSFER_HOOK_CONTROL",
    "UNKNOWN_EXTENSION_REQUIRES_REVIEW", "LOW_PROVIDER_REPORTED_LIQUIDITY",
}
GENESIS = "0" * 64


def _utc(text: str) -> dt.datetime:
    return feed.timestamp(text)


def _sha(value: object) -> str:
    return hashlib.sha256(json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode()).hexdigest()


def _valid_mint(mint: object) -> bool:
    return (isinstance(mint, str) and bool(feed.ADDRESS.fullmatch(mint))
            and mint not in public.NATIVE_REFERENCE_MINTS)


@contextmanager
def local_database(path: str):
    """One local writer, owner-only file, no symlink-following, no cloud store."""
    target = Path(path)
    if not target.is_absolute() or target.is_symlink() or not target.parent.is_dir():
        raise ValueError("local_database_absolute_existing_parent_required")
    if target.exists() and (not target.is_file() or target.stat().st_mode & 0o077):
        raise ValueError("local_database_insecure_file")
    lock = target.with_name(target.name + ".lock")
    fd = os.open(lock, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    db = None
    try:
        if os.fstat(fd).st_mode & 0o077:
            raise ValueError("local_database_lock_permissions")
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        db = sqlite3.connect(str(target), timeout=1.0)
        os.chmod(target, 0o600)
        db.execute("PRAGMA journal_mode=DELETE")
        db.execute("PRAGMA synchronous=FULL")
        db.execute("""CREATE TABLE IF NOT EXISTS tokens(
            mint TEXT PRIMARY KEY, first_discovered TEXT NOT NULL,
            last_checked TEXT, study_json TEXT, risk_json TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'QUEUED', last_seen TEXT NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS outbox(
            event_key TEXT PRIMARY KEY, mint TEXT NOT NULL, created_at TEXT NOT NULL,
            delivery TEXT NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS cycles(
            id INTEGER PRIMARY KEY AUTOINCREMENT, available_at TEXT NOT NULL UNIQUE,
            receipt_digest TEXT NOT NULL UNIQUE, new_tokens INTEGER NOT NULL,
            checked INTEGER NOT NULL, graded INTEGER NOT NULL
        )""")
        db.commit()
        yield db
    finally:
        if db is not None:
            db.close()
        os.close(fd)


def _read_summary(db: sqlite3.Connection) -> dict:
    all_tokens = db.execute("SELECT study_json, status FROM tokens").fetchall()
    marks = 0
    open_cases = 0
    censored = 0
    scored = []
    for raw, status in all_tokens:
        if raw:
            study = paper.check_study(json.loads(raw))
            if study["status"] == "OPEN":
                if status.startswith("CENSORED_"):
                    censored += 1
                else:
                    open_cases += 1
            else:
                last = study["events"][-1]
                if last["type"] == "PRICE_ONLY_UNVERIFIED":
                    marks += 1
                    scored.append(1 if last["priceOnlyReturnPct"] > 0 else 0)
                else:
                    censored += 1
        elif status.startswith("QUARANTINED"):
            censored += 1
    evaluated = marks + censored + open_cases
    coverage = round(marks / evaluated, 4) if evaluated else None
    # A 50/50 benchmark has Brier=0.25 regardless of actual up/down.
    # This is NOT calibration of a predictive model or evidence of edge.
    enough = marks >= 30 and coverage is not None and coverage >= .8
    return {
        "observedPublicTokens": len(all_tokens),
        "priceOnlyPaperMarks": marks,
        "openProspectiveCases": open_cases, "missingOrCensored": censored,
        "paperOutcomeCoverage": coverage,
        "noEdgeReferenceBrier": round(sum((REFERENCE_P_UP - y)**2 for y in scored) / marks, 4)
                                 if enough else None,
        "calibrationStatus": "DESCRIPTIVE_REFERENCE_NOT_PREDICTIVE_CALIBRATION"
                             if enough else "INSUFFICIENT_PROSPECTIVE_PRICE_ONLY_OUTCOMES",
        "calibratedEntryOrExitSignal": False,
        "actualProfitsVerified": False, "canTrade": False,
    }


def _rows(db: sqlite3.Connection) -> list[dict]:
    return [dict(zip(("mint", "first_discovered", "last_checked", "study_json",
                      "risk_json", "status", "last_seen"), x))
            for x in db.execute("""SELECT mint,first_discovered,last_checked,study_json,
                                  risk_json,status,last_seen FROM tokens
                                  ORDER BY first_discovered,mint""")]


def _discover(profiles: object, boosts: object) -> list[str]:
    # Reuse existing public DexScreener discovery; no Telegram-origin mints.
    return [x for x in feed.candidates(profiles, boosts) if _valid_mint(x)]


def _alert_key(mint: str, label: str) -> str:
    return _sha({"source": "PUBLIC_DEX_RPC_ONLY", "mint": mint, "label": label})


def tick(db: sqlite3.Connection, *, now: str, profiles: object, boosts: object,
         read_dossier, deliver=None, clock_now=None) -> dict:
    """One bounded cycle; commits public-only state before optional private alerts.

    Discovery: 2 fixed public DEX endpoints obtained by caller. Risk: max 6
    owner/public-mint dossiers, up to 3 prioritized pending followups. Alerts
    are at-most-once ATTEMPTED. Provider API authenticity remains unattested.
    """
    clock = _utc(now)
    if db.execute("SELECT 1 FROM cycles WHERE available_at=?", (now,)).fetchone():
        raise ValueError("duplicate_public_cycle_timestamp")
    fresh = _discover(profiles, boosts)
    existing = {r["mint"]: r for r in _rows(db)}
    if clock_now is None:
        clock_now = lambda: now  # Hermetic test clock by default.
    # Retain all public audit receipts while recycling finite active capacity.
    # No valid 24–30h later evidence => explicitly censored, never scored.
    for item in existing.values():
        age = (clock - _utc(item["first_discovered"])).total_seconds() / 3600
        if age > RESEARCH_WINDOW_HOURS and item["status"] not in ("PAPER_CLOSED", "CENSORED_NO_FOLLOWUP"):
            db.execute("UPDATE tokens SET status=? WHERE mint=?", ("CENSORED_NO_FOLLOWUP", item["mint"]))
            item["status"] = "CENSORED_NO_FOLLOWUP"
    active = sum(r["status"] not in ("PAPER_CLOSED", "CENSORED_NO_FOLLOWUP")
                 for r in existing.values())
    created = 0
    for mint in fresh:
        if mint in existing or created >= MAX_NEW or len(existing) >= MAX_RETAINED or active >= MAX_ACTIVE:
            continue
        db.execute("""INSERT INTO tokens(mint,first_discovered,last_seen)
                      VALUES(?,?,?)""", (mint, now, now))
        existing[mint] = {
            "mint": mint, "first_discovered": now, "last_seen": now,
            "last_checked": None, "study_json": None, "risk_json": "[]",
            "status": "QUEUED"}
        created += 1
        active += 1
    # Prioritize 24–30 hour due marks, then first-time discoveries, then stale
    # checks. A runner that misses the horizon MUST censor, not backfill.
    due, queued, stale = [], [], []
    for item in existing.values():
        if item["status"] in ("PAPER_CLOSED", "CENSORED_NO_FOLLOWUP"):
            continue
        study = json.loads(item["study_json"]) if item["study_json"] else None
        if study:
            paper.check_study(study)
        if study and study["status"] == "OPEN":
            hours = (clock - _utc(study["openedAt"])).total_seconds() / 3600
            if hours >= 24:
                due.append(item)
                continue
        if item["last_checked"] is None:
            queued.append(item)
        elif (clock - _utc(item["last_checked"])).total_seconds() >= CHECK_COOLDOWN_SECONDS:
            stale.append(item)
    due.sort(key=lambda row: (row["first_discovered"], row["mint"]))
    queued.sort(key=lambda row: (row["first_discovered"], row["mint"]))
    stale.sort(key=lambda row: (row["last_checked"], row["mint"]))
    selected = (due[:MAX_FOLLOWUPS] +
                (queued + stale)[:MAX_CHECKS - min(MAX_FOLLOWUPS, len(due))])
    outcomes = []
    checked = graded = quarantined = 0
    pending_alerts: list[tuple[str, str, str]] = []
    for item in selected:
        mint = item["mint"]
        checked += 1
        dossier = None
        try:
            dossier = read_dossier(mint)
            if not isinstance(dossier, dict):
                raise ValueError("provider_report_missing")
            public_study = paper.exact_public_dossier(dossier)
        except (ValueError, TypeError, KeyError, OSError, OverflowError):
            quarantined += 1
            # Missing data cannot close or grade an existing case.
            db.execute("UPDATE tokens SET last_checked=?,status=? WHERE mint=?",
                       (now, "QUARANTINED_MISSING_PUBLIC_DATA", mint))
            continue
        # Only prospective public provider data, never before this cycle's
        # first ledger receipt. Self-declared timestamps do not prove origin.
        available = _utc(public_study["marketAvailableAt"])
        provider_clock = _utc(clock_now())  # read after network call, never predate reply.
        if available > provider_clock or (provider_clock - available).total_seconds() > 900:
            quarantined += 1
            db.execute("UPDATE tokens SET last_checked=?,status=? WHERE mint=?",
                       (now, "QUARANTINED_UNTRUSTED_TIME", mint))
            continue
        study = json.loads(item["study_json"]) if item["study_json"] else None
        label = "PUBLIC_MINT_NEW"
        if study is None:
            study = paper.start(public_study)
        elif study["status"] == "OPEN":
            try:
                study = paper.follow(study, public_study)
            except (ValueError, KeyError):
                # A repeated / older public receipt cannot become a new outcome.
                db.execute("UPDATE tokens SET last_checked=? WHERE mint=?", (now, mint))
                continue
            if study["status"] == "CLOSED":
                label = study["events"][-1]["type"]
                if label == "PRICE_ONLY_UNVERIFIED":
                    graded += 1
                    outcomes.append(label)
        flags = [x for x in public_study.get("findings", [])
                 if isinstance(x, str) and x in RESEARCH_FLAGS]
        flags = sorted(set(flags))
        old_flags = json.loads(item["risk_json"])
        risk_new = sorted(set(flags) - set(old_flags))
        if risk_new:
            label = "RISK_VISIBILITY_" + "_".join(risk_new)
        # Only append a prospective sealed study after a checked provider read.
        db.execute("""UPDATE tokens SET study_json=?, risk_json=?, status=?,
                      last_checked=? WHERE mint=?""",
                   (json.dumps(study, sort_keys=True, allow_nan=False),
                    json.dumps(flags), "PAPER_CLOSED" if study["status"] == "CLOSED"
                    else "PUBLIC_PARTIAL_UNVERIFIED", now, mint))
        if label != "PUBLIC_MINT_NEW" or item["last_checked"] is None:
            headline = ("Observed public mint" if label == "PUBLIC_MINT_NEW"
                        else "Risk/coverage update" if risk_new
                        else "24–30h paper outcome (price-only)" if label == "PRICE_ONLY_UNVERIFIED"
                        else "Paper comparison censored")
            body = (
                "Jhadina SHARK | Public-market research (NOT a trade alert)\n"
                f"{headline}\nMint: {mint}\n"
                f"Public provider status: PARTIAL / NOT INDEPENDENTLY ATTESTED\n"
                f"Risk flags: {', '.join(flags) if flags else 'No reviewed controls proved safe'}\n"
                f"Paper status: {study['events'][-1]['type'] if study['status']=='CLOSED' else 'UNSCORED_OPEN'}\n"
                "No Telegram message used as market evidence or AI training.\n"
                "No trading, verified sellability, entries, or executable returns."
            )
            pending_alerts.append((mint, _alert_key(mint, label), body))
    # Deterministic receipt only describes public research checks, not source
    # attestation or real-time execution latency. Do not log contract IDs.
    receipt = _sha({"time": now, "checked": checked, "created": created,
                    "graded": graded, "quarantined": quarantined,
                    "selected": [x["mint"] for x in selected]})
    db.execute("""INSERT INTO cycles(available_at,receipt_digest,new_tokens,checked,graded)
                  VALUES(?,?,?,?,?)""", (now, receipt, created, checked, graded))
    # Claim before network I/O: duplicate or uncertain delivery is NEVER retried.
    outbox: list[tuple[str, str]] = []
    for mint, key, body in pending_alerts[:MAX_ALERTS_PER_CYCLE]:
        row = db.execute("INSERT OR IGNORE INTO outbox(event_key,mint,created_at,delivery) VALUES(?,?,?,?)",
                         (key, mint, now, "ATTEMPTED" if deliver else "DISABLED"))
        if row.rowcount and deliver:
            outbox.append((key, body))
    db.commit()
    sent = 0
    for key, body in outbox:
        try:
            success = deliver(body) is True
        except Exception:
            success = False
        # Audit only; never retry this key if the reply may already have sent.
        db.execute("UPDATE outbox SET delivery=? WHERE event_key=?",
                   ("ACKNOWLEDGED" if success else "UNCERTAIN_NO_RETRY", key))
        db.commit()
        sent += int(success)
    return {
        "schema": SCHEMA, "cycleAt": now, "newlyDiscovered": created,
        "checkedPublicMints": checked, "quarantined": quarantined,
        "priceOnlyCasesGraded": graded, "alertsAttempted": len(outbox),
        "alertsAcknowledged": sent, "canTrade": False, "canSign": False,
        "canBroadcast": False, "telegramDataIngested": False,
        "providerEvidenceIndependentlyAttested": False,
        "continuousLatencyCertified": False,
        "paper": _read_summary(db),
    }


def read_public_feeds():
    return (feed.fetch_json("/token-profiles/latest/v1"),
            feed.fetch_json("/token-boosts/latest/v1"))


def _private_sender():
    if os.environ.get("ENABLE_SHARK_PUBLIC_ALERTS") != "true":
        raise ValueError("owner_public_alerts_not_enabled")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    ident = os.environ.get("TELEGRAM_ALLOWED_USER_ID", "")
    if not token or not ident.isascii() or not ident.isdecimal() or not 0 < int(ident) < 2**63:
        raise ValueError("owner_notification_credentials_invalid")
    # Reuse protected owner-private Telegram send; NEVER getUpdates.
    import importlib.util
    filename = Path(__file__).resolve().parent.parent / "telegram" / "bot_research_once.py"
    telegram_dir = str(filename.parent)
    if telegram_dir not in sys.path:
        sys.path.insert(0, telegram_dir)
    from bot_research_once import send_private_preview
    def send(message: str) -> bool:
        send_private_preview(token, int(ident), message)
        return True
    return send


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["audit", "once", "serve"], default="audit")
    parser.add_argument("--state", required=True, help="Absolute PRIVATE local SQLite path, outside source checkout")
    parser.add_argument("--confirm", default="", help="Must be PUBLIC-MARKET-RESEARCH-ONLY for network reads")
    parser.add_argument("--interval-seconds", type=int, default=180)
    parser.add_argument("--notify", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.mode != "audit" and args.confirm != "PUBLIC-MARKET-RESEARCH-ONLY":
            raise ValueError("read_only_owner_optin_required")
        if args.mode == "serve" and os.environ.get("SHARK_PUBLIC_HOST_COMMISSIONED") != "true":
            raise ValueError("trusted_continuous_host_not_commissioned")
        if not 120 <= args.interval_seconds <= 3600:
            raise ValueError("public_poll_interval_outside_bounds")
        sender = _private_sender() if args.notify else None
        with local_database(args.state) as db:
            if args.mode == "audit":
                print(json.dumps({"schema": SCHEMA, "authority": "RESEARCH_ONLY",
                                  "paper": _read_summary(db), "canTrade": False}))
                return 0
            while True:
                now = feed.now_utc()
                profiles, boosts = read_public_feeds()
                result = tick(db, now=now, profiles=profiles, boosts=boosts,
                              read_dossier=public.manual_read_public_mint,
                              deliver=sender, clock_now=feed.now_utc)
                # No mint, token secret, account ID or Telegram contents in logs.
                print(json.dumps(result, sort_keys=True), flush=True)
                if args.mode == "once":
                    return 0
                time.sleep(args.interval_seconds)
    except (ValueError, OSError, sqlite3.Error, KeyboardInterrupt) as exc:
        # Avoid printing provider errors (may contain URLs or credentials).
        print("SHARK_PUBLIC_INTELLIGENCE_HELD_OR_UNAVAILABLE", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
