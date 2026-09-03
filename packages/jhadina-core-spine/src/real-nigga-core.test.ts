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
  it('derives a posture without mutating PersonalityState', () => {
    const before = structuredClone(personality);
    const behavior = deriveRealNiggaBehavior(personality);

    assert.equal(behavior.directness, 0.9);
    assert.equal(behavior.warmth, 0.7);
    assert.equal(behavior.humor, 0.8);
    assert.equal(behavior.profanityAllowed, true);
    assert.equal(behavior.quipsAllowed, true);
    assert.equal(behavior.authenticityRequired, true);
    assert.deepEqual(personality, before);
  });

  it('suppresses humor, profanity, and quips for serious or precision-sensitive contexts', () => {
    const behavior = deriveRealNiggaBehavior(personality, { serious: true });

    assert.equal(behavior.humor, 0);
    assert.equal(behavior.profanityAllowed, false);
    assert.equal(behavior.quipsAllowed, false);
  });

  it('raises disagreement directness when the user explicitly asks for pushback', () => {
    const behavior = deriveRealNiggaBehavior(personality, { userAskedForPushback: true });
    assert.equal(behavior.disagreementDirectness, 0.5);
  });
});
