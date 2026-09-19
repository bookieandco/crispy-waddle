import { describe, expect, it } from 'vitest';
import { EventIdentityRegistry, EventTimeline, TemporalIdentityRegistry, TemporalRoster } from './identity.js';

describe('TemporalIdentityRegistry', () => {
  it('fails closed on ambiguous aliases', () => {
    const registry = new TemporalIdentityRegistry();
    registry.register({ canonicalId: 'team-a', entityType: 'TEAM', sport: 'NBA', names: ['Wolves'], externalIds: [], validity: { validFrom: '2020-01-01T00:00:00Z' } });
    registry.register({ canonicalId: 'team-b', entityType: 'TEAM', sport: 'NBA', names: ['Wolves'], externalIds: [], validity: { validFrom: '2020-01-01T00:00:00Z' } });
    expect(registry.resolveAlias('TEAM', 'NBA', 'Wolves', '2025-01-01T00:00:00Z')).toBeUndefined();
  });

  it('prevents one provider identity from mapping to two entities', () => {
    const registry = new TemporalIdentityRegistry();
    registry.register({ canonicalId: 'p1', entityType: 'PLAYER', sport: 'NBA', names: ['Player One'], externalIds: [{ provider: 'feed', externalId: '7' }], validity: { validFrom: '2020-01-01T00:00:00Z' } });
    expect(() => registry.register({ canonicalId: 'p2', entityType: 'PLAYER', sport: 'NBA', names: ['Player Two'], externalIds: [{ provider: 'feed', externalId: '7' }], validity: { validFrom: '2020-01-01T00:00:00Z' } })).toThrow();
  });
});

describe('TemporalRoster', () => {
  it('returns the roster valid at the requested cutoff, not the future roster', () => {
    const roster = new TemporalRoster();
    roster.addMembership({ playerId: 'p1', teamId: 'team-a', validFrom: '2024-01-01T00:00:00Z', validTo: '2025-01-01T00:00:00Z', evidenceIds: ['e1'] });
    roster.addMembership({ playerId: 'p1', teamId: 'team-b', validFrom: '2025-01-01T00:00:00Z', evidenceIds: ['e2'] });
    expect(roster.teamForPlayer('p1', '2024-06-01T00:00:00Z')).toBe('team-a');
    expect(roster.teamForPlayer('p1', '2025-06-01T00:00:00Z')).toBe('team-b');
  });

  it('rejects overlapping memberships across teams', () => {
    const roster = new TemporalRoster();
    roster.addMembership({ playerId: 'p1', teamId: 'team-a', validFrom: '2024-01-01T00:00:00Z', validTo: '2025-01-01T00:00:00Z', evidenceIds: ['e1'] });
    expect(() => roster.addMembership({ playerId: 'p1', teamId: 'team-b', validFrom: '2024-06-01T00:00:00Z', evidenceIds: ['e2'] })).toThrow();
  });
});

describe('EventIdentityRegistry', () => {
  it('rejects duplicate provider event identities and same-team matchups', () => {
    const registry = new EventIdentityRegistry();
    expect(() => registry.register({ eventId: 'g1', sport: 'NFL', scheduledAt: '2026-09-01T18:00:00Z', homeTeamId: 't1', awayTeamId: 't1', externalIds: [], evidenceIds: ['e1'] })).toThrow();
    registry.register({ eventId: 'g1', sport: 'NFL', scheduledAt: '2026-09-01T18:00:00Z', homeTeamId: 't1', awayTeamId: 't2', externalIds: [{ provider: 'feed', externalId: 'game-1' }], evidenceIds: ['e1'] });
    expect(() => registry.register({ eventId: 'g2', sport: 'NFL', scheduledAt: '2026-09-01T18:00:00Z', homeTeamId: 't3', awayTeamId: 't4', externalIds: [{ provider: 'feed', externalId: 'game-1' }], evidenceIds: ['e2'] })).toThrow();
  });
});

describe('EventTimeline', () => {
  it('excludes evidence received after the historical cutoff and orders deterministically', () => {
    const timeline = new EventTimeline();
    timeline.append({ eventId: 'g1', observedAt: '2026-09-01T18:00:01Z', receivedAt: '2026-09-01T18:00:02Z', sequence: 2, type: 'SCORE', payload: { home: 7 }, evidenceIds: ['e2'] });
    timeline.append({ eventId: 'g1', observedAt: '2026-09-01T18:00:00Z', receivedAt: '2026-09-01T18:00:01Z', sequence: 1, type: 'START', payload: {}, evidenceIds: ['e1'] });
    timeline.append({ eventId: 'g1', observedAt: '2026-09-01T18:00:03Z', receivedAt: '2026-09-01T18:00:10Z', sequence: 3, type: 'FUTURE', payload: {}, evidenceIds: ['e3'] });
    expect(timeline.forEvent('g1', '2026-09-01T18:00:05Z').map((x) => x.type)).toEqual(['START', 'SCORE']);
  });
});
