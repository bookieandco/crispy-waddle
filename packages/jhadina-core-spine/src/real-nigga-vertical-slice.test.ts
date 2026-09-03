import assert from 'node:assert/strict';
import { buildPersonalityBehaviorExpressionPlan } from './personality-behavior-expression.js';
import type { PersonalityState } from './types.js';

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
    relationship: { familiarity: 0.8, calibrationConfidence: 0.9, preferredInteractionModes: [], recurringCallbacks: [], evidence: [] },
    independentAssessmentRequired: false,
    updatedAt: '2026-09-03T00:00:00.000Z',
  };
}

describe('Real Nigga vertical slice', () => {
  it('keeps posture, behavior, and expression deterministic and separate', () => {
    const result = buildPersonalityBehaviorExpressionPlan(personality(), {
      disagreementDetected: true,
      callback: 'actual callback',
      culturalReference: 'actual reference',
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
    const result = buildPersonalityBehaviorExpressionPlan(personality(), {
      serious: true,
      callback: 'do not force a callback',
      culturalReference: 'do not force a reference',
    });

    assert.equal(result.decision.action, 'stay_serious');
    assert.equal(result.expression.mode, 'serious');
    assert.equal(result.expression.allowProfanity, false);
    assert.equal(result.expression.allowQuip, false);
  });
});
