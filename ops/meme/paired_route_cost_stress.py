"""WATCHKEEPER.14 — bounded incremental cost stress around .13 two-way quotes.

A Jupiter quote contains unknown embedded route fees/price impacts. Therefore
this model does not identify those components or claim independent executable
prices. Stress assumptions may overlap with quote-embedded costs: keep
separate, label hypothetical, and never count as profit or certified fills.
For independently attested direct constant-product pools use the existing
dex_cost_benchmark.py instead; aggregated Jupiter route != direct pool.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from pathlib import Path
HERE=Path(__file__).resolve().parent
def load(name):
    sp=importlib.util.spec_from_file_location("wk14_"+name,HERE/(name+".py"))
    mod=importlib.util.module_from_spec(sp);sp.loader.exec_module(mod);return mod
pair=load("paired_route_evidence")
cost=load("dex_cost_benchmark")
SCHEMA="SHARK-ROUTE-COST-STRESS-14"
FIELDS={"schema","solUsdAssumption","networkLamportsPerLeg",
 "priorityLamportsPerLeg","extraDexFeeBpsPerLeg","transferFeeBpsPerLeg",
 "extraSlippageBpsPerLeg","extraImpactBpsPerLeg","authority",
 "canTrade","canSign","canBroadcast"}
def decimal(raw,name,lo,hi):
    if not isinstance(raw,str):raise ValueError("wk14_"+name+"_string_required")
    try:d=Decimal(raw)
    except InvalidOperation as exc:raise ValueError("wk14_"+name+"_invalid") from exc
    if not d.is_finite() or not Decimal(lo)<=d<=Decimal(hi):
        raise ValueError("wk14_"+name+"_out_of_range")
    return d
def inputs(stress:dict):
    if not isinstance(stress,dict) or set(stress)!=FIELDS or stress["schema"]!=SCHEMA:
        raise ValueError("wk14_assumptions_schema_invalid")
    if stress["authority"]!="RESEARCH_ONLY" or any(stress[x] is not False for x in ("canTrade","canSign","canBroadcast")):
        raise ValueError("wk14_trade_authority_invalid")
    price=decimal(stress["solUsdAssumption"],"sol_price","0.00001","1000000")
    network=cost.uint(stress["networkLamportsPerLeg"],"wk14_network",positive=False)
    priority=cost.uint(stress["priorityLamportsPerLeg"],"wk14_priority",positive=False)
    if network+priority>10_000_000:
        raise ValueError("wk14_network_cost_bound_exceeded")
    stress_components={k:decimal(stress[k],k,"0","3000") for k in
        ("extraDexFeeBpsPerLeg","transferFeeBpsPerLeg",
         "extraSlippageBpsPerLeg","extraImpactBpsPerLeg")}
    if sum(stress_components.values())>=Decimal("5000"):
        raise ValueError("wk14_stress_assumptions_excessive")
    return price,network,priority,stress_components

def model(route:dict,assumptions:dict)->dict:
    sol_price,network,priority,components=inputs(assumptions)
    if not isinstance(route,dict) or route.get("schema")!=pair.SCHEMA:
        raise ValueError("wk14_route_receipt_required")
    if route.get("receiptDigest")!=pair.obs.hashlib.sha256(
            pair.obs.canonical({k:v for k,v in route.items() if k!="receiptDigest"})).hexdigest():
        raise ValueError("wk14_route_digest_invalid")
    if route.get("authority")!="RESEARCH_ONLY" or any(route.get(k) is not False for k in
        ("canTrade","canSign","canBroadcast","canAuthorizeLive","sellabilityVerified","singlePoolRouteVerified","actualFillVerified")):
        raise ValueError("wk14_route_claims_execution")
    result={
        "schema":SCHEMA,"routeDigest":route["receiptDigest"],
        "status":"NO_FILL_ROUTE_UNVERIFIED","reasonCodes":[],
        "quotedRoundTripBps":None,"quotedRoundTripSolAtoms":None,
        "quotedNotionalUsdAssumed":None,
        "hypotheticalStressNetSolAtoms":None,
        "hypotheticalStressBps":None,
        "hypotheticalStressUsd":None,
        "estimatedExtraNetworkPriorityUsd":None,
        "incrementalStressBpsPerLeg":None,
        "embeddedAggregatorCostsIdentified":False,
        "feeScheduleIndependentlyVerified":False,
        "poolRouteIndependentlyVerified":False,
        "tokenTransferFeesVerified":False,
        "transactionSimulationVerified":False,
        "actualFillVerified":False,"certifiedPaperFills":0,
        "isExecutablePnL":False,"canScoreForwardReturn":False,
        "canAuthorizeLive":False,"authority":"RESEARCH_ONLY",
        "canTrade":False,"canSign":False,"canBroadcast":False}
    if route.get("status")!="TWO_AGGREGATOR_DIRECTIONS_INDICATIVE_NOT_EXECUTABLE":
        result["reasonCodes"]=["TWO_SIDED_QUOTE_NOT_AVAILABLE"]
        result["receiptDigest"]=pair.obs.hashlib.sha256(pair.obs.canonical(result)).hexdigest()
        return result
    if route.get("quoteTimelinessVerified") is not True or not isinstance(route.get("sourceQuoteDigests"),list) or len(route["sourceQuoteDigests"])!=2:
        raise ValueError("wk14_quote_integrity_missing")
    inp=pair.atoms(route.get("forwardInputSolAtoms"),"input")
    out=pair.atoms(route.get("reverseOutputSolAtoms"),"output")
    pair.atoms(route.get("forwardOutputTokenAtoms"),"token")
    if route.get("forwardOutputTokenAtoms")!=route.get("reverseInputTokenAtoms"):
        raise ValueError("wk14_sell_route_amount_mismatch")
    in_usd=Decimal(inp)*sol_price/Decimal(10**9)
    if in_usd>Decimal("50") or in_usd<Decimal("0.00001"):
        raise ValueError("wk14_paper_notional_out_of_bounds")
    incremental=sum(components.values())
    total_network=2*(network+priority)
    # Stress assumptions apply to estimated quoted reverse SOL, then fixed
    # network costs subtract for both hypothetical legs. Additional quote
    # impact is an *upper-bound sensitivity*, not measured transaction costs.
    retention=(Decimal("1")-incremental/Decimal(10000))**2
    scenario=max(0,(Decimal(out)*retention).to_integral_value(rounding=ROUND_DOWN)-total_network)
    round_trip=Decimal(out)/Decimal(inp)
    quoted_bps=(round_trip-1)*Decimal(10000)
    stress_bps=(scenario/Decimal(inp)-1)*Decimal(10000)
    result.update({
      "status":"HYPOTHETICAL_COST_STRESS_NO_FILL_CERTIFICATION",
      "reasonCodes":["ROUTE_NOT_BOUND_TO_SINGLE_VERIFIED_POOL",
         "UNKNOWN_QUOTE_EMBEDDED_FEES_AND_PRICE_IMPACT",
         "COST_ASSUMPTIONS_MAY_OVERLAP_QUOTE",
         "TRANSFER_FEES_UNVERIFIED","NO_SWAP_SIMULATION_OR_FILLS"],
      "quotedRoundTripBps":str(quoted_bps.quantize(Decimal("0.01"))),
      "quotedRoundTripSolAtoms":str(out),
      "quotedNotionalUsdAssumed":str(in_usd.quantize(Decimal("0.000001"))),
      "hypotheticalStressNetSolAtoms":str(int(scenario)),
      "hypotheticalStressBps":str(stress_bps.quantize(Decimal("0.01"))),
      "hypotheticalStressUsd":str((scenario*sol_price/Decimal(10**9)).quantize(Decimal("0.000001"))),
      "estimatedExtraNetworkPriorityUsd":str((Decimal(total_network)*sol_price/Decimal(10**9)).quantize(Decimal("0.000001"))),
      "incrementalStressBpsPerLeg":str(incremental),
      "assumptionsDigest":cost.hashlib.sha256(cost.json.dumps(assumptions,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    })
    result["receiptDigest"]=pair.obs.hashlib.sha256(pair.obs.canonical(result)).hexdigest()
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--paired-quote",required=True);p.add_argument("--assumptions",required=True)
    p.add_argument("--out",required=True);a=p.parse_args()
    target=Path(a.out)
    if target.exists():raise ValueError("wk14_no_overwrite")
    pqt=json.loads(Path(a.paired_quote).read_text(encoding="utf-8"))
    stress=json.loads(Path(a.assumptions).read_text(encoding="utf-8"))
    v=model(pqt,stress)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(v,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print(v["status"])
if __name__=="__main__":main()
