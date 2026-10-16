"""SHARK-RUG-DATA.17–.18 — honest Solana outcome review and prospective universe.

On-chain candidate observations, source-supplied labels and monitored windows
are never certified fraud/nonfraud, never money or model-training authority.
Only existing SHARK hash-chained market events are eligible to seed cohorts.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from datetime import timedelta

HERE=Path(__file__).parent
def _load(name):
    spec=importlib.util.spec_from_file_location("rug_outcome_"+name,HERE/(name+".py"))
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj

native=_load("rug_native_shadow")
observer=_load("experiment_7day")
liquidity=_load("rug_liquidity_exit_research")
SCHEMA="SHARK-RUG-OUTCOMES-17-18-V1"
MAX_CASES=native.MAX_CASES
MAX_REPORTS=MAX_CASES*3

def _err(label):raise ValueError("rug_outcome_"+label)

def _time(raw,name):return native._utc(raw,name)
def _sha(record):return native._hash(record)

def _false(record,keys=("canTrade","canSign","canBroadcast","canAuthorizeLive")):
    if not isinstance(record,dict) or any(record.get(k) is not False for k in keys):
        _err("unauthorized_execution_claim")

def seal_prospective_universe(state,*,sealed_at,cohort_id,actor_groups,
                              train_groups=(),minimum_horizon_seconds=86400):
    """Register every discovered mint in an audited, pre-result SHARK ledger.

    Owner-supplied actor_group IDs are UNWITNESSED grouping hypotheses and
    must not be mistaken for actual wallet-cluster independence.
    """
    observer.audit(state)
    stop=_time(sealed_at,"sealed_at")
    if not isinstance(actor_groups,dict):
        _err("actor_groups_required")
    discoveries={}
    for evt in state["events"]:
        if _time(evt["availableAt"],"event_time")>stop:
            _err("ledger_contains_future_events")
        if evt["type"]!="MARKET_OBSERVATION":
            continue
        if evt.get("securityStatus")!="UNVERIFIED" or evt.get("canTrade") is not False:
            _err("market_claims_safety_or_trade")
        mint=native._pubkey(evt.get("mint"),"mint")
        pair=native._pubkey(evt.get("pair"),"pool")
        if mint==pair:_err("mint_pair_alias")
        if mint not in discoveries:
            discoveries[mint]={"pair":pair,"event":evt}
    if not discoveries or len(discoveries)>MAX_CASES:
        _err("no_supported_universe_or_limit_exceeded")
    if set(actor_groups)!=set(discoveries):
        _err("universe_membership_or_actor_group_missing")
    by_case={}
    for mint,{ "pair":pair,"event":evt } in sorted(discoveries.items()):
        case_id="case-"+_sha({"mint":mint,"eventDigest":evt["digest"]})[:24]
        group=actor_groups[mint]
        if not isinstance(group,str) or not group.strip():
            _err("actor_group_invalid")
        by_case[case_id]={
            "caseId":case_id,"mint":mint,"pool":pair,
            "actorGroup":group,"discoveryEvidenceDigest":evt["digest"],
            "discoveryAvailableAt":evt["availableAt"]
        }
    if type(minimum_horizon_seconds) is not int or minimum_horizon_seconds<86400:
        _err("control_monitoring_horizon_too_short")
    native_plan={
        "schema":native.SCHEMA,"cohortId":cohort_id,"sealedAt":sealed_at,
        "sourceHeadDigest":state["lastDigest"],
        "samplingPolicy":"PROSPECTIVE_ALL_ELIGIBLE",
        "minimumControlHorizonSeconds":minimum_horizon_seconds,
        "cases":[{
            "caseId":v["caseId"],"mint":v["mint"],"actorGroup":v["actorGroup"],
            "discoveryEvidenceId":v["discoveryEvidenceDigest"],
            "discoveryAvailableAt":v["discoveryAvailableAt"],
            "venueStratum":"UNKNOWN"
        } for v in by_case.values()],
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"externalSealWitnessed":False
    }
    sealed=native.seal_control_cohort(native_plan,training_actor_groups=tuple(train_groups))
    output={
        "schema":SCHEMA,"cohortId":cohort_id,"sealedAt":sealed_at,
        "canonicalSeal":sealed,"caseRegistry":list(by_case.values()),
        "sourceHeadDigest":state["lastDigest"],"eligiblePopulationCount":len(by_case),
        "eligibleCasesExcluded":0,"samplingMethod":"ALL_DISCOVERED_PRIOR_TO_SEAL",
        "externalSealWitnessed":False,"actorGroupIndependenceVerified":False,
        "labelsVerified":False,"canTrainCalibratedModel":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False
    }
    return {**output,"receiptDigest":_sha(output)}

def _sealed(universe):
    if not isinstance(universe,dict) or universe.get("schema")!=SCHEMA or (
        universe.get("receiptDigest")!=_sha({k:v for k,v in universe.items() if k!="receiptDigest"})
    ):
        _err("cohort_seal_tampered")
    _false(universe)
    if (universe.get("authority")!="RESEARCH_ONLY" or universe.get("eligibleCasesExcluded")!=0
        or universe.get("externalSealWitnessed") is not False or
        universe.get("actorGroupIndependenceVerified") is not False or
        universe.get("labelsVerified") is not False or
        universe.get("canTrainCalibratedModel") is not False):
        _err("cohort_authority_escalated")
    sealed=universe.get("canonicalSeal")
    if not isinstance(sealed,dict):
        _err("canonical_seal_missing")
    rows=native._sealed(sealed)
    registry=universe.get("caseRegistry")
    if not isinstance(registry,list) or len(registry)!=len(rows) or (
        universe.get("eligiblePopulationCount")!=len(rows)
    ):
        _err("case_set_changed")
    by_id={}
    for row in registry:
        if not isinstance(row,dict) or set(row)!={
            "caseId","mint","pool","actorGroup","discoveryEvidenceDigest","discoveryAvailableAt"
        }:
            _err("case_registry_shape")
        cid=row["caseId"]
        if cid not in rows or cid in by_id or (
            row["mint"]!=rows[cid]["mint"] or row["actorGroup"]!=rows[cid]["actorGroup"]
            or row["discoveryEvidenceDigest"]!=rows[cid]["discoveryEvidenceId"]
            or row["discoveryAvailableAt"]!=rows[cid]["discoveryAvailableAt"]
        ):
            _err("case_registry_not_bound")
        native._pubkey(row["pool"],"pool")
        if row["pool"]==row["mint"]:
            _err("case_pair_invalid")
        by_id[cid]=row
    if set(by_id)!=set(rows):
        _err("case_set_changed")
    return by_id

def _validate_report(row,universe,asof,case):
    if not isinstance(row,dict) or set(row)!={
        "caseId","kind","observedAt","availableAt","sourceFamilies",
        "sourceEvidenceDigests","monitoringFrom","monitoringThrough",
        "liquidityReceipt","externalWitnessVerified"
    }:
        _err("report_shape_invalid")
    if row["externalWitnessVerified"] is not False:
        _err("externally_verified_label_without_proof")
    t=_time(row["observedAt"],"outcome_observed")
    available=_time(row["availableAt"],"outcome_available")
    sealed=_time(universe["sealedAt"],"sealed")
    if not sealed<t<=available<=asof:
        _err("lookahead_or_preseal_outcome")
    kind=row["kind"]
    if kind not in ("DUAL_VAULT_DECLINE_REPORTED","MONITORED_NO_INCIDENT_REPORTED","UNKNOWN"):
        _err("invalid_report_kind")
    families=row["sourceFamilies"]
    digests=row["sourceEvidenceDigests"]
    if not isinstance(families,list) or not isinstance(digests,list) or len(families)!=len(digests) or len(families)>6:
        _err("report_evidence_shape")
    if (len(set(families))!=len(families) or
        any(not isinstance(s,str) or not s.strip() or len(s)>80 for s in families) or
        any(not isinstance(d,str) or not native.SHA.fullmatch(d) for d in digests)):
        _err("report_provenance_invalid")
    if kind!="UNKNOWN" and len(families)<2:
        _err("reported_outcome_needs_two_source_families")
    if kind=="UNKNOWN":
        if row["liquidityReceipt"] is not None:
            _err("unknown_must_not_claim_drain")
        return "CENSORED_UNKNOWN"
    if kind=="DUAL_VAULT_DECLINE_REPORTED":
        receipt=row["liquidityReceipt"]
        if (not isinstance(receipt,dict) or
            receipt.get("receiptDigest")!=liquidity._sha({k:v for k,v in receipt.items() if k!="receiptDigest"}) or
            receipt.get("schema")!=liquidity.SCHEMA or
            receipt.get("status") not in ("TWO_VAULT_DECLINES_NO_TX","TWO_VAULT_DECLINES_TX_PATTERN_UNVERIFIED") or
            receipt.get("mint")!=case["mint"] or receipt.get("pool")!=case["pool"] or
            receipt.get("rugConfirmed") is not False or
            receipt.get("withdrawalCauseProven") is not False or
            _time(receipt.get("asOf"),"liquidity_time")>available):
            _err("liquidity_report_not_bound_or_overstated")
        _false(receipt)
        if row["monitoringFrom"] is not None or row["monitoringThrough"] is not None:
            _err("drain_report_has_control_window")
        return "REPORTED_RESERVE_DECLINE_NOT_CONFIRMED_RUG"
    if row["liquidityReceipt"] is not None:
        _err("control_has_drain_claim")
    start=_time(row["monitoringFrom"],"monitoring_from")
    end=_time(row["monitoringThrough"],"monitoring_through")
    if (start!=sealed or end>t or
        (end-start).total_seconds()<universe["canonicalSeal"]["minimumControlHorizonSeconds"]):
        _err("control_observation_window_incomplete")
    return "MONITORED_WINDOW_NO_INCIDENT_REPORTED_NOT_SAFE"

def adjudicate_reports(universe,reports,*,as_of):
    """Censored and disputed sources remain unknown; no certified labels."""
    cases=_sealed(universe)
    now=_time(as_of,"asof")
    if now<_time(universe["sealedAt"],"sealed"):
        _err("asof_before_seal")
    if not isinstance(reports,list) or len(reports)>MAX_REPORTS:
        _err("reports_invalid")
    events={}
    for item in reports:
        if not isinstance(item,dict) or item.get("caseId") not in cases:
            _err("unknown_case")
        cid=item["caseId"]
        if len(events.get(cid,[]))>=3:_err("too_many_repeated_case_reports")
        status=_validate_report(item,universe,now,cases[cid])
        events.setdefault(cid,[]).append({"status":status,"reportDigest":_sha(item)})
    output_rows=[]
    for cid,case in sorted(cases.items()):
        marks=events.get(cid,[])
        statuses={x["status"] for x in marks}
        if not marks:
            state="PENDING_NO_REPORT"
        elif len(statuses)>1:
            state="CONFLICTED_SOURCES_UNKNOWN"
        else:
            state=next(iter(statuses))
        output_rows.append({
            "caseId":cid,"mint":case["mint"],"actorGroup":case["actorGroup"],
            "caseEvidenceDigest":case["discoveryEvidenceDigest"],
            "disposition":state,"reportDigests":sorted(x["reportDigest"] for x in marks),
            "verifiedLabel":None,
            "canTrain":False
        })
    statuses={}
    for row in output_rows:statuses[row["disposition"]]=statuses.get(row["disposition"],0)+1
    result={
        "schema":SCHEMA,"status":"SOURCE_ONLY_OUTCOME_REVIEW_UNATTESTED",
        "cohortId":universe["cohortId"],"cohortReceiptDigest":universe["receiptDigest"],
        "asOf":as_of,"totalPrespecifiedCases":len(cases),
        "outcomeReviewCounts":dict(sorted(statuses.items())),
        "cases":output_rows,"externalOutcomesIndependentlyVerified":False,
        "noIncidentMeansSafe":False,"canExportCertifiedLabels":False,
        "canTrainCalibratedModel":False,"canPromoteModel":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False
    }
    return {**result,"receiptDigest":_sha(result)}
