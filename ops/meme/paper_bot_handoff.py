#!/usr/bin/env python3
"""Research-only SHARK handoff for future MemeBot and SniperBot integration.

This emits an untrusted *simulation review receipt*, NOT a DecisionProposal
authorizing action, a trading instruction, launch transaction, wallet operation
or invocation of another bot. An eventual live route must pass the canonical
Money Policy / Action / Coffer boundaries and operator commissioning.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("shark_bot_handoff_obs", HERE / "experiment_7day.py")
obs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(obs)
SCHEMA = "SHARK-BOT-PAPER-HANDOFF-01"
BOTS = {
    "SNIPER_BOT": "PAPER_SNIPE_REVIEW",
    "MEME_BOT": "PAPER_LAUNCH_REVIEW",
}
FORBIDDEN_EVENTS = {
    "LIVE_BUY", "LIVE_SELL", "ORDER_FILLED", "EXECUTED_TRADE",
    "SIGNED_TRANSACTION", "TOKEN_DEPLOYED", "AUTHORIZED_LIVE_TRADE",
}


def build(state: dict, *, bot: str, mint: str, as_of: str) -> dict:
    """Produce a bounded, reproducible no-trade receipt from ledger evidence."""
    if bot not in BOTS:
        raise ValueError("shark_bot_handoff_unknown_target")
    if not isinstance(mint, str) or not obs.ADDRESS.fullmatch(mint):
        raise ValueError("shark_bot_handoff_invalid_mint")
    at = obs.timestamp(as_of)
    if not (obs.timestamp(obs.START) <= at <= obs.timestamp(obs.END)):
        raise ValueError("shark_bot_handoff_outside_study")
    obs.audit(state)
    if any(e.get("type") in FORBIDDEN_EVENTS for e in state["events"]):
        raise ValueError("shark_bot_handoff_executable_event_not_allowed")
    matches = [
        e for e in state["events"]
        if e.get("type") == "MARKET_OBSERVATION"
        and e.get("mint") == mint
        and obs.timestamp(e["availableAt"]) <= at
    ]
    if not matches:
        raise ValueError("shark_bot_handoff_no_available_observation")
    observation = max(matches, key=lambda e: (e["availableAt"], e["digest"]))
    # None of these fields confer a launch/trading approval. In particular,
    # DexScreener USD valuations and Jupiter quotes cannot prove sellability.
    return {
        "schema": SCHEMA,
        "bot": bot,
        "reviewType": BOTS[bot],
        "purpose": "SIMULATED_RESEARCH_ONLY",
        "proposalDisposition": "DEFER",
        "mint": mint,
        "pair": observation["pair"],
        "asOf": as_of,
        "sourceAvailableAt": observation["availableAt"],
        "sourceEventDigest": observation["digest"],
        "sourceLedgerHead": state["lastDigest"],
        "source": "dexscreener_public_api_indicative",
        "marketDataVerifiedOnchain": False,
        "mintFreezeLpHolderRiskVerified": False,
        "actualSellabilityVerified": False,
        "expectedProfitVerified": False,
        "confirmedRug": False,
        "operatorApprovalGranted": False,
        "canTrade": False,
        "canLaunch": False,
        "canSign": False,
        "canBroadcast": False,
        "canSpend": False,
        "walletOrKeyAttached": False,
        "canChangePolicies": False,
        "nextBoundary": "SHARK_EVIDENCE_TO_MONEY_POLICY_EVALUATION_NOT_ACTION",
    }
