#!/usr/bin/env python3
"""Final 7-day SHARK research audit; no made-up results or live-money certification.

Only emits final artifact after true October 20 UTC cutoff AND immutable ledger
records COMPLETED/END. Does not rewrite the observation ledger or strategy.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import pathlib

HERE=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location("shark_obs",HERE/"experiment_7day.py")
obs=importlib.util.module_from_spec(spec);spec.loader.exec_module(obs)
FINAL_NAME="final-evaluation.md"


def build(state:dict,now:str)->dict:
    obs.audit(state)
    current=obs.timestamp(now)
    if current < obs.timestamp(obs.END):
        return {"status":"NOT_MATURE","final":False,"eligible":False}
    if state.get("status")!="COMPLETED" or not any(e.get("type")=="END" for e in state["events"]):
        return {"status":"AWAITING_COMPLETED_LEDGER","final":False,"eligible":False}
    cycles=[e for e in state["events"] if e.get("type")=="CYCLE"]
    markets=[e for e in state["events"] if e.get("type")=="MARKET_OBSERVATION"]
    warning_events=[e for e in markets if any(f.startswith(("PRICE_COLLAPSE","SUSPECTED_LIQUIDITY"))
                                                for f in e.get("flags",[]))]
    decisions=[e for e in state["events"] if e.get("type")=="SHADOW_NO_TRADE_DECISION"]
    grades=[e for e in state["events"] if e.get("type")=="SHADOW_SPOT_GRADE"]
    censors=[e for e in state["events"] if e.get("type")=="SHADOW_SPOT_CENSOR"]
    guards=[e for e in state["events"] if e.get("type")=="SHARK_MONEY_PAPER_GUARD"]
    pool=[e for e in state["events"] if e.get("type")=="POOL_VAULT_PROBE"]
    quotes=[e for e in state["events"] if e.get("type")=="JUPITER_ROUTE_DIAGNOSTIC"]
    marks=[c["first24hMark"] for c in state["cases"].values() if c.get("first24hMark")]
    up=sum(m["up"] is True for m in marks)
    down=len(marks)-up
    mints=set(e["mint"] for e in warning_events)
    unscored=sum(c.get("first24hMark") is None for c in state["cases"].values())
    bad_eligibility=any(e.get("canTrade") is not False for e in
        state["events"] if e.get("type") in
        {"SHADOW_NO_TRADE_DECISION","SHARK_MONEY_PAPER_GUARD","POOL_VAULT_PROBE"})
    if bad_eligibility:raise ValueError("trade_authority_found_in_research_receipt")
    decision_ids=[e["decisionId"] for e in decisions]
    if len(decision_ids)!=len(set(decision_ids)):raise ValueError("duplicate_shadow_decision")
    grade_ids=[e["decisionId"] for e in grades+censors]
    if len(grade_ids)!=len(set(grade_ids)):raise ValueError("duplicate_shadow_outcome")
    if not set(grade_ids).issubset(set(decision_ids)):raise ValueError("unlinked_shadow_outcome")
    if len(decision_ids)<len(grade_ids):raise ValueError("more_outcomes_than_decisions")
    times=sorted(obs.timestamp(e["availableAt"]) for e in cycles)
    gaps=[int((b-a).total_seconds()) for a,b in zip(times,times[1:])]
    # GitHub scheduling is best effort; these include user-triggered push runs.
    # 336 scheduled half-hour slots in seven days is only a planning reference.
    return {
        "status":"RESEARCH_WINDOW_CLOSED_NOT_TRADING_CERTIFIED",
        "final":True,"eligible":True,"experimentId":obs.ID,
        "windowStart":obs.START,"windowEnd":obs.END,
        "cycleCount":len(cycles),
        "firstCycleAt":cycles[0]["availableAt"] if cycles else None,
        "lastCycleAt":cycles[-1]["availableAt"] if cycles else None,
        "longestObservedGapSeconds":max(gaps) if gaps else None,
        "approximatePlannedSlotsAtTwoPerHour":336,
        "marketObservations":len(markets),
        "distinctCandidates":len(state.get("seenMints",state["candidateMints"])),
        "cases":len(state["cases"]),
        "baseline24hMarks":len(marks),
        "baseline24hUp":up,"baseline24hNonUp":down,
        "baselineUpRate":round(up/len(marks),6) if marks else None,
        "baselineUnscoredCases":unscored,
        "baselineCensoredPairSwitch":sum(c.get("baselineClass")=="CENSORED_PAIR_SWITCH" for c in state["cases"].values()),
        "shadowSealedDecisions":len(decisions),
        "shadowObservedGrades":len(grades),
        "shadowCensored":len(censors),
        "shadowUnresolved":len(decisions)-len(grades)-len(censors),
        "shadowMissedSpotUp":sum(e.get("grade")=="MISSED_SPOT_UP_MOVE" for e in grades),
        "shadowAvoidedSpotNonUp":sum(e.get("grade")=="AVOIDED_SPOT_NON_UP_MOVE" for e in grades),
        "severeWarningObservationsNotRugLabels":len(warning_events),
        "distinctMintsWithMarketWarning":len(mints),
        "confirmedRugs":None,"falsePositiveRate":None,
        "poolVaultPartialSnapshots":sum(e.get("status")=="ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED" for e in pool),
        "poolVaultUnavailable":sum(e.get("status")!="ONCHAIN_VAULT_BALANCES_PARTIAL_UNVERIFIED" for e in pool),
        "indicativeRouteObservations":len(quotes),
        "governedMoneyAbstentions":len(guards),
        "paperFills":0,"realTrades":0,
        "canTrade":False,"canSign":False,"canBroadcast":False,
        "ledgerHead":state["lastDigest"],
    }


def render(result:dict)->str:
    if not result.get("final"):raise ValueError("not_an_actual_final_result")
    r=result
    rate="unavailable" if r["baselineUpRate"] is None else f'{r["baselineUpRate"]*100:.2f}%'
    gap="unavailable" if r["longestObservedGapSeconds"] is None else str(r["longestObservedGapSeconds"])
    return (
        "# Jhadina SHARK — final seven-day evidence audit\n\n"
        f'Window: {r["windowStart"]} to {r["windowEnd"]} (UTC)\n\n'
        "**Research collection closed; NOT certified as a sniper or live-money trader.**\n\n"
        f'- Real observed polling cycles: {r["cycleCount"]}, first/last: '
        f'{r["firstCycleAt"]} / {r["lastCycleAt"]}\n'
        f'- Longest observed gap (seconds): {gap}; planned twice-hourly slots: '
        f'{r["approximatePlannedSlotsAtTwoPerHour"]} (not a verified cron success count)\n'
        f'- Discovery candidates: {r["distinctCandidates"]}; market snapshots: {r["marketObservations"]}\n'
        f'- First-price cases: {r["cases"]}; genuine 24h marks: {r["baseline24hMarks"]}; '
        f'up/non-up: {r["baseline24hUp"]}/{r["baseline24hNonUp"]}; naive up-rate: {rate}\n'
        f'- Unscored first-price cases: {r["baselineUnscoredCases"]}; pair-switch censored: '
        f'{r["baselineCensoredPairSwitch"]}\n'
        f'- Prospective NO_TRADE Shadow decisions: {r["shadowSealedDecisions"]}; '
        f'graded/censored/unresolved: {r["shadowObservedGrades"]}/'
        f'{r["shadowCensored"]}/{r["shadowUnresolved"]}\n'
        f'- Shadow missed spot up / avoided non-up: {r["shadowMissedSpotUp"]}/'
        f'{r["shadowAvoidedSpotNonUp"]}; price-only counterfactual labels\n'
        f'- Severe market warnings (NOT proven rugs): {r["severeWarningObservationsNotRugLabels"]}; '
        f'distinct addresses: {r["distinctMintsWithMarketWarning"]}\n'
        '- Verified confirmed rugs / false-positive rate: **UNKNOWN / UNSCORED**\n'
        f'- Partial onchain DEX pool/vault balance snapshots: {r["poolVaultPartialSnapshots"]}; '
        f'unavailable: {r["poolVaultUnavailable"]}\n'
        f'- Indicative Jupiter route evidence: {r["indicativeRouteObservations"]}; '
        f'fail-closed Money refusals: {r["governedMoneyAbstentions"]}\n'
        '- Paper fills / real trades / charges: **0 / 0 / none initiated by workflow**\n\n'
        "## Certification limitations\n\n"
        "The experiment uses public DEX profile/boost discovery and best-effort GitHub "
        "scheduled collection. No executable P&L, LP lock ownership, verified sellability, "
        "identity/holder independence, permissioned Money Core entry, complete launch stream, "
        "independently adjudicated confirmed rug, or statistically valid strategy edge "
        "has been proved. Missing/pair-switched outcomes stay censored. "
        "Do not self-promote strategy weights or grant trade authority.\n\n"
        f'Immutable-style Git hash-linked ledger head: \x60{r["ledgerHead"]}\x60\n'
    )


def finalize(state_path:pathlib.Path,out_path:pathlib.Path,now:str)->dict:
    state=json.loads(state_path.read_text())
    result=build(state,now)
    if result["final"]:
        out_path.parent.mkdir(parents=True,exist_ok=True)
        out_path.write_text(render(result))
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True)
    p.add_argument("--out",required=True)
    a=p.parse_args()
    result=finalize(pathlib.Path(a.state),pathlib.Path(a.out),obs.now_utc())
    print(json.dumps(result,sort_keys=True))


if __name__=="__main__":main()
