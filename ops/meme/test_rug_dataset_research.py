"""Hermetic SHARK dataset provenance, taxonomy, and holdout safety tests."""
import csv
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest

PATH = Path(__file__).with_name("rug_dataset_research.py")
spec = importlib.util.spec_from_file_location("rug_dataset_research", PATH)
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)

FIELDS = research.REQUIRED_COLUMNS
SOURCE = "2026-01-01T00:00:00Z"
FEATURE = "2026-01-02T00:00:00Z"
DECISION = "2026-01-02T00:01:00Z"
OUTCOME = "2026-01-09T00:00:00Z"


def make_bytes(rows):
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def incident(idx=1, chain="ETH", category="Transaction Limitation", **changes):
    record = {
        "No.": str(idx), "Chain": chain, "address": "0x" + format(idx, "040x"),
        "Losses": "$1,000.00", "Type": category, "Root Causes": "Sale-restrict",
        "Sources": "synthetic-fixture", "URL": "https://example.invalid/source",
    }
    record.update(changes)
    return record


def audit(rows):
    content = make_bytes(rows)
    return research.audit_corpus(content, expected_blob_sha=research.git_blob_sha(content))


def cohort(n_positive=10, n_control=10, chain="ETH"):
    rows = []
    for idx in range(n_positive + n_control):
        label = "RUG" if idx < n_positive else "CONTROL"
        rows.append({
            "caseId": "fixture-case-" + str(idx), "actorGroup": "actor-" + str(idx),
            "chain": chain, "label": label, "split": "HOLDOUT",
            "predictedHighRisk": (idx % 5 != 0) if label == "RUG" else (idx % 5 == 0),
            "featureAvailableAt": FEATURE, "decisionAt": DECISION,
            "outcomeAvailableAt": OUTCOME, "featureSource": "independent-rpc",
            "outcomeSource": "forensic-reporter-" + str(idx % 2),
        })
    return rows


class CorpusTests(unittest.TestCase):
    def test_pinned_unmodified_csv_and_research_only_semantics(self):
        result = audit([incident(), incident(2, "BSC", "Fee")])
        self.assertEqual(result["records"], 2)
        self.assertEqual(result["chainCounts"], {"BSC": 1, "ETH": 1})
        self.assertEqual(result["distinctChainAddressPairs"], 2)
        self.assertEqual(result["typeCounts"]["Fee"], 1)
        self.assertEqual(result["mappedEvidenceFamilies"]["Fee"], "FEE_OR_TAX_CONTROL")
        self.assertIn("POSITIVE_CASES_ONLY_NO_NEGATIVE_CONTROLS", result["warnings"])
        self.assertFalse(result["canTrainCalibratedModel"])
        self.assertFalse(result["canCertifyTokenSafety"])
        self.assertFalse(result["canAuthorizeTrade"])
        self.assertNotIn("0x000", str(result))  # Aggregate only: no addresses disclosed.

    def test_pin_rejects_any_changed_bytes(self):
        data = make_bytes([incident()])
        pinned = research.git_blob_sha(data)
        result = research.audit_corpus(data, expected_blob_sha=pinned)
        self.assertEqual(result["sourceGitBlobSha"], pinned)
        with self.assertRaisesRegex(ValueError, "unpinned_or_changed"):
            research.audit_corpus(data + b"\n", expected_blob_sha=pinned)

    def test_upstream_blob_is_not_synthetic_fixture_blob(self):
        data = make_bytes([incident()])
        with self.assertRaisesRegex(ValueError, "unpinned_or_changed"):
            research.audit_corpus(data)  # Enforces verified upstream SHA by default.

    def test_schema_and_width_fail_closed(self):
        data = make_bytes([incident()])
        with self.assertRaisesRegex(ValueError, "schema_mismatch"):
            research.audit_corpus(data.replace(b"Root Causes", b"Root_Causes"),
                                  expected_blob_sha=research.git_blob_sha(data.replace(b"Root Causes", b"Root_Causes")))
        bad = data + b'3,ETH,0x0,1000,Fee,Root,Source,https://example.invalid,EXTRA\n'
        with self.assertRaisesRegex(ValueError, "row_width_invalid"):
            research.audit_corpus(bad, expected_blob_sha=research.git_blob_sha(bad))

    def test_row_quality_is_explicit_not_reclassified_as_safe(self):
        rows = [
            incident(1, category="Unknown and unmapped", Losses="N/A"),
            incident(2, chain="SOL", **{"address": "not-an-evm-contract", "Losses": "not_money"}),
            incident(1),
        ]
        result = audit(rows)
        self.assertEqual(result["invalid"]["chain"], 1)
        self.assertEqual(result["invalid"]["address"], 1)
        self.assertEqual(result["invalid"]["id_or_duplicate"], 1)
        self.assertEqual(result["invalid"]["unmapped_type"], 1)
        self.assertEqual(result["lossValueQuality"]["MISSING"], 1)
        self.assertEqual(result["lossValueQuality"]["INVALID"], 1)
        self.assertIn("ROW_QUALITY_GAPS_REQUIRE_REVIEW", result["warnings"])

    def test_duplicate_addresses_are_case_insensitive(self):
        row = incident()
        mirror = incident(2, **{"address": row["address"].upper().replace("0X", "0x")})
        self.assertEqual(audit([row, mirror])["invalid"]["duplicate_chain_address"], 1)


class SealedHoldoutTests(unittest.TestCase):
    def test_balanced_prospective_controls_descriptive_only(self):
        result = research.evaluate_sealed_holdout(cohort(), frozen_at=SOURCE)
        self.assertEqual(result["status"], "DESCRIPTIVE_HOLDOUT_ONLY")
        self.assertEqual(result["truePositiveRate"], 0.8)
        self.assertEqual(result["falsePositiveRate"], 0.2)
        self.assertEqual(result["balancedAccuracy"], 0.8)
        self.assertEqual(result["calibration"], "UNVERIFIED")
        self.assertFalse(result["canAuthorizeTrade"])

    def test_one_class_corpus_never_scores(self):
        result = research.evaluate_sealed_holdout(cohort(n_control=0), frozen_at=SOURCE)
        self.assertEqual(result["status"], "UNSCORED")
        self.assertIsNone(result["balancedAccuracy"])

    def test_no_independent_outcome_sources_abstains(self):
        rows = cohort()
        for r in rows:
            r["outcomeSource"] = "same-for-all-cases"
        result = research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)
        self.assertEqual(result["status"], "UNSCORED")

    def test_post_outcome_features_and_unfrozen_rule_rejected(self):
        rows = cohort()
        rows[0]["featureAvailableAt"] = "2026-01-10T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "lookahead"):
            research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)
        rows = cohort()
        with self.assertRaisesRegex(ValueError, "lookahead"):
            research.evaluate_sealed_holdout(rows, frozen_at=OUTCOME)

    def test_same_predictor_and_outcome_provenance_rejected(self):
        rows = cohort()
        rows[0]["outcomeSource"] = rows[0]["featureSource"]
        with self.assertRaisesRegex(ValueError, "not_independent"):
            research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)

    def test_actor_split_leakage_rejected(self):
        with self.assertRaisesRegex(ValueError, "actor_overlap"):
            research.evaluate_sealed_holdout(cohort(), frozen_at=SOURCE,
                                             training_actor_groups=("actor-3",))

    def test_duplicate_and_unsealed_predictions_rejected(self):
        rows = cohort()
        rows[-1]["caseId"] = rows[0]["caseId"]
        with self.assertRaisesRegex(ValueError, "duplicate_case"):
            research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)
        rows = cohort()
        rows[0]["predictedHighRisk"] = 1  # Not a true boolean.
        with self.assertRaisesRegex(ValueError, "unsealed_prediction"):
            research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)

    def test_sol_is_explicitly_out_of_domain_even_with_controls(self):
        result = research.evaluate_sealed_holdout(cohort(chain="SOL"), frozen_at=SOURCE)
        self.assertEqual(result["status"], "DESCRIPTIVE_HOLDOUT_ONLY")
        self.assertIn("UPSTREAM_DATASET_DOES_NOT_COVER_SOLANA", result["reasons"])
        self.assertFalse(result["canTrainCalibratedModel"])

    def test_mixed_chain_pooling_rejected(self):
        rows = cohort()
        rows[-1]["chain"] = "SOL"
        with self.assertRaisesRegex(ValueError, "mixed_chains"):
            research.evaluate_sealed_holdout(rows, frozen_at=SOURCE)


if __name__ == "__main__":
    unittest.main()
