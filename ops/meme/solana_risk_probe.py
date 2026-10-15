#!/usr/bin/env python3
"""Read-only Solana mint risk evidence for the seven-day SHARK pilot.

Never certifies token safety, identifies a person, or sends a transaction.
All case records are research-only and missing data always quarantines.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).with_name("experiment_7day.py")
SPEC = importlib.util.spec_from_file_location("shark_meme_observer", ROOT)
OBSERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OBSERVER)

RPC_URLS = ("https://api.mainnet.solana.com", "https://solana-rpc.publicnode.com")
TOKEN_PROGRAMS = frozenset({
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
})
MINT_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
MAX_PROBES_PER_RUN = 1


def rpc(method: str, params: list) -> dict:
    if method not in {"getAccountInfo", "getTokenLargestAccounts"}:
        raise ValueError("disallowed_rpc_method")
    data = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": method, "params": params
    }, separators=(",", ":")).encode()
    # Both endpoints are explicitly fixed, unauthenticated and read-only.
    # Never silently fall back to a key-based or billable endpoint.
    for index, url in enumerate(RPC_URLS):
        try:
            req = urllib.request.Request(url, data=data, headers={
                "Content-Type": "application/json", "Accept": "application/json",
                "User-Agent": "JhadinaReadOnlySHARK/1.0"
            }, method="POST")
            with urllib.request.urlopen(req, timeout=12) as res:
                if res.status != 200:
                    raise ValueError("rpc_http_error")
                raw = res.read(180001)
            if len(raw) > 180000:
                raise ValueError("rpc_payload_too_large")
            value = json.loads(raw)
            if not isinstance(value, dict) or value.get("error") or not isinstance(value.get("result"), dict):
                raise ValueError("rpc_result_unverified")
            result = value["result"]
            result["_readOnlyProvider"] = "SOLANA_OFFICIAL" if index == 0 else "PUBLICNODE_FREE"
            return result
        except (urllib.error.URLError, ValueError, json.JSONDecodeError, OSError):
            if index == len(RPC_URLS) - 1:
                raise ValueError("all_public_rpc_sources_unavailable")
    raise ValueError("no_public_rpc_provider")



def verify_mint(mint: str, account: dict, largest: dict | None, available: str) -> dict:
    """Proof of *some* token metadata, NOT LP ownership, sellability, or rug status."""
    OBSERVER.timestamp(available)
    if not isinstance(mint, str) or not MINT_PATTERN.fullmatch(mint):
        raise ValueError("invalid_solana_mint")
    if not isinstance(account, dict) or not isinstance(account.get("context"), dict):
        raise ValueError("mint_missing_slot")
    slot = account["context"].get("slot")
    val = account.get("value")
    if not isinstance(slot, int) or isinstance(slot, bool) or slot < 1 or not isinstance(val, dict):
        raise ValueError("mint_account_absent")
    owner = val.get("owner")
    data = val.get("data")
    if owner not in TOKEN_PROGRAMS or not isinstance(data, dict):
        raise ValueError("mint_program_unknown")
    parsed = data.get("parsed")
    if not isinstance(parsed, dict) or parsed.get("type") != "mint" or not isinstance(parsed.get("info"), dict):
        raise ValueError("not_a_parsed_mint")
    info = parsed["info"]
    for authority in ("mintAuthority", "freezeAuthority"):
        if info.get(authority) is not None and (
            not isinstance(info[authority], str) or not MINT_PATTERN.fullmatch(info[authority])
        ):
            raise ValueError("malformed_mint_authority")
    if not isinstance(info.get("supply"), str) or not info["supply"].isdigit():
        raise ValueError("mint_supply_unknown")
    supply = int(info["supply"])
    top_accounts_fraction = None
    largest_slot = None
    if largest is not None:
        if not isinstance(largest, dict) or not isinstance(largest.get("context"), dict):
            raise ValueError("largest_accounts_context_invalid")
        largest_slot = largest["context"].get("slot")
        rows = largest.get("value")
        if not isinstance(largest_slot, int) or not isinstance(rows, list) or len(rows) > 20:
            raise ValueError("largest_accounts_invalid")
        if largest_slot < slot:
            raise ValueError("largest_accounts_stale")
        amounts = []
        for row in rows:
            if not isinstance(row, dict) or not str(row.get("amount", "")).isdigit():
                raise ValueError("largest_accounts_amount_invalid")
            amounts.append(int(row["amount"]))
        if supply > 0:
            top_accounts_fraction = round(sum(sorted(amounts, reverse=True)[:10]) / supply, 6)
            if top_accounts_fraction > 1:
                raise ValueError("largest_accounts_exceed_supply")
    flags = []
    if info["mintAuthority"] is not None:
        flags.append("MINT_AUTHORITY_ACTIVE")
    if info["freezeAuthority"] is not None:
        flags.append("FREEZE_AUTHORITY_ACTIVE")
    if top_accounts_fraction is not None and top_accounts_fraction >= .8:
        flags.append("TOP_TOKEN_ACCOUNTS_CONCENTRATED_NOT_WALLET_GRAPH")
    # Token-program parse cannot establish LP locking, sellability or independent owners.
    return {
        "mint": mint, "observedAt": available, "availableAt": available,
        "source": "solana_public_mainnet_rpc", "slot": slot,
        "readOnlyProvider": account.get("_readOnlyProvider", "TEST_OR_UNKNOWN"),
        "tokenProgram": owner, "mintAuthorityActive": info["mintAuthority"] is not None,
        "freezeAuthorityActive": info["freezeAuthority"] is not None,
        "largestAccountsSlot": largest_slot,
        "top10TokenAccountsFraction": top_accounts_fraction, "signals": flags,
        "rugVerdict": "UNDETERMINED", "status": "ONCHAIN_PARTIAL_UNVERIFIED",
        "unverified": [
            "sellability", "liquidityControl", "holderIndependence", "operatorIdentity",
            "developerHistory", "bundleDetection", "token2022_extensions"
        ],
        "canTrade": False, "canSign": False, "canBroadcast": False,
    }


def selected_mint(state: dict) -> str | None:
    mints = sorted(state["cases"])
    if not mints:
        return None
    seen = sum(e.get("type") == "SOLANA_MINT_PROBE" for e in state["events"])
    return mints[seen % len(mints)]


def probe_one(mint: str, rpc_fn=rpc) -> dict:
    if not MINT_PATTERN.fullmatch(mint):
        raise ValueError("invalid_solana_mint")
    account = rpc_fn("getAccountInfo", [mint, {"encoding": "jsonParsed", "commitment": "confirmed"}])
    # Token-largest-accounts can fail independently on a rate-limited public endpoint.
    # Never substitute synthetic holders or a price-provider claim.
    try:
        largest = rpc_fn("getTokenLargestAccounts", [mint, {"commitment": "confirmed"}])
    except (ValueError, OSError, urllib.error.URLError):
        largest = None
    return verify_mint(mint, account, largest, OBSERVER.now_utc())


def run_probe(path: pathlib.Path) -> dict:
    state = json.loads(path.read_text())
    OBSERVER.audit(state)
    current = OBSERVER.now_utc()
    if not (OBSERVER.timestamp(OBSERVER.START) <= OBSERVER.timestamp(current)
            < OBSERVER.timestamp(OBSERVER.END)):
        return {"status": "OUTSIDE_WINDOW", "probes": 0}
    # Append only research evidence; never change baseline first price or trading authority.
    mint = selected_mint(state)
    if mint is None:
        return {"status": "NO_MARKETS", "probes": 0}
    try:
        evidence = probe_one(mint)
    except (ValueError, OSError, urllib.error.URLError, KeyError, TypeError, OverflowError) as exc:
        # Only stable, self-owned diagnostic labels; never log URL, tokens or bodies.
        allowed = {"all_public_rpc_sources_unavailable", "mint_account_absent",
                   "mint_program_unknown", "not_a_parsed_mint",
                   "mint_supply_unknown", "largest_accounts_stale"}
        reason = str(exc) if isinstance(exc, ValueError) and str(exc) in allowed else "RPC_OR_EVIDENCE_ERROR"
        evidence = {
            "mint": mint, "observedAt": OBSERVER.now_utc(),
            "availableAt": OBSERVER.now_utc(),
            "source": "solana_public_mainnet_rpc",
            "status": "RPC_UNAVAILABLE_OR_UNVERIFIED", "rugVerdict": "UNDETERMINED",
            "unverified": ["all_critical_coverage"], "signals": [],
            "failureReasonCode": reason,
            "canTrade": False, "canSign": False, "canBroadcast": False,
        }
    OBSERVER.append_event(state, {"type": "SOLANA_MINT_PROBE", **evidence})
    OBSERVER.audit(state)
    OBSERVER.write_json(path, state)
    return {"status": evidence["status"], "probes": 1, "signals": evidence["signals"]}


def summarize(state: dict) -> dict:
    OBSERVER.audit(state)
    cycles = [e for e in state["events"] if e["type"] == "CYCLE"]
    market = [e for e in state["events"] if e["type"] == "MARKET_OBSERVATION"]
    probes = [e for e in state["events"] if e["type"] == "SOLANA_MINT_PROBE"]
    warnings = [e for e in market if any(
        f.startswith(("SUSPECTED_LIQUIDITY", "PRICE_COLLAPSE")) for f in e.get("flags", [])
    )]
    outcomes = [c["first24hMark"] for c in state["cases"].values() if c.get("first24hMark")]
    wins = sum(bool(o["up"]) for o in outcomes)
    shadow_decisions = [e for e in state["events"] if e["type"] == "SHADOW_NO_TRADE_DECISION"]
    shadow_grades = [e for e in state["events"] if e["type"] == "SHADOW_SPOT_GRADE"]
    return {
        "experimentId": OBSERVER.ID, "status": state["status"],
        "observedCycles": len(cycles),
        "lastCycleAt": cycles[-1]["availableAt"] if cycles else None,
        "discoveredMints": len(state.get("seenMints", state["candidateMints"])),
        "activeWatchMints": len(state["candidateMints"]),
        "watchPoolEvictions": sum(e.get("watchPoolEvictions",0) for e in cycles),
        "unscoredEvictions": sum(e.get("unscoredEvictions",0) for e in cycles),
        "evictedHorizonObservations": sum(e.get("evictedHorizonObservations",0) for e in cycles),
        "totalDueHorizonRequests": sum(e.get("dueHorizonTargets",0) for e in cycles),
        "maturedUnscoredFirstMarks": sum(
            c.get("first24hMark") is None and c.get("baselineClass") != "CENSORED_PAIR_SWITCH"
            and cycles and (OBSERVER.timestamp(cycles[-1]["availableAt"]) - OBSERVER.timestamp(c["firstAvailableAt"])).total_seconds() > 30 * 3600
            for c in state["cases"].values()),
        "sampledMarketObservations": len(market),
        "suspiciousMarketObservationsNotConfirmedRugs": len(warnings),
        "onchainPartialProbes": sum(p["status"] == "ONCHAIN_PARTIAL_UNVERIFIED" for p in probes),
        "onchainUnavailableProbes": sum(p["status"] != "ONCHAIN_PARTIAL_UNVERIFIED" for p in probes),
        "governedPaperAbstentions": sum(e["type"] == "SHARK_MONEY_PAPER_GUARD" for e in state["events"]),
        "indicativeRouteObservations": sum(e["type"] == "JUPITER_ROUTE_DIAGNOSTIC" and e["status"] == "INDICATIVE_ROUTING_ONLY_NOT_EXECUTABLE" for e in state["events"]),
        "unavailableRouteProbes": sum(e["type"] == "JUPITER_ROUTE_DIAGNOSTIC" and e["status"] != "INDICATIVE_ROUTING_ONLY_NOT_EXECUTABLE" for e in state["events"]),
        "priceOnly24hMarks": len(outcomes),
        "prospectivelySealedNoTradeDecisions": len(shadow_decisions),
        "observedShadowSpotGrades": len(shadow_grades),
        "priceOnly24hUpCount": wins,
        "naive24hUpAccuracy": (round(wins / len(outcomes), 4) if outcomes else None),
        "confirmedRugs": None, "paperOrders": 0, "executedTrades": 0,
        "canTrade": False, "canSign": False, "canBroadcast": False,
        "ledgerHead": state["lastDigest"],
        "source": "dexscreener_public_api_plus_optional_solana_rpc",
    }


def render_markdown(s: dict) -> str:
    pct = "not scoreable yet" if s["naive24hUpAccuracy"] is None else f'{s["naive24hUpAccuracy"] * 100:.2f}%'
    return (
        "# Jhadina SHARK — seven-day research dashboard\n\n"
        f'Experiment: {s["experimentId"]}  \n'
        f'Status: **{s["status"]}**  \n'
        f'Latest genuine market cycle: {s["lastCycleAt"] or "none"}  \n\n'
        f'- Market polling cycles: {s["observedCycles"]}\n'
        f'- Distinct profile/boost mints admitted: {s["discoveredMints"]}\n'
        f'- Active watch mints: {s["activeWatchMints"]}\n'
        f'- Watchlist evictions: {s["watchPoolEvictions"]}; unscored early evictions: {s["unscoredEvictions"]}\n'
        f'- Requested 24h outcome follow-ups: {s["totalDueHorizonRequests"]}; evicted token quotes observed: {s["evictedHorizonObservations"]}\n'
        f'- First-market-price cases past 30h and still unscored: {s["maturedUnscoredFirstMarks"]}\n'
        f'- Market pair observations: {s["sampledMarketObservations"]}\n'
        f'- Suspicious market observations (NOT confirmed rugs): {s["suspiciousMarketObservationsNotConfirmedRugs"]}\n'
        f'- Partial Solana mint probes: {s["onchainPartialProbes"]}\n'
        f'- Unavailable/unverified RPC probes: {s["onchainUnavailableProbes"]}\n'
        f'- Governed SHARK/Money paper abstentions: {s["governedPaperAbstentions"]}\n'
        f'- Indicative read-only DEX routes (NOT fills): {s["indicativeRouteObservations"]}\n'
        f'- Unavailable route observations: {s["unavailableRouteProbes"]}\n'
        f'- Verified confirmed rugs: **unknown**\n'
        f'- Prospective NO_TRADE shadow decisions: {s["prospectivelySealedNoTradeDecisions"]}\n'
        f'- Subsequently graded spot-only decisions: {s["observedShadowSpotGrades"]}\n'
        f'- 24h price-only scored marks: {s["priceOnly24hMarks"]}\n'
        f'- Naive up-direction score: {pct}\n'
        f'- Paper fills / real trades: **0 / 0**\n\n'
        "These are price-only marks, NOT executable P&L. Missing on-chain liquidity "
        "control, holder independence, sellability, and operator verification "
        "remain hard quarantine conditions. The observer never signs or broadcasts.\n\n"
        f'Ledger hash head: \x60{s["ledgerHead"]}\x60\n'
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["probe", "report"], required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--report", default="")
    args = parser.parse_args()
    path = pathlib.Path(args.state)
    if args.mode == "probe":
        print(json.dumps(run_probe(path), sort_keys=True))
    else:
        state = json.loads(path.read_text())
        info = summarize(state)
        if args.report:
            target = pathlib.Path(args.report)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(render_markdown(info))
        print(json.dumps(info, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
