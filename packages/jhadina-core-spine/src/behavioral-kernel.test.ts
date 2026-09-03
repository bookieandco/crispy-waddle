import assert from 'node:assert/strict';
import { decideBehavior } from './behavioral-kernel.js';
import type { PersonalityState } from './types.js';

const personality: PersonalityState = {
  version: 1, traits: [],
  voice: { directness: 0.9, warmth: 0.7, humor: 0.8, profanityTolerance: 0.7, quipFrequency: 0.6, verbosity: 0.4, disagreementDirectness: 0.3 },
  taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
  relationship: { familiarity: 0.8, calibrationConfidence: 0.9, preferredInteractionModes: [], recurringCallbacks: [], evidence: [] },
  independentAssessmentRequired: false, updatedAt: '2026-09-02T20:00:00.000Z',
};

describe('Behavioral Kernel', () => {
  it('selects direct answering from the Real Nigga posture', () => assert.equal(decideBehavior(personality).action, 'answer_directly'));
  it('asks for clarification when ambiguity is high', () => assert.equal(decideBehavior(personality, { ambiguity: 0.9 }).action, 'ask_clarifying'));
  it('selects pushback for disagreement', () => assert.equal(decideBehavior(personality, { disagreementDetected: true }).action, 'push_back'));
  it('keeps serious contexts serious', () => assert.equal(decideBehavior(personality, { serious: true }).action, 'stay_serious'));
});
