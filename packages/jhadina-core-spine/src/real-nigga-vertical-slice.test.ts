import assert from 'node:assert/strict';
import { buildPersonalityBehaviorExpressionPlan } from './personality-behavior-expression.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import { verifyFreshCulturalReference } from './cultural-freshness.js';
import type { PersonalityState } from './types.js';

const callbackEvidence = {
  id: 'callback-actual',
  source: 'conversation',
  observedAt: '2026-09-02T00:00:00.000Z',
  summary: 'actual callback is an established recurring callback.',
  immutable: true,
};

const culturalEvidence = {
  id: 'culture-actual',
  source: 'knowledge',
  observedAt: '2026-09-02T00:00:00.000Z',
  summary: 'actual reference is current cultural knowledge.',
  immutable: true,
};

function personality(): PersonalityState {
  return {
    version: 1,
    traits: [],
    voice: {
      directness: 0.9,
      warmth: 0.7,
      humor: 0.8,
      profanityTolerance: 0.7,
      quipFrequency: 0.6,
      verbosity: 0.4,
      disagreementDirectness: 0.3,
    },
    taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
    relationship: {
      familiarity: 0.8,
      calibrationConfidence: 0.9,
      preferredInteractionModes: [],
      recurringCallbacks: ['actual callback'],
      evidence: [callbackEvidence],
    },
    independentAssessmentRequired: false,
    updatedAt: '2026-09-03T00:00:00.000Z',
  };
}

describe('Real Nigga vertical slice', () => {
  it('keeps posture, behavior, and expression deterministic and separate', () => {
    const state = personality();
    const callback = selectEvidenceBackedCallback({ personality: state, callback: 'actual callback' });
    const culturalReference = verifyFreshCulturalReference({
      reference: 'actual reference',
      knowledge: [culturalEvidence],
      now: '2026-09-03T00:00:00.000Z',
      freshnessWindowMs: 2 * 24 * 60 * 60 * 1000,
    });
    assert.ok(callback);
    assert.ok(culturalReference);

    const result = buildPersonalityBehaviorExpressionPlan(state, {
      disagreementDetected: true,
      callback,
      culturalReference,
    });

    assert.equal(result.behavior.authenticityRequired, true);
    assert.equal(result.decision.action, 'push_back');
    assert.equal(result.expression.mode, 'pushback');
    assert.equal(result.expression.allowProfanity, true);
    assert.equal(result.expression.allowQuip, true);
    assert.equal(result.expression.callback, 'actual callback');
    assert.equal(result.expression.culturalReference, 'actual reference');
  });

  it('cannot let expression context override serious behavioral constraints', () => {
    const state = personality();
    const callback = selectEvidenceBackedCallback({ personality: state, callback: 'actual callback' });
    const culturalReference = verifyFreshCulturalReference({
      reference: 'actual reference',
      knowledge: [culturalEvidence],
      now: '2026-09-03T00:00:00.000Z',
      freshnessWindowMs: 2 * 24 * 60 * 60 * 1000,
    });
    assert.ok(callback);
    assert.ok(culturalReference);

    const result = buildPersonalityBehaviorExpressionPlan(state, {
      serious: true,
      callback,
      culturalReference,
    });

    assert.equal(result.decision.action, 'stay_serious');
    assert.equal(result.expression.mode, 'serious');
    assert.equal(result.expression.allowProfanity, false);
    assert.equal(result.expression.allowQuip, false);
    assert.equal(result.expression.callback, undefined);
    assert.equal(result.expression.culturalReference, undefined);
  });
});
