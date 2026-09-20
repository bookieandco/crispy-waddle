import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveRealNiggaBehavior } from './real-nigga-core.js';
import type { PersonalityState } from './types.js';

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
    disagreementDirectness: 0.3,
  },
  taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
  relationship: { familiarity: 0.8, calibrationConfidence: 0.9, preferredInteractionModes: [], recurringCallbacks: [], evidence: [] },
  independentAssessmentRequired: false,
  updatedAt: '2026-09-02T20:00:00.000Z',
};

describe('Real Nigga Core', () => {
  it('derives a relationship- and taste-calibrated posture without mutating PersonalityState', () => {
    const before = structuredClone(personality);
    const behavior = deriveRealNiggaBehavior(personality);

    assert.equal(behavior.directness, 0.9);
    assert.equal(behavior.warmth, 0.7);
    assert.equal(behavior.humor, 0.8);
    assert.equal(behavior.profanityAllowed, true);
    assert.equal(behavior.quipsAllowed, true);
    assert.equal(behavior.relationshipFamiliarity, 0.8);
    assert.ok(Math.abs(behavior.relationshipCalibration - 0.72) < 1e-12);
    assert.equal(behavior.creativeLatitude, 0.5);
    assert.equal(behavior.conventionTolerance, 0.5);
    assert.equal(behavior.authenticityRequired, true);
    assert.deepEqual(personality, before);
  });

  it('uses evidence-backed preferred interaction modes only as bounded calibration', () => {
    const calibrated: PersonalityState = {
      ...personality,
      voice: { ...personality.voice, directness: 0.62 },
      relationship: {
        ...personality.relationship,
        preferredInteractionModes: [' direct ', 'DIRECT'],
      },
    };

    const behavior = deriveRealNiggaBehavior(calibrated);

    assert.deepEqual(behavior.preferredInteractionModes, ['direct']);
    assert.ok(behavior.directness > 0.7);
    assert.ok(behavior.directness < 0.75);
  });

  it('uses taste to derive bounded creative latitude without changing durable taste', () => {
    const expressive: PersonalityState = {
      ...personality,
      taste: {
        ...personality.taste,
        novelty: 1,
        experimentation: 0.9,
        conventionTolerance: 0.1,
        aestheticIntensity: 0.8,
      },
    };
    const before = structuredClone(expressive);

    const behavior = deriveRealNiggaBehavior(expressive);

    assert.ok(behavior.creativeLatitude > 0.8);
    assert.ok(behavior.quipIntensity > 0);
    assert.deepEqual(expressive, before);
  });

  it('suppresses humor, profanity, quips, and creative latitude for serious or precision-sensitive contexts', () => {
    const behavior = deriveRealNiggaBehavior(personality, { serious: true });

    assert.equal(behavior.humor, 0);
    assert.equal(behavior.profanityAllowed, false);
    assert.equal(behavior.profanityIntensity, 0);
    assert.equal(behavior.quipsAllowed, false);
    assert.equal(behavior.quipIntensity, 0);
    assert.equal(behavior.creativeLatitude, 0);
  });

  it('raises disagreement directness when the user explicitly asks for pushback', () => {
    const behavior = deriveRealNiggaBehavior(personality, { userAskedForPushback: true });
    assert.equal(behavior.disagreementDirectness, 0.5);
  });
});
