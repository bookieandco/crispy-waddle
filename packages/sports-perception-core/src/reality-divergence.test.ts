import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attributeRealityDivergence } from './reality-divergence.js';

const actual = {
  version: 4,
  asOf: '2026-09-03T12:00:04.000Z',
  state: { score: { home: 91, away: 88 }, possession: 'away' },
  eventIds: ['e1', 'e2', 'e4'],
  stateHash: 'actual-hash',
  provisional: false,
};

describe('attributeRealityDivergence', () => {
  it('attributes field-level and event-level divergence', () => {
    const report = attributeRealityDivergence(
      {
        state: { score: { home: 89, away: 88 }, possession: 'home' },
        eventIds: ['e1', 'e2', 'e3'],
        stateHash: 'expected-hash',
      },
      actual,
      ['evidence-4'],
    );

    assert.equal(report.changed, true);
    assert.equal(report.actualVersion, 4);
    assert.deepEqual(report.eventIdsAdded, ['e4']);
    assert.deepEqual(report.eventIdsMissing, ['e3']);
    assert.equal(report.divergences.find((item) => item.path === 'score.home')?.kind, 'SCORE');
    assert.equal(report.divergences.find((item) => item.path === 'possession')?.kind, 'POSSESSION');
    assert.deepEqual(report.divergences[0]?.evidenceIds, ['evidence-4']);
  });

  it('reports agreement without false divergence', () => {
    const report = attributeRealityDivergence(
      { state: actual.state, eventIds: actual.eventIds, stateHash: actual.stateHash },
      actual,
    );
    assert.equal(report.changed, false);
    assert.deepEqual(report.divergences, []);
    assert.equal(report.summary, 'Expected and actual reality states agree');
  });
});
