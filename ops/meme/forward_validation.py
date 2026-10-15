"""WATCHKEEPER.04: prospective cohort audit, incomplete-outcome and local restore tests.

Source-only research pipeline. A source-controlled record alone cannot prove
prospective timing, genuine independent execution fills, owner identity or a
production Postgres/Google Drive cold restore.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
def load_module(name):
    s=importlib.util.spec_from_file_location(name, HERE/(name+".py"))
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
w=load_module("strategy_watchkeeper")
j=load_module("strategy_proposal_journal")
SCHEMA="SHARK-FORWARD-VALIDATION-04"
def _id(s, field):
    if not isinstance(s, str) or not s.strip() or len(s)>160:
        raise ValueError("forward_"+field+"_invalid")
    return s
def _sig(d, field):
    if not isinstance(d,str) or len(d)!=64 or any(x not in "0123456789abcdef" for x in d):
        raise ValueError("forward_"+field+"_invalid")
    return d

def seal_plan(plan:dict, proposal_events:list[dict])->dict:
    j.audit(proposal_events)
    if not isinstance(plan,dict) or set(plan)!={
        "schema","cohortId","strategyId","marketRegime","hardLimitsHash",
        "sealedAt","proposalId","sourceHeadHash","cases","authority",
        "canExecute","canSign","canBroadcast"
    } or plan["schema"]!=SCHEMA:
        raise ValueError("forward_plan_shape_invalid")
    if plan["authority"]!="RESEARCH_ONLY" or any(plan[k] is not False for k in ("canExecute","canSign","canBroadcast")):
        raise ValueError("forward_authority_invalid")
    for f in ("cohortId","strategyId","marketRegime","proposalId"):
        _id(plan[f],f)
    for f in ("hardLimitsHash","sourceHeadHash"):
        _sig(plan[f],f)
    at=w._time(plan["sealedAt"])
    p=[e["payload"] for e in proposal_events if e["type"]=="PROPOSED" and e["payload"]["proposalId"]==plan["proposalId"]]
    r=[e["payload"] for e in proposal_events if e["type"]=="REVIEW_DECLARED" and e["payload"]["proposalId"]==plan["proposalId"]]
    if len(p)!=1 or len(r)!=1 or r[0]["decision"]!="REQUEST_PAPER_TEST" or r[0]["proposalDigest"]!=j.digest(p[0]):
        raise ValueError("forward_paper_review_request_missing")
    if p[0]["strategyId"]!=plan["strategyId"] or p[0]["marketRegime"]!=plan["marketRegime"] or p[0]["hardLimitsHash"]!=plan["hardLimitsHash"]:
        raise ValueError("forward_proposal_context_mismatch")
    if at<=w._time(r[0]["reviewedAt"]):
        raise ValueError("forward_seal_before_review")
    cases=plan["cases"]
    if not isinstance(cases,list) or not 1<=len(cases)<=5000:
        raise ValueError("forward_cases_invalid")
    seen_id,seen_group=set(),set()
    for c in cases:
        if not isinstance(c,dict) or set(c)!={"caseId","independentGroup","mint","decisionAt","evidenceIds","baselineId","candidateId"}:
            raise ValueError("forward_case_shape_invalid")
        for f in ("caseId","independentGroup","mint","baselineId","candidateId"):
            _id(c[f],f)
        if c["baselineId"]==c["candidateId"]:
            raise ValueError("forward_strategy_arms_identical")
        if c["caseId"] in seen_id or c["independentGroup"] in seen_group:
            raise ValueError("forward_duplicate_or_dependent_cohort")
        seen_id.add(c["caseId"]);seen_group.add(c["independentGroup"])
        if w._time(c["decisionAt"])>at:
            raise ValueError("forward_case_future_at_seal")
        if not isinstance(c["evidenceIds"],list) or not c["evidenceIds"] or any(not isinstance(e,str) or not e.strip() for e in c["evidenceIds"]):
            raise ValueError("forward_seal_evidence_missing")
        if len(c["evidenceIds"])!=len(set(c["evidenceIds"])):
            raise ValueError("forward_duplicate_source_evidence")
    sealed={**plan,"proposalDigest":j.digest(p[0]),
        "proposalJournalHead":j.audit(proposal_events),
        "sealTimestampIndependentlyWitnessed":False,
        "ownerApprovalSignatureVerified":False,
        "liveTradingAuthorized":False,
        "canAuthorizeLive":False,"canChangeHardLimits":False,
        "status":"SEALED_SOURCE_ONLY"}
    sealed["sealDigest"]=j.digest(sealed)
    return sealed

def evaluate(seal:dict, observations:list[dict], asof:str, safety_status:str)->dict:
    if not isinstance(seal,dict) or seal.get("schema")!=SCHEMA:
        raise ValueError("forward_seal_required")
    expected=j.digest({k:v for k,v in seal.items() if k!="sealDigest"})
    if seal.get("sealDigest")!=expected or seal.get("status")!="SEALED_SOURCE_ONLY":
        raise ValueError("forward_seal_hash_invalid")
    if any(seal.get(k) is not False for k in ("canExecute","canSign","canBroadcast","canAuthorizeLive","liveTradingAuthorized","ownerApprovalSignatureVerified","sealTimestampIndependentlyWitnessed")):
        raise ValueError("forward_seal_authority_invalid")
    cutoff=w._time(asof);sealed_at=w._time(seal["sealedAt"])
    if cutoff<=sealed_at:
        raise ValueError("forward_asof_before_seal")
    if safety_status not in ("UNKNOWN","INDEPENDENT_VERIFIED"):
        raise ValueError("forward_safety_status_invalid")
    if not isinstance(observations,list):
        raise ValueError("forward_observations_not_list")
    registered={case["caseId"]:case for case in seal["cases"]}
    records={};found=set()
    for obs in observations:
        if not isinstance(obs,dict) or set(obs)!={"caseId","outcomeAvailableAt","candidate","baseline"}:
            raise ValueError("forward_outcome_shape_invalid")
        cid=obs["caseId"]
        if cid not in registered or cid in found:
            raise ValueError("forward_unsealed_or_repeated_outcome")
        found.add(cid)
        available=w._time(obs["outcomeAvailableAt"])
        if available<=sealed_at or available>cutoff:
            raise ValueError("forward_outcome_not_prospective")
        for key in ("candidate","baseline"):
            arm=obs[key]
            if not isinstance(arm,dict):
                raise ValueError("forward_outcome_arm_missing")
            # Do not trust an unsealed strategy substitution.
            if arm.get("strategyId")!=registered[cid][key+"Id"]:
                raise ValueError("forward_outcome_strategy_changed")
            arm={k:v for k,v in arm.items() if k!="strategyId"}
            w._arm(arm,available)
            if key=="candidate":candidate=arm
            else:baseline=arm
        records[cid]={"caseId":cid,"independentGroup":registered[cid]["independentGroup"],
            "marketRegime":seal["marketRegime"],"sealedAt":seal["sealedAt"],
            "outcomeAvailableAt":obs["outcomeAvailableAt"],
            "candidate":candidate,"baseline":baseline}
    # Unobserved cases are *explicitly censored*, never fabricated returns.
    missing=sorted(set(registered)-found)
    for cid in missing:
        def not_scored():
            return {"sourceClass":"DEX_ROUTE_COUNTERFACTUAL","authority":"PAPER_SIMULATION_ONLY",
                "canExecute":False,"canSign":False,"canBroadcast":False,
                "fillStatus":"UNSCORED","returnBps":None}
        records[cid]={"caseId":cid,"independentGroup":registered[cid]["independentGroup"],
            "marketRegime":seal["marketRegime"],"sealedAt":seal["sealedAt"],
            "outcomeAvailableAt":asof,"candidate":not_scored(),"baseline":not_scored()}
    scorecard={"schema":w.SCHEMA,"strategyId":seal["strategyId"],
        "marketRegime":seal["marketRegime"],"hardLimitsHash":seal["hardLimitsHash"],
        "safetyStatus":safety_status,"asOf":asof,
        "pairs":[records[cid] for cid in sorted(records)]}
    assessment=w.assess(scorecard)
    result={"schema":SCHEMA,"cohortId":seal["cohortId"],
        "sealDigest":seal["sealDigest"],"sourceHeadHash":seal["sourceHeadHash"],
        "proposalDigest":seal["proposalDigest"],"assessment":assessment,
        "missingObservationCaseIds":missing,
        "observedCaseCount":len(found),"sealedCaseCount":len(registered),
        "status":"INCOMPLETE_EXTERNAL_CERTIFICATION",
        "sourceSealTimeVerified":False,"ownerApprovalSignatureVerified":False,
        "fullDatabaseRestored":False,"independentArchiveReadbackVerified":False,
        "genuineFillsVerified":False,"tradePerformanceCertified":False,
        "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,
        "canChangeHardLimits":False,"canRewriteRules":False}
    result["receiptDigest"]=j.digest(result)
    return result

def verify_local_restore(original:bytes, copy:bytes, anchored_digest:str)->dict:
    _sig(anchored_digest,"anchor_digest")
    if not isinstance(original,bytes) or not isinstance(copy,bytes):
        raise ValueError("forward_restore_bytes_required")
    if hashlib.sha256(original).hexdigest()!=anchored_digest:
        raise ValueError("forward_source_anchor_mismatch")
    if original!=copy:
        raise ValueError("forward_local_restore_mismatch")
    lines=original.decode("utf-8").splitlines()
    if not lines:
        raise ValueError("forward_empty_journal_not_backup")
    events=[json.loads(line) for line in lines]
    head=j.audit(events)
    return {"status":"LOCAL_BYTES_AND_JOURNAL_MATCH_ONLY",
        "sourceSha256":anchored_digest,"journalHeadHash":head,
        "realProductionPostgresRestoreVerified":False,
        "externalIndependentDownloadVerified":False,
        "remoteArchiveRetentionVerified":False,
        "ownerApprovalSignatureVerified":False,
        "authority":"RESEARCH_ONLY","canAuthorizeLive":False}

def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest="action",required=True)
    a=sub.add_parser("seal")
    a.add_argument("--plan",required=True);a.add_argument("--journal",required=True);a.add_argument("--out",required=True)
    a=sub.add_parser("evaluate")
    a.add_argument("--seal",required=True);a.add_argument("--observations",required=True)
    a.add_argument("--asof",required=True);a.add_argument("--safety-status",required=True);a.add_argument("--out",required=True)
    a=sub.add_parser("restore-check")
    a.add_argument("--source",required=True);a.add_argument("--copy",required=True);a.add_argument("--anchored-sha256",required=True)
    a.add_argument("--out",required=True)
    x=p.parse_args()
    target=Path(x.out)
    inputs=[Path(getattr(x,k)) for k in ("plan","journal","seal","observations","source","copy") if hasattr(x,k)]
    if target.exists() or any(target.resolve()==i.resolve() for i in inputs):
        raise ValueError("forward_output_overwrite_forbidden")
    if x.action=="seal":
        result=seal_plan(json.loads(Path(x.plan).read_text()),j.load(Path(x.journal)))
    elif x.action=="evaluate":
        result=evaluate(json.loads(Path(x.seal).read_text()),
            json.loads(Path(x.observations).read_text()),x.asof,x.safety_status)
    else:
        result=verify_local_restore(Path(x.source).read_bytes(),Path(x.copy).read_bytes(),x.anchored_sha256)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(result["status"])

if __name__=="__main__":
    main()
