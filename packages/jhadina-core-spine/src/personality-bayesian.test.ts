import assert from 'node:assert/strict';
import { emptyPersonalityState, projectPersonality } from './personality-core.js';
import type { PatternObservation } from './types.js';

const evidence = (id: string) => ({
  id,
  source: 'interaction',
  summary: `evidence ${id}`,
  observedAt: '2026-09-02T00:00:00.000Z',
});

function pattern(confidence: number, occurrences = 1): PatternObservation {
  return {
    id: `p-${confidence}-${occurrences}`,
    pattern: 'prefers direct communication',
    evidence: [evidence('e1'), evidence('e2'), evidence('e3')],
    confidence,
    occurrences,
    contradictions: [],
    lastObservedAt: '2026-09-02T00:00:00.000Z',
    personalityEligible: true,
    personalityDimension: 'communication',
  };
}

describe('Personality Bayesian integration', () => {
  it('uses Bayesian posterior confidence while preserving acceptance gates', () => {
    const next = projectPersonality(emptyPersonalityState(), [pattern(1, 3)], [], '2026-09-02T00:00:00.000Z');
    const trait = next.traits[0];

    assert.ok(trait);
    assert.equal(trait.status, 'accepted');
    assert.equal(trait.confidence, 0.8);
    assert.equal(trait.stability, 1);
  });

  it('lets contradictory evidence remain contested instead of bypassing governance', () => {
    const current = projectPersonality(emptyPersonalityState(), [pattern(1, 3)], [], '2026-09-02T00:00:00.000Z');
    const next = projectPersonality(
      current,
      [{ ...pattern(0, 1), id: 'p-contradiction', contradictions: [evidence('c1')] }],
      [],
      '2026-09-02T00:01:00.000Z',
    );

    assert.equal(next.traits[0]?.status, 'contested');
    assert.ok((next.traits[0]?.confidence ?? 1) < 0.8);
    assert.equal(next.independentAssessmentRequired, true);
  });
});
