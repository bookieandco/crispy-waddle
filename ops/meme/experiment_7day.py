#!/usr/bin/env python3
"""Seven-day SHARK observational pilot: FREE public DEX data, zero trading authority.

This is an independent *sampler*, not the canonical actor/mint/LP verification engine.
Missing verification always means QUARANTINE. Git history + chained entries aid audit,
but a Git commit is not an independent on-chain observation receipt.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import sys
import urllib.error
import urllib.request

ID = 'JHADINA-MEME-20261013-7D-001'
START = '2026-10-13T22:50:00Z'
END = '2026-10-20T22:50:00Z'
CHAIN = 'solana'
BASE = 'https://api.dexscreener.com'
ADDRESS = re.compile(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$')
MAX_TRACKED = 90
MAX_DISTINCT_MINTS = 2500
MAX_SAMPLED = 30
MAX_HORIZON_FOLLOWUPS = 12
HORIZON_START_SECONDS = 24 * 3600
HORIZON_END_SECONDS = 30 * 3600
MAX_EVENTS = 15000
PRICE_FLOOR_USD = 10000
GENESIS = '0' * 64


def now_utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def timestamp(text: str) -> dt.datetime:
    if not isinstance(text, str) or not text.endswith('Z'):
        raise ValueError('time_must_be_utc_z')
    result = dt.datetime.fromisoformat(text.replace('Z', '+00:00'))
    if result.tzinfo != dt.timezone.utc:
        raise ValueError('time_must_be_utc')
    return result


def clean_float(value: object) -> float | None:
    try:
        if isinstance(value, bool) or value is None:
            return None
        x = float(value)
        return x if math.isfinite(x) and x >= 0 else None
    except (ValueError, TypeError, OverflowError):
        return None


def empty_state() -> dict:
    return {'experimentId': ID, 'start': START, 'end': END,
            'status': 'PLANNED', 'authority': 'RESEARCH_ONLY',
            'canSign': False, 'canBroadcast': False, 'canTrade': False,
            'source': 'dexscreener_public_api', 'candidateMints': [],
            'cases': {}, 'events': [], 'lastDigest': GENESIS}


def canonical(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def append_event(state: dict, payload: dict) -> None:
    if len(state['events']) >= MAX_EVENTS:
        raise ValueError('event_cap_reached_stop_without_truncation')
    event = dict(payload)
    event['previousDigest'] = state['lastDigest']
    event['digest'] = hashlib.sha256(event['previousDigest'].encode('ascii') + canonical(event)).hexdigest()
    state['events'].append(event)
    state['lastDigest'] = event['digest']


def audit(state: dict) -> None:
    if any([state.get('experimentId') != ID, state.get('start') != START,
            state.get('end') != END, state.get('authority') != 'RESEARCH_ONLY',
            state.get('canTrade') is not False, state.get('canSign') is not False,
            state.get('canBroadcast') is not False]):
        raise ValueError('experiment_contract_invalid')
    if len(state.get('candidateMints', [])) > MAX_TRACKED:
        raise ValueError('watch_pool_cap_exceeded')
    if 'seenMints' in state:
        seen = state['seenMints']
        if not isinstance(seen, list) or len(seen) > MAX_DISTINCT_MINTS or len(set(seen)) != len(seen):
            raise ValueError('watch_history_invalid')
        if any(not isinstance(m, str) or not ADDRESS.fullmatch(m) for m in seen):
            raise ValueError('watch_history_address_invalid')
        if not set(state['candidateMints']).issubset(set(seen)):
            raise ValueError('active_watch_history_inconsistent')
    previous = GENESIS
    for item in state['events']:
        event = dict(item)
        digest = event.pop('digest', None)
        if event.get('previousDigest') != previous:
            raise ValueError('event_chain_broken')
        if hashlib.sha256(previous.encode('ascii') + canonical(event)).hexdigest() != digest:
            raise ValueError('event_digest_invalid')
        if event.get('type') == 'MARKET_OBSERVATION':
            if event.get('canTrade') is not False or event.get('securityStatus') != 'UNVERIFIED':
                raise ValueError('market_authority_escalated')
            if timestamp(event['availableAt']) < timestamp(event['observedAt']):
                raise ValueError('future_information_leakage')
        previous = digest
    if state.get('lastDigest') != previous:
        raise ValueError('chain_head_invalid')


def fetch_json(path: str) -> object:
    # Only fixed public endpoints are ever called; no wallet, credentials or paid keys.
    req = urllib.request.Request(BASE + path, headers={
        'Accept': 'application/json', 'User-Agent': 'JhadinaPaperResearch/1.0'})
    with urllib.request.urlopen(req, timeout=15) as reply:
        if reply.status != 200:
            raise ValueError('market_provider_non_200')
        raw = reply.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError('provider_payload_too_large')
    return json.loads(raw)


def candidates(profiles: object, boosts: object) -> list[str]:
    found = set()
    for feed in (profiles, boosts):
        if not isinstance(feed, list):
            raise ValueError('discovery_payload_not_array')
        for item in feed:
            if isinstance(item, dict) and item.get('chainId') == CHAIN:
                addr = item.get('tokenAddress')
                if isinstance(addr, str) and ADDRESS.fullmatch(addr):
                    found.add(addr)
    return sorted(found)


def plan_watch_pool(state: dict, fresh: list[str]) -> tuple[list[str], list[str], list[str], list[str]]:
    """Rolling active pool. Past cases are never erased or backfilled.

    Previously discovered/evicted addresses are not repeatedly counted as new.
    Evictions before an outcome remain missing/censored rather than scored.
    """
    active = list(state["candidateMints"])
    seen = list(state.get("seenMints", list(dict.fromkeys(active + list(state["cases"])))))
    old_seen = set(seen)
    newly, evicted = [], []
    for mint in fresh:
        if mint in old_seen or len(seen) >= MAX_DISTINCT_MINTS:
            continue
        if len(active) >= MAX_TRACKED:
            evicted.append(active.pop(0))
        active.append(mint)
        newly.append(mint)
        seen.append(mint)
        old_seen.add(mint)
    return active, seen, newly, evicted



def plan_horizon_followups(state: dict, at: str, limit: int = MAX_HORIZON_FOLLOWUPS) -> list[str]:
    """Request *real* later quotes even for mints evicted from the active discovery pool.

    Reserve the earliest expiring 24–30h horizon targets; never resuscitate a
    past-due prediction or manufacture a quote. Shadow decisions are included
    independently from the first-market-price baseline. This is bounded
    prioritization, not a guaranteed outcome or a complete historical stream.
    """
    clock = timestamp(at)
    if not isinstance(limit, int) or not 0 <= limit <= MAX_HORIZON_FOLLOWUPS:
        raise ValueError('horizon_limit_invalid')
    unresolved: dict[str, dt.datetime] = {}
    def due(mint: str, origin: str) -> None:
        base = timestamp(origin)
        age = (clock - base).total_seconds()
        if HORIZON_START_SECONDS <= age <= HORIZON_END_SECONDS:
            deadline = base + dt.timedelta(seconds=HORIZON_END_SECONDS)
            if mint not in unresolved or deadline < unresolved[mint]:
                unresolved[mint] = deadline
    for mint, case in state['cases'].items():
        if (case.get('first24hMark') is None
                and case.get('baselineClass') != 'CENSORED_PAIR_SWITCH'):
            due(mint, case['firstAvailableAt'])
    completed = {
        event['decisionId'] for event in state['events']
        if event.get('type') in ('SHADOW_SPOT_GRADE', 'SHADOW_SPOT_CENSOR')
    }
    for event in state['events']:
        if (event.get('type') == 'SHADOW_NO_TRADE_DECISION'
                and event['decisionId'] not in completed):
            due(event['mint'], event['availableAt'])
    return sorted(unresolved, key=lambda mint: (unresolved[mint], mint))[:limit]


def choose_pair(rows: object, mint: str) -> dict | None:
    if not isinstance(rows, list):
        raise ValueError('pairs_payload_not_array')
    eligible = []
    for row in rows:
        if not isinstance(row, dict) or row.get('chainId') != CHAIN:
            continue
        base = row.get('baseToken')
        pair = row.get('pairAddress')
        if not isinstance(base, dict) or base.get('address') != mint:
            continue
        if not isinstance(pair, str) or not ADDRESS.fullmatch(pair):
            continue
        price = clean_float(row.get('priceUsd'))
        liquidity = row.get('liquidity')
        usd = clean_float(liquidity.get('usd')) if isinstance(liquidity, dict) else None
        if not price or usd is None:
            continue
        eligible.append((usd, pair, row, price))
    if not eligible:
        return None
    _, pair, row, price = max(eligible, key=lambda x: (x[0], x[1]))
    quote = row.get('quoteToken') or {}
    return {'pair': pair, 'priceUsd': price, 'liquidityUsd': float(row['liquidity']['usd']),
            'dex': str(row.get('dexId') or ''),
            'quoteMint': quote.get('address') if isinstance(quote, dict) else None,
            'pairCreatedAt': row.get('pairCreatedAt')}


def inspect_observation(previous: dict | None, current: dict) -> list[str]:
    flags = []
    if current['liquidityUsd'] < PRICE_FLOOR_USD:
        flags.append('LOW_LIQUIDITY')
    if previous and previous['pair'] != current['pair']:
        flags.append('PAIR_SWITCH_CANNOT_COMPARE')
    elif previous:
        if previous['liquidityUsd'] > 0 and current['liquidityUsd'] / previous['liquidityUsd'] <= .30:
            flags.append('SUSPECTED_LIQUIDITY_DRAIN_NOT_PROVEN_RUG')
        if previous['priceUsd'] > 0 and current['priceUsd'] / previous['priceUsd'] <= .30:
            flags.append('PRICE_COLLAPSE_NOT_PROVEN_RUG')
    flags.append('MINT_FREEZE_LP_CONTROL_AND_HOLDERS_UNVERIFIED')
    return flags


def sample(state: dict, feeds: tuple[object, object, object], observed: str, available: str) -> dict:
    """feeds=(profile rows, boost rows, token pair rows). No invented observations."""
    if timestamp(available) < timestamp(observed):
        raise ValueError('availability_before_observation')
    if not (timestamp(START) <= timestamp(available) < timestamp(END)):
        raise ValueError('sample_outside_experiment_window')
    profiles, boosts, pairs = feeds
    fresh = candidates(profiles, boosts)
    known, seen, newly, evicted = plan_watch_pool(state, fresh)
    state['candidateMints'] = known
    state['seenMints'] = seen
    evicted_without_mark = sum(
        mint not in state['cases'] or state['cases'][mint].get('first24hMark') is None
        for mint in evicted
    )
    # Follow-up pairs can belong to genuinely observed cases evicted long ago.
    # They are read-only cohort revisits, never new discoveries or backfills.
    due_mints = plan_horizon_followups(state, available)
    targets = list(dict.fromkeys(known + due_mints))
    by_mint: dict[str, list] = {m: [] for m in targets}
    if not isinstance(pairs, list):
        raise ValueError('token_pairs_payload_not_array')
    for pair in pairs:
        if isinstance(pair, dict):
            mint = (pair.get('baseToken') or {}).get('address') if isinstance(pair.get('baseToken'), dict) else None
            if mint in by_mint:
                by_mint[mint].append(pair)
    count = 0
    new_alerts = 0
    # Feed selection is reported as sampled public profiles/boosts, never all launches.
    cohort_observations = 0
    for mint in targets:
        selected = choose_pair(by_mint[mint], mint)
        if selected is None:
            continue
        previous = state['cases'].get(mint, {}).get('last')
        flags = inspect_observation(previous, selected)
        entry = state['cases'].setdefault(mint, {
            'firstAvailableAt': available, 'firstPair': selected['pair'],
            'firstObservedPriceUsd': selected['priceUsd'],
            'baseline': 'UP_AT_24H', 'baselineClass': 'PRICE_ONLY_NON_EXECUTABLE',
            'securityStatus': 'UNVERIFIED', 'canTrade': False,
            'last': None, 'first24hMark': None,
        })
        # If any prior case moved to a new pool, outcome comparison is censored.
        if selected['pair'] != entry['firstPair']:
            entry['baselineClass'] = 'CENSORED_PAIR_SWITCH'
        horizon_hours = (timestamp(available) - timestamp(entry['firstAvailableAt'])).total_seconds() / 3600
        if entry['first24hMark'] is None and entry['baselineClass'] != 'CENSORED_PAIR_SWITCH' and 24 <= horizon_hours <= 30 and selected['pair'] == entry['firstPair']:
            entry['first24hMark'] = {'availableAt': available,
                                     'returnPctPriceOnly': round(100 * (selected['priceUsd'] / entry['firstObservedPriceUsd'] - 1), 5),
                                     'up': selected['priceUsd'] > entry['firstObservedPriceUsd']}
        entry['last'] = selected
        append_event(state, {'type': 'MARKET_OBSERVATION', 'mint': mint,
            'observedAt': observed, 'availableAt': available,
            'source': 'dexscreener_public_api', 'pair': selected['pair'],
            'quoteMint': selected['quoteMint'], 'dex': selected['dex'],
            'priceUsd': selected['priceUsd'], 'liquidityUsd': selected['liquidityUsd'],
            'pairCreatedAt': selected['pairCreatedAt'],
            'securityStatus': 'UNVERIFIED', 'canTrade': False,
            'rugVerdict': 'UNDETERMINED', 'flags': flags,
            'virtualPosition': 'NONE', 'shadowReturnIsExecutable': False})
        count += 1
        if mint not in known:
            cohort_observations += 1
        if any(x.startswith(('SUSPECTED_LIQUIDITY', 'PRICE_COLLAPSE')) for x in flags):
            new_alerts += 1
    return {'newlyDiscovered': len(newly), 'sampled': count,
            'dueHorizonTargets': len(due_mints),
            'evictedHorizonObservations': cohort_observations,
            'watchPoolEvictions': len(evicted), 'unscoredEvictions': evicted_without_mark,
            'suspiciousObservations': new_alerts}


def discover_and_fetch(state: dict) -> tuple[object, object, object]:
    profiles = fetch_json('/token-profiles/latest/v1')
    boosts = fetch_json('/token-boosts/latest/v1')
    fresh = candidates(profiles, boosts)
    upcoming, _, _, _ = plan_watch_pool(state, fresh)
    # Reserve up to 20 follow-up observations at real 24–30h horizons,
    # including older cases no longer in the rotating 90-mint watch pool.
    # New discovery still gets up to 30 observations per cycle.
    due = plan_horizon_followups(state, now_utc())
    offset = len([e for e in state['events'] if e.get('type') == 'CYCLE']) * MAX_SAMPLED
    active = (upcoming + upcoming)[offset % len(upcoming):(offset % len(upcoming)) + MAX_SAMPLED] if upcoming else []
    sampled_mints = list(dict.fromkeys(due + active))
    if len(sampled_mints) > MAX_SAMPLED + MAX_HORIZON_FOLLOWUPS:
        raise ValueError('cycle_sampling_budget_exceeded')
    pairs = []
    for start in range(0, len(sampled_mints), 30):
        batch = sampled_mints[start:start + 30]
        payload = fetch_json('/tokens/v1/solana/' + ','.join(batch))
        if not isinstance(payload, list):
            raise ValueError('pair_provider_payload_not_array')
        pairs.extend(payload)
    return profiles, boosts, pairs


def write_json(path: pathlib.Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, indent=2, sort_keys=True, allow_nan=False) + '\n')
    tmp.replace(path)


def run(path: pathlib.Path, mode: str) -> int:
    state = json.loads(path.read_text()) if path.exists() else empty_state()
    audit(state)
    current = now_utc()
    if timestamp(current) < timestamp(START):
        print(json.dumps({'status': 'NOT_STARTED', 'experimentId': ID}))
        return 0
    if timestamp(current) >= timestamp(END):
        if state['status'] != 'COMPLETED':
            append_event(state, {'type': 'END', 'observedAt': current, 'availableAt': current,
                                 'reason': 'SEVEN_DAY_CUTOFF_NO_MORE_POLLING'})
            state['status'] = 'COMPLETED'
            write_json(path, state)
        print(json.dumps({'status': 'COMPLETED', 'experimentId': ID, 'events': len(state['events'])}))
        return 0
    if mode != 'live':
        raise ValueError('only_live_mode_supported_by_scheduler')
    # The observation is not backdated to the beginning of the HTTP call.
    feeds = discover_and_fetch(state)
    available = now_utc()
    stats = sample(state, feeds, available, available)
    append_event(state, {'type': 'CYCLE', 'observedAt': available, 'availableAt': available,
                         'feed': 'DEXSCREENER_PROFILES_AND_BOOSTS', **stats})
    state['status'] = 'RUNNING'
    audit(state)
    write_json(path, state)
    print(json.dumps({'experimentId': ID, 'status': state['status'],
                      'cycleAvailableAt': available, **stats,
                      'securityVerified': 0, 'tradesExecuted': 0, 'canTrade': False}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', default='training/meme/experiments/2026-10-13-seven-day-001/state.json')
    parser.add_argument('--mode', choices=['live', 'audit'], default='audit')
    args = parser.parse_args()
    path = pathlib.Path(args.state)
    if args.mode == 'audit':
        data = json.loads(path.read_text()) if path.exists() else empty_state()
        audit(data)
        print(json.dumps({'status': data['status'], 'events': len(data['events']),
                          'tracked': len(data['candidateMints']),
                          'cases': len(data['cases']),
                          '24hMarks': sum(bool(c['first24hMark']) for c in data['cases'].values())}))
        return 0
    return run(path, args.mode)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print('MEME_EXPERIMENT_FAILED:' + type(exc).__name__ + ':' + str(exc)[:180], file=sys.stderr)
        sys.exit(1)
