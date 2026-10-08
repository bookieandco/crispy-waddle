#!/usr/bin/env python3
"""Read-only, fail-closed offline evidence verification for SWLC → Money commissioning.

This never opens a broker, changes Supabase, executes SQL, or grants certification.
Source/restore identity and provider entitlements must still be independently audited.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = "jhadina.swlc-money-commission-evidence.v1"
PROJECT_REF = "kqbkaozfjubkjevdfvic"
HORIZONS = ("15m", "1h", "4h", "24h", "3d", "7d")
SUPABASE_STAGES = {
    "SUPABASE-DB.2": ("sql_readable", "not_in_recovery", "capacity_headroom",
                       "wal_inspected", "relations_inspected", "replication_inspected"),
    "SUPABASE-MIGRATIONS.3": ("history_read", "version_drift_reconciled",
                               "rls_grants_reviewed", "rollback_reviewed"),
    "SUPABASE-AUTH/API.4": ("auth_read", "postgrest_read", "rls_negative_test"),
    "SUPABASE-EDGE.5": ("memory", "director", "sam", "overage", "audit_ingest"),
    "SUPABASE-OIDC.6": ("vercel_oidc", "github_oidc", "unauthorized_401_403"),
    "SUPABASE-RUNTIME-CONFIG.7": ("retired_bindings_audited", "secrets_redacted"),
    "SUPABASE-STORAGE.8": ("bucket_metadata", "object_sample_readback"),
    "SUPABASE-CROSS-SYSTEM.9": ("memory", "director", "workstation", "sam",
                                 "overage", "spatial", "action_audit", "oce"),
}
SHA40 = re.compile(r"^[0-9a-f]{40}$", re.I)
SHA64 = re.compile(r"^[0-9a-f]{64}$", re.I)


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def stamp(raw: Any) -> datetime:
    if not isinstance(raw, str) or not raw:
        raise ValueError("timestamp missing")
    result = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timezone required")
    return result.astimezone(timezone.utc)


def data_file(root: Path, relative: str) -> Path:
    """No symlink or absolute-path escapes outside the operator's evidence root."""
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError("unsafe evidence path")
    parent = root.resolve()
    path = (parent / relative).resolve()
    if not path.is_relative_to(parent) or not path.is_file():
        raise ValueError("missing or escaped evidence file")
    return path


def read_json(root: Path, relative: str) -> dict[str, Any]:
    try:
        value = json.loads(data_file(root, relative).read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid evidence: {relative}") from exc
    if not isinstance(value, dict):
        raise ValueError("evidence must be an object")
    return value


def verify_receipt(payload: dict[str, Any], *, stage: str, head: str,
                   as_of: datetime, max_age_hours: int) -> list[str]:
    errors: list[str] = []
    if payload.get("stage") != stage or payload.get("projectRef") != PROJECT_REF:
        errors.append("WRONG_PROJECT_OR_STAGE")
    if payload.get("sourceType") != "AUTHORIZED_REMOTE_READ_ONLY":
        errors.append("SOURCE_NOT_AUTHORIZED_REMOTE_READ_ONLY")
    if payload.get("mainHeadSha") != head:
        errors.append("EXACT_HEAD_NOT_PROVEN")
    if payload.get("synthetic") is not False or payload.get("canExecute") is not False:
        errors.append("SYNTHETIC_OR_EXECUTING_EVIDENCE")
    if not isinstance(payload.get("operatorEvidenceId"), str) or not payload["operatorEvidenceId"].strip():
        errors.append("OPERATOR_RECEIPT_MISSING")
    try:
        observed = stamp(payload.get("observedAt"))
        if observed > as_of or (as_of-observed).total_seconds() > max_age_hours*3600:
            errors.append("STALE_OR_FUTURE_RECEIPT")
    except (TypeError, ValueError):
        errors.append("BAD_RECEIPT_TIMESTAMP")
    checks = payload.get("checks")
    if not isinstance(checks, dict):
        return errors+["CHECKS_MISSING"]
    for name in SUPABASE_STAGES[stage]:
        check = checks.get(name)
        if not isinstance(check, dict) or check.get("passed") is not True or not check.get("evidenceId"):
            errors.append(f"CHECK_FAILED:{name}")
    return errors


def verify_restoration(root: Path, payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if payload.get("origin") != "ORIGINAL_PERSISTENT" or payload.get("synthetic") is not False:
        errors.append("ORIGINAL_SHADOW_NOT_IDENTIFIED")
    if not payload.get("originalPodId") or not payload.get("originalVolumeId"):
        errors.append("ORIGINAL_SHADOW_VOLUME_UNKNOWN")
    if not payload.get("sourceOperatorId") or not payload.get("restorerOperatorId") or (
        payload.get("sourceOperatorId") == payload.get("restorerOperatorId")
    ):
        errors.append("INDEPENDENT_RESTORER_MISSING")
    files = payload.get("files")
    if not isinstance(files, dict):
        return errors+["RESTORE_FILES_MISSING"]
    keys = ("encryptedBackup", "independentDownloadedBackup", "originalLedger",
            "isolatedRestoredLedger")
    blobs: dict[str, bytes] = {}
    resolved_paths: dict[str, Path] = {}
    for key in keys:
        spec = files.get(key)
        if not isinstance(spec, dict) or not SHA64.fullmatch(str(spec.get("sha256", ""))):
            errors.append(f"FILE_HASH_EVIDENCE_MISSING:{key}")
            continue
        try:
            verified_path = data_file(root, spec["path"])
            resolved_paths[key] = verified_path
            blob = verified_path.read_bytes()
            if not blob or digest(blob) != spec["sha256"].lower():
                errors.append(f"ACTUAL_FILE_HASH_MISMATCH:{key}")
            else:
                blobs[key] = blob
        except (OSError, KeyError, TypeError, ValueError):
            errors.append(f"ACTUAL_FILE_UNAVAILABLE:{key}")
    for left, right in (
        ("encryptedBackup", "independentDownloadedBackup"),
        ("originalLedger", "isolatedRestoredLedger"),
    ):
        if left in resolved_paths and right in resolved_paths and (
            resolved_paths[left].samefile(resolved_paths[right])
        ):
            errors.append(f"SOURCE_AND_RESTORE_NOT_INDEPENDENT:{left}:{right}")
    if {"encryptedBackup", "independentDownloadedBackup"} <= blobs.keys():
        if blobs["encryptedBackup"] != blobs["independentDownloadedBackup"]:
            errors.append("OFFSITE_BACKUP_HASH_MISMATCH")
    for k in ("originalLedger", "isolatedRestoredLedger"):
        if k not in blobs:
            continue
        try:
            rows = json.loads(blobs[k])
            if not isinstance(rows, list) or not rows:
                raise ValueError("empty ledger")
            keys_seen: set[str] = set()
            for row in rows:
                if (not isinstance(row, dict) or not all(row.get(f) for f in (
                    "eventId", "payloadHash", "kind", "occurredAt"))):
                    raise ValueError("invalid source ledger")
                if row["eventId"] in keys_seen:
                    raise ValueError("duplicate ledger")
                keys_seen.add(row["eventId"])
            blobs[k] = json.dumps(sorted(rows, key=lambda x:x["eventId"]),
                                  separators=(",",":"),sort_keys=True).encode()
        except (ValueError, TypeError, KeyError):
            errors.append(f"LEDGER_PARSE_OR_IDENTITY_INVALID:{k}")
    if {"originalLedger", "isolatedRestoredLedger"} <= blobs.keys():
        if blobs["originalLedger"] != blobs["isolatedRestoredLedger"]:
            errors.append("SOURCE_RESTORED_LEDGER_NOT_IDENTICAL")
    # Matching files do not independently prove origin, encryption, or durability.
    if not payload.get("backupEncryptionEvidenceId") or not payload.get("independentDriveReadbackId"):
        errors.append("ENCRYPTION_OR_INDEPENDENT_READBACK_UNVERIFIED")
    return errors


def verify_feeds(payload: dict[str, Any], as_of: datetime) -> list[str]:
    errors: list[str] = []
    feeds = payload.get("providers")
    if not isinstance(feeds, list):
        return ["PROVIDERS_MISSING"]
    by_asset: dict[str, list[dict[str, Any]]] = {}
    for feed in feeds:
        if not isinstance(feed, dict):
            errors.append("PROVIDER_INVALID"); continue
        asset = str(feed.get("asset","")).upper()
        by_asset.setdefault(asset,[]).append(feed)
        if feed.get("sourceMode") != "LICENSED_READ_ONLY" or feed.get("synthetic") is not False or (
            not feed.get("entitlementEvidenceId") or not feed.get("sampleEvidenceId")):
            errors.append(f"FEED_LICENSE_OR_SOURCE_INVALID:{asset}")
        try:
            a,b,c = (stamp(feed.get(k)) for k in ("observedAt","availableAt","receivedAt"))
            if not a <= b <= c <= as_of:
                errors.append(f"FEED_LOOKAHEAD:{asset}")
        except (ValueError, TypeError):
            errors.append(f"FEED_TIMESTAMP_INVALID:{asset}")
        if asset in ("STOCK","FOREX","OPTIONS") and feed.get("twoSidedQuoteVerified") is not True:
            errors.append(f"TWO_SIDED_QUOTES_MISSING:{asset}")
        if asset == "METALS" and feed.get("priceKind") != "NON_EXECUTABLE_MIDPOINT":
            errors.append("METALS_REFERENCE_MISREPRESENTED")
        if asset == "OPTIONS" and (feed.get("adjustedContractEvidence") is not True or
                                   feed.get("expirySettlementVerified") is not True):
            errors.append("OPTIONS_CONTRACT_COVERAGE_MISSING")
    for asset in ("STOCK","FOREX","OPTIONS","METALS"):
        if not by_asset.get(asset):
            errors.append(f"PROVIDER_MISSING:{asset}")
    return errors


def verify_paper(root: Path, payload: dict[str, Any], as_of: datetime) -> list[str]:
    errors: list[str] = []
    if payload.get("synthetic") is not False or payload.get("liveOrdersDisabled") is not True:
        errors.append("PAPER_ONLY_BOUNDARY_UNVERIFIED")
    files = payload.get("files")
    if not isinstance(files, dict):
        return errors+["PAPER_FILES_MISSING"]
    spec = files.get("journal")
    if not isinstance(spec, dict) or not SHA64.fullmatch(str(spec.get("sha256",""))):
        return errors+["PAPER_JOURNAL_HASH_MISSING"]
    try:
        raw = data_file(root,spec["path"]).read_bytes()
        if digest(raw)!=spec["sha256"].lower() or not raw.endswith(b"\n"):
            errors.append("PAPER_JOURNAL_TAMPER_OR_TRUNCATION")
        lines = [json.loads(x) for x in raw.splitlines()]
        prior="GENESIS"
        ids=set()
        horizons=set()
        chain=[]
        for i,record in enumerate(lines):
            if (not isinstance(record,dict) or record.get("sequence")!=i+1 or
                record.get("previousHash")!=prior):
                errors.append("PAPER_JOURNAL_CHAIN_BROKEN");break
            h=record.get("eventHash")
            body={k:v for k,v in record.items() if k!="eventHash"}
            calculated=digest(json.dumps(body,separators=(",",":"),ensure_ascii=False).encode())
            if calculated != h:
                errors.append("PAPER_JOURNAL_HASH_CHAIN_INVALID");break
            grade=record.get("grade",{})
            identity=str(grade.get("predictionId"))+"|"+str(grade.get("horizon"))
            if identity in ids:
                errors.append("PAPER_DUPLICATE_GRADE")
            ids.add(identity)
            horizons.add(grade.get("horizon"))
            if grade.get("proof")!="FORWARD_PAPER_EVIDENCE_ONLY" or grade.get("canExecute") is not False:
                errors.append("PAPER_GRADE_AUTHORITY_INVALID")
            try:
                if stamp(grade.get("gradedAt")) > as_of:
                    errors.append("PAPER_GRADE_FROM_FUTURE")
            except (ValueError,TypeError):
                errors.append("PAPER_GRADE_TIME_INVALID")
            prior=h;chain.append(h)
        for h in HORIZONS:
            if h not in horizons:
                errors.append("PAPER_HORIZON_MISSING:"+h)
        cycles=payload.get("cycles",[])
        if not isinstance(cycles,list) or len(cycles)<3:
            errors.append("PAPER_THREE_CYCLES_MISSING")
        else:
            last_count=0;last_time=None;seen=set()
            for c in cycles:
                if not isinstance(c,dict):
                    errors.append("PAPER_CYCLE_INVALID");continue
                try:
                    at=stamp(c.get("completedAt"))
                    count=c.get("journalCount")
                    if (not isinstance(count,int) or count<=last_count or count>len(chain) or
                        c.get("journalTailHash")!=chain[count-1] or
                        c.get("cycleId") in seen or at>as_of or
                        (last_time is not None and at<=last_time)):
                        errors.append("PAPER_WATCHDOG_DIVERGED")
                    if c.get("realFeedOrigin")!="LICENSED_READ_ONLY" or c.get("independentReadback") is not True:
                        errors.append("PAPER_WATCHDOG_NOT_INDEPENDENT")
                    seen.add(c.get("cycleId"));last_count=count;last_time=at
                except (ValueError,TypeError,IndexError):
                    errors.append("PAPER_CYCLE_TIME_INVALID")
            if last_count!=len(chain):
                errors.append("PAPER_LAST_CYCLE_NOT_AT_JOURNAL_TAIL")
    except (OSError,KeyError,ValueError,TypeError):
        errors.append("PAPER_JOURNAL_FILE_OR_JSON_INVALID")
    if not payload.get("persistentHostEvidenceId") or not payload.get("rebootReadbackEvidenceId"):
        errors.append("PAPER_DURABLE_HOST_RESTART_UNVERIFIED")
    return errors


def evaluate(root: Path, head: str, as_of: datetime, max_age_hours: int=24) -> dict[str, Any]:
    if not SHA40.fullmatch(head):
        raise ValueError("expected main SHA-1 must be 40 hexadecimal characters")
    outcomes: dict[str, Any]={}
    previous_ok=True
    for stage in SUPABASE_STAGES:
        filename="supabase/"+stage+".json"
        try:
            errors=verify_receipt(read_json(root,filename),stage=stage,head=head,
                                  as_of=as_of,max_age_hours=max_age_hours)
        except (OSError,ValueError,TypeError):
            errors=["INDEPENDENT_REMOTE_RECEIPT_MISSING"]
        if not previous_ok:
            errors.append("UPSTREAM_STAGE_NOT_CERTIFIED")
        outcomes[stage]={"state":"REVIEW_REQUIRED" if not errors else "BLOCKED",
                         "reasons":sorted(set(errors))}
        previous_ok=not errors
    for stage,filename,verifier in (
        ("MONEY-COMMISSION.RESTORE","money/restore.json",lambda x:verify_restoration(root,x)),
        ("MONEY-COMMISSION.FEEDS","money/feeds.json",lambda x:verify_feeds(x,as_of)),
        ("MONEY-COMMISSION.PAPER","money/paper.json",lambda x:verify_paper(root,x,as_of)),
    ):
        try:
            errors=verifier(read_json(root,filename))
        except (ValueError,TypeError,OSError):
            errors=["REQUIRED_OPERATOR_EVIDENCE_MISSING"]
        if not previous_ok:
            errors.append("UPSTREAM_STAGE_NOT_CERTIFIED")
        outcomes[stage]={"state":"REVIEW_REQUIRED" if not errors else "BLOCKED",
                         "reasons":sorted(set(errors))}
        previous_ok=not errors
    outcomes["MONEY-COMMISSION.FINAL"]={
        "state":"EXTERNAL_REVIEW_REQUIRED" if previous_ok else "BLOCKED",
        "reasons":[] if previous_ok else ["OPERATIONAL_EVIDENCE_INCOMPLETE"],
    }
    return {"schema":SCHEMA,"mainHeadSha":head,"assessedAt":as_of.isoformat(),
        "stages":outcomes,"finalCertification":"NOT_ISSUED",
        "financialAuthority":"NONE","canExecute":False,"canAuthorizeLive":False}


def main()->int:
    parser=argparse.ArgumentParser(description="Offline, read-only audit of operator receipts; never certifies live trading")
    parser.add_argument("--evidence-root",type=Path,required=True)
    parser.add_argument("--main-head",required=True)
    parser.add_argument("--as-of",default=datetime.now(timezone.utc).isoformat())
    parser.add_argument("--max-age-hours",type=int,default=24)
    args=parser.parse_args()
    if args.max_age_hours<1 or args.max_age_hours>168:
        parser.error("max-age-hours must be 1..168")
    report=evaluate(args.evidence_root,args.main_head,stamp(args.as_of),args.max_age_hours)
    print(json.dumps(report,sort_keys=True,indent=2))
    return 2 if report["stages"]["MONEY-COMMISSION.FINAL"]["state"]=="BLOCKED" else 0


if __name__=="__main__":
    sys.exit(main())
