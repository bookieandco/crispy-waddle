#!/usr/bin/env python3
"""Independent GitHub-side observation availability guard, no paid provider.

Runs on trusted main against data-only state, not a full DEX availability oracle.
Never auto-patches observations, backfills gaps, triggers trades or declares rugs.
"""
import argparse
import importlib.util
import json
import pathlib

HERE=pathlib.Path(__file__).parent
sp=importlib.util.spec_from_file_location("meme_experiment",HERE/"experiment_7day.py")
obs=importlib.util.module_from_spec(sp);sp.loader.exec_module(obs)
MAX_CYCLE_STALENESS_SECONDS=7200
END_GRACE_SECONDS=7200


def check(state:dict,now:str,final_exists:bool=False)->dict:
    obs.audit(state)
    clock=obs.timestamp(now)
    start=obs.timestamp(obs.START)
    end=obs.timestamp(obs.END)
    if clock<start:
        return {"status":"PRE_START","alert":False,"canTrade":False}
    cycles=[e for e in state["events"] if e.get("type")=="CYCLE"]
    if clock>=end:
        if clock<end+__import__("datetime").timedelta(seconds=END_GRACE_SECONDS):
            if (state.get("status")=="COMPLETED" and
                any(e.get("type")=="END" for e in state["events"]) and final_exists):
                return {"status":"FINALIZED","alert":False,"canTrade":False}
            return {"status":"AWAITING_CUTOFF_LEDGER_AND_FINALIZER","alert":False,"canTrade":False}
        if (state.get("status")=="COMPLETED" and
            any(e.get("type")=="END" for e in state["events"]) and final_exists):
            return {"status":"FINALIZED","alert":False,"canTrade":False}
        return {"status":"CUTOFF_NOT_FINALIZED","alert":True,
                "reason":"NO_END_OR_FINAL_REPORT_AFTER_GRACE","canTrade":False}
    if not cycles:
        if (clock-start).total_seconds()>MAX_CYCLE_STALENESS_SECONDS:
            return {"status":"NO_CYCLES_TOO_LONG","alert":True,"canTrade":False}
        return {"status":"AWAITING_FIRST_CYCLE","alert":False,"canTrade":False}
    newest=max(obs.timestamp(e["availableAt"]) for e in cycles)
    gap=(clock-newest).total_seconds()
    if gap < 0:raise ValueError("cycle_timestamp_from_future")
    if gap>MAX_CYCLE_STALENESS_SECONDS:
        return {"status":"COLLECTION_STALE","alert":True,
                "latestCycleAt":newest.isoformat(),"secondsSinceLatestCycle":int(gap),
                "canTrade":False}
    return {"status":"COLLECTION_HEALTHY_RECENT_CYCLE","alert":False,
            "latestCycleAt":newest.isoformat(),"secondsSinceLatestCycle":int(gap),
            "canTrade":False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    p.add_argument("--final",required=True)
    a=p.parse_args()
    state=json.loads(pathlib.Path(a.state).read_text())
    r=check(state,obs.now_utc(),pathlib.Path(a.final).is_file())
    print(json.dumps(r,sort_keys=True))
    if r["alert"]:raise SystemExit(1)


if __name__=="__main__":main()
