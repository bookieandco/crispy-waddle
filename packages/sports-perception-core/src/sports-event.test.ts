import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { freezeSportsEvent, nextSportsEventSequence, validateSportsEvent, type SportsEvent } from './sports-event.js';

const makeEvent = (overrides: Partial<SportsEvent> = {}): SportsEvent => ({
  eventId: 'nba-event-v2:game-1:1:SHOT',
  sport: 'NBA',
  gameId: 'game-1',
  sequence: 1,
  eventType: 'SHOT',
  phase: 'LIVE',
  period: 1,
  clockSecondsRemaining: 600,
  participants: [{ participantId: 'A', role: 'TEAM', side: 'HOME' }],
  payload: { made: true, points: 2 },
  observationClass: 'OBSERVED',
  confidence: 0.99,
  provenance: {
    evidenceIds: ['e1'],
    source: { sourceId: 'feed-1', sourceType: 'FEED', observedAt: '2026-09-03T12:00:00.000Z', receivedAt: '2026-09-03T12:00:00.100Z' },
  },
  ...overrides,
});

describe('universal sports event envelope', () => {
  it('validates and freezes a canonical event', () => {
    const event = freezeSportsEvent(makeEvent());
    assert.equal(event.gameId, 'game-1');
    assert.equal(Object.isFrozen(event), true);
    assert.equal(Object.isFrozen(event.participants), true);
    assert.equal(Object.isFrozen(event.provenance), true);
  });

  it('supports every sport without changing the envelope', () => {
    for (const sport of ['NBA', 'NFL', 'MLB', 'NHL', 'SOCCER', 'TENNIS', 'OTHER'] as const) {
      assert.doesNotThrow(() => validateSportsEvent(makeEvent({ sport })));
    }
  });

  it('rejects missing evidence and invalid confidence', () => {
    assert.throws(() => validateSportsEvent(makeEvent({ provenance: { ...makeEvent().provenance, evidenceIds: [] } })), /evidence/);
    assert.throws(() => validateSportsEvent(makeEvent({ confidence: 1.1 })), /confidence/);
  });

  it('rejects received timestamps earlier than observation', () => {
    const event = makeEvent({ provenance: { ...makeEvent().provenance, source: { ...makeEvent().provenance.source, receivedAt: '2026-09-03T11:59:59.000Z' } } });
    assert.throws(() => validateSportsEvent(event), /receivedAt/);
  });

  it('increments sequences without inventing identity', () => {
    assert.equal(nextSportsEventSequence(undefined), 1);
    assert.equal(nextSportsEventSequence(makeEvent({ sequence: 17 })), 18);
  });
});
