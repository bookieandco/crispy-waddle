"""SHARK-RUG-DATA.07–.10: Solana-native offline proofs and sealed Shadow replay.

Source-only review of existing Jhadina Solana mint/pool probe outputs.
No network requests, keys, wallet signing, money controls, DB writes, trading,
automatic rule promotion, token safety certification, or confirmed-rug oracle.
All timestamps and source claims require independent external attestation.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).parent
def _load(name):
    spec = importlib.util.spec_from_file_location("rug_native_" + name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

study = _load("rug_dataset_research")
mint_probe = _load("solana_risk_probe")
pool_probe = _load("pool_vault_probe")

SCHEMA = "SHARK-RUG-SOL-NATIVE-07-10-V1"
SHA = re.compile(r"^[0-9a-f]{64}$")
MAX_CASES = 5000
MIN_CONTROL_SECONDS = 86400


def _fail(code):
    raise ValueError("shark_rug_native_" + code)


def _utc(value, name):
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)", value
    ):
        _fail(name + "_invalid")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        _fail(name + "_invalid")
    if result.utcoffset() is None:
        _fail(name + "_invalid")
    return result.astimezone(timezone.utc)


def _id(value, field):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 160:
        _fail(field + "_invalid")
    return value


def _hash(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
                   allow_nan=False).encode("utf-8")
    ).hexdigest()


def _verify_digest(value, field):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        _fail(field + "_invalid")
    return value


def _pubkey(value, field):
    if not isinstance(value, str) or not mint_probe.MINT_PATTERN.fullmatch(value):
        _fail(field + "_invalid")
    # Exact base58 decode length; format regex alone admits impossible public keys.
    base58 = pool_probe.B58
    n = 0
    for c in value:
        n = n * 58 + base58.index(c)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    raw = b"\0" * (len(value) - len(value.lstrip("1"))) + raw
    if len(raw) != 32:
        _fail(field + "_invalid")
    return value


def _false_authority(record):
    if record.get("canTrade") is not False or record.get("canSign") is not False or record.get("canBroadcast") is not False:
        _fail("execution_authority_not_false")
    if record.get("rugVerdict") != "UNDETERMINED":
        _fail("unproven_rug_claim")


def assess_solana_evidence(*, mint, information_cutoff, mint_proof=None, pool_proof=None):
    """Validate normalized receipts from canonical probe modules; never attest RPC truth."""
    _pubkey(mint, "mint")
    cutoff = _utc(information_cutoff, "cutoff")
    reasons, ids = [], []
    coverage = {"mintMetadata": False, "poolVaultMapping": False,
                "sellability": False, "lpControl": False, "holderIndependence": False,
                "operatorIdentity": False}
    if mint_proof is None:
        reasons.append("MINT_EVIDENCE_MISSING")
    else:
        if not isinstance(mint_proof, dict) or mint_proof.get("mint") != mint or (
            mint_proof.get("source") != "solana_public_mainnet_rpc" or
            mint_proof.get("status") != "ONCHAIN_PARTIAL_UNVERIFIED"
        ):
            _fail("mint_provenance_or_identity_invalid")
        _false_authority(mint_proof)
        if mint_proof.get("tokenProgram") not in mint_probe.TOKEN_PROGRAMS:
            _fail("mint_token_program_invalid")
        slot = mint_proof.get("slot")
        if type(slot) is not int or slot <= 0:
            _fail("mint_slot_invalid")
        a = _utc(mint_proof.get("observedAt"), "mint_observed")
        b = _utc(mint_proof.get("availableAt"), "mint_available")
        if not a <= b <= cutoff:
            _fail("mint_lookahead")
        if not {"sellability", "liquidityControl", "holderIndependence",
                "operatorIdentity"}.issubset(mint_proof.get("unverified") or []):
            _fail("mint_missing_uncertainty")
        for flag in ("mintAuthorityActive", "freezeAuthorityActive"):
            if type(mint_proof.get(flag)) is not bool:
                _fail("mint_authority_shape_invalid")
        coverage["mintMetadata"] = True
        if mint_proof["freezeAuthorityActive"]:
            reasons.append("FREEZE_AUTHORITY_ACTIVE")
        if mint_proof["mintAuthorityActive"]:
            reasons.append("MINT_AUTHORITY_ACTIVE")
        if mint_proof.get("tokenProgram") == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb":
            reasons.append("TOKEN2022_EXTENSIONS_UNVERIFIED")
        # Do not treat top token accounts as wallet-independent holders.
        ids.append("mint-proof:" + _hash(mint_proof))

    if pool_proof is None:
        reasons.append("POOL_VAULT_EVIDENCE_MISSING")
    else:
        if not isinstance(pool_proof, dict) or pool_proof.get("mint") != mint or (
            pool_proof.get("source") != "solana_public_mainnet_rpc" or
            pool_proof.get("status") != "ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED"
        ):
            _fail("pool_provenance_or_identity_invalid")
        _false_authority(pool_proof)
        if pool_proof.get("isRugConfirmed") is not False:
            _fail("pool_unproven_rug_claim")
        _pubkey(pool_proof.get("pool"), "pool")
        venue = pool_proof.get("dex")
        if venue not in pool_probe.PROGRAMS or pool_proof.get("poolProgram") != pool_probe.PROGRAMS[venue][0]:
            _fail("pool_program_invalid")
        slot = pool_proof.get("poolSlot")
        if type(slot) is not int or slot <= 0:
            _fail("pool_slot_invalid")
        if mint_proof is not None and slot < mint_proof["slot"]:
            _fail("stale_pool_slot")
        start = _utc(pool_proof.get("observedAt"), "pool_observed")
        available = _utc(pool_proof.get("availableAt"), "pool_available")
        if not start <= available <= cutoff:
            _fail("pool_lookahead")
        base, quote = pool_proof.get("baseVault"), pool_proof.get("quoteVault")
        if not isinstance(base, dict) or not isinstance(quote, dict):
            _fail("vault_receipt_missing")
        if base.get("mint") != mint or base.get("address") == quote.get("address"):
            _fail("pool_vault_identity_mismatch")
        for vault in (base, quote):
            _pubkey(vault.get("address"), "vault_address")
            _pubkey(vault.get("mint"), "vault_mint")
            _pubkey(vault.get("ownerAuthority"), "vault_authority")
            if vault.get("tokenProgram") not in mint_probe.TOKEN_PROGRAMS or (
                type(vault.get("slot")) is not int or vault["slot"] < slot or
                not isinstance(vault.get("atoms"), str) or not vault["atoms"].isdigit()
            ):
                _fail("vault_receipt_invalid")
        if quote["mint"] == mint or base["address"] == mint or quote["address"] == mint:
            _fail("pool_vault_identity_mismatch")
        c = pool_proof.get("coverage")
        if not isinstance(c, dict) or any(c.get(k) is not True for k in (
            "poolProgramOwner", "poolMintMapping", "tokenVaultMintMapping", "vaultRawBalances"
        )) or any(c.get(k) is not False for k in (
            "liquidityControl", "lpTokenOwnership", "sellability", "holderIndependence", "operatorIdentity"
        )):
            _fail("pool_overstated_coverage")
        coverage["poolVaultMapping"] = True
        ids.append("pool-proof:" + _hash(pool_proof))

    status = "RESEARCH_WATCH" if coverage["mintMetadata"] and coverage["poolVaultMapping"] else "ABSTAIN"
    if "FREEZE_AUTHORITY_ACTIVE" in reasons or "MINT_AUTHORITY_ACTIVE" in reasons:
        status = "REVIEW_HIGH_RISK"
    if status == "RESEARCH_WATCH":
        reasons.append("NO_FLAG_IS_NOT_SAFETY_CERTIFICATION")
    return {
        "schema": SCHEMA, "mint": mint, "informationCutoff": information_cutoff,
        "status": status, "coverage": coverage, "reasons": sorted(set(reasons)),
        "evidenceIds": sorted(ids), "sourceIntegrity": "SELF_REPORTED_RPC_RECEIPTS_NOT_INDEPENDENTLY_ATTESTED",
        "sellabilityCertified": False, "lpControlCertified": False, "rugConfirmed": False,
        "canTrainCalibratedModel": False, "canTrade": False, "canSign": False, "canBroadcast": False,
        "authority": "RESEARCH_ONLY",
    }


def seal_control_cohort(plan, *, training_actor_groups=()):
    """Prespecify ALL eligible mints, strata and horizon before new decisions."""
    if not isinstance(plan, dict) or set(plan) != {
        "schema", "cohortId", "sealedAt", "sourceHeadDigest", "samplingPolicy",
        "minimumControlHorizonSeconds", "cases", "authority", "canTrade",
        "canSign", "canBroadcast", "externalSealWitnessed"
    } or plan["schema"] != SCHEMA:
        _fail("cohort_schema_invalid")
    if (plan["samplingPolicy"] != "PROSPECTIVE_ALL_ELIGIBLE" or
        plan["authority"] != "RESEARCH_ONLY" or
        plan["externalSealWitnessed"] is not False or
        any(plan[k] is not False for k in ("canTrade", "canSign", "canBroadcast"))):
        _fail("cohort_authority_or_sampling_invalid")
    _id(plan["cohortId"], "cohort_id")
    _verify_digest(plan["sourceHeadDigest"], "source_head")
    sealed = _utc(plan["sealedAt"], "sealed_at")
    horizon = plan["minimumControlHorizonSeconds"]
    if type(horizon) is not int or horizon < MIN_CONTROL_SECONDS:
        _fail("cohort_horizon_too_short")
    cases = plan["cases"]
    if not isinstance(cases, list) or not 1 <= len(cases) <= MAX_CASES:
        _fail("cohort_size_invalid")
    if not all(isinstance(g, str) and g.strip() for g in training_actor_groups):
        _fail("cohort_training_groups_invalid")
    training = set(training_actor_groups)
    seen_mints, seen_cases, seen_groups = set(), set(), set()
    for case in cases:
        if not isinstance(case, dict) or set(case) != {
            "caseId", "mint", "actorGroup", "discoveryEvidenceId", "discoveryAvailableAt", "venueStratum"
        }:
            _fail("case_shape_invalid")
        cid, group, mint = _id(case["caseId"], "case_id"), _id(case["actorGroup"], "actor_group"), _pubkey(case["mint"], "mint")
        _id(case["discoveryEvidenceId"], "discovery_evidence")
        if cid in seen_cases or mint in seen_mints or group in seen_groups or group in training:
            _fail("duplicate_or_leaked_actor_group")
        if _utc(case["discoveryAvailableAt"], "discovery_time") > sealed:
            _fail("cohort_future_discovery")
        if case["venueStratum"] not in ("PUMPSWAP", "RAYDIUM_AMM_V4", "UNKNOWN"):
            _fail("case_stratum_invalid")
        seen_cases.add(cid); seen_mints.add(mint); seen_groups.add(group)
    out = {**plan, "status": "SOURCE_ONLY_SEAL_UNWITNESSED",
           "canPromoteModel": False, "canCertifySafety": False}
    return {**out, "sealDigest": _hash(out)}


def _sealed(seal):
    if not isinstance(seal, dict) or seal.get("status") != "SOURCE_ONLY_SEAL_UNWITNESSED" or (
        seal.get("sealDigest") != _hash({k:v for k,v in seal.items() if k != "sealDigest"})
    ):
        _fail("seal_tampered")
    # Re-check original structure, including authority, on every replay.
    base = {k:v for k,v in seal.items() if k not in ("status", "canPromoteModel", "canCertifySafety", "sealDigest")}
    expected = seal_control_cohort(base)
    if expected != seal:
        _fail("seal_not_canonical")
    return {c["caseId"]: c for c in seal["cases"]}


def freeze_shadow_decisions(seal, decisions):
    """Immutable decision-time classification; no retrospective case additions."""
    cases = _sealed(seal)
    if not isinstance(decisions, list) or len(decisions) != len(cases):
        _fail("decisions_must_cover_prespecified_cohort")
    seen = set()
    frozen = []
    for item in decisions:
        if not isinstance(item, dict) or set(item) != {"caseId", "decisionAt", "mintProof", "poolProof"}:
            _fail("decision_shape_invalid")
        cid = item["caseId"]
        if cid not in cases or cid in seen:
            _fail("decision_unknown_duplicate")
        seen.add(cid)
        at = _utc(item["decisionAt"], "decision_at")
        if at <= _utc(seal["sealedAt"], "sealed_at"):
            _fail("decision_before_cohort_seal")
        risk = assess_solana_evidence(mint=cases[cid]["mint"], information_cutoff=item["decisionAt"],
                                      mint_proof=item["mintProof"], pool_proof=item["poolProof"])
        source_times = [
            _utc(proof["availableAt"], "feature_available")
            for proof in (item["mintProof"], item["poolProof"]) if proof is not None
        ]
        if source_times and min(source_times) < _utc(seal["sealedAt"], "sealed_at"):
            _fail("preseal_features_not_prospective")
        feature_available = max(source_times) if source_times else at
        frozen.append({
            "caseId": cid, "mint": cases[cid]["mint"], "actorGroup": cases[cid]["actorGroup"],
            "decisionAt": item["decisionAt"],
            "featureAvailableAt": feature_available.isoformat().replace("+00:00","Z"),
            "featureSource": "solana-read-only-rpc", "classification": risk["status"],
            "riskEvidenceDigest": _hash(risk), "informationCutoff": item["decisionAt"],
            "canTrade": False, "canSign": False, "canBroadcast": False
        })
    frozen.sort(key=lambda c: c["caseId"])
    out = {
        "schema": SCHEMA, "sealDigest": seal["sealDigest"], "records": frozen,
        "authority": "SHADOW_LEARNING_ONLY", "canTrade": False, "canSign": False,
        "canBroadcast": False, "canPromoteModel": False, "actualFills": 0,
        "independentSealWitnessed": False,
    }
    return {**out, "decisionDigest": _hash(out)}


def _frozen(seal, frozen):
    cases = _sealed(seal)
    if not isinstance(frozen, dict) or frozen.get("sealDigest") != seal["sealDigest"] or (
        frozen.get("decisionDigest") != _hash({k:v for k,v in frozen.items() if k != "decisionDigest"})
    ):
        _fail("decision_digest_invalid")
    if (frozen.get("schema") != SCHEMA or frozen.get("authority") != "SHADOW_LEARNING_ONLY" or
        frozen.get("independentSealWitnessed") is not False or frozen.get("actualFills") != 0 or
        any(frozen.get(k) is not False for k in ("canTrade","canSign","canBroadcast","canPromoteModel"))):
        _fail("shadow_execution_authority_invalid")
    rows = frozen.get("records")
    if not isinstance(rows, list) or len(rows) != len(cases) or (
        [c["caseId"] for c in rows] != sorted(cases)
    ):
        _fail("shadow_case_set_changed")
    for row in rows:
        if row["mint"] != cases[row["caseId"]]["mint"] or row["actorGroup"] != cases[row["caseId"]]["actorGroup"]:
            _fail("shadow_identity_changed")
        if row["classification"] not in ("ABSTAIN", "RESEARCH_WATCH", "REVIEW_HIGH_RISK"):
            _fail("shadow_unrecognized_classification")
        if any(row.get(k) is not False for k in ("canTrade","canSign","canBroadcast")):
            _fail("shadow_execution_authority_invalid")
        _verify_digest(row["riskEvidenceDigest"], "risk_digest")
        if row["featureSource"] != "solana-read-only-rpc" or row["informationCutoff"] != row["decisionAt"] or row["featureAvailableAt"] != row["decisionAt"] or (
            _utc(row["decisionAt"], "decision_at") <= _utc(seal["sealedAt"], "sealed_at")
        ):
            _fail("shadow_information_cutoff_changed")
    return {c["caseId"]:c for c in rows}


def grade_shadow_replay(seal, frozen, outcomes, as_of, *, min_per_class=10):
    """Only future independently sourced outcome claims; never certify a rug/safe mint."""
    decisions = _frozen(seal, frozen)
    now = _utc(as_of, "as_of")
    if now <= _utc(seal["sealedAt"], "seal_time"):
        _fail("as_of_before_seal")
    if not isinstance(outcomes, list) or len(outcomes) > len(decisions):
        _fail("outcomes_invalid")
    by_id = {}
    for obs in outcomes:
        if not isinstance(obs, dict) or set(obs) != {
            "caseId","outcomeKind","observedAt","availableAt","sourceFamilies",
            "outcomeEvidenceIds","monitoringComplete","windowStartAt","windowEndAt"
        }:
            _fail("outcome_shape_invalid")
        cid = obs["caseId"]
        if cid not in decisions or cid in by_id:
            _fail("unsealed_or_duplicate_outcome")
        by_id[cid] = obs
    holdout, censored, abstained, reason_codes = [], 0, 0, set()
    for cid, decision in sorted(decisions.items()):
        if decision["classification"] == "ABSTAIN":
            abstained += 1
        obs = by_id.get(cid)
        if obs is None:
            censored += 1
            continue
        if obs["outcomeKind"] not in ("REPORTED_LP_WITHDRAWAL", "MONITORED_NO_REPORTED_RUG", "UNKNOWN"):
            _fail("outcome_kind_invalid")
        when = _utc(obs["availableAt"], "outcome_available")
        observed = _utc(obs["observedAt"], "outcome_observed")
        decided = _utc(decision["decisionAt"], "decision_at")
        if not decided < observed <= when:
            _fail("outcome_lookahead_or_retroactive")
        if when > now:
            censored += 1
            continue
        if obs["outcomeKind"] == "UNKNOWN":
            censored += 1
            continue
        sources = obs["sourceFamilies"]
        ids = obs["outcomeEvidenceIds"]
        if (not isinstance(sources,list) or len(sources)<2 or
            any(not isinstance(s,str) or not s.strip() for s in sources) or
            len(set(sources)) != len(sources) or "solana-read-only-rpc" in sources or
            not isinstance(ids,list) or len(ids)<2 or
            any(not isinstance(x,str) or not x.strip() for x in ids) or len(set(ids))!=len(ids)):
            _fail("independent_outcome_provenance_insufficient")
        label = "RUG" if obs["outcomeKind"] == "REPORTED_LP_WITHDRAWAL" else "CONTROL"
        if label == "CONTROL":
            if obs["monitoringComplete"] is not True or (
                obs["windowStartAt"] != decision["decisionAt"]
            ):
                _fail("unverified_control_window")
            end = _utc(obs["windowEndAt"], "window_end")
            if (end - decided).total_seconds() < seal["minimumControlHorizonSeconds"] or end > observed:
                _fail("unverified_control_window")
        else:
            if obs["monitoringComplete"] not in (True, False) or obs["windowStartAt"] is not None or obs["windowEndAt"] is not None:
                _fail("rug_event_not_separate_from_control_window")
        if decision["classification"] == "ABSTAIN":
            continue
        # Reuse the canonical .05 scorer, which rejects chronology, group
        # leakage, one-class cohorts, and source-family identity collisions.
        holdout.append({
            "caseId": cid, "actorGroup": decision["actorGroup"], "chain": "SOL",
            "label": label, "split": "HOLDOUT",
            "predictedHighRisk": decision["classification"] == "REVIEW_HIGH_RISK",
            "featureAvailableAt": decision["featureAvailableAt"], "decisionAt": decision["decisionAt"],
            "outcomeAvailableAt": obs["availableAt"], "featureSource": decision["featureSource"],
            "outcomeSource": sources[0],
        })
    result = study.evaluate_sealed_holdout(
        holdout, frozen_at=seal["sealedAt"], min_per_class=min_per_class
    )
    if abstained or censored:
        reason_codes.add("ABSTENTIONS_OR_MISSING_OUTCOMES_NOT_RANDOMLY_EXCLUDED")
    if abstained or censored or result["status"] != "DESCRIPTIVE_HOLDOUT_ONLY":
        score = None
        verdict = "UNSCORED_INCOMPLETE"
    else:
        score = {
            "balancedAccuracy": result["balancedAccuracy"],
            "truePositiveRate": result["truePositiveRate"],
            "falsePositiveRate": result["falsePositiveRate"],
        }
        verdict = "DESCRIPTIVE_REPORTED_OUTCOMES_ONLY"
    reason_codes.update(result["reasons"])
    reason_codes.add("UNWITNESSED_SOURCE_CLAIMS_NOT_CONFIRMED_RUGS_OR_SAFE_TOKENS")
    return {
        "schema": SCHEMA, "verdict": verdict, "cohortId": seal["cohortId"],
        "sealDigest": seal["sealDigest"], "decisionDigest": frozen["decisionDigest"],
        "asOf": as_of, "prespecifiedCases": len(decisions), "outcomesAvailable": len(holdout),
        "abstentions": abstained, "censoredOrPending": censored,
        "shadowScore": score, "reasons": sorted(reason_codes),
        "calibration": "UNVERIFIED", "rugConfirmedCount": None,
        "sourceAttestationVerified": False, "independentSealWitnessed": False,
        "actualFills": 0, "realizedPnl": None, "isExecutablePnL": False,
        "canTrade": False, "canSign": False, "canBroadcast": False,
        "canAuthorizeExit": False, "canPromoteModel": False,
        "authority": "SHADOW_LEARNING_ONLY",
    }
