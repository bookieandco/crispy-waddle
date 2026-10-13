#!/usr/bin/env python3
"""Experiment-layer conservative adapter for SHARK/Money paper admission.

Never impersonates the canonical persisted Money approval. Canonical
actor-aware assessment still requires the app's Supabase graph and actual
liquidity/actor/sellability checks. This worker records why it ABSTAINS
rather than fabricating authorizations from price/partial mint metadata.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import pathlib

HERE=pathlib.Path(__file__).parent
def load(name):
    sp=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    module=importlib.util.module_from_spec(sp)
    sp.loader.exec_module(module)
    return module
obs=load("experiment_7day")
paper=load("paper_shadow_lab")

VERSION="SHARK-MEME-7D-PAPER-GATE-01"


def evidence_for(state:dict,mint:str,cutoff:str)->dict|None:
    at=obs.timestamp(cutoff)
    probes=[e for e in state["events"]
            if e["type"]=="SOLANA_MINT_PROBE" and e.get("mint")==mint and
               obs.timestamp(e["availableAt"])<=at]
    return probes[-1] if probes else None


def assess_abstention(state:dict,decision:dict,now:str)->dict:
    if decision.get("type")!="SHADOW_NO_TRADE_DECISION" or decision.get("canTrade") is not False:
        raise ValueError("only_prospective_no_trade_decision")
    if decision.get("action")!="NO_TRADE":
        raise ValueError("no_trade_only")
    if obs.timestamp(now)<obs.timestamp(decision["availableAt"]):
        raise ValueError("paper_evidence_from_future")
    probe=evidence_for(state,decision["mint"],decision["availableAt"])
    # A parsed Solana mint may prove only mint/freeze flags. No mint information
    # proves DEX sellability, LP ownership, independent holders or operators.
    signals=probe.get("signals",[]) if probe and probe.get("status")=="ONCHAIN_PARTIAL_UNVERIFIED" else []
    disposition="BLOCK" if any(s in signals for s in (
        "MINT_AUTHORITY_ACTIVE","FREEZE_AUTHORITY_ACTIVE",
        "TOP_TOKEN_ACCOUNTS_CONCENTRATED_NOT_WALLET_GRAPH"
    )) else "REVIEW"
    safety={
        "coverage":{k:False for k in paper.REQUIRED_COVERAGE},
        "checks":{},
        "rugDisposition":disposition,
        "sourceIntegrity":"UNVERIFIED",
        "moneyRiskDisposition":"MONEY_CORE_PAPER_NOT_APPROVED",
        "executionAuthority":False,"canSign":False
    }
    verdict=paper.admit_paper_case(safety,decision["availableAt"])
    if verdict["admission"]!="REJECT":
        raise ValueError("paper_guard_unexpected_admission")
    return {
        "type":"SHARK_MONEY_PAPER_GUARD",
        "version":VERSION,
        "decisionId":decision["decisionId"],
        "mint":decision["mint"],
        "marketEvidenceDigest":decision["marketEvidenceDigest"],
        "mintProbeEvidenceDigest":probe["digest"] if probe else None,
        "informationCutoff":decision["availableAt"],
        "observedAt":now,"availableAt":now,
        "disposition":"NO_TRADE",
        "rugDefenseDisposition":disposition,
        "reasons":verdict["reasons"],
        "missingCriticalCoverage":sorted(paper.REQUIRED_COVERAGE),
        "moneyApproval":"ABSENT",
        "authority":"RESEARCH_ONLY",
        "canTrade":False,"canSign":False,"canBroadcast":False,
        "canAuthorizeLive":False,"paperNotionalUsd":0,
        "quoteClass":"UNAVAILABLE","simulatedFill":"NONE"
    }


def reconcile(state:dict,now:str)->dict:
    obs.audit(state)
    already={e["decisionId"] for e in state["events"] if e["type"]=="SHARK_MONEY_PAPER_GUARD"}
    decisions=[e for e in state["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION"]
    added=0
    for decision in decisions:
        if decision["decisionId"] in already:
            continue
        result=assess_abstention(state,decision,now)
        obs.append_event(state,result)
        already.add(decision["decisionId"])
        added+=1
    obs.audit(state)
    return {"newFailClosedAssessments":added,"totalFailClosedAssessments":len(already),
            "paperOrders":0,"paperFills":0,"realOrders":0,"canTrade":False}


def main()->None:
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    a=p.parse_args()
    f=pathlib.Path(a.state)
    state=json.loads(f.read_text())
    result=reconcile(state,obs.now_utc())
    obs.write_json(f,state)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":
    main()
