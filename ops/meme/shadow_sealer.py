#!/usr/bin/env python3
"""Immutable, prospective NO_TRADE shadow receipts; no real or simulated fills."""
import argparse
import datetime as dt
import importlib.util
import json
import pathlib

HERE=pathlib.Path(__file__).parent
def load(name):
    spec=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
observer=load("experiment_7day")
paper=load("paper_shadow_lab")


def existing(state):
    decisions,grades={},{}
    for e in state["events"]:
        if e["type"]=="SHADOW_NO_TRADE_DECISION":
            if e["mint"] in decisions or e.get("canTrade") is not False:
                raise ValueError("shadow_duplicate_or_unsafe_decision")
            decisions[e["mint"]]=e
        elif e["type"]=="SHADOW_SPOT_GRADE":
            if e["mint"] in grades or e.get("isExecutablePnL") is not False:
                raise ValueError("shadow_duplicate_or_unsafe_grade")
            grades[e["mint"]]=e
    for mint,e in grades.items():
        if mint not in decisions or e["decisionId"]!=decisions[mint]["decisionId"]:
            raise ValueError("shadow_grade_without_sealed_decision")
        if observer.timestamp(e["availableAt"])<=observer.timestamp(decisions[mint]["availableAt"]):
            raise ValueError("shadow_grade_not_later")
    return decisions,grades


def reconcile(state,current):
    observer.audit(state)
    now=observer.timestamp(current)
    decisions,grades=existing(state)
    cycle=next((e for e in reversed(state["events"]) if e["type"]=="CYCLE"),None)
    added=learned=0
    if cycle and 0 <= (now-observer.timestamp(cycle["availableAt"])).total_seconds() <= 300:
        market={e["mint"]:e for e in state["events"] if
                e["type"]=="MARKET_OBSERVATION" and e["availableAt"]==cycle["availableAt"]}
        for mint,case in sorted(state["cases"].items()):
            if mint in decisions or case["firstAvailableAt"]!=cycle["availableAt"]:
                continue
            receipt=market.get(mint)
            if not receipt or receipt["pair"]!=case["firstPair"]:
                continue
            decision_id="no-trade:"+receipt["digest"]
            observer.append_event(state,{
                "type":"SHADOW_NO_TRADE_DECISION","mint":mint,"pair":receipt["pair"],
                "decisionId":decision_id,"marketEvidenceDigest":receipt["digest"],
                "informationCutoff":receipt["availableAt"],"observedAt":current,
                "availableAt":current,"action":"NO_TRADE",
                "reason":"CRITICAL_SAFETY_COVERAGE_UNVERIFIED",
                "authority":"SHADOW_DECISION_ONLY",
                "canTrade":False,"canSign":False,"canBroadcast":False,
                "isExecutablePnL":False
            })
            added+=1
        decisions,grades=existing(state)
    for mint,decision in sorted(decisions.items()):
        if mint in grades or mint not in state["cases"]:
            continue
        case=state["cases"][mint]
        mark=case.get("first24hMark")
        if not mark or case.get("baselineClass")=="CENSORED_PAIR_SWITCH":
            continue
        if observer.timestamp(mark["availableAt"])<=observer.timestamp(decision["availableAt"]):
            continue
        grade=paper.grade_no_trade(mark)
        if grade["grade"]=="UNSCORED":
            continue
        observer.append_event(state,{
            "type":"SHADOW_SPOT_GRADE","mint":mint,
            "decisionId":decision["decisionId"],"marketEvidenceDigest":decision["marketEvidenceDigest"],
            "observedAt":mark["availableAt"],"availableAt":current,
            "grade":grade["grade"],"authority":"SHADOW_LEARNING_ONLY",
            "isExecutablePnL":False,"canTrade":False,"canSign":False,
            "canBroadcast":False,"canAuthorizeLive":False,"rugVerdict":"UNDETERMINED"
        })
        learned+=1
    observer.audit(state)
    ds,gs=existing(state)
    return {"newNoTradeDecisions":added,"newSpotOnlyGrades":learned,
            "sealedNoTradeDecisions":len(ds),"scoredSpotOnlyGrades":len(gs),
            "canTrade":False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    args=p.parse_args()
    f=pathlib.Path(args.state)
    state=json.loads(f.read_text())
    result=reconcile(state,observer.now_utc())
    observer.write_json(f,state)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":
    main()
