#!/usr/bin/env python3
"""Prospective, cycle-by-cycle SHARK shadow abstention study.

Seals a maximum of three genuine same-cycle market observations per invocation.
Grades only FUTURE same-pair observations within 24–30 hours of that decision.
Censors missing data and all intervening pair switches, never scores hindsight.
No real or simulated orders. No token is certified safe.
"""
from __future__ import annotations
import argparse
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
MAX_SEALS_PER_CYCLE=3
MAX_DECISION_DELAY_SECONDS=300
HORIZON_START=24*3600
HORIZON_END=30*3600


def existing(state):
    decisions,grades={},{}
    for e in state["events"]:
        if e["type"]=="SHADOW_NO_TRADE_DECISION":
            key=e["decisionId"]
            if key in decisions or e.get("canTrade") is not False or e.get("action")!="NO_TRADE":
                raise ValueError("shadow_duplicate_or_unsafe_decision")
            decisions[key]=e
        elif e["type"] in {"SHADOW_SPOT_GRADE","SHADOW_SPOT_CENSOR"}:
            key=e["decisionId"]
            if key in grades or e.get("isExecutablePnL") is not False:
                raise ValueError("shadow_duplicate_or_unsafe_grade")
            grades[key]=e
    for key,e in grades.items():
        if key not in decisions or e["decisionId"]!=decisions[key]["decisionId"]:
            raise ValueError("shadow_grade_without_sealed_decision")
        if observer.timestamp(e["availableAt"])<=observer.timestamp(decisions[key]["availableAt"]):
            raise ValueError("shadow_grade_not_later")
    return decisions,grades


def reconcile(state,current):
    observer.audit(state)
    now=observer.timestamp(current)
    if now < observer.timestamp(observer.START):
        raise ValueError("shadow_outside_start")
    if now >= observer.timestamp(observer.END):
        return {"status":"ENDED","newNoTradeDecisions":0,"newSpotOnlyGrades":0,
                "newCensors":0,"canTrade":False}
    decisions,grades=existing(state)
    cycle=next((e for e in reversed(state["events"]) if e["type"]=="CYCLE"),None)
    added=learned=censored=0
    if cycle and 0 <= (now-observer.timestamp(cycle["availableAt"])).total_seconds() <= MAX_DECISION_DELAY_SECONDS:
        market=[e for e in state["events"] if
                e["type"]=="MARKET_OBSERVATION" and e["availableAt"]==cycle["availableAt"]]
        # Rotate genuine candidates across cycles. Previously studied mints may
        # receive NEW decision-time hypotheses; no case is backdated.
        market.sort(key=lambda e: e["mint"])
        cycle_number=sum(e["type"]=="CYCLE" for e in state["events"])
        if market:
            start=(cycle_number*MAX_SEALS_PER_CYCLE)%len(market)
            rotated=(market+market)[start:start+MAX_SEALS_PER_CYCLE]
        else:
            rotated=[]
        for receipt in rotated:
            key="no-trade:"+receipt["digest"]
            if key in decisions:
                continue
            if receipt.get("securityStatus")!="UNVERIFIED" or receipt.get("canTrade") is not False:
                raise ValueError("shadow_input_authority_mismatch")
            observer.append_event(state,{
                "type":"SHADOW_NO_TRADE_DECISION","decisionId":key,
                "mint":receipt["mint"],"pair":receipt["pair"],
                "marketPriceUsd":receipt["priceUsd"],
                "marketEvidenceDigest":receipt["digest"],
                "informationCutoff":receipt["availableAt"],
                "observedAt":current,"availableAt":current,
                "action":"NO_TRADE","authority":"SHADOW_DECISION_ONLY",
                "reason":"SELLABILITY_LP_ACTOR_AND_MONEY_APPROVAL_UNVERIFIED",
                "canTrade":False,"canSign":False,"canBroadcast":False,
                "isExecutablePnL":False
            })
            added+=1
        decisions,grades=existing(state)
    observations={}
    for e in state["events"]:
        if e["type"]=="MARKET_OBSERVATION":
            observations.setdefault(e["mint"],[]).append(e)
    for key,decision in decisions.items():
        if key in grades:
            continue
        decision_time=observer.timestamp(decision["availableAt"])
        age=(now-decision_time).total_seconds()
        if age < HORIZON_START:
            continue
        future=[e for e in observations.get(decision["mint"],[]) if
                observer.timestamp(e["availableAt"])>decision_time]
        future.sort(key=lambda e:e["availableAt"])
        # If a token ever changes its recorded trading pool, no price
        # continuity is presumed, even if it changes back before 24 hours.
        prior_switch=any(e["pair"]!=decision["pair"] for e in future
                         if (observer.timestamp(e["availableAt"])-decision_time).total_seconds()<=HORIZON_END)
        eligible=[e for e in future if
                  HORIZON_START <= (observer.timestamp(e["availableAt"])-decision_time).total_seconds() <= HORIZON_END]
        if prior_switch:
            outcome="CENSORED_PAIR_SWITCH"
        elif eligible:
            outcome="GRADE"
        elif age>HORIZON_END:
            outcome="CENSORED_MISSING_24H"
        else:
            continue
        if outcome=="GRADE":
            observed=eligible[0]
            up=observed["priceUsd"]>decision["marketPriceUsd"]
            return_pct=round(100*(observed["priceUsd"]/decision["marketPriceUsd"]-1),5)
            grade=paper.grade_no_trade({"up":up})
            observer.append_event(state,{
                "type":"SHADOW_SPOT_GRADE","decisionId":key,"mint":decision["mint"],
                "observedAt":observed["availableAt"],"availableAt":current,
                "marketEvidenceDigest":decision["marketEvidenceDigest"],
                "outcomeEvidenceDigest":observed["digest"],
                "returnPctSpotOnly":return_pct,"grade":grade["grade"],
                "authority":"SHADOW_LEARNING_ONLY","rugVerdict":"UNDETERMINED",
                "isExecutablePnL":False,"canTrade":False,"canSign":False,
                "canBroadcast":False,"canAuthorizeLive":False,
            })
            learned+=1
        else:
            observer.append_event(state,{
                "type":"SHADOW_SPOT_CENSOR","decisionId":key,"mint":decision["mint"],
                "observedAt":current,"availableAt":current,
                "reason":outcome,"grade":"UNSCORED",
                "authority":"SHADOW_LEARNING_ONLY","rugVerdict":"UNDETERMINED",
                "isExecutablePnL":False,"canTrade":False,"canSign":False,
                "canBroadcast":False,"canAuthorizeLive":False,
            })
            censored+=1
    observer.audit(state)
    ds,gs=existing(state)
    return {"status":"RUNNING","newNoTradeDecisions":added,
            "newSpotOnlyGrades":learned,"newCensors":censored,
            "sealedNoTradeDecisions":len(ds),
            "scoredSpotOnlyGrades":sum(e["type"]=="SHADOW_SPOT_GRADE" for e in gs.values()),
            "censoredGrades":sum(e["type"]=="SHADOW_SPOT_CENSOR" for e in gs.values()),
            "canTrade":False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    args=p.parse_args()
    path=pathlib.Path(args.state)
    state=json.loads(path.read_text())
    result=reconcile(state,observer.now_utc())
    observer.write_json(path,state)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":
    main()
