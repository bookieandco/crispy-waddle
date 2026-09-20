import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { planExpression } from './expression-kernel.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import { verifyFreshCulturalReference } from './cultural-freshness.js';
import type { BehavioralDecision } from './behavioral-kernel.js';
import type { PersonalityState } from './types.js';

const callbackEvidence = {
  id: 'callback-evidence-1',
  source: 'conversation',
  observedAt: '2026-09-03T00:00:00.000Z',
  summary: 'callback-1 was used in a prior conversation',
  immutable: true,
};

const culturalEvidence = {
  id: 'cultural-evidence-1',
  source: 'knowledge',
  observedAt: '2026-09-03T00:00:00.000Z',
  summary: 'reference-1 is a current cultural reference.',
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
    verbosity: 0.4,
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
  it('maps behavioral action to an expression plan with verified provenance', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    const culturalReference = verifyFreshCulturalReference({
      reference: 'reference-1',
      knowledge: [culturalEvidence],
      now: '2026-09-03T01:00:00.000Z',
      freshnessWindowMs: 24 * 60 * 60 * 1000,
    });
    assert.ok(callback);
    assert.ok(culturalReference);

    assert.deepEqual(planExpression(decision, { callback, culturalReference }), {
      mode: 'pushback',
      allowProfanity: true,
      allowQuip: true,
      responseLength: 'brief',
      callback: 'callback-1',
      callbackProvenance: [{
        origin: 'relationship',
        evidence: callbackEvidence,
      }],
      culturalReference: 'reference-1',
      culturalReferenceEvidence: [culturalEvidence],
    });
  });

  it('never allows serious mode to re-enable profanity, quips, callbacks, or cultural references', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'callback-1' });
    const culturalReference = verifyFreshCulturalReference({
      reference: 'reference-1',
      knowledge: [culturalEvidence],
      now: '2026-09-03T01:00:00.000Z',
      freshnessWindowMs: 24 * 60 * 60 * 1000,
    });
    assert.ok(callback);
    assert.ok(culturalReference);

    const serious: BehavioralDecision = { ...decision, action: 'stay_serious' };
    const plan = planExpression(serious, { callback, culturalReference });
    assert.equal(plan.mode, 'serious');
    assert.equal(plan.allowProfanity, false);
    assert.equal(plan.allowQuip, false);
    assert.equal(plan.responseLength, 'brief');
    assert.equal(plan.callback, undefined);
    assert.equal(plan.callbackProvenance, undefined);
    assert.equal(plan.culturalReference, undefined);
    assert.equal(plan.culturalReferenceEvidence, undefined);
  });
});
