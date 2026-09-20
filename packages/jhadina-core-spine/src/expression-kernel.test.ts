import assert from 'node:assert/strict';
import { planExpression } from './expression-kernel.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import type { BehavioralDecision } from './behavioral-kernel.js';
import type { PersonalityState } from './types.js';

const callbackEvidence = {
  id: 'callback-evidence-1',
  source: 'conversation',
  observedAt: '2026-09-03T00:00:00.000Z',
  summary: 'callback-1 was used in a prior conversation',
  immutable: true,
};

const personality: PersonalityState = {
  version: 1,
  traits: [],
  voice: {
    directness: 0.9,
    warmth: 0.7,
    humor: 0.8,
    profanityTolerance: 0.7,
    quipFrequency: 0.6,
    verbosity: 0.4,
    disagreementDirectness: 0.6,
  },
  taste: {
    novelty: 0.5,
    experimentation: 0.5,
    conventionTolerance: 0.5,
    aestheticIntensity: 0.5,
    evidence: [],
  },
  relationship: {
    familiarity: 0.8,
    calibrationConfidence: 0.9,
    preferredInteractionModes: [],
    recurringCallbacks: ['callback-1'],
    evidence: [callbackEvidence],
  },
  independentAssessmentRequired: false,
  updatedAt: '2026-09-03T00:00:00.000Z',
};

const decision: BehavioralDecision = {
  action: 'push_back',
  posture: {
    directness: 0.9,
    warmth: 0.7,
    humor: 0.8,
    profanityAllowed: true,
    profanityIntensity: 0.6,
    quipsAllowed: true,
    quipIntensity: 0.5,
    disagreementDirectness: 0.6,
    relationshipFamiliarity: 0.8,
    relationshipCalibration: 0.72,
    preferredInteractionModes: [],
    creativeLatitude: 0.5,
    conventionTolerance: 0.5,
    authenticityRequired: true,
  },
  confidence: 0.6,
  reasons: ['test'],
};

describe('Expression Kernel', () => {
  it('maps behavioral action to an expression plan with verified callback provenance', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    assert.ok(callback);

    assert.deepEqual(planExpression(decision, { callback, culturalReference: 'reference-1' }), {
      mode: 'pushback',
      allowProfanity: true,
      allowQuip: true,
      callback: 'callback-1',
      callbackProvenance: [{
        origin: 'relationship',
        evidence: callbackEvidence,
      }],
      culturalReference: 'reference-1',
    });
  });

  it('never allows serious mode to re-enable profanity, quips, or callbacks', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    assert.ok(callback);

    const serious: BehavioralDecision = { ...decision, action: 'stay_serious' };
    const plan = planExpression(serious, { callback });
    assert.equal(plan.mode, 'serious');
    assert.equal(plan.allowProfanity, false);
    assert.equal(plan.allowQuip, false);
    assert.equal(plan.callback, undefined);
    assert.equal(plan.callbackProvenance, undefined);
  });
});
