#!/usr/bin/env python3
"""Keyless, no-wallet, no-sign read-only reverse route lookout.

A two-way Jupiter *indicative* quote is not a sale simulation, swap success,
proof of LP ownership, or evidence of actual token sellability.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import pathlib
import urllib.parse
import urllib.request
import urllib.error

HERE=pathlib.Path(__file__).parent
def load(name):
    spec=importlib.util.spec_from_file_location(name,HERE/(name+".py"))
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
obs=load("experiment_7day")
route=load("quote_probe")
MAX_ATOMS=(1<<64)-1

def reverse_quote(mint:str,token_atoms:str,opener=urllib.request.urlopen)->dict:
    if not isinstance(mint,str) or not obs.ADDRESS.fullmatch(mint) or mint==route.SOL:
        raise ValueError("invalid_token")
    if not isinstance(token_atoms,str) or not token_atoms.isdecimal() or not (0<int(token_atoms)<=MAX_ATOMS):
        raise ValueError("invalid_buy_quoted_atoms")
    params=urllib.parse.urlencode({"inputMint":mint,"outputMint":route.SOL,"amount":token_atoms})
    req=urllib.request.Request(route.JUPITER_QUOTE_URL+"?"+params,method="GET",headers={
        "Accept":"application/json","User-Agent":"JhadinaResearchOnly/1.0"})
    try:
        with opener(req,timeout=12) as response:
            if response.status!=200:raise ValueError("http_unavailable")
            raw=response.read(90001)
        if len(raw)>90000:raise ValueError("payload_too_large")
        body=json.loads(raw)
        if not isinstance(body,dict):raise ValueError("route_shape_invalid")
        out=body.get("outAmount")
        if not isinstance(out,str) or not out.isdecimal() or int(out)<=0:
            raise ValueError("sell_route_not_found")
        if body.get("transaction") not in (None,""):
            raise ValueError("unexpected_transaction_payload")
        return {"status":"INDICATIVE_REVERSE_ROUTE_ONLY",
                "outputSolAtoms":out,"inputTokenAtoms":token_atoms,
                "source":"jupiter_v2_public_get_order_quote_only",
                "isSellabilityProven":False,"routeVerified":False,
                "canTrade":False,"canSign":False,"canBroadcast":False}
    except (ValueError,TypeError,OverflowError,OSError,urllib.error.URLError,json.JSONDecodeError):
        return {"status":"REVERSE_ROUTE_UNAVAILABLE_OR_KEY_REQUIRED",
                "inputTokenAtoms":token_atoms,
                "source":"jupiter_v2_public_get_order_quote_only",
                "isSellabilityProven":False,"routeVerified":False,
                "canTrade":False,"canSign":False,"canBroadcast":False}


def reconcile(state:dict,at:str,probe=reverse_quote)->dict:
    obs.audit(state)
    if not obs.timestamp(obs.START)<=obs.timestamp(at)<obs.timestamp(obs.END):
        return {"newReverseObservation":0,"status":"OUTSIDE_EXPERIMENT_WINDOW"}
    cycles=[x for x in state["events"] if x.get("type")=="CYCLE"]
    if not cycles:return {"newReverseObservation":0,"status":"NO_CYCLES"}
    latest=cycles[-1]
    if any(e.get("type")=="JUPITER_REVERSE_ROUTE_DIAGNOSTIC" and e.get("cycleDigest")==latest["digest"] for e in state["events"]):
        return {"newReverseObservation":0,"status":"ALREADY_PROBED"}
    forward=next((e for e in reversed(state["events"]) if
                  e.get("type")=="JUPITER_ROUTE_DIAGNOSTIC"
                  and e.get("cycleDigest")==latest["digest"]
                  and e.get("status")==route.STATUS_OK),None)
    if not forward or not isinstance(forward.get("outputAtoms"),str):
        return {"newReverseObservation":0,"status":"FORWARD_ROUTE_NOT_AVAILABLE"}
    # Never feed Jupiter a historical output amount from a different mint/cycle.
    if not obs.ADDRESS.fullmatch(forward.get("mint","")):
        return {"newReverseObservation":0,"status":"FORWARD_MINT_UNVERIFIED"}
    try:
        verdict=probe(forward["mint"],forward["outputAtoms"])
        if verdict.get("canTrade") is not False or verdict.get("isSellabilityProven") is not False or verdict.get("routeVerified") is not False:
            raise ValueError("unsafe_provider_sellability_claim")
    except (ValueError,TypeError,KeyError,OverflowError,OSError):
        verdict={"status":"REVERSE_ROUTE_UNVERIFIED","isSellabilityProven":False,
                 "routeVerified":False,"canTrade":False,"canSign":False,"canBroadcast":False}
    obs.append_event(state,{"type":"JUPITER_REVERSE_ROUTE_DIAGNOSTIC",
             "cycleDigest":latest["digest"],"forwardRouteDigest":forward["digest"],
             "mint":forward["mint"],"observedAt":at,"availableAt":at,
             "authority":"RESEARCH_ONLY",**verdict})
    obs.audit(state)
    return {"newReverseObservation":1,"status":verdict["status"],
            "isSellabilityProven":False,"canTrade":False}


def main():
    p=argparse.ArgumentParser();p.add_argument("--state",required=True);a=p.parse_args()
    f=pathlib.Path(a.state);s=json.loads(f.read_text())
    result=reconcile(s,obs.now_utc())
    obs.write_json(f,s)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":main()
