"""SHARK .24–.25: prospective public-feed → canonical paper ledger with honest costs.

Not an automated Telegram bridge. Uses the existing bounded public SHARK
tick and a scenario-only friction model. No wallet, DEX client or execution.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import math
import time

import shark_live_intelligence as live

SCHEMA = "jhadina.shark.public-sniper-paper-audit.v1"
FIXED_PUBLIC_SOURCE = "FIXED_PUBLIC_DEX_PROFILES_BOOSTS"
MAX_CYCLE_MS = 3_600_000
MAX_TRADE_USD = Decimal("10000")
MAX_BPS = Decimal("10000")
MAX_FEE_USD = Decimal("1000")


def _decimal(value, name: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError(name + "_invalid")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(name + "_invalid") from None
    if not result.is_finite() or result < 0:
        raise ValueError(name + "_invalid")
    return result


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def hypothetical_round_trip(*, entry_usd, exit_usd, trade_usd, entry_fee_bps,
                            exit_fee_bps, entry_slippage_bps, exit_slippage_bps,
                            network_priority_usd, market_impact_bps=0) -> dict:
    """Conservative two-sided assumed friction, not an actual quoted route or fill."""
    amount = _decimal(trade_usd, "trade_usd")
    entry = _decimal(entry_usd, "entry_usd")
    exit_ = _decimal(exit_usd, "exit_usd")
    network = _decimal(network_priority_usd, "network_priority_usd")
    if not (0 < amount <= MAX_TRADE_USD and 0 < entry and 0 < exit_
            and network <= MAX_FEE_USD):
        raise ValueError("paper_scenario_out_of_bounds")
    bps_values = tuple(_decimal(v, "bps") for v in (
        entry_fee_bps, exit_fee_bps, entry_slippage_bps,
        exit_slippage_bps, market_impact_bps))
    if any(v > MAX_BPS for v in bps_values):
        raise ValueError("paper_bps_out_of_bounds")
    f1, f2, s1, s2, impact = bps_values
    # With a purchase budget, entry frictions reduce tokens received.
    # On exit, fee/slippage/impact are charged on gross proceeds.
    entry_deductions = (f1 + s1 + impact) / Decimal(10000)
    exit_deductions = (f2 + s2 + impact) / Decimal(10000)
    if entry_deductions >= 1 or exit_deductions >= 1:
        raise ValueError("paper_liquidity_cost_not_executable")
    acquired = (amount / entry) * (1 - entry_deductions)
    gross = acquired * exit_
    proceeds = gross * (1 - exit_deductions)
    net = proceeds - amount - network
    return {
        "schema": "jhadina.shark.paper-friction-scenario.v1",
        "disposition": "ASSUMPTIONS_ONLY_NO_LIVE_QUOTES",
        "hypotheticalGrossExitUsd": _money(gross),
        "hypotheticalNetPnlUsd": _money(net),
        "assumedNetworkPriorityUsd": _money(network),
        "actualFeesMeasured": False,
        "actualSlippageMeasured": False,
        "quoteAgeMeasured": False,
        "routeSimulationPassed": False,
        "mevProtectionCertified": False,
        "fillOccurred": False,
        "canSign": False,
        "canBroadcast": False,
        "canTrade": False,
    }


def audited_public_paper_cycle(db, *, source_kind, now, profiles, boosts,
                               read_dossier, clock_now, monotonic_ns=time.perf_counter_ns):
    """Admit independently obtained public feeds into the existing paper tick.

    Caller must explicitly attest feeds came from the two fixed independent
    public provider endpoints. Does NOT prove provider origin cryptographically.
    No arbitrary requests, Telegram data, wallet, ML or persistent sidecar.
    """
    if source_kind != FIXED_PUBLIC_SOURCE:
        raise ValueError("shark_telegram_or_unverified_source_denied")
    # Non-list feed would be refused by the canonical discovery parser too.
    if not isinstance(profiles, list) or not isinstance(boosts, list):
        raise ValueError("shark_public_feed_shape_invalid")
    for row in profiles + boosts:
        if not isinstance(row, dict) or any(k in row for k in
             ("chat_id", "forward_origin", "text", "telegram_message", "sender_id")):
            raise ValueError("shark_mixed_private_source_denied")
    start = monotonic_ns()
    result = live.tick(db, now=now, profiles=profiles, boosts=boosts,
                       read_dossier=read_dossier, clock_now=clock_now)
    finish = monotonic_ns()
    if not all(isinstance(v, int) and not isinstance(v, bool)
               for v in (start, finish)) or not (0 <= finish-start <= MAX_CYCLE_MS*1_000_000):
        raise ValueError("shark_cycle_timer_invalid")
    # These are only local cycle processing measurements, not DEX route or
    # end-to-end launch discovery timing. A fast value NEVER indicates a fill.
    return {
        "schema": SCHEMA, "sourceKind": FIXED_PUBLIC_SOURCE,
        "publicDiscovery": result,
        "localCycleMs": round((finish - start) / 1_000_000, 3),
        "freshQuoteAgeMs": None,
        "launchToDecisionMs": None,
        "decisionToSimulatedFillMs": None,
        "transactionFinalityMs": None,
        "endToEndLatencyCertified": False,
        "sourceOriginCryptographicallyAttested": False,
        "telegramIngested": False, "aiModelUsed": False,
        "sniperPaperReadyForReview": result["checkedPublicMints"] > 0,
        "paperOrdersExecuted": 0,
        "realTrades": 0, "canSign": False, "canBroadcast": False, "canTrade": False,
    }
