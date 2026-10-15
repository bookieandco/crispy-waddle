"""WATCHKEEPER.10 — prospective, censored, no-fabrication research evaluation.

Generates provisional evaluations before Oct 20, 2026 22:50 UTC and
an evidence-closed *research* evaluation only after a real END ledger.
No prediction of future results, profitability, rug adjudication, trading,
wallet access, database writes, external billing or strategy promotion.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
def load(name):
    spec=importlib.util.spec_from_file_location("w10_"+name,HERE/(name+".py"))
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
obs=load("experiment_7day")
shadow=load("shadow_sealer")
existing=load("final_evaluation")
ck=load("watchkeeper_checkpoint")
journal=load("strategy_proposal_journal")
SCHEMA="SHARK-RESEARCH-EVALUATION-10"
FORBIDDEN={"EXECUTED_TRADE","ORDER_FILLED","LIVE_BUY","LIVE_SELL",
           "SIGNED_TRANSACTION","AUTHORIZED_LIVE_TRADE"}
def fraction(n,d):
    return round(n/d,6) if d>0 else None
def evaluate(state:dict,asof:str,archive_dir:Path|None=None)->dict:
    obs.audit(state)
    now=obs.timestamp(asof)
    if now<obs.timestamp(obs.START):
        raise ValueError("w10_before_experiment_start")
    if any(e.get("type") in FORBIDDEN for e in state["events"]):
        raise ValueError("w10_executable_event_in_research_log")
    # The seven-day observer is explicitly observational, no pricing
    # outcomes become executable P&L through this evaluator.
    ds,grades=shadow.existing(state)
    decisions=len(ds)
    observed=sum(x.get("type")=="SHADOW_SPOT_GRADE" for x in grades.values())
    censored=sum(x.get("type")=="SHADOW_SPOT_CENSOR" for x in grades.values())
    unresolved=decisions-observed-censored
    if unresolved<0:raise ValueError("w10_outcome_count_invalid")
    end_events=[x for x in state["events"] if x.get("type")=="END"]
    cutoff=obs.timestamp(obs.END)
    ended=(now>=cutoff and state.get("status")=="COMPLETED"
       and len(end_events)==1 and cutoff<=obs.timestamp(end_events[0]["availableAt"])<=now)
    if state.get("status")=="COMPLETED" and (len(end_events)!=1 or obs.timestamp(end_events[0]["availableAt"])<cutoff):
        raise ValueError("w10_early_or_missing_end_receipt")
    if now<cutoff and end_events:
        raise ValueError("w10_future_end_receipt_not_allowed")
    if now>=cutoff and state.get("status")=="COMPLETED" and not ended:
        raise ValueError("w10_end_receipt_not_available")
    cycles=[e for e in state["events"] if e.get("type")=="CYCLE"]
    markets=[e for e in state["events"] if e.get("type")=="MARKET_OBSERVATION"]
    guards=[e for e in state["events"] if e.get("type")=="SHARK_MONEY_PAPER_GUARD"]
    buy_quotes=[e for e in state["events"] if e.get("type")=="JUPITER_ROUTE_DIAGNOSTIC"]
    reverse_quotes=[e for e in state["events"] if e.get("type")=="JUPITER_REVERSE_ROUTE_DIAGNOSTIC"]
    pool=[e for e in state["events"] if e.get("type")=="POOL_VAULT_PROBE"]
    marked=[case.get("first24hMark") for case in state["cases"].values() if case.get("first24hMark") is not None]
    unscored=sum(case.get("first24hMark") is None for case in state["cases"].values())
    switch=sum(case.get("baselineClass")=="CENSORED_PAIR_SWITCH" for case in state["cases"].values())
    times=sorted(obs.timestamp(e["availableAt"]) for e in cycles)
    gaps=[int((b-a).total_seconds()) for a,b in zip(times,times[1:])]
    confirmed_bad=any(e.get("canTrade") is not False for e in guards)
    if confirmed_bad:raise ValueError("w10_money_guard_authority")
    warnings=sum(any(str(flag).startswith(("PRICE_COLLAPSE","SUSPECTED_LIQUIDITY"))
        for flag in e.get("flags",[])) for e in markets)
    spot_up=sum(x.get("grade")=="MISSED_SPOT_UP_MOVE" for x in grades.values())
    spot_nonup=sum(x.get("grade")=="AVOIDED_SPOT_NON_UP_MOVE" for x in grades.values())
    if spot_up+spot_nonup!=observed:
        raise ValueError("w10_unknown_spot_grade")
    if archive_dir is None:
        archived="NOT_CONFIGURED"
        local_head=None
    else:
        chain=ck.load(archive_dir)
        local_head=ck.audit(archive_dir,chain)
        archived=("LOCAL_SNAPSHOT_MATCHES_CURRENT_HEAD" if chain and
            chain[-1]["receipt"]["sourceHead"]==state["lastDigest"] else "MISSING_OR_STALE_LOCAL_SNAPSHOT")
    result={
        "schema":SCHEMA,"experimentId":obs.ID,"asOf":asof,
        "windowStart":obs.START,"windowEnd":obs.END,
        "status":"FINAL_RESEARCH_NOT_EXECUTION_CERTIFIED" if ended else
                 "PROVISIONAL_MISSING_OR_IMMATURE_EVIDENCE",
        "final":ended,"researchOnly":True,
        "ledgerHead":state["lastDigest"],
        "ledgerStatus":state.get("status"),"endReceiptPresent":len(end_events)>0,
        "pollingCycles":len(cycles),"marketObservations":len(markets),
        "distinctCandidates":len(state.get("seenMints",state["candidateMints"])),
        "longestObservedGapSeconds":max(gaps) if gaps else None,
        "plannedHalfHourSlotsReference":336,
        "schedulerRunsIndependentlyWitnessed":False,
        "baselineCases":len(state["cases"]),"baselineObserved24h":len(marked),
        "baselineUnscored":unscored,"pairSwitchCensored":switch,
        "baseline24hObservationCoverage":fraction(len(marked),len(state["cases"])),
        "shadowDecisions":decisions,"shadowObservedSpotOnly":observed,
        "shadowCensored":censored,"shadowUnresolved":unresolved,
        "shadowSpotOnlyCoverage":fraction(observed,decisions),
        "shadowSpotOnlyUp":spot_up,"shadowSpotOnlyNonUp":spot_nonup,
        "shadowPriceDirectionRatio":fraction(spot_up,observed),
        "marketWarningObservationsNotConfirmedRugs":warnings,
        "moneyCoreRefusals":len(guards),"partialOrUnavailablePoolSnapshots":len(pool),
        "indicativeBuyRouteObservations":len(buy_quotes),
        "indicativeSellRouteObservations":len(reverse_quotes),
        "actualFillsVerified":0,"verifiedPaperFills":0,
        "netTradingReturn":None,"maxDrawdown":None,"sharpeRatio":None,
        "confirmedRugCount":None,"rugFalsePositiveRate":None,
        "verifiedExitSellabilityCoverage":None,
        "strategyPromotionEligible":False,"independentlySealedForwardStudy":False,
        "localCheckpointStatus":archived,"localCheckpointJournalHead":local_head,
        "independentArchiveRestoreVerified":False,
        "postgresColdRestoreVerified":False,"ownerSignatureVerified":False,
        "authority":"RESEARCH_ONLY","canTrade":False,"canSign":False,
        "canBroadcast":False,"canAuthorizeLive":False,
        "canRewriteRules":False}
    if ended:
        prior=existing.build(state,asof)
        if prior.get("final") is not True:
            raise ValueError("w10_legacy_final_not_ready")
        if prior["paperFills"]!=0 or prior["realTrades"]!=0 or prior["ledgerHead"]!=state["lastDigest"]:
            raise ValueError("w10_final_prior_audit_mismatch")
    result["receiptDigest"]=journal.digest(result)
    return result
def render(result):
    if result.get("schema")!=SCHEMA or result.get("receiptDigest")!=journal.digest({k:v for k,v in result.items() if k!="receiptDigest"}):
        raise ValueError("w10_result_digest_invalid")
    line=lambda name,x:f"- {name}: **{x if x is not None else 'UNKNOWN / UNSCORED'}**"
    return "\n".join([
        "# Jhadina SHARK — WATCHKEEPER.10 evidence review",
        "",
        "**"+result["status"]+"**",
        "Window: "+result["windowStart"]+" to "+result["windowEnd"]+" UTC",
        "As-of: "+result["asOf"]+" (UTC)",
        "No real or independently certified paper orders; spot outcomes not executable P&L.",
        "",
        line("Market cycles",result["pollingCycles"]),
        line("Distinct candidate mints",result["distinctCandidates"]),
        line("Observed longest gap (seconds)",result["longestObservedGapSeconds"]),
        line("Baseline 24h price-only marks",result["baselineObserved24h"]),
        line("Baseline unscored/censored",result["baselineUnscored"]),
        line("Pair-switch censored",result["pairSwitchCensored"]),
        line("Shadow spot-only graded/censored/unresolved",
             str(result["shadowObservedSpotOnly"])+"/"+str(result["shadowCensored"])+"/"+str(result["shadowUnresolved"])),
        line("Confirmed rugs / false-positive rate",None),
        line("Verified profitable execution",None),
        line("Verified paper fills",result["verifiedPaperFills"]),
        line("Net trading return / drawdown / Sharpe",None),
        line("Local archive status",result["localCheckpointStatus"]),
        "",
        "Only a valid post-cutoff END receipt can make this a final **research** audit.",
        "No automated strategy promotion, signing, money, or cloud restore verification.",
        "",
        "Research checksum: "+result["receiptDigest"],""
    ])
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    p.add_argument("--asof",required=True)
    p.add_argument("--archive-dir")
    p.add_argument("--out",required=True)
    args=p.parse_args()
    out=Path(args.out)
    if out.exists() or out.resolve()==Path(args.state).resolve():
        raise ValueError("w10_overwrite_forbidden")
    result=evaluate(json.loads(Path(args.state).read_text(encoding="utf-8")),
      args.asof,Path(args.archive_dir) if args.archive_dir else None)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(render(result),encoding="utf-8")
    print(json.dumps({"status":result["status"],"final":result["final"],
        "verifiedPaperFills":0,"strategyPromotionEligible":False}))
if __name__=="__main__":
    main()
