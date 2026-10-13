#!/usr/bin/env python3
"""One no-wallet, no-key, GET-only Jupiter V2 route feasibility observation.

Even a successful quote is INDICATIVE, NOT an executable fill and not
independent proof that a token is safe/sellable. Never POST, sign, trade, or
create transactions. Provider auth/rate limits fail closed without costs.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("quote_observer",HERE/"experiment_7day.py")
obs=importlib.util.module_from_spec(spec)
spec.loader.exec_module(obs)

JUPITER_QUOTE_URL="https://api.jup.ag/swap/v2/order"
SOL="So11111111111111111111111111111111111111112"
INPUT_ATOMS=10000000  # 0.01 wrapped SOL, strictly observational
STATUS_OK="INDICATIVE_ROUTING_ONLY_NOT_EXECUTABLE"
STATUS_UNAVAILABLE="ROUTE_UNAVAILABLE_OR_KEY_REQUIRED"
MAX_RESPONSE=90000


def read_quote(output_mint:str,opener=urllib.request.urlopen)->dict:
    if not isinstance(output_mint,str) or not obs.ADDRESS.fullmatch(output_mint) or output_mint==SOL:
        raise ValueError("quote_mint_invalid")
    url=JUPITER_QUOTE_URL+"?"+urllib.parse.urlencode({
        "inputMint":SOL,"outputMint":output_mint,"amount":str(INPUT_ATOMS)
    })
    req=urllib.request.Request(url,headers={
        "Accept":"application/json","User-Agent":"JhadinaResearchOnly/1.0"
    },method="GET")
    try:
        with opener(req,timeout=12) as response:
            if response.status!=200:
                raise ValueError("quote_http_unavailable")
            raw=response.read(MAX_RESPONSE+1)
        if len(raw)>MAX_RESPONSE:
            raise ValueError("quote_payload_too_large")
        data=json.loads(raw)
        if not isinstance(data,dict):
            raise ValueError("quote_shape_invalid")
        output=data.get("outAmount")
        if not isinstance(output,str) or not output.isdecimal() or int(output)<=0:
            raise ValueError("no_usable_route")
        if data.get("transaction") not in (None,""):
            # Do not capture/forward unsigned transaction bytes. No wallet was
            # submitted, so an unexpected transaction cannot count as route proof.
            raise ValueError("unexpected_transaction_content")
        fees=data.get("feeBps")
        if fees is not None and (isinstance(fees,bool) or not isinstance(fees,int) or fees<0 or fees>10000):
            raise ValueError("quote_fee_invalid")
        router=data.get("router")
        if router is not None and router not in ("metis","jupiterz","dflow","okx"):
            raise ValueError("quote_router_invalid")
        return {
            "status":STATUS_OK,"inputMint":SOL,"inputAtoms":str(INPUT_ATOMS),
            "outputMint":output_mint,"outputAtoms":output,
            "router":router,"feeBps":fees,
            "source":"jupiter_v2_public_get_order_quote_only",
            "routeVerified":False,"isFill":False,"canTrade":False,
            "canSign":False,"canBroadcast":False,
        }
    except (ValueError,TypeError,KeyError,urllib.error.URLError,OSError,json.JSONDecodeError):
        return {
            "status":STATUS_UNAVAILABLE,"inputMint":SOL,"inputAtoms":str(INPUT_ATOMS),
            "outputMint":output_mint,
            "source":"jupiter_v2_public_get_order_quote_only",
            "routeVerified":False,"isFill":False,"canTrade":False,
            "canSign":False,"canBroadcast":False,
        }


def reconcile(state:dict,current:str,provider=read_quote)->dict:
    obs.audit(state)
    obs.timestamp(current)
    if not(obs.timestamp(obs.START)<=obs.timestamp(current)<obs.timestamp(obs.END)):
        return {"status":"OUTSIDE_EXPERIMENT_WINDOW","newQuotes":0}
    cycles=[e for e in state["events"] if e["type"]=="CYCLE"]
    if not cycles:
        return {"status":"NO_MARKET_CYCLES","newQuotes":0}
    cycle=cycles[-1]
    already=any(e["type"]=="JUPITER_ROUTE_DIAGNOSTIC"
                and e.get("cycleDigest")==cycle["digest"] for e in state["events"])
    if already:
        return {"status":"ALREADY_RECORDED","newQuotes":0}
    minted=[e["mint"] for e in state["events"] if e["type"]=="SHADOW_NO_TRADE_DECISION"
            and e["availableAt"]>=cycle["availableAt"] and e["mint"]!=SOL]
    if not minted:
        return {"status":"NO_SEALED_PROSPECTIVE_CANDIDATE","newQuotes":0}
    candidate=minted[0]
    report=provider(candidate)
    if report.get("canTrade") is not False or report.get("routeVerified") is not False:
        raise ValueError("route_provider_claimed_trade_authority")
    obs.append_event(state,{
        "type":"JUPITER_ROUTE_DIAGNOSTIC",
        "observedAt":current,"availableAt":current,
        "cycleDigest":cycle["digest"],"mint":candidate,
        "authority":"RESEARCH_ONLY",**report
    })
    obs.audit(state)
    return {"status":report["status"],"newQuotes":1,
            "routeVerified":False,"tradesPlaced":0,"canTrade":False}


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    args=p.parse_args()
    f=pathlib.Path(args.state)
    state=json.loads(f.read_text())
    result=reconcile(state,obs.now_utc())
    obs.write_json(f,state)
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":
    main()
