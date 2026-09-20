import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  createPersonalityEligibilityClassifier,
  type PersonalityEligibilityRule,
} from './personality-eligibility.js';
import type { EvidenceRef, PatternObservation } from './types.js';

const rule: PersonalityEligibilityRule = {
  ruleId: 'communication-semantic-v1',
  patternIdPrefix: 'personality-signal:communication:',
  dimension: 'communication',
  minimumObservations: 3,
  minimumEvidence: 3,
  maximumContradictions: 0,
  requireImmutableEvidence: true,
};

const evidence = (id: string): EvidenceRef => ({
  id,
  source: 'conversation',
  observedAt: '2026-09-03T00:00:00.000Z',
  summary: `explicit communication evidence ${id}`,
  immutable: true,
});

function pattern(overrides: Partial<PatternObservation> = {}): PatternObservation {
  return {
    id: 'personality-signal:communication:directness',
    pattern: 'prefers direct communication',
    evidence: [evidence('e1'), evidence('e2'), evidence('e3')],
    confidence: 0.2,
    occurrences: 3,
    contradictions: [],
    lastObservedAt: '2026-09-03T00:00:00.000Z',
    personalityEligible: false,
    personalityDimension: 'communication',
    ...overrides,
  };
}

describe('GovernedPersonalityEligibilityClassifier', () => {
  it('fails closed by default for generic patterns regardless of confidence or detector flags', () => {
    const classifier = createPersonalityEligibilityClassifier();
    const input = pattern({
      id: 'recurrence:direct',
      confidence: 0.999,
      personalityEligible: true,
      personalityDimension: 'communication',
    });

    const decision = classifier.classify(input);
    const [projected] = classifier.project([input]);

    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'no_matching_rule');
    assert.equal(projected.personalityEligible, false);
    assert.equal(projected.personalityDimension, undefined);
  });

  it('admits only an explicitly allowlisted semantic family with sufficient governed evidence', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const input = pattern({ confidence: 0.1 });

    const decision = classifier.classify(input);

    assert.equal(decision.eligible, true);
    assert.equal(decision.dimension, 'communication');
    assert.equal(decision.ruleId, 'communication-semantic-v1');
    assert.equal(decision.reason, 'eligible');
  });

  it('does not use Bayesian confidence as an eligibility threshold', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);

    assert.equal(classifier.classify(pattern({ confidence: 0.01 })).eligible, true);
    assert.equal(classifier.classify(pattern({ confidence: 0.99 })).eligible, true);
  });

  it('rejects a detector-proposed dimension that disagrees with governance', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const decision = classifier.classify(pattern({ personalityDimension: 'taste' }));

    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'dimension_mismatch');
  });

  it('rejects insufficient independent observations even with enough evidence refs', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const decision = classifier.classify(pattern({ occurrences: 1 }));

    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'insufficient_observations');
  });

  it('rejects contradictions beyond the explicit rule allowance', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const decision = classifier.classify(pattern({ contradictions: [evidence('c1')] }));

    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'contradicted');
  });

  it('requires immutable evidence when the governing rule requires it', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const mutable = evidence('mutable');
    delete mutable.immutable;

    const decision = classifier.classify(
      pattern({ evidence: [evidence('e1'), evidence('e2'), mutable] }),
    );

    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, 'mutable_evidence');
  });

  it('projects eligibility without mutating the detector observation', () => {
    const classifier = createPersonalityEligibilityClassifier([rule]);
    const input = pattern();
    const before = structuredClone(input);

    const [projected] = classifier.project([input]);

    assert.equal(projected.personalityEligible, true);
    assert.equal(projected.personalityDimension, 'communication');
    assert.deepEqual(input, before);
  });
});
