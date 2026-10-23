#!/usr/bin/env python3
"""SHARK-GOODCRYPTO.01-.05: offline, source-attributed, paper-only research.

Not a GoodCrypto API client. No network, secrets, signer, webhook, wallet, or
order transport. Provider features inspired the experiment, not a data license.
Caller supplies independently collected PUBLIC market observations with origin
and time receipts; user-provided values are retained only as UNVERIFIED research.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import re
from typing import Any

SCHEMA = 'SHARK-GOODCRYPTO-PAPER-01-05'
MINT = re.compile(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$')
MAX_AGE_MS = 30_000
MAX_QUOTE_AGE_MS = 5_000
MAX_RTT_MS = 2_000  # Acceptance limit, not an execution-speed claim.
MAX_BPS = 10_000
PUBLIC = 'INDEPENDENT_PUBLIC_MARKET'
USER = 'USER_SUPPLIED_UNVERIFIED'
QUARANTINE = frozenset({'MINT_AUTHORITY_ACTIVE', 'FREEZE_AUTHORITY_ACTIVE',
 'TRANSFER_HOOK', 'TRANSFER_FEE_CONTROL', 'TOP_HOLDER_CONCENTRATION',
 'CREATOR_CLUSTER', 'WASH_TRADING', 'LP_WITHDRAWAL_RISK', 'SELL_BLOCKED',
 'UNRESOLVED_CONTRACT_IMPERSONATION', 'UNKNOWN_TOKEN_EXTENSION'})


def _money(value: Any, name: str, *, zero: bool = False) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError(f'{name}_missing_or_invalid')
    try:
        d = Decimal(str(value))
    except InvalidOperation as e:
        raise ValueError(f'{name}_invalid') from e
    if not d.is_finite() or (d < 0 if zero else d <= 0):
        raise ValueError(f'{name}_nonpositive')
    return d


def _ms(value: Any, name: str) -> int:
    if not isinstance(value, str) or not value.endswith('Z'):
        raise ValueError(f'{name}_must_be_utc')
    try:
        t = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as e:
        raise ValueError(f'{name}_invalid') from e
    if t.utcoffset() != timezone.utc.utcoffset(t):
        raise ValueError(f'{name}_must_be_utc')
    return int(t.timestamp() * 1000)


def _digest(value: Any) -> str:
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                            ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def _risk_flags(raw: dict) -> list[str]:
    flags = raw.get('riskFlags')
    if not isinstance(flags, list) or any(not isinstance(x, str) or x not in QUARANTINE for x in flags):
        raise ValueError('risk_flags_unrecognized_or_missing')
    return sorted(set(flags))


def normalize(raw: Any, *, received_at: str) -> dict:
    """01: reject unlicensed/private feeds and chronology gaps; seal provenance.

    The source is a caller assertion; the function cannot verify ownership or
    authenticity of external observations, and marks every record UNATTESTED.
    """
    if not isinstance(raw, dict) or set(raw) - {
        'chain','mint','source','sourceId','observedAt','availableAt','priceUsd',
        'liquidityUsd','volumeUsd5m','holders','top10Pct','marketCapUsd',
        'riskFlags','sellRouteObserved','socialCatalystId'}:
        raise ValueError('unexpected_observation_fields')
    if raw.get('chain') != 'solana' or not isinstance(raw.get('mint'), str) or not MINT.fullmatch(raw['mint']):
        raise ValueError('invalid_solana_mint')
    if raw.get('source') not in (PUBLIC, USER):
        raise ValueError('unsupported_or_private_source')
    if not isinstance(raw.get('sourceId'), str) or not 1 <= len(raw['sourceId']) <= 128:
        raise ValueError('source_id_required')
    received = _ms(received_at, 'received_at')
    available = _ms(raw.get('availableAt'), 'available_at')
    observed = _ms(raw.get('observedAt'), 'observed_at')
    if observed > available or available > received or received - available > MAX_AGE_MS:
        raise ValueError('future_stale_or_inverted_chronology')
    vals = {k: _money(raw.get(k), k, zero=k != 'priceUsd') for k in
            ('priceUsd','liquidityUsd','volumeUsd5m','marketCapUsd','top10Pct')}
    if vals['top10Pct'] > 100:
        raise ValueError('concentration_over_100')
    if type(raw.get('holders')) is not int or raw['holders'] < 0:
        raise ValueError('holders_invalid')
    if type(raw.get('sellRouteObserved')) is not bool:
        raise ValueError('sell_route_evidence_missing')
    flags = _risk_flags(raw)
    social = raw.get('socialCatalystId')
    if social is not None and (not isinstance(social, str) or len(social) > 128):
        raise ValueError('catalyst_id_invalid')
    # No sender, chat text, private data, URLs, or externally asserted profit accepted.
    out = {'schema': SCHEMA, 'source': raw['source'], 'sourceId': raw['sourceId'],
           'sourceAttested': False, 'chain': 'solana', 'mint': raw['mint'],
           'observedAt': raw['observedAt'], 'availableAt': raw['availableAt'],
           'receivedAt': received_at, 'ageMsAtReceipt': received-available,
           'priceUsd': str(vals['priceUsd']), 'liquidityUsd': str(vals['liquidityUsd']),
           'volumeUsd5m': str(vals['volumeUsd5m']), 'marketCapUsd': str(vals['marketCapUsd']),
           'top10Pct': str(vals['top10Pct']), 'holders': raw['holders'],
           'sellRouteObserved': raw['sellRouteObserved'], 'riskFlags': flags,
           'socialCatalystId': social, 'authority': 'RESEARCH_ONLY', 'canTrade': False}
    return {**out, 'receiptId': _digest(out)}


def screen(obs: dict) -> dict:
    """02: explicit risk vetoes and a conservative, deterministic screening rule.

    Unknown risk state is not safe: independent verification is a separate gate.
    """
    if obs.get('schema') != SCHEMA or obs.get('authority') != 'RESEARCH_ONLY':
        raise ValueError('invalid_observation_contract')
    reasons = []
    if obs['source'] != PUBLIC:
        reasons.append('PROVENANCE_UNVERIFIED_INPUT')
    if obs['riskFlags']:
        reasons.extend(obs['riskFlags'])
    if not obs['sellRouteObserved']:
        reasons.append('NO_SELL_ROUTE_OBSERVED')
    if Decimal(obs['liquidityUsd']) < 15000:
        reasons.append('LOW_LIQUIDITY')
    if Decimal(obs['volumeUsd5m']) < 5000:
        reasons.append('LOW_5M_VOLUME')
    if Decimal(obs['top10Pct']) > 40:
        reasons.append('HIGH_TOP_10_CONCENTRATION')
    if obs['holders'] < 75:
        reasons.append('THIN_HOLDER_DISTRIBUTION')
    if Decimal(obs['marketCapUsd']) > 0 and Decimal(obs['liquidityUsd']) / Decimal(obs['marketCapUsd']) < Decimal('0.05'):
        reasons.append('LOW_LIQUIDITY_TO_CAP')
    # Even a passing paper screen is not a claim of safety or a BUY order.
    return {'decision': 'REVIEW' if reasons else 'PAPER_CANDIDATE',
            'reasons': sorted(set(reasons)), 'canTrade': False,
            'independentRiskCertified': False}


def quote_cost(quote: dict, *, received_at: str) -> dict:
    """03: bounded quote assumptions; exact fee/slippage/MEV unknown -> defer.

    Quote must be produced by an independent explicit caller, never scraped from
    GoodCrypto or inferred from claimed execution speed. Prices are USD values.
    """
    if not isinstance(quote, dict) or set(quote) != {
        'availableAt','roundTripLatencyMs','buySlippageBps','sellSlippageBps',
        'buyFeeBps','sellFeeBps','priorityFeeUsd','mevExposureBps','sellDepthUsd',
        'quoteSource','quoteId'}:
        raise ValueError('exact_quote_contract_required')
    if not isinstance(quote['quoteId'], str) or not quote['quoteId'] or not isinstance(quote['quoteSource'], str) or not quote['quoteSource']:
        raise ValueError('quote_provenance_required')
    age = _ms(received_at, 'received_at') - _ms(quote['availableAt'], 'quote_available_at')
    if age < 0 or age > MAX_QUOTE_AGE_MS:
        raise ValueError('quote_stale_or_future')
    if type(quote['roundTripLatencyMs']) is not int or not 0 <= quote['roundTripLatencyMs'] <= MAX_RTT_MS:
        raise ValueError('latency_outside_paper_budget')
    bps = ('buySlippageBps','sellSlippageBps','buyFeeBps','sellFeeBps','mevExposureBps')
    values = {k: _money(quote[k], k, zero=True) for k in bps}
    if any(values[k] > 2000 for k in bps):
        raise ValueError('excessive_quote_risk')
    if values['buySlippageBps'] + values['buyFeeBps'] + values['mevExposureBps'] > 1500:
        raise ValueError('entry_cost_budget_exceeded')
    if values['sellSlippageBps'] + values['sellFeeBps'] + values['mevExposureBps'] > 1500:
        raise ValueError('exit_cost_budget_exceeded')
    priority = _money(quote['priorityFeeUsd'], 'priorityFeeUsd', zero=True)
    depth = _money(quote['sellDepthUsd'], 'sellDepthUsd')
    return {'bps': {k: str(v) for k, v in values.items()},
            'priorityFeeUsd': str(priority), 'sellDepthUsd': str(depth),
            'quoteId': quote['quoteId'], 'quoteSource': quote['quoteSource'],
            'quoteAgeMs': age, 'roundTripLatencyMs': quote['roundTripLatencyMs'],
            'mevSafetyProved': False}


def paper_entry(obs: dict, quote: dict, *, received_at: str,
                position_usd: str = '10') -> dict:
    """04: hypothetical paper entry only, explicitly not a fill."""
    verdict = screen(obs)
    cost = quote_cost(quote, received_at=received_at)
    position = _money(position_usd, 'position_usd')
    if position > 25:
        raise ValueError('paper_position_cap_exceeded')
    # Conservative depth test, not proof the token can actually be sold.
    if position > Decimal(cost['sellDepthUsd']) / 20:
        verdict = {**verdict, 'decision': 'REVIEW',
                   'reasons': sorted(set(verdict['reasons'] + ['INSUFFICIENT_SIMULATED_EXIT_DEPTH']))}
    action = 'SIMULATED_ENTRY_CANDIDATE' if verdict['decision'] == 'PAPER_CANDIDATE' else 'NO_ENTRY'
    out = {'schema': SCHEMA, 'action': action, 'screen': verdict,
           'mint': obs['mint'], 'observationReceipt': obs['receiptId'],
           'priceUsd': obs['priceUsd'], 'positionUsd': str(position),
           'quote': cost, 'createdAt': received_at,
           'paperOnly': True, 'simulated': True, 'fillVerified': False,
           'sellabilityVerified': False, 'canTrade': False, 'authority': 'RESEARCH_ONLY'}
    return {**out, 'paperProposalId': _digest(out)}


def paper_mark(entry: dict, *, mark_price_usd: str, mark_at: str,
               high_water_price_usd: str, quoted_exit: dict | None = None) -> dict:
    """05: hypothetical TP/stop/trailing comparison; never mark as realized P&L.

    Stop = -15%, TP = +40%, trailing floor = 20% below high-water once
    price has gained >=30%. Missing/stale exit quote gives UNSCORED, not profit.
    """
    if entry.get('schema') != SCHEMA or entry.get('action') != 'SIMULATED_ENTRY_CANDIDATE' or not entry.get('paperOnly'):
        raise ValueError('entry_not_paper_candidate')
    if _ms(mark_at, 'mark_at') <= _ms(entry['createdAt'], 'entry_at'):
        raise ValueError('nonprospective_mark')
    price = _money(mark_price_usd, 'mark_price_usd')
    high = _money(high_water_price_usd, 'high_water_price_usd')
    base = Decimal(entry['priceUsd'])
    if high < max(base, price):
        raise ValueError('inconsistent_high_water')
    ratio = price / base
    trail = high >= base * Decimal('1.30') and price <= high * Decimal('0.80')
    reason = 'STOP' if ratio <= Decimal('.85') else 'TRAIL' if trail else 'TAKE_PROFIT' if ratio >= Decimal('1.40') else 'HOLD'
    outcome = {'schema': SCHEMA, 'entryId': entry['paperProposalId'],
               'markAt': mark_at, 'markPriceUsd': str(price),
               'trigger': reason, 'paperOnly': True, 'simulated': True,
               'realizedPnlUsd': None, 'canTrade': False, 'fillVerified': False}
    if reason == 'HOLD':
        return {**outcome, 'status': 'OPEN_UNSCORED', 'hypotheticalNetUsd': None}
    if quoted_exit is None:
        return {**outcome, 'status': 'EXIT_UNSCORED_NO_QUOTE', 'hypotheticalNetUsd': None}
    try:
        exit_cost = quote_cost(quoted_exit, received_at=mark_at)
    except (ValueError, TypeError):
        return {**outcome, 'status': 'EXIT_UNSCORED_BAD_QUOTE', 'hypotheticalNetUsd': None}
    principal = Decimal(entry['positionUsd'])
    if principal > Decimal(exit_cost['sellDepthUsd']) / 20:
        return {**outcome, 'status': 'EXIT_UNSCORED_INADEQUATE_DEPTH', 'hypotheticalNetUsd': None}
    buy = entry['quote']['bps']
    sell = exit_cost['bps']
    factor_in = Decimal('1') - (Decimal(buy['buySlippageBps']) + Decimal(buy['buyFeeBps']) +
                              Decimal(buy['mevExposureBps'])) / MAX_BPS
    factor_out = Decimal('1') - (Decimal(sell['sellSlippageBps']) + Decimal(sell['sellFeeBps']) +
                               Decimal(sell['mevExposureBps'])) / MAX_BPS
    hypothetical = principal * factor_in * ratio * factor_out - principal - \
                   Decimal(entry['quote']['priorityFeeUsd']) - Decimal(exit_cost['priorityFeeUsd'])
    return {**outcome, 'status': 'HYPOTHETICAL_PRICE_ONLY',
            'hypotheticalNetUsd': str(hypothetical.quantize(Decimal('0.000001'))),
            'exitQuoteId': exit_cost['quoteId'], 'executionVerified': False}


def shadow_envelope(entry: dict) -> dict:
    """05: inert, idempotent research envelope for a downstream reviewer.

    Deliberately does NOT claim the canonical Money OpportunityCandidateV2
    schema or insert into the live Purse repository. This is offline research.
    """
    if entry.get('schema') != SCHEMA or not entry.get('paperOnly'):
        raise ValueError('not_a_paper_research_entry')
    o = {'schema': SCHEMA, 'sourceKind': 'SHARK', 'lane': 'MEME',
         'sourceProposalId': entry['paperProposalId'],
         'sourceObservationReceipt': entry['observationReceipt'],
         'decision': 'REVIEW_ONLY', 'requiresIndependentMoneyValidation': True,
         'requiresMimsTradeVote': True, 'admittedToPurse': False,
         'paperOnly': True, 'canTrade': False, 'walletAccess': False,
         'signing': False, 'broadcast': False}
    return {**o, 'envelopeId': _digest(o)}
