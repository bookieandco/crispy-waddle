#!/usr/bin/env python3
"""Hermetic negative-path certification for release_acceptance. No network."""
import json
import sqlite3
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
import release_acceptance as gate

SOURCE = {"sourceRef": "https://dash.cloudflare.com/owner-review",
          "collectedAt": "2026-10-18T23:00:00Z"}


class ReleaseGateTests(unittest.TestCase):
    def test_migration_is_exact_canonical_in_memory(self):
        report = gate.migration_check(gate.MIGRATION.read_text())
        self.assertFalse(report["remoteMigrationApplied"])
        self.assertFalse(report["cronAuthorized"])
        self.assertEqual(report["tableCount"], 6)
        self.assertEqual(report["indexCount"], 1)

    def test_migration_rejects_triggers_extra_ddl_and_missing_check(self):
        sql = gate.MIGRATION.read_text()
        with self.assertRaises(gate.Blocked):
            gate.migration_check(sql + "\nDROP TABLE watch;")
        with self.assertRaises(gate.Blocked):
            gate.migration_check(sql.replace("CHECK(cycles BETWEEN 0 AND 288)", ""))

    def _benchmark(self):
        return {
            **SOURCE, "deploymentSha": "a" * 40, "planReported": "FREE",
            "sampleMode": "OPERATOR_TRANSCRIBED_CLOUDFLARE_METRICS",
            "invocations": 40,
            "cpuMs": {"p50": 2, "p95": 4, "max": 7},
            "wallMs": {"p95": 250},
            "provider": {"requests": 45, "errors": 0,
                         "rateLimited": 0, "p95LatencyMs": 180},
            "d1": {"reads": 250, "writes": 50},
            "subrequestsMax": 12
        }

    def test_benchmark_never_certifies_provider_or_cron(self):
        report = gate.benchmark_check(self._benchmark())
        self.assertEqual(report["status"], "REPORTED_ENVELOPE_IN_RANGE_UNATTESTED")
        self.assertFalse(report["cloudflareCpuTelemetryVerified"])
        self.assertFalse(report["cronAuthorized"])
        self.assertFalse(report["workerCollectionAuthorized"])
        self.assertFalse(report["tradingAuthorized"])

    def test_benchmark_fails_numeric_and_provenance_edge_cases(self):
        for key, value in [
            ("cpuMs", {"p50": 4, "p95": 11, "max": 12}),
            ("subrequestsMax", 50),
            ("provider", {"requests": 45, "errors": 1, "rateLimited": 0,
                          "p95LatencyMs": 180}),
        ]:
            payload = self._benchmark()
            payload[key] = value
            self.assertEqual(gate.benchmark_check(payload)["status"],
                             "RUNTIME_BENCHMARK_REQUIRES_REVIEW")
        for key, value in [
            ("cpuMs", {"p50": 5, "p95": 2, "max": 7}),
            ("deploymentSha", "unknown"),
            ("invocations", -1),
            ("collectedAt", "yesterday"),
        ]:
            payload = self._benchmark()
            payload[key] = value
            with self.assertRaises(gate.Blocked):
                gate.benchmark_check(payload)
        payload = self._benchmark()
        payload["privateKey"] = "must reject"
        with self.assertRaises(gate.Blocked):
            gate.benchmark_check(payload)

    def _retention(self):
        return {**SOURCE, "databaseBytes": 5_000_000, "accountD1Bytes": 10_000_000,
                "dailyGrowthBytes": 20_000, "openWatches": 12,
                "retainedCases": 30, "oldestUnclosedHours": 12,
                "offHostRestoreVerified": False}

    def test_retention_never_deletes_or_attests_offhost(self):
        result = gate.retention_check(self._retention())
        self.assertEqual(result["status"], "CAPACITY_SCREEN_OK_NO_RETENTION_MUTATION")
        self.assertFalse(result["automaticDeletion"])
        self.assertFalse(result["offHostRestoreIndependentlyVerified"])
        self.assertFalse(result["cronAuthorized"])

    def test_retention_fail_close_on_no_headroom_and_invalid_sample(self):
        high = self._retention()
        high["databaseBytes"] = 480_000_000
        self.assertEqual(gate.retention_check(high)["status"],
                         "ARCHIVE_AND_CAPACITY_REVIEW_REQUIRED")
        bad = self._retention()
        bad["openWatches"] = -10
        with self.assertRaises(gate.Blocked):
            gate.retention_check(bad)
        bad = self._retention()
        bad["offHostRestoreVerified"] = "yes"
        with self.assertRaises(gate.Blocked):
            gate.retention_check(bad)

    def _dump(self, extra_sql=""):
        with sqlite3.connect(":memory:") as db:
            db.executescript(gate.MIGRATION.read_text())
            db.execute("INSERT INTO daily_budget(utc_day,cycles) VALUES('2026-10-18',1)")
            db.execute("INSERT INTO cycles(scheduled_ms,started_at,status) VALUES(1234,'timestamp','DONE')")
            db.commit()
            return ("\n".join(db.iterdump()) + "\n" + extra_sql).encode()

    def test_restore_fingerprints_and_second_machine_is_not_attested(self):
        raw = self._dump()
        result = gate.restore_check(raw)
        self.assertEqual(result["counts"]["cycles"], 1)
        self.assertEqual(result["counts"]["daily_budget"], 1)
        self.assertFalse(result["encryptedOffHostArchiveVerified"])
        self.assertFalse(result["secondIndependentHostVerified"])
        expected = {"snapshotSha256": result["snapshotSha256"], "counts": result["counts"]}
        self.assertTrue(gate.restore_check(raw, expected)["expectedFingerprintMatched"])
        expected["snapshotSha256"] = "0" * 64
        with self.assertRaises(gate.Blocked):
            gate.restore_check(raw, expected)

    def test_restore_cannot_attach_files_or_import_unrelated_schema(self):
        with self.assertRaises(gate.Blocked):
            gate.restore_check(self._dump("ATTACH DATABASE '/tmp/shark-bad.sqlite' AS other;"))
        with self.assertRaises(gate.Blocked):
            gate.restore_check(self._dump("CREATE TABLE pupsonstuff(id INTEGER);"))
        with self.assertRaises(gate.Blocked):
            gate.restore_check(b"")
        with self.assertRaises(gate.Blocked):
            gate.restore_check(b"x" * (gate.MAX_DUMP_BYTES + 1))

    def test_restore_foreign_key_inconsistency_is_detected(self):
        sql = self._dump().decode() + "\nINSERT INTO observations(mint, observed_ms, pair, price_usd, liquidity_usd) VALUES('unknown', 1, 'pair', 1, 1);\n"
        with self.assertRaises(gate.Blocked):
            gate.restore_check(sql.encode())


if __name__ == "__main__":
    unittest.main()
