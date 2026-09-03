import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NBAEventGameState } from './nba-event-state-machine.js';
import { NBAEventLedger } from './nba-canonical-ledger.js';
import { createNBAEndOfPeriodEvent, createNBANextPeriodEvent } from './nba-period-events.js';

const state = (period: number, periodSecondsRemaining: number, home: number, away: number): NBAEventGameState => ({
  gameId: 'period-test',
  period,
  periodSecondsRemaining,
  shotClockSeconds: 24,
  offenseTeamId: 'A',
  defenseTeamId: 'B',
  scores: { A: home, B: away },
  players: {},
  sequence: 0,
  evidenceIds: [],
});

describe('NBA canonical period events', () => {
  it('advances regulation through PERIOD_END then PERIOD_START', () => {
    const ledger = new NBAEventLedger(state(1, 0, 10, 9));
    ledger.append(createNBAEndOfPeriodEvent(ledger.snapshot().finalState));
    ledger.append(createNBANextPeriodEvent(ledger.snapshot().finalState));
    const final = ledger.snapshot().finalState;
    assert.equal(final.period, 2);
    assert.equal(final.periodSecondsRemaining, 720);
    assert.equal(final.shotClockSeconds, 24);
  });

  it('starts overtime when regulation is tied', () => {
    const ledger = new NBAEventLedger(state(4, 0, 100, 100));
    ledger.append(createNBAEndOfPeriodEvent(ledger.snapshot().finalState));
    ledger.append(createNBANextPeriodEvent(ledger.snapshot().finalState));
    const events = ledger.snapshot().transitions.map((transition) => transition.event.kind);
    assert.deepEqual(events, ['PERIOD_END', 'OVERTIME_START']);
    assert.equal(ledger.snapshot().finalState.period, 5);
    assert.equal(ledger.snapshot().finalState.periodSecondsRemaining, 300);
  });

  it('ends a non-tied regulation game with GAME_END', () => {
    const ledger = new NBAEventLedger(state(4, 0, 101, 100));
    ledger.append(createNBAEndOfPeriodEvent(ledger.snapshot().finalState));
    assert.equal(ledger.snapshot().transitions.at(-1)?.event.kind, 'GAME_END');
    assert.equal(ledger.snapshot().finalState.periodSecondsRemaining, 0);
  });

  it('replays overtime as repeated canonical periods when still tied', () => {
    const ledger = new NBAEventLedger(state(5, 0, 100, 100));
    ledger.append(createNBAEndOfPeriodEvent(ledger.snapshot().finalState));
    ledger.append(createNBANextPeriodEvent(ledger.snapshot().finalState));
    assert.equal(ledger.snapshot().finalState.period, 6);
    assert.equal(ledger.snapshot().finalState.periodSecondsRemaining, 300);
  });
});
