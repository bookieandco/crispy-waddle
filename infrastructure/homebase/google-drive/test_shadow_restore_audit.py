#!/usr/bin/env python3
"""No network or PostgreSQL service: validate the disposable restore audit."""
import json
import subprocess
import unittest
from unittest.mock import patch

import shadow_restore_audit as audit


def clean_counts(**overrides):
    data = {
        "market_samples": 53, "decisions": 12, "executions": 12,
        "observations": 18, "lessons": 18, "calibrations": 2,
        "memories": 4, "sync_records": 65, "runtime_state": 3,
        "observation_horizons": {"15M": 10, "1H": 8},
        "lesson_horizons": {"15M": 10, "1H": 8},
        "grade_review_table_present": True,
        "orphan_observations": 0, "orphan_lessons": 0,
        "authority_violations": 0,
        "spot_quote_grade_review_required": 11,
        "observation_sample_timestamp_disagreement": 0,
        "pending_sync": 6,
    }
    data.update(overrides)
    return data


class ValidateSemanticsTests(unittest.TestCase):
    def test_recovered_rows_can_be_sound_even_while_old_grades_are_suspect(self):
        data = audit.validate_audit(clean_counts())
        self.assertEqual(data["observations"], 18)
        self.assertEqual(data["spot_quote_grade_review_required"], 11)
        self.assertEqual(data["pending_sync"], 6)

    def test_empty_ledger_is_recoverable_but_not_automatically_certified(self):
        data = clean_counts(**{
            "market_samples": 0, "decisions": 0, "executions": 0,
            "observations": 0, "lessons": 0, "calibrations": 0,
            "memories": 0, "sync_records": 0, "runtime_state": 0,
            "observation_horizons": {}, "lesson_horizons": {},
            "spot_quote_grade_review_required": 0, "pending_sync": 0,
        })
        self.assertEqual(audit.validate_audit(data)["decisions"], 0)

    def test_cannot_pass_unreconciled_or_fabricated_horizons(self):
        for data in (
            clean_counts(observation_horizons={"15M": 18, "7D": 1}),
            clean_counts(lesson_horizons={"15M": -1, "1H": 19}),
            clean_counts(observation_horizons={"FUTURE": 18}),
        ):
            with self.assertRaises(audit.ShadowSemanticError):
                audit.validate_audit(data)

    def test_authority_and_foreign_key_anomalies_fail_closed(self):
        for flag in ("orphan_observations", "orphan_lessons", "authority_violations"):
            with self.subTest(flag=flag):
                with self.assertRaises(audit.ShadowSemanticError):
                    audit.validate_audit(clean_counts(**{flag: 1}))

    def test_missing_schema_metrics_do_not_default_to_zero(self):
        data = clean_counts()
        del data["grade_review_table_present"]
        with self.assertRaisesRegex(audit.ShadowSemanticError, "presence"):
            audit.validate_audit(data)

    def test_rejects_nonrandom_or_production_docker_target_before_invocation(self):
        with patch.object(audit.subprocess, "run") as run:
            for container in ("postgres", "jhadina_shadow", "jhadina-drill-123", "jhadina-drill-hello"):
                with self.assertRaisesRegex(audit.ShadowSemanticError, "unrecognized"):
                    audit.audit_disposable_shadow_postgres(container)
            run.assert_not_called()

    def test_aggregate_query_remains_read_only_and_returns_only_counts(self):
        class Complete:
            returncode = 0
            stdout = json.dumps(clean_counts()).encode()
        with patch.object(audit.subprocess, "run", return_value=Complete()) as run:
            result = audit.audit_disposable_shadow_postgres("jhadina-drill-012345abcdef")
        args = run.call_args.args[0]
        self.assertEqual(args[:3], ["docker", "exec", "jhadina-drill-012345abcdef"])
        self.assertIn("psql", args)
        self.assertNotIn("prod", args)
        self.assertNotIn("CREATE ", audit.AGGREGATE_SQL)
        self.assertNotIn("INSERT ", audit.AGGREGATE_SQL)
        self.assertEqual(result["decisions"], 12)

    def test_missing_or_broken_audit_response_blocks_proof(self):
        class Broken:
            returncode = 1
            stdout = b""
        with patch.object(audit.subprocess, "run", return_value=Broken()):
            with self.assertRaisesRegex(audit.ShadowSemanticError, "failed"):
                audit.audit_disposable_shadow_postgres("jhadina-drill-012345abcdef")


if __name__ == "__main__":
    unittest.main()
