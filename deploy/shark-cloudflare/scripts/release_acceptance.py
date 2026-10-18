#!/usr/bin/env python3
"""SHARK-CLOUDFLARE.LIVE.17-.20: OFFLINE acceptance, no Cloudflare or trading access.

migration: in-memory canonical D1 migration audit, never remote execute.
benchmark: screen operator-transcribed CPU/provider metrics, not attestation.
retention: capacity and evidence-preservation screen, NEVER prune/delete.
restore: restore locally from trusted *plaintext* export into :memory:, verify
         hashes and constraints. Decrypt externally on an approved second host.
All returns keep production, collection, Telegram and trading disabled.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0001_public_only.sql"
TABLES = ("daily_budget", "cycles", "watch", "observations", "outcomes", "alert_outbox")
INDEXES = ("watch_due",)
CPU_LIMIT_MS = 10
D1_DB_LIMIT = 500_000_000
D1_ACCOUNT_LIMIT = 5_000_000_000
MAX_DUMP_BYTES = 24_000_000
COMMON = {"remoteAttested": False, "cronAuthorized": False,
          "telegramAuthorized": False, "tradingAuthorized": False,
          "workerCollectionAuthorized": False, "sourceOnly": True}


class Blocked(ValueError):
    pass


def require_fields(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise Blocked("MISSING_OR_EXTRA_FIELDS")
    return value


def nonnegative(value, *, integral=False):
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise Blocked("INVALID_NUMERIC_SAMPLE")
    if integral and (not isinstance(value, int)):
        raise Blocked("INVALID_INTEGER_SAMPLE")
    if value < 0 or value != value or value == float("inf"):
        raise Blocked("INVALID_NUMERIC_RANGE")
    return value


def provenance(obj):
    for field in ("sourceRef", "collectedAt"):
        if not isinstance(obj.get(field), str):
            raise Blocked("MISSING_PROVENANCE")
    if not obj["sourceRef"].startswith("https://") or len(obj["sourceRef"]) > 320:
        raise Blocked("UNREVIEWED_SOURCE_REFERENCE")
    try:
        timestamp = datetime.fromisoformat(obj["collectedAt"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise Blocked("INVALID_TIMESTAMP") from exc
    if timestamp.utcoffset() != timezone.utc.utcoffset(timestamp):
        raise Blocked("NON_UTC_TIMESTAMP")


def canonical_sql(sql):
    if not isinstance(sql, str) or not sql.strip():
        raise Blocked("MIGRATION_MISSING")
    stripped = re.sub(r"(?m)^\s*--[^\n]*", "", sql)
    statements = [v.strip() for v in stripped.split(";") if v.strip()]
    if len(statements) != 7 or any(
        not re.match(r"^CREATE\s+(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+", v, re.I)
        for v in statements
    ):
        raise Blocked("MIGRATION_UNEXPECTED_STATEMENTS")
    return sql


def inspect_db(conn):
    names = conn.execute(
        "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'"
    ).fetchall()
    expected = {("table", n) for n in TABLES} | {("index", n) for n in INDEXES}
    if {(row[0], row[1]) for row in names} != expected or len(names) != len(expected):
        raise Blocked("RESTORED_SCHEMA_DRIFT")
    for kind, name, sql in names:
        if not sql or kind not in ("table", "index"):
            raise Blocked("RESTORE_UNEXPECTED_SCHEMA")
    # Foreign keys and critical constraints cannot silently disappear.
    for table in ("observations", "outcomes"):
        keys = conn.execute(f"PRAGMA foreign_key_list({table})").fetchall()
        if not any(row[2] == "watch" for row in keys):
            raise Blocked("RESTORE_FOREIGN_KEY_MISSING")
    sql_map = {row[1]: re.sub(r"\s+", "", row[2].lower()) for row in names}
    for table, parts in {
        "daily_budget": ("check(cyclesbetween0and288)",),
        "watch": ("check(statein", "initial_usdrealnotnullcheck(initial_usd>0)"),
        "outcomes": ("check(kindin",),
        "alert_outbox": ("check(statein",),
    }.items():
        if any(fragment not in sql_map[table] for fragment in parts):
            raise Blocked("RESTORE_KEY_CONSTRAINT_MISSING")
    if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise Blocked("RESTORE_SQLITE_INTEGRITY_FAILED")
    if conn.execute("PRAGMA foreign_key_check").fetchall():
        raise Blocked("RESTORE_FOREIGN_KEYS_FAILED")


def migration_check(sql):
    raw = canonical_sql(sql)
    with sqlite3.connect(":memory:") as conn:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(raw)
        inspect_db(conn)
        conn.executescript(raw)  # idempotency; never remotely run
        inspect_db(conn)
        try:
            conn.execute("INSERT INTO daily_budget(utc_day,cycles) VALUES('bad',289)")
        except sqlite3.IntegrityError:
            pass
        else:
            raise Blocked("MIGRATION_BUDGET_CHECK_INACTIVE")
    return {"schema": "SHARK_CF_MIGRATION_ACCEPTANCE_01",
            "status": "OFFLINE_MIGRATION_SQL_ACCEPTED_NOT_REMOTE_APPLIED",
            "sqlSha256": hashlib.sha256(raw.encode()).hexdigest(),
            "tableCount": len(TABLES), "indexCount": len(INDEXES),
            "remoteMigrationApplied": False, **COMMON}


def benchmark_check(sample):
    require_fields(sample, ("sourceRef", "collectedAt", "deploymentSha",
                            "planReported", "sampleMode", "invocations",
                            "cpuMs", "wallMs", "provider", "d1", "subrequestsMax"))
    provenance(sample)
    if not isinstance(sample["deploymentSha"], str) or not re.fullmatch(
        r"[0-9a-f]{40}", sample["deploymentSha"]
    ):
        raise Blocked("BAD_DEPLOYMENT_SHA")
    if sample["sampleMode"] != "OPERATOR_TRANSCRIBED_CLOUDFLARE_METRICS":
        raise Blocked("BENCHMARK_ORIGIN_NOT_SUPPORTED")
    nonnegative(sample["invocations"], integral=True)
    require_fields(sample["cpuMs"], ("p50", "p95", "max"))
    require_fields(sample["wallMs"], ("p95",))
    require_fields(sample["provider"], ("requests", "errors", "rateLimited", "p95LatencyMs"))
    require_fields(sample["d1"], ("reads", "writes"))
    for obj in (sample["cpuMs"], sample["wallMs"], sample["provider"], sample["d1"]):
        for name, value in obj.items():
            nonnegative(value, integral=name in ("requests", "errors", "rateLimited", "reads", "writes"))
    nonnegative(sample["subrequestsMax"], integral=True)
    c = sample["cpuMs"]
    if c["p50"] > c["p95"] or c["p95"] > c["max"] or (
        sample["provider"]["errors"] + sample["provider"]["rateLimited"]
        > sample["provider"]["requests"]
    ):
        raise Blocked("BENCHMARK_INCOHERENT")
    checks = {
        "workerFreePlanReported": sample["planReported"] == "FREE",
        "representativeSamples": sample["invocations"] >= 30,
        "cpuHardLimit": c["max"] < CPU_LIMIT_MS,
        "subrequestLimit": sample["subrequestsMax"] < 50,
        "providerNoErrors": sample["provider"]["errors"] == 0,
        "providerNoRateLimiting": sample["provider"]["rateLimited"] == 0,
        "providerObserved": sample["provider"]["requests"] > 0,
    }
    return {"schema": "SHARK_CF_RUNTIME_SCREEN_01",
            "status": ("REPORTED_ENVELOPE_IN_RANGE_UNATTESTED" if all(checks.values())
                       else "RUNTIME_BENCHMARK_REQUIRES_REVIEW"),
            "numericChecks": checks, "sampleOriginVerified": False,
            "cloudflareCpuTelemetryVerified": False, **COMMON}


def retention_check(sample):
    require_fields(sample, ("sourceRef", "collectedAt", "databaseBytes",
                            "accountD1Bytes", "dailyGrowthBytes", "openWatches",
                            "retainedCases", "oldestUnclosedHours", "offHostRestoreVerified"))
    provenance(sample)
    for key in ("databaseBytes", "accountD1Bytes", "dailyGrowthBytes",
                "openWatches", "retainedCases", "oldestUnclosedHours"):
        nonnegative(sample[key], integral=True)
    if not isinstance(sample["offHostRestoreVerified"], bool):
        raise Blocked("RETENTION_RESTORE_FLAG_INVALID")
    db_remaining = D1_DB_LIMIT * 0.8 - sample["databaseBytes"]
    account_remaining = D1_ACCOUNT_LIMIT * 0.8 - sample["accountD1Bytes"]
    thirty_day_growth = 30 * sample["dailyGrowthBytes"]
    checks = {
        "dbThirtyDayHeadroom": db_remaining >= thirty_day_growth,
        "accountThirtyDayHeadroom": account_remaining >= thirty_day_growth,
        "openCasesBelowCap": sample["openWatches"] <= 1000,
        "oldestCaseWithinResearchWindow": sample["oldestUnclosedHours"] <= 36,
        "closedRowsRetained": sample["retainedCases"] >= sample["openWatches"],
    }
    return {"schema": "SHARK_CF_EVIDENCE_RETENTION_01",
            "status": ("CAPACITY_SCREEN_OK_NO_RETENTION_MUTATION" if all(checks.values())
                       else "ARCHIVE_AND_CAPACITY_REVIEW_REQUIRED"),
            "checks": checks, "automaticDeletion": False,
            "manualEncryptedArchiveReviewRequired": True,
            "offHostRestoreIndependentlyVerified": False, **COMMON}


def _deny_unsafe(action, arg1, arg2, database, origin):
    prohibited = (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH,
                  sqlite3.SQLITE_CREATE_TRIGGER, sqlite3.SQLITE_CREATE_VIEW,
                  sqlite3.SQLITE_CREATE_VTABLE, sqlite3.SQLITE_DROP_TABLE,
                  sqlite3.SQLITE_DROP_INDEX, sqlite3.SQLITE_ALTER_TABLE)
    return sqlite3.SQLITE_DENY if action in prohibited else sqlite3.SQLITE_OK


def restore_check(raw, expected=None):
    if not isinstance(raw, bytes) or not (0 < len(raw) <= MAX_DUMP_BYTES):
        raise Blocked("RESTORE_DUMP_SIZE_INVALID")
    try:
        sql = raw.decode("utf-8")
    except UnicodeError as exc:
        raise Blocked("RESTORE_DUMP_NOT_UTF8") from exc
    with sqlite3.connect(":memory:") as conn:
        conn.set_authorizer(_deny_unsafe)
        try:
            conn.executescript(sql)
        except sqlite3.Error as exc:
            raise Blocked("RESTORE_SQL_UNTRUSTED_OR_FAILED") from exc
        inspect_db(conn)
        counts, digests = {}, {}
        for table in TABLES:
            rows = conn.execute(f"SELECT * FROM {table} ORDER BY rowid").fetchall()
            counts[table] = len(rows)
            stable = json.dumps(rows, ensure_ascii=True, separators=(",", ":"), default=str)
            digests[table] = hashlib.sha256(stable.encode()).hexdigest()
        snapshot = hashlib.sha256(json.dumps(
            {"counts": counts, "tableDigests": digests}, sort_keys=True
        ).encode()).hexdigest()
    if expected is not None:
        require_fields(expected, ("snapshotSha256", "counts"))
        if expected["snapshotSha256"] != snapshot or expected["counts"] != counts:
            raise Blocked("RESTORE_SOURCE_FINGERPRINT_MISMATCH")
    return {"schema": "SHARK_CF_LOCAL_RESTORE_01",
            "status": "ISOLATED_LOCAL_SQL_RESTORE_VALID_NOT_OFFHOST_CERTIFIED",
            "plaintextInputSha256": hashlib.sha256(raw).hexdigest(),
            "snapshotSha256": snapshot, "counts": counts,
            "expectedFingerprintMatched": expected is not None,
            "encryptedOffHostArchiveVerified": False,
            "secondIndependentHostVerified": False, **COMMON}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("migration", "benchmark", "retention", "restore"),
                        required=True)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--expected", type=Path)
    parser.add_argument("--confirm")
    args = parser.parse_args()
    if args.mode == "migration":
        if args.input or args.expected or args.confirm:
            raise Blocked("MIGRATION_USES_FIXED_REPO_SCHEMA_ONLY")
        result = migration_check(MIGRATION.read_text())
    elif args.mode == "restore":
        if args.confirm != "ISOLATED-OFFLINE-SQL-RESTORE-ONLY" or not args.input:
            raise Blocked("RESTORE_EXPLICIT_LOCAL_CONFIRM_REQUIRED")
        raw = args.input.read_bytes()
        expected = json.loads(args.expected.read_text()) if args.expected else None
        result = restore_check(raw, expected)
    else:
        if not args.input or args.expected or args.confirm:
            raise Blocked("METRICS_LOCAL_INPUT_REQUIRED")
        sample = json.loads(args.input.read_text())
        result = benchmark_check(sample) if args.mode == "benchmark" else retention_check(sample)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (Blocked, ValueError, OSError, sqlite3.Error):
        print("SHARK_CF_OFFLINE_RELEASE_GATE_FAILED_CLOSED", file=sys.stderr)
        sys.exit(1)
