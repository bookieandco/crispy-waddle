"""WATCHKEEPER.13 — bind actual hash-chained Jupiter quote + reverse diagnostics.

Jupiter's read-only GET quote cannot prove same-pool routing, an executable
token sale, transfer-tax sufficiency, transaction success or a real fill.
Do not transform the provider's routeVerified=false into true.
"""
from __future__ import annotations
import argparse
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
HERE=Path(__file__).resolve().parent
def module(name):
    sp=importlib.util.spec_from_file_location("wk13_"+name,HERE/(name+".py"))
    m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);return m
obs=module("experiment_7day")
forward=module("quote_probe")
reverse=module("reverse_quote_probe")
dual=module("dual_rpc_pool_observer")
SCHEMA="SHARK-TWO-SIDED-QUOTE-13"
MAX_ATOMS=(1<<64)-1
MAX_LAG_SECONDS=120
def atoms(value,name):
    if not isinstance(value,str) or not value.isascii() or not value.isdecimal():
        raise ValueError("wk13_"+name+"_integer_atoms_required")
    number=int(value)
    if not 0<number<=MAX_ATOMS:
        raise ValueError("wk13_"+name+"_atoms_outside_bounds")
    return number
def safe_record(value):
    if value.get("authority")!="RESEARCH_ONLY" or any(value.get(k) is not False for k in ("canTrade","canSign","canBroadcast","routeVerified")):
        raise ValueError("wk13_route_authority_escalation")
    if value.get("source")!="jupiter_v2_public_get_order_quote_only":
        raise ValueError("wk13_source_unrecognized")

def evaluate(state:dict,cycle_digest:str,asof:str,dual_snapshot:dict|None=None):
    obs.audit(state)
    cutoff=obs.timestamp(asof)
    if not isinstance(cycle_digest,str) or len(cycle_digest)!=64:
        raise ValueError("wk13_cycle_digest_invalid")
    cycle=[e for e in state["events"] if e.get("type")=="CYCLE" and e.get("digest")==cycle_digest]
    if len(cycle)!=1:raise ValueError("wk13_unknown_cycle")
    if obs.timestamp(cycle[0]["availableAt"])>cutoff:raise ValueError("wk13_future_cycle")
    buys=[e for e in state["events"] if e.get("type")=="JUPITER_ROUTE_DIAGNOSTIC"
        and e.get("cycleDigest")==cycle_digest]
    sells=[e for e in state["events"] if e.get("type")=="JUPITER_REVERSE_ROUTE_DIAGNOSTIC"
        and e.get("cycleDigest")==cycle_digest]
    if len(buys)>1 or len(sells)>1:raise ValueError("wk13_multiple_routes_same_cycle")
    result={
        "schema":SCHEMA,"status":"NO_TWO_SIDED_EVIDENCE","reasonCodes":[],
        "experimentId":obs.ID,"cycleDigest":cycle_digest,
        "asOf":asof,"sourceLedgerHead":state["lastDigest"],
        "sourceQuoteDigests":[],"mint":None,
        "forwardInputSolAtoms":None,"forwardOutputTokenAtoms":None,
        "reverseInputTokenAtoms":None,"reverseOutputSolAtoms":None,
        "quotedRoundTripSolRatio":None,"quotedRoundTripChangeBps":None,
        "quoteTimelinessVerified":False,"singlePoolRouteVerified":False,
        "priceImpactIndependentlyVerified":False,
        "transferRestrictionsVerified":False,"sellabilityVerified":False,
        "simulatedSwapSuccessVerified":False,"actualFillVerified":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False}
    if not buys or not sells:
        result["reasonCodes"]=["BUY_OR_REVERSE_ROUTE_MISSING"]
        result["receiptDigest"]=obs.hashlib.sha256(obs.canonical(result)).hexdigest()
        return result
    a,b=buys[0],sells[0]
    safe_record(a);safe_record(b)
    if a.get("status")!=forward.STATUS_OK or b.get("status")!="INDICATIVE_REVERSE_ROUTE_ONLY":
        result["reasonCodes"]=["UNAVAILABLE_OR_UNVERIFIED_DIRECTION"]
        result["receiptDigest"]=obs.hashlib.sha256(obs.canonical(result)).hexdigest()
        return result
    if a.get("inputMint")!=forward.SOL or a.get("mint")!=a.get("outputMint") or b.get("mint")!=a.get("mint"):
        raise ValueError("wk13_mint_identity_mismatch")
    if b.get("forwardRouteDigest")!=a.get("digest"):
        raise ValueError("wk13_forward_reverse_digest_mismatch")
    in_sol=atoms(a.get("inputAtoms"),"buy_input")
    out_token=atoms(a.get("outputAtoms"),"buy_output")
    reverse_in=atoms(b.get("inputTokenAtoms"),"reverse_input")
    reverse_out=atoms(b.get("outputSolAtoms"),"reverse_output")
    if reverse_in!=out_token:
        raise ValueError("wk13_reverse_amount_unreconciled")
    x=obs.timestamp(a["availableAt"]);y=obs.timestamp(b["availableAt"])
    if not obs.timestamp(cycle[0]["availableAt"])<=x<=y<=cutoff or (y-x).total_seconds()>MAX_LAG_SECONDS or (cutoff-y).total_seconds()>MAX_LAG_SECONDS:
        raise ValueError("wk13_quote_future_or_stale")
    if b.get("isSellabilityProven") is not False or a.get("isFill") is not False:
        raise ValueError("wk13_fabricated_route_claim")
    if dual_snapshot is not None:
        if not isinstance(dual_snapshot,dict) or dual_snapshot.get("schema")!=dual.SCHEMA or dual_snapshot.get("receiptDigest")!=dual.single.sha({k:v for k,v in dual_snapshot.items() if k!="receiptDigest"}):
            raise ValueError("wk13_unverified_pool_snapshot")
        if dual_snapshot.get("mint")!=a["mint"] or obs.timestamp(dual_snapshot["asOf"])>cutoff:
            raise ValueError("wk13_pool_mint_or_future_mismatch")
        if dual_snapshot.get("canEnterPaper") is not False or dual_snapshot.get("actualFillVerified") is not False:
            raise ValueError("wk13_pool_authority_escalated")
    ratio=Decimal(reverse_out)/Decimal(in_sol)
    bps=(ratio-1)*Decimal(10000)
    result.update({
        "status":"TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE",
        "reasonCodes":["POOL_ROUTE_UNIDENTIFIED","TOKEN_TRANSFER_FEES_UNVERIFIED",
                       "NO_TRANSACTION_SIMULATION","SAME_AGGREGATOR_SOURCE_NOT_INDEPENDENT"],
        "mint":a["mint"],"sourceQuoteDigests":[a["digest"],b["digest"]],
        "forwardInputSolAtoms":str(in_sol),"forwardOutputTokenAtoms":str(out_token),
        "reverseInputTokenAtoms":str(reverse_in),"reverseOutputSolAtoms":str(reverse_out),
        "quotedRoundTripSolRatio":str(ratio.quantize(Decimal("0.00000001"))),
        "quotedRoundTripChangeBps":str(bps.quantize(Decimal("0.01"))),
        "quoteTimelinessVerified":True,
        "sourcePoolConsistencyReceipt":dual_snapshot["receiptDigest"] if dual_snapshot is not None else None
    })
    result["receiptDigest"]=obs.hashlib.sha256(obs.canonical(result)).hexdigest()
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True);p.add_argument("--cycle-digest",required=True)
    p.add_argument("--asof",required=True);p.add_argument("--dual-snapshot")
    p.add_argument("--out",required=True)
    a=p.parse_args();dest=Path(a.out)
    if dest.exists():raise ValueError("wk13_no_overwrite")
    state=json.loads(Path(a.state).read_text(encoding="utf-8"))
    snap=json.loads(Path(a.dual_snapshot).read_text(encoding="utf-8")) if a.dual_snapshot else None
    report=evaluate(state,a.cycle_digest,a.asof,snap)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(report["status"])
if __name__=="__main__":main()
