"""WATCHKEEPER.07: bounded, no-wallet, timestamped paper execution study.

Consumes .06 read-only pool receipts and optional independently supplied *research*
entry/exit route evidence. When only .06 partial vault evidence is present, ABSTAIN.
When separate complete safety + quote research receipts exist, run the existing
paper-shadow library, but ALWAYS mark simulations as unverified external claims,
never certified fills. No strategy autopromotion, actual trade, signature or money.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
def load(name):
    s=importlib.util.spec_from_file_location("wk07_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
paper=load("paper_shadow_lab")
single=load("single_slot_pool_observer")
watch=load("strategy_watchkeeper")
journal=load("strategy_proposal_journal")
SCHEMA="SHARK-PAPER-REPLAY-07"
MAX_CASES=1000

def _id(x):
    if not isinstance(x,str) or not x.strip() or len(x)>160:
        raise ValueError("wk07_identity_missing")
    return x

def guard(case:dict):
    if not isinstance(case,dict) or set(case)!={
        "schema","caseId","mint","pair","strategyId","sourceClass","decisionAt",
        "exitAt","exitPlan","entryNotionalUsd","virtualBalanceUsd","readOnlyPoolReceipt",
        "safety","buyQuote","sellQuote","authority","canExecute","canSign","canBroadcast"}:
        raise ValueError("wk07_case_schema_invalid")
    if case["schema"]!=SCHEMA or case["authority"]!="RESEARCH_ONLY" or any(case[k] is not False for k in ("canExecute","canSign","canBroadcast")):
        raise ValueError("wk07_authority_invalid")
    for k in ("caseId","mint","pair","strategyId"):_id(case[k])
    if not single.obs.ADDRESS.fullmatch(case["mint"]) or not single.obs.ADDRESS.fullmatch(case["pair"]):
        raise ValueError("wk07_mint_pair_invalid")
    if case["sourceClass"] not in ("SYNTHETIC_TEST","EXTERNAL_PAPER_RESEARCH","PUBLIC_SINGLE_SLOT_OBSERVATION"):
        raise ValueError("wk07_source_class_invalid")
    at=watch._time(case["decisionAt"])
    exit_at=watch._time(case["exitAt"])
    if exit_at<=at:
        raise ValueError("wk07_nonprospective_exit")
    plan=case["exitPlan"]
    if not isinstance(plan,dict) or set(plan)!={"maxHoldSeconds","takeProfitBps","stopLossBps"}:
        raise ValueError("wk07_exit_plan_invalid")
    for k,limit in (("maxHoldSeconds",7200),("takeProfitBps",10000),("stopLossBps",10000)):
        v=plan[k]
        if type(v) is not int or not 1<=v<=limit:
            raise ValueError("wk07_exit_plan_"+k+"_invalid")
    if case["sourceClass"]!="SYNTHETIC_TEST" and not isinstance(case["readOnlyPoolReceipt"],dict):
        raise ValueError("wk07_pool_evidence_required")
    return at,exit_at

def abstain(case:dict,reason:str)->dict:
    return {"schema":SCHEMA,"caseId":case["caseId"],"sourceClass":case["sourceClass"],
        "status":"ABSTAIN","reasonCodes":[reason],"entryFillClass":"NO_FILL",
        "exitFillClass":"NO_FILL","netPnlUsdModeled":None,"feeUsdModeled":None,
        "realizedProfitCertified":False,"actualTradeCount":0,"paperFillCountCertified":0,
        "observationIndependentlyAttested":False,"authority":"RESEARCH_ONLY",
        "canExecute":False,"canSign":False,"canBroadcast":False,
        "canAuthorizeLive":False,"canRewriteRules":False}

def check_pool(case:dict)->str|None:
    pool=case["readOnlyPoolReceipt"]
    if case["sourceClass"]=="SYNTHETIC_TEST":
        if pool is not None:raise ValueError("wk07_synthetic_not_isolated")
        return None
    if pool.get("schema")!=single.SCHEMA or pool.get("status")!="SINGLE_RPC_CONTEXT_PARTIAL_UNVERIFIED":
        return "POOL_RECEIPT_NOT_VALID"
    check=single.sha({k:v for k,v in pool.items() if k!="receiptDigest"})
    if pool.get("receiptDigest")!=check:
        raise ValueError("wk07_pool_digest_tampered")
    if pool.get("pool")!=case["pair"] or pool.get("baseMint")!=case["mint"]:
        raise ValueError("wk07_pool_identity_mismatch")
    if any(pool.get(k) is not False for k in ("canTrade","canSign","canBroadcast","canEnterPaper")):
        raise ValueError("wk07_pool_authority_invalid")
    observed=watch._time(pool.get("observedAt"))
    available=watch._time(pool.get("availableAt"))
    decision=watch._time(case["decisionAt"])
    if observed>available or available>decision or (decision-available).total_seconds()>20:
        raise ValueError("wk07_pool_evidence_future_or_stale")
    if case["sourceClass"]=="PUBLIC_SINGLE_SLOT_OBSERVATION":
        return "READ_ONLY_POOL_ONLY_NO_INDEPENDENT_SELLABILITY"
    # EXTERNAL_PAPER_RESEARCH still needs complete separately supplied safety proofs.
    return None

def simulate(case:dict)->dict:
    guard(case)
    limitation=check_pool(case)
    if limitation:
        return abstain(case,limitation)
    safety=case["safety"]
    if not isinstance(safety,dict):
        return abstain(case,"SAFETY_RECEIPTS_MISSING")
    decision=paper.admit_paper_case(safety,case["decisionAt"])
    if decision["admission"]!="REVIEWED_PAPER_CANDIDATE":
        result=abstain(case,"INDEPENDENT_SAFETY_NOT_ADMITTED")
        result["reasonCodes"]+=decision["reasons"]
        return result
    try:
        entry=paper.simulate_buy(case["mint"],case["entryNotionalUsd"],case["virtualBalanceUsd"],
                   decision,safety,case["buyQuote"],case["decisionAt"])
    except (ValueError,TypeError,KeyError,OverflowError,ZeroDivisionError):
        return abstain(case,"BUY_ROUTE_MISSING_OR_UNVERIFIED")
    if entry["pair"]!=case["pair"]:
        raise ValueError("wk07_entry_pool_mismatch")
    sell=paper.simulate_exit(entry,case["sellQuote"],case["exitAt"])
    seconds=(watch._time(case["exitAt"])-watch._time(case["decisionAt"])).total_seconds()
    deadline=seconds>=case["exitPlan"]["maxHoldSeconds"]
    if sell["action"]=="NO_FILL":
        status="COUNTERFACTUAL_OPEN_OR_UNSELLABLE"
        pnl=None
        exit_class="NO_FILL"
        reasons=[sell["reason"]]
        study_trigger="TIMEOUT_WITH_NO_SELL" if deadline else "WAITING_ON_EXIT_EVIDENCE"
    else:
        status="COUNTERFACTUAL_CLOSED_UNVERIFIED"
        pnl=sell["pnlUsdModeled"]
        exit_class="COUNTERFACTUAL_ONLY"
        reasons=["SIMULATED_NOT_EXECUTED"]
        return_bps=pnl*10000/entry["notionalUsd"]
        study_trigger=("PAPER_TP_AT_OBSERVATION" if return_bps>=case["exitPlan"]["takeProfitBps"]
            else "PAPER_STOP_AT_OBSERVATION" if return_bps<=-case["exitPlan"]["stopLossBps"]
            else "PAPER_TIMEOUT_OBSERVATION" if deadline else "PAPER_HOLD_OBSERVATION")
    result={
        "schema":SCHEMA,"caseId":case["caseId"],"strategyId":case["strategyId"],
        "sourceClass":case["sourceClass"],"status":status,"reasonCodes":reasons,
        "mint":case["mint"],"pair":case["pair"],
        "decisionAt":case["decisionAt"],"exitAt":case["exitAt"],
        "exitPlan":case["exitPlan"],"elapsedSeconds":int(seconds),
        "timeoutThresholdReached":deadline,"paperExitStudyTag":study_trigger,
        "entryNotionalUsd":entry["notionalUsd"],
        "entryFillClass":"COUNTERFACTUAL_ONLY","exitFillClass":exit_class,
        "entryEvidenceIds":entry["evidenceIds"],"exitEvidenceIds":sell.get("evidenceIds",[]),
        "netPnlUsdModeled":pnl,"modeledEntryCostUsd":entry["costUsdModeled"],
        "modeledEntryFeeBps":case["buyQuote"]["feeBps"],
        "modeledEntrySlippageBps":case["buyQuote"]["slippageBps"],
        "modeledEntryPriceImpactBps":case["buyQuote"]["impactBps"],
        "modeledExitFeeBps":case["sellQuote"]["feeBps"] if exit_class=="COUNTERFACTUAL_ONLY" else None,
        "modeledExitSlippageBps":case["sellQuote"]["slippageBps"] if exit_class=="COUNTERFACTUAL_ONLY" else None,
        "modeledExitPriceImpactBps":case["sellQuote"]["impactBps"] if exit_class=="COUNTERFACTUAL_ONLY" else None,
        "notExecutionEvidence":True,
        "inputClaimsIndependentlyAuthenticated":False,
        "actualTradeCount":0,"paperFillCountCertified":0,
        "realizedProfitCertified":False,"observationIndependentlyAttested":False,
        "authority":"RESEARCH_ONLY","canExecute":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,"canRewriteRules":False}
    result["receiptDigest"]=journal.digest(result)
    return result

def batch(cases:list[dict])->dict:
    if not isinstance(cases,list) or not 1<=len(cases)<=MAX_CASES:
        raise ValueError("wk07_batch_invalid")
    seen=set();rows=[]
    for c in cases:
        result=simulate(c)
        if result["caseId"] in seen:raise ValueError("wk07_duplicate_case")
        seen.add(result["caseId"]);rows.append(result)
    summary={
        "schema":SCHEMA,"records":rows,"cases":len(rows),
        "abstentions":sum(x["status"]=="ABSTAIN" for x in rows),
        "modeledNoSellCases":sum(x["status"]=="COUNTERFACTUAL_OPEN_OR_UNSELLABLE" for x in rows),
        "closedCounterfactualCases":sum(x["status"]=="COUNTERFACTUAL_CLOSED_UNVERIFIED" for x in rows),
        "actualTradeCount":0,"certifiedPaperFills":0,
        "status":"OFFLINE_RESEARCH_ONLY_NOT_COMMISSIONED",
        "authority":"RESEARCH_ONLY","canExecute":False,
        "canSign":False,"canBroadcast":False,"canAuthorizeLive":False}
    summary["receiptDigest"]=journal.digest(summary)
    return summary

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--cases",required=True)
    p.add_argument("--out",required=True)
    args=p.parse_args()
    target=Path(args.out)
    if target.exists() or target.resolve()==Path(args.cases).resolve():
        raise ValueError("wk07_output_overwrite_forbidden")
    cases=json.loads(Path(args.cases).read_text(encoding="utf-8"))
    result=batch(cases)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"cases":result["cases"],"abstentions":result["abstentions"],
        "closedCounterfactualCases":result["closedCounterfactualCases"],"actualTradeCount":0}))

if __name__=="__main__":
    main()
