import assert from 'node:assert/strict';
import { buildPersonalityBehaviorExpressionPlan } from './personality-behavior-expression.js';
import type { PersonalityState } from './types.js';

const personality: PersonalityState = {
  version: 1, traits: [],
  voice: { directness: 0.9, warmth: 0.7, humor: 0.8, profanityTolerance: 0.7, quipFrequency: 0.6, verbosity: 0.4, disagreementDirectness: 0.3 },
  taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
  relationship: { familiarity: 0.8, calibrationConfidence: 0.9, preferredInteractionModes: [], recurringCallbacks: [], evidence: [] },
  independentAssessmentRequired: false, updatedAt: '2026-09-03T02:00:00.000Z',
};

describe('Personality behavior expression slice', () => {
  it('keeps the three behavioral boundaries explicit', () => {
    const plan = buildPersonalityBehaviorExpressionPlan(personality, { disagreementDetected: true, callback: 'callback-1' });
    assert.equal(plan.behavior.authenticityRequired, true);
    assert.equal(plan.decision.action, 'push_back');
    assert.equal(plan.expression.mode, 'pushback');
    assert.equal(plan.expression.callback, 'callback-1');
  });

  it('preserves the serious-context safety posture through the whole slice', () => {
    const plan = buildPersonalityBehaviorExpressionPlan(personality, { serious: true, callback: 'ignored-as-quip' });
    assert.equal(plan.decision.action, 'stay_serious');
    assert.equal(plan.expression.mode, 'serious');
    assert.equal(plan.expression.allowProfanity, false);
    assert.equal(plan.expression.allowQuip, false);
  });

  it('does not mutate the durable personality state', () => {
    const before = structuredClone(personality);
    buildPersonalityBehaviorExpressionPlan(personality, { userAskedForPushback: true });
    assert.deepEqual(personality, before);
  });
});
