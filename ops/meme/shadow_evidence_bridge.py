"""WATCHKEEPER.08: read-only join between sealed SHARK NO_TRADE shadow and .07 paper research.

This does NOT create an executable P&L dataset, write Money Core/Supabase,
run AI coaching, or confer strategy promotion. Neither a local SHA-256 nor
self-declared quote safety booleans independently authenticate fills.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
def load(name):
    spec=importlib.util.spec_from_file_location("w08_"+name,HERE/(name+".py"))
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
observations=load("experiment_7day")
shadow=load("shadow_sealer")
paper=load("paper_replay_runner")
journal=load("strategy_proposal_journal")
watch=load("strategy_watchkeeper")
SCHEMA="SHARK-SHADOW-EVIDENCE-BRIDGE-08"
MAX_LINKS=1000
MAX_LAG_SECONDS=300
def identifier(value,field):
    if not isinstance(value,str) or not value.strip() or len(value)>160:
        raise ValueError("w08_"+field+"_invalid")
    return value
def no_authority(payload,keys,where):
    if payload.get("authority")!="RESEARCH_ONLY" or any(payload.get(k) is not False for k in keys):
        raise ValueError("w08_"+where+"_authority_invalid")
def utc(value):
    return watch._time(value)

def validate_batch(batch:dict):
    if not isinstance(batch,dict) or batch.get("schema")!=paper.SCHEMA or batch.get("status")!="OFFLINE_RESEARCH_ONLY_NOT_COMMISSIONED":
        raise ValueError("w08_not_a_research_batch")
    no_authority(batch,("canExecute","canSign","canBroadcast","canAuthorizeLive"),"batch")
    if batch.get("actualTradeCount")!=0 or batch.get("certifiedPaperFills")!=0:
        raise ValueError("w08_batch_trading_claim")
    rows=batch.get("records")
    if not isinstance(rows,list) or len(rows)>paper.MAX_CASES or batch.get("cases")!=len(rows):
        raise ValueError("w08_batch_rows_invalid")
    expected={k:v for k,v in batch.items() if k!="receiptDigest"}
    if batch.get("receiptDigest")!=journal.digest(expected):
        raise ValueError("w08_batch_digest_invalid")
    seen=set()
    for row in rows:
        if not isinstance(row,dict) or row.get("schema")!=paper.SCHEMA:
            raise ValueError("w08_row_invalid")
        rid=identifier(row.get("caseId"),"case")
        if rid in seen:raise ValueError("w08_duplicate_case")
        seen.add(rid)
        no_authority(row,("canExecute","canSign","canBroadcast","canAuthorizeLive","canRewriteRules"),"row")
        if row.get("actualTradeCount")!=0 or row.get("paperFillCountCertified")!=0 or row.get("realizedProfitCertified") is not False:
            raise ValueError("w08_row_execution_claim")
        status=row.get("status")
        if status not in ("ABSTAIN","COUNTERFACTUAL_OPEN_OR_UNSELLABLE","COUNTERFACTUAL_CLOSED_UNVERIFIED"):
            raise ValueError("w08_row_status_invalid")
        if status=="ABSTAIN":
            if row.get("netPnlUsdModeled") is not None or row.get("exitFillClass")!="NO_FILL":
                raise ValueError("w08_abstention_pnl_fabricated")
        else:
            if row.get("inputClaimsIndependentlyAuthenticated") is not False or row.get("observationIndependentlyAttested") is not False or row.get("notExecutionEvidence") is not True:
                raise ValueError("w08_unverified_paper_claim_escalated")
            if row.get("receiptDigest")!=journal.digest({k:v for k,v in row.items() if k!="receiptDigest"}):
                raise ValueError("w08_row_digest_invalid")
            if row.get("entryFillClass")!="COUNTERFACTUAL_ONLY" or not isinstance(row.get("entryEvidenceIds"),list) or not row["entryEvidenceIds"]:
                raise ValueError("w08_paper_entry_not_counterfactual")
            if status=="COUNTERFACTUAL_OPEN_OR_UNSELLABLE":
                if row.get("exitFillClass")!="NO_FILL" or row.get("netPnlUsdModeled") is not None or row.get("exitEvidenceIds")!=[]:
                    raise ValueError("w08_unsold_has_pnl")
            else:
                if row.get("exitFillClass")!="COUNTERFACTUAL_ONLY" or not isinstance(row.get("exitEvidenceIds"),list) or not row["exitEvidenceIds"] or row.get("netPnlUsdModeled") is None:
                    raise ValueError("w08_closed_route_missing")
                if set(row["entryEvidenceIds"]) & set(row["exitEvidenceIds"]):
                    raise ValueError("w08_entry_exit_evidence_reused")
    if sum(r["status"]=="ABSTAIN" for r in rows)!=batch.get("abstentions"):
        raise ValueError("w08_abstention_count_invalid")
    if sum(r["status"]=="COUNTERFACTUAL_CLOSED_UNVERIFIED" for r in rows)!=batch.get("closedCounterfactualCases"):
        raise ValueError("w08_closed_count_invalid")
    if sum(r["status"]=="COUNTERFACTUAL_OPEN_OR_UNSELLABLE" for r in rows)!=batch.get("modeledNoSellCases"):
        raise ValueError("w08_nosell_count_invalid")
    return {r["caseId"]:r for r in rows}

def correlate(state:dict,batch:dict,manifest:dict)->dict:
    observations.audit(state)
    decisions,grades=shadow.existing(state)
    records=validate_batch(batch)
    if not isinstance(manifest,dict) or set(manifest)!={
        "schema","experimentId","stateHeadDigest","batchDigest","asOf","links",
        "authority","canExecute","canSign","canBroadcast","canRewriteRules","canAuthorizeLive"
    } or manifest["schema"]!=SCHEMA:
        raise ValueError("w08_manifest_shape_invalid")
    no_authority(manifest,("canExecute","canSign","canBroadcast","canRewriteRules","canAuthorizeLive"),"manifest")
    if manifest["experimentId"]!=observations.ID or manifest["stateHeadDigest"]!=state["lastDigest"] or manifest["batchDigest"]!=batch["receiptDigest"]:
        raise ValueError("w08_manifest_input_identity_mismatch")
    asof=utc(manifest["asOf"])
    links=manifest["links"]
    if not isinstance(links,list) or not 1<=len(links)<=MAX_LINKS:
        raise ValueError("w08_links_invalid")
    used_decisions,used_cases=set(),set()
    findings=[]
    for link in links:
        if not isinstance(link,dict) or set(link)!={"shadowDecisionId","paperCaseId"}:
            raise ValueError("w08_link_invalid")
        sid=identifier(link["shadowDecisionId"],"shadow_decision")
        rid=identifier(link["paperCaseId"],"paper_case")
        if sid in used_decisions or rid in used_cases:
            raise ValueError("w08_duplicate_or_dependent_link")
        used_decisions.add(sid);used_cases.add(rid)
        if sid not in decisions or rid not in records:
            raise ValueError("w08_unsealed_or_missing_pair")
        decision,row=decisions[sid],records[rid]
        if (decision.get("authority")!="SHADOW_DECISION_ONLY" or decision.get("action")!="NO_TRADE"
            or any(decision.get(k) is not False for k in ("canTrade","canSign","canBroadcast","isExecutablePnL"))):
            raise ValueError("w08_unsafe_shadow_decision")
        if utc(decision["availableAt"])>asof:
            raise ValueError("w08_future_shadow_decision")
        if row["status"]=="ABSTAIN":
            raise ValueError("w08_unbound_abstention_cannot_join_real_decision")
        if row.get("sourceClass")!="EXTERNAL_PAPER_RESEARCH":
            raise ValueError("w08_synthetic_or_unverified_public_case")
        if row["mint"]!=decision["mint"] or row["pair"]!=decision["pair"]:
            raise ValueError("w08_mint_or_pool_mismatch")
        decided=utc(decision["availableAt"]);entry=utc(row["decisionAt"]);exit_at=utc(row["exitAt"])
        if entry<decided or (entry-decided).total_seconds()>MAX_LAG_SECONDS or exit_at<=entry or exit_at>asof:
            raise ValueError("w08_retroactive_stale_or_future_replay")
        # Sealed spot grades and censored horizons are NEVER evidence of a sale.
        grade=grades.get(sid)
        if grade is None:
            spot="PENDING_SPOT_ONLY"
        elif grade.get("type")=="SHADOW_SPOT_CENSOR":
            spot="CENSORED_SPOT_ONLY"
        else:
            if grade.get("type")!="SHADOW_SPOT_GRADE":
                raise ValueError("w08_unknown_shadow_grade")
            spot="OBSERVED_SPOT_ONLY"
        if grade:
            if grade.get("isExecutablePnL") is not False or grade.get("canTrade") is not False:
                raise ValueError("w08_spot_grade_claimed_execution")
            if utc(grade["availableAt"])>asof:
                raise ValueError("w08_future_spot_grade")
        findings.append({
            "shadowDecisionId":sid,"paperCaseId":rid,
            "mint":row["mint"],"pair":row["pair"],
            "paperResearchClass":row["status"],"spotOutcomeClass":spot,
            "paperNotionalUsdUnverified":row["entryNotionalUsd"],
            "paperModeledNetPnlUsdUnverified":row["netPnlUsdModeled"],
            "paperEntryEvidenceIds":row["entryEvidenceIds"],
            "paperExitEvidenceIds":row["exitEvidenceIds"],
            "researchGradeOnly":True,"realizedFillVerified":False,
            "canExportAsForwardFill":False,"canChangeStrategy":False
        })
    count_nosell=sum(x["paperResearchClass"]=="COUNTERFACTUAL_OPEN_OR_UNSELLABLE" for x in findings)
    count_censored=sum(x["spotOutcomeClass"]=="CENSORED_SPOT_ONLY" for x in findings)
    result={
        "schema":SCHEMA,"asOf":manifest["asOf"],"experimentId":observations.ID,
        "sourceStateHead":state["lastDigest"],"paperBatchDigest":batch["receiptDigest"],
        "joinedCases":len(findings),"openOrUnsellable":count_nosell,
        "censoredSpotHorizon":count_censored,"findings":findings,
        "verdict":"RESEARCH_RECONCILIATION_ONLY",
        "reasonCodes":sorted({"EXTERNAL_ROUTE_ATTESTATION_UNVERIFIED",
           "SPOT_GRADE_NOT_EXECUTABLE_PNL","NO_INDEPENDENT_FILL_WITNESS",
           "NO_STRATEGY_PROMOTION_AUTHORITY"} | (
            {"PAPER_SELL_ROUTE_GAPS"} if count_nosell else set()
        ) | ({"SPOT_HORIZON_CENSORED"} if count_censored else set())),
        "canExportAsWatchkeeper04Outcome":False,"canProposeRuleChange":False,
        "canExecute":False,"canSign":False,"canBroadcast":False,
        "canAuthorizeLive":False,"canRewriteRules":False,
        "authority":"RESEARCH_ONLY","actualTradesVerified":0,
        "independentPaperFillCount":0
    }
    result["receiptDigest"]=journal.digest(result)
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--observer-state",required=True)
    p.add_argument("--paper-batch",required=True)
    p.add_argument("--link-manifest",required=True)
    p.add_argument("--out",required=True)
    a=p.parse_args()
    inputs=[Path(a.observer_state),Path(a.paper_batch),Path(a.link_manifest)]
    dest=Path(a.out)
    if dest.exists() or any(dest.resolve()==v.resolve() for v in inputs):
        raise ValueError("w08_no_overwrite")
    state=json.loads(inputs[0].read_text(encoding="utf-8"))
    batch=json.loads(inputs[1].read_text(encoding="utf-8"))
    manifest=json.loads(inputs[2].read_text(encoding="utf-8"))
    result=correlate(state,batch,manifest)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"verdict":result["verdict"],"joinedCases":result["joinedCases"],
        "actualTradesVerified":0,"canAuthorizeLive":False}))

if __name__=="__main__":
    main()
