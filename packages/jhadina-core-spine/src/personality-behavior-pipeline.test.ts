import assert from 'node:assert/strict';
import { buildPersonalityBehavior } from './personality-behavior-pipeline.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import { verifyFreshCulturalReference } from './cultural-freshness.js';
import type { PersonalityState } from './types.js';

const callbackEvidence = {
  id: 'callback-shared-history',
  source: 'conversation',
  observedAt: '2026-09-02T12:00:00.000Z',
  summary: 'shared-history is a recurring callback.',
  immutable: true,
};

const culturalEvidence = {
  id: 'culture-fresh-reference',
  source: 'knowledge',
  observedAt: '2026-09-02T12:00:00.000Z',
  summary: 'fresh-reference is a currently verified cultural reference.',
  immutable: true,
};

const personality: PersonalityState = {
  version: 2,
  traits: [],
  voice: { directness: 0.9, warmth: 0.7, humor: 0.8, profanityTolerance: 0.7, quipFrequency: 0.6, verbosity: 0.4, disagreementDirectness: 0.3 },
  taste: { novelty: 0.6, experimentation: 0.6, conventionTolerance: 0.5, aestheticIntensity: 0.7, evidence: [] },
  relationship: {
    familiarity: 0.8,
    calibrationConfidence: 0.9,
    preferredInteractionModes: ['direct'],
    recurringCallbacks: ['shared-history'],
    evidence: [callbackEvidence],
  },
  independentAssessmentRequired: false,
  updatedAt: '2026-09-02T20:00:00.000Z',
};

describe('Personality → Real Nigga → Behavioral → Expression vertical slice', () => {
  it('preserves the boundary between behavioral selection and verified wording inputs', () => {
    const callback = selectEvidenceBackedCallback({ personality, callback: 'shared-history' });
    const culturalReference = verifyFreshCulturalReference({
      reference: 'fresh-reference',
      knowledge: [culturalEvidence],
      now: '2026-09-03T00:00:00.000Z',
      freshnessWindowMs: 24 * 60 * 60 * 1000,
    });
    assert.ok(callback);
    assert.ok(culturalReference);

    const result = buildPersonalityBehavior({
      personality,
      behavior: { disagreementDetected: true },
      expression: { callback, culturalReference },
    });

    assert.equal(result.behavior.action, 'push_back');
    assert.equal(result.expression.mode, 'pushback');
    assert.equal(result.expression.allowProfanity, true);
    assert.equal(result.expression.allowQuip, true);
    assert.equal(result.expression.callback, 'shared-history');
    assert.equal(result.expression.culturalReference, 'fresh-reference');
    assert.deepEqual(result.expression.callbackProvenance?.map((item) => item.evidence.id), ['callback-shared-history']);
    assert.deepEqual(result.expression.culturalReferenceEvidence?.map((ref) => ref.id), ['culture-fresh-reference']);
  });

  it('forces serious behavior through the complete slice', () => {
    const result = buildPersonalityBehavior({ personality, behavior: { serious: true } });
    assert.equal(result.behavior.action, 'stay_serious');
    assert.equal(result.expression.mode, 'serious');
    assert.equal(result.expression.allowProfanity, false);
    assert.equal(result.expression.allowQuip, false);
  });

  it('does not mutate durable personality state', () => {
    const before = structuredClone(personality);
    buildPersonalityBehavior({ personality, behavior: { userAskedForPushback: true } });
    assert.deepEqual(personality, before);
  });
});
