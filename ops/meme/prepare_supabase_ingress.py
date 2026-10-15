#!/usr/bin/env python3
"""Construct an authenticated, research-only SHARK evidence handoff.

Trusted main-branch code reads an untrusted Git *data-only* ledger, fully
validates its original SHA-256 event chain, and emits a bounded prospective
subset. Only the production scheduler's OIDC identity may submit it.
The feed does NOT establish actual token launch time, actor independence,
LP locking, token sellability, trading P&L, or Money admission.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import pathlib
import re

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("experiment_7day",HERE/"experiment_7day.py")
obs=importlib.util.module_from_spec(spec);spec.loader.exec_module(obs)
SHA=re.compile(r"^[a-f0-9]{40}$")
MAX_EVENTS=24
TYPES={"MARKET_OBSERVATION","SHARK_MONEY_PAPER_GUARD"}


def prepare(state:dict,source_commit:str,limit:int=MAX_EVENTS)->dict:
    obs.audit(state)
    if not SHA.fullmatch(source_commit):raise ValueError("source_data_commit_invalid")
    if type(limit) is not int or not 1<=limit<=MAX_EVENTS:raise ValueError("ingress_batch_limit_invalid")
    cycles=[e for e in state["events"] if e.get("type")=="CYCLE"]
    if not cycles:raise ValueError("no_real_cycle_available")
    cycle=cycles[-1]
    cycle_time=obs.timestamp(cycle["availableAt"])
    # An immutable ledger head + exact Git data commit are provenance; neither
    # independently certifies economic accuracy or creator fraud.
    observations=[]
    for e in state["events"]:
        if e.get("type") not in TYPES:continue
        if e.get("type")=="MARKET_OBSERVATION":
            if e.get("securityStatus")!="UNVERIFIED" or e.get("canTrade") is not False:
                raise ValueError("market_authority_escalated")
            if obs.timestamp(e["availableAt"])!=cycle_time:continue
            if not obs.ADDRESS.fullmatch(e.get("mint","")) or not obs.ADDRESS.fullmatch(e.get("pair","")):
                raise ValueError("market_identity_invalid")
        else:
            if e.get("disposition")!="NO_TRADE" or e.get("moneyApproval")!="ABSENT" or e.get("canTrade") is not False:
                raise ValueError("money_abstention_authority_escalated")
            if e.get("informationCutoff")!=cycle["availableAt"]:continue
            if not obs.ADDRESS.fullmatch(e.get("mint","")):raise ValueError("guard_identity_invalid")
        observations.append(e)
    # Deterministic last-N selection avoids request size surprises. Partial
    # coverage is explicitly reported; no fabricated historical backfill.
    selected=observations[-limit:]
    return {
       "version":"SHARK-PAPER-INGRESS-01",
       "experimentId":obs.ID,
       "sourceDataCommit":source_commit,
       "ledgerHeadDigest":state["lastDigest"],
       "cycleDigest":cycle["digest"],
       "cycleAvailableAt":cycle["availableAt"],
       "totalEligibleInLastCycle":len(observations),
       "partialBatch":len(observations)>len(selected),
       "authority":"RESEARCH_ONLY",
       "canTrade":False,"canSign":False,"canBroadcast":False,
       "events":selected
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    p.add_argument("--source-commit",required=True)
    p.add_argument("--out",required=True)
    args=p.parse_args()
    state=json.loads(pathlib.Path(args.state).read_text())
    output=prepare(state,args.source_commit)
    out=pathlib.Path(args.out)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(output,sort_keys=True,separators=(",",":"))+"\n")
    print(json.dumps({"cycleAt":output["cycleAvailableAt"],
                      "eligible":output["totalEligibleInLastCycle"],
                      "selected":len(output["events"]),
                      "partial":output["partialBatch"],
                      "authority":"RESEARCH_ONLY"},sort_keys=True))


if __name__=="__main__":main()
