import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildPersonalityBehaviorExpressionPlan } from './personality-behavior-expression.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import type { PersonalityState } from './types.js';

const callbackEvidence = {
  id: 'callback-evidence-1',
  source: 'conversation',
  observedAt: '2026-09-03T01:00:00.000Z',
  summary: 'callback-1 was used in prior conversation',
  immutable: true,
};

const personality: PersonalityState = {
  version: 1, traits: [],
  voice: { directness: 0.9, warmth: 0.7, humor: 0.8, profanityTolerance: 0.7, quipFrequency: 0.6, verbosity: 0.4, disagreementDirectness: 0.3 },
  taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
  relationship: {
    familiarity: 0.8,
    calibrationConfidence: 0.9,
    preferredInteractionModes: [],
    recurringCallbacks: ['callback-1'],
    evidence: [callbackEvidence],
  },
  independentAssessmentRequired: false, updatedAt: '2026-09-03T02:00:00.000Z',
};

describe('Personality behavior expression slice', () => {
  it('keeps the three behavioral boundaries explicit', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    assert.ok(callback);

    const plan = buildPersonalityBehaviorExpressionPlan(personality, {
      disagreementDetected: true,
      callback,
    });
    assert.equal(plan.behavior.authenticityRequired, true);
    assert.equal(plan.decision.action, 'push_back');
    assert.equal(plan.expression.mode, 'pushback');
    assert.equal(plan.expression.callback, 'callback-1');
    assert.deepEqual(plan.expression.callbackProvenance?.map((item) => item.evidence.id), ['callback-evidence-1']);
  });

  it('preserves the serious-context safety posture through the whole slice', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    assert.ok(callback);

    const plan = buildPersonalityBehaviorExpressionPlan(personality, { serious: true, callback });
    assert.equal(plan.decision.action, 'stay_serious');
    assert.equal(plan.expression.mode, 'serious');
    assert.equal(plan.expression.allowProfanity, false);
    assert.equal(plan.expression.allowQuip, false);
    assert.equal(plan.expression.callback, undefined);
  });

  it('does not mutate the durable personality state', () => {
    const before = structuredClone(personality);
    buildPersonalityBehaviorExpressionPlan(personality, { userAskedForPushback: true });
    assert.deepEqual(personality, before);
  });
});
