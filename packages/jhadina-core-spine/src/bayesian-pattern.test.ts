import assert from 'node:assert/strict';
import { assessPatternBayesian, projectBayesianPattern } from './bayesian-pattern.js';
import type { PatternObservation } from './types.js';

const pattern: PatternObservation = {
  id: 'pattern-1',
  pattern: 'prefers direct communication',
  evidence: [],
  confidence: 0.5,
  occurrences: 3,
  contradictions: [],
  lastObservedAt: '2026-09-02T00:00:00.000Z',
  personalityEligible: true,
  personalityDimension: 'communication',
};

describe('Bayesian pattern assessment', () => {
  it('updates a pattern belief without mutating the observation', () => {
    const before = structuredClone(pattern);
    const result = assessPatternBayesian(pattern, [
      { support: 1, weight: 2, reliability: 1 },
      { support: 0.8, weight: 1, reliability: 0.5 },
    ]);

    assert.equal(result.patternId, 'pattern-1');
    assert.equal(result.posteriorAlpha, 3.4);
    assert.equal(result.posteriorBeta, 1.6);
    assert.equal(result.confidence, 0.68);
    assert.equal(result.evidenceCount, 2);
    assert.equal(result.eligibleForPersonality, true);
    assert.deepEqual(pattern, before);
  });

  it('projects posterior confidence without granting personality eligibility', () => {
    const ordinaryPattern = { ...pattern, confidence: 0.2, personalityEligible: false, personalityDimension: undefined };
    const projected = projectBayesianPattern(ordinaryPattern, [{ support: 1, weight: 1 }]);

    assert.equal(projected.confidence, 2 / 3);
    assert.equal(projected.personalityEligible, false);
    assert.equal(projected.personalityDimension, undefined);
    assert.equal(ordinaryPattern.confidence, 0.2);
  });

  it('does not grant personality eligibility to an ordinary pattern', () => {
    const result = assessPatternBayesian(
      { ...pattern, personalityEligible: false, personalityDimension: undefined },
      [{ support: 1, weight: 10 }],
    );

    assert.equal(result.confidence, 11 / 12);
    assert.equal(result.eligibleForPersonality, false);
  });

  it('rejects malformed pattern occurrences', () => {
    assert.throws(
      () => assessPatternBayesian({ ...pattern, occurrences: 0 }, [{ support: 1, weight: 1 }]),
      /occurrences must be a positive integer/,
    );
  });
});
