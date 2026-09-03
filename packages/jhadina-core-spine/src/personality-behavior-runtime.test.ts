import assert from 'node:assert/strict';
import { runPersonalityBehaviorRuntime } from './personality-behavior-runtime.js';
import type { MemoryProposal, PatternObservation, PersonalityState } from './types.js';

const personality: PersonalityState = {
  version: 0,
  traits: [],
  voice: {
    directness: 0.9,
    warmth: 0.7,
    humor: 0.8,
    profanityTolerance: 0.7,
    quipFrequency: 0.6,
    verbosity: 0.4,
    disagreementDirectness: 0.8,
  },
  taste: { novelty: 0.5, experimentation: 0.5, conventionTolerance: 0.5, aestheticIntensity: 0.5, evidence: [] },
  relationship: { familiarity: 0.8, calibrationConfidence: 0.9, preferredInteractionModes: [], recurringCallbacks: [], evidence: [] },
  independentAssessmentRequired: false,
  updatedAt: '2026-09-03T00:00:00.000Z',
};

const evidence = {
  id: 'memory-1',
  source: 'memory',
  observedAt: '2026-09-02T00:00:00.000Z',
  summary: 'prefers direct answers',
  immutable: true,
};

const memory: MemoryProposal = {
  id: 'memory-proposal-1',
  content: 'prefers direct answers',
  disposition: 'SAVE',
  evidence: [evidence],
};

const pattern: PatternObservation = {
  id: 'pattern-1',
  pattern: 'prefers direct answers',
  evidence: [evidence],
  confidence: 0.9,
  occurrences: 3,
  contradictions: [],
  lastObservedAt: '2026-09-03T00:00:00.000Z',
  personalityEligible: true,
  personalityDimension: 'communication',
};

describe('Personality → Real Nigga → Behavioral → Expression vertical slice', () => {
  it('projects eligible evidence before selecting behavior and expression', () => {
    const result = runPersonalityBehaviorRuntime({
      personality,
      patterns: [pattern],
      memories: [memory],
      now: '2026-09-03T00:01:00.000Z',
      idFactory: () => 'trait-1',
    });

    assert.equal(result.personality.traits[0]?.status, 'accepted');
    assert.equal(result.behavior.action, 'answer_directly');
    assert.equal(result.expression.mode, 'direct');
    assert.equal(result.expression.allowQuip, true);
    assert.equal(result.expression.allowProfanity, true);
  });

  it('keeps serious context authoritative over personality style', () => {
    const result = runPersonalityBehaviorRuntime({
      personality,
      patterns: [],
      memories: [],
      behaviorContext: { serious: true },
      expressionContext: { callback: 'ignored-for-serious-wording' },
    });

    assert.equal(result.behavior.action, 'stay_serious');
    assert.equal(result.expression.mode, 'serious');
    assert.equal(result.expression.allowQuip, false);
    assert.equal(result.expression.allowProfanity, false);
  });

  it('does not mutate the supplied personality state', () => {
    const before = structuredClone(personality);
    runPersonalityBehaviorRuntime({ personality, patterns: [pattern], memories: [memory] });
    assert.deepEqual(personality, before);
  });
});
