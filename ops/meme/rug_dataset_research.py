"""Offline, non-executing SHARK historical rug-pull research.

No upstream CSV is bundled or downloaded: no license has been verified.
Does not determine whether a named token is fraudulent or safe.
Does not grant wallet, order, capital, model-promotion, or network authority.
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re

SOURCE_REPOSITORY = "https://github.com/dianxiang-sun/rug_pull_dataset"
SOURCE_REVISION = "5a52a33ddb6c5d1a0c52146a633085412b66af7d"
PINNED_CSV_BLOB_SHA = "4c836cee762af5338ef335e85c747ceb34cf0737"
SOURCE_PATH = "rugpull_full_dataset_new.csv"
REQUIRED_COLUMNS = ("No.", "Chain", "address", "Losses", "Type", "Root Causes", "Sources", "URL")
EVM_ADDRESS = re.compile(r"^0x[a-fA-F0-9]{40}$")
SUPPORTED_CHAINS = frozenset({"ETH", "BSC"})
MAX_CSV_BYTES = 15_000_000

# Defensive research hypotheses, NOT verified token-level evidence. No automatic scoring.
TYPE_TO_EVIDENCE_FAMILY = {
    "Transaction Limitation": "TRANSFER_OR_SELLABILITY",
    "Fee": "FEE_OR_TAX_CONTROL",
    "Token Generation": "SUPPLY_OR_MINT_CONTROL",
    "Destroy Token": "SUPPLY_OR_BURN_CONTROL",
    "Combination": "MULTIPLE_INDEPENDENT_CHECKS_REQUIRED",
    "Funds Manipulation": "BALANCE_OR_TRANSFER_CONTROL",
    "Token Distribution": "HOLDER_OR_OPERATOR_DISTRIBUTION",
    "External Call": "CONTRACT_CALL_OR_PROXY_CONTROL",
    "LP Drain": "LIQUIDITY_WITHDRAWAL",
    "Vulnerability": "CONTRACT_VULNERABILITY_REVIEW",
    "Fake LP Lock": "LIQUIDITY_LOCK_ATTESTATION",
    "Proxy": "UPGRADE_OR_PROXY_AUTHORITY",
    "Unverified contract": "SOURCE_CODE_VERIFICATION",
    "LP Manipulation": "LIQUIDITY_CONTROL",
}
MISSING = frozenset({"", "N/A", "NA", "NULL", "NONE", "UNKNOWN", "-"})


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(raw)).encode("ascii") + b"\0" + raw).hexdigest()


def _missing(value: str) -> bool:
    return value.strip().upper() in MISSING


def _loss_status(value: str) -> str:
    if _missing(value):
        return "MISSING"
    cleaned = value.strip().replace("$", "").replace(",", "")
    try:
        number = Decimal(cleaned)
    except InvalidOperation:
        return "INVALID"
    return "VALID" if number.is_finite() and number >= 0 else "INVALID"


def audit_corpus(raw: bytes, *, expected_blob_sha: str = PINNED_CSV_BLOB_SHA) -> dict:
    """Validate an explicitly supplied CSV and return aggregate-only research statistics."""
    if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_CSV_BYTES:
        raise ValueError("rug_dataset_invalid_bytes_or_size")
    sha = git_blob_sha(raw)
    if not re.fullmatch(r"[a-f0-9]{40}", expected_blob_sha) or sha != expected_blob_sha:
        raise ValueError("rug_dataset_unpinned_or_changed_source")
    try:
        stream = io.StringIO(raw.decode("utf-8-sig"), newline="")
    except UnicodeDecodeError as exc:
        raise ValueError("rug_dataset_invalid_utf8") from exc
    reader = csv.DictReader(stream, strict=True)
    if tuple(reader.fieldnames or ()) != REQUIRED_COLUMNS:
        raise ValueError("rug_dataset_schema_mismatch")

    chains, types, causes, sources, loss_stats = (Counter() for _ in range(5))
    missing_fields = Counter()
    invalid = Counter()
    identities = set()
    incident_ids = set()
    rows = 0
    for row in reader:
        rows += 1
        if None in row or any(value is None for value in row.values()):
            raise ValueError("rug_dataset_row_width_invalid")
        for key in REQUIRED_COLUMNS:
            if _missing(row[key]):
                missing_fields[key] += 1
        chain, address, case_id = row["Chain"].strip(), row["address"].strip(), row["No."].strip()
        chains[chain] += 1
        types[row["Type"].strip()] += 1
        causes[row["Root Causes"].strip()] += 1
        sources[row["Sources"].strip()] += 1
        loss_stats[_loss_status(row["Losses"])] += 1
        if chain not in SUPPORTED_CHAINS:
            invalid["chain"] += 1
        if not EVM_ADDRESS.fullmatch(address):
            invalid["address"] += 1
        identity = (chain, address.lower())
        if identity in identities:
            invalid["duplicate_chain_address"] += 1
        identities.add(identity)
        if not case_id.isdecimal() or case_id in incident_ids:
            invalid["id_or_duplicate"] += 1
        incident_ids.add(case_id)
        if row["Type"].strip() not in TYPE_TO_EVIDENCE_FAMILY:
            invalid["unmapped_type"] += 1
        if not row["URL"].strip().startswith(("https://", "http://")):
            invalid["source_url"] += 1

    if rows == 0:
        raise ValueError("rug_dataset_empty")
    warnings = [
        "POSITIVE_CASES_ONLY_NO_NEGATIVE_CONTROLS",
        "NO_ROW_LEVEL_PRE_INCIDENT_FEATURE_TIMESTAMPS",
        "SOLANA_OUT_OF_DOMAIN",
        "UPSTREAM_LICENSE_NOT_VERIFIED_NO_BUNDLING_OR_REDISTRIBUTION",
        "HISTORICAL_TAXONOMY_NOT_LIVE_PROOF",
    ]
    if invalid or missing_fields:
        warnings.append("ROW_QUALITY_GAPS_REQUIRE_REVIEW")
    if types.get("Transaction Limitation", 0) / rows > .80:
        warnings.append("TYPE_LABEL_CONCENTRATION_HIGH")
    if chains.get("ETH", 0) / rows > .90:
        warnings.append("ETHEREUM_CHAIN_CONCENTRATION_HIGH")
    return {
        "status": "RESEARCH_ONLY",
        "source": SOURCE_REPOSITORY,
        "sourceRevision": SOURCE_REVISION,
        "sourcePath": SOURCE_PATH,
        "sourceGitBlobSha": sha,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "records": rows,
        "distinctChainAddressPairs": len(identities),
        "chainCounts": dict(sorted(chains.items())),
        "typeCounts": dict(sorted(types.items())),
        "mappedEvidenceFamilies": dict(sorted(
            (label, TYPE_TO_EVIDENCE_FAMILY.get(label, "UNMAPPED")) for label in types
        )),
        "rootCauseCounts": dict(sorted(causes.items())),
        "sourceCounts": dict(sorted(sources.items())),
        "lossValueQuality": dict(sorted(loss_stats.items())),
        "missingFields": dict(sorted(missing_fields.items())),
        "invalid": dict(sorted(invalid.items())),
        "warnings": warnings,
        "canTrainCalibratedModel": False,
        "canCertifyTokenSafety": False,
        "canAuthorizeTrade": False,
    }


def _instant(value: object, field: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("rug_holdout_" + field + "_required")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("rug_holdout_" + field + "_invalid") from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("rug_holdout_" + field + "_timezone_required")
    return result


def evaluate_sealed_holdout(
    cases: list[dict], *, frozen_at: str, training_actor_groups: tuple[str, ...] = (),
    min_per_class: int = 10,
) -> dict:
    """Grade a separately supplied prospective labeled cohort, never train on the rug CSV.

    Predictive classifications must be frozen before the outcome. The outcome
    source must be independent from the predictor source, with actor holdout.
    Evaluation remains descriptive; it never promotes a model or a trade.
    """
    if not isinstance(cases, list) or not isinstance(min_per_class, int) or min_per_class < 1:
        raise ValueError("rug_holdout_invalid_arguments")
    frozen = _instant(frozen_at, "frozen_at")
    train_groups = set(training_actor_groups)
    if not all(isinstance(x, str) and x for x in train_groups):
        raise ValueError("rug_holdout_invalid_training_group")
    seen, chains = set(), set()
    confusion = Counter()
    outcome_sources = set()
    for row in cases:
        if not isinstance(row, dict):
            raise ValueError("rug_holdout_invalid_record")
        case_id, group = row.get("caseId"), row.get("actorGroup")
        chain, label = row.get("chain"), row.get("label")
        if not isinstance(case_id, str) or not case_id or case_id in seen:
            raise ValueError("rug_holdout_missing_or_duplicate_case_id")
        seen.add(case_id)
        if not isinstance(group, str) or not group or group in train_groups:
            raise ValueError("rug_holdout_actor_overlap_or_missing")
        if chain not in SUPPORTED_CHAINS | {"SOL"} or label not in {"RUG", "CONTROL"}:
            raise ValueError("rug_holdout_invalid_chain_or_label")
        if row.get("split") != "HOLDOUT" or type(row.get("predictedHighRisk")) is not bool:
            raise ValueError("rug_holdout_unsealed_prediction")
        evidence = _instant(row.get("featureAvailableAt"), "feature_available_at")
        decision = _instant(row.get("decisionAt"), "decision_at")
        outcome = _instant(row.get("outcomeAvailableAt"), "outcome_available_at")
        if not (frozen <= evidence <= decision < outcome):
            raise ValueError("rug_holdout_lookahead_or_unfrozen_rule")
        evidence_source, outcome_source = row.get("featureSource"), row.get("outcomeSource")
        if not all(isinstance(s, str) and s.strip() for s in (evidence_source, outcome_source)):
            raise ValueError("rug_holdout_missing_independent_provenance")
        if evidence_source.strip() == outcome_source.strip():
            raise ValueError("rug_holdout_source_not_independent")
        outcome_sources.add(outcome_source.strip())
        chains.add(chain)
        confusion[(label, row["predictedHighRisk"])] += 1
    if len(chains) > 1:
        raise ValueError("rug_holdout_mixed_chains_not_comparable")
    positive = confusion[("RUG", True)] + confusion[("RUG", False)]
    negative = confusion[("CONTROL", True)] + confusion[("CONTROL", False)]
    sufficient = positive >= min_per_class and negative >= min_per_class and len(outcome_sources) >= 2
    tpr = confusion[("RUG", True)] / positive if positive else None
    fpr = confusion[("CONTROL", True)] / negative if negative else None
    reasons = []
    if positive < min_per_class or negative < min_per_class:
        reasons.append("INSUFFICIENT_POSITIVE_AND_NEGATIVE_CONTROLS")
    if len(outcome_sources) < 2:
        reasons.append("INSUFFICIENT_INDEPENDENT_OUTCOME_SOURCES")
    if "SOL" in chains:
        reasons.append("UPSTREAM_DATASET_DOES_NOT_COVER_SOLANA")
    return {
        "status": "DESCRIPTIVE_HOLDOUT_ONLY" if sufficient else "UNSCORED",
        "chain": next(iter(chains), None),
        "cases": len(cases), "positives": positive, "controls": negative,
        "truePositiveRate": round(tpr, 5) if tpr is not None and sufficient else None,
        "falsePositiveRate": round(fpr, 5) if fpr is not None and sufficient else None,
        "balancedAccuracy": round((tpr + (1 - fpr)) / 2, 5) if sufficient else None,
        "outcomeSourceCount": len(outcome_sources),
        "reasons": reasons, "calibration": "UNVERIFIED",
        "canTrainCalibratedModel": False, "canCertifyTokenSafety": False,
        "canAuthorizeTrade": False, "canAuthorizeExit": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Local, keyless rug corpus audit / holdout evaluation")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--corpus", type=Path, help="Locally supplied pinned upstream CSV")
    group.add_argument("--holdout", type=Path, help="Independently prepared sealed holdout JSON")
    args = parser.parse_args()
    if args.corpus is not None:
        result = audit_corpus(args.corpus.read_bytes())
    else:
        payload = json.loads(args.holdout.read_text(encoding="utf-8"))
        result = evaluate_sealed_holdout(
            payload["cases"], frozen_at=payload["frozenAt"],
            training_actor_groups=tuple(payload.get("trainingActorGroups", []))
        )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
