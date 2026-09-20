import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { runPersonalityBehaviorRuntime } from './personality-behavior-runtime.js';
import type { PersonalityEligibilityRule } from './personality-eligibility.js';
import type { EvidenceRef, MemoryProposal, PatternObservation, PersonalityState } from './types.js';

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

const evidence = (id: string): EvidenceRef => ({
  id,
  source: 'memory',
  observedAt: '2026-09-02T00:00:00.000Z',
  summary: `prefers direct answers ${id}`,
  immutable: true,
});

const memoryEvidence = [evidence('memory-1'), evidence('memory-2'), evidence('memory-3')];

const memory: MemoryProposal = {
  id: 'memory-proposal-1',
  content: 'prefers direct answers',
  reason: 'approved communication preference evidence',
  disposition: 'SAVE',
  evidence: memoryEvidence,
};

const pattern: PatternObservation = {
  id: 'personality-signal:communication:direct-answers',
  pattern: 'prefers direct answers',
  evidence: memoryEvidence,
  confidence: 1,
  occurrences: 3,
  contradictions: [],
  lastObservedAt: '2026-09-03T00:00:00.000Z',
  personalityEligible: false,
  personalityDimension: 'communication',
};

const eligibilityRule: PersonalityEligibilityRule = {
  ruleId: 'communication-semantic-v1',
  patternIdPrefix: 'personality-signal:communication:',
  dimension: 'communication',
  minimumObservations: 3,
  minimumEvidence: 3,
  maximumContradictions: 0,
  requireImmutableEvidence: true,
};

describe('Pattern → Personality → Real Nigga → Behavioral → Expression runtime', () => {
  it('projects governed eligible evidence before selecting behavior and expression', () => {
    const result = runPersonalityBehaviorRuntime({
      personality,
      patterns: [pattern],
      memories: [memory],
      eligibilityRules: [eligibilityRule],
      now: '2026-09-03T00:01:00.000Z',
      idFactory: () => 'trait-1',
    });

    assert.equal(result.eligibilityDecisions[0]?.reason, 'eligible');
    assert.equal(result.patterns[0]?.personalityEligible, true);
    assert.equal(result.patterns[0]?.personalityDimension, 'communication');
    assert.equal(result.personality.traits[0]?.status, 'accepted');
    assert.equal(result.behavior.action, 'answer_directly');
    assert.equal(result.expression.mode, 'direct');
    assert.equal(result.expression.allowQuip, true);
    assert.equal(result.expression.allowProfanity, true);
  });

  it('fails closed when a detector pre-marks a generic pattern as personality eligible', () => {
    const generic: PatternObservation = {
      ...pattern,
      id: 'recurrence:direct',
      personalityEligible: true,
    };

    const result = runPersonalityBehaviorRuntime({
      personality,
      patterns: [generic],
      memories: [memory],
      now: '2026-09-03T00:01:00.000Z',
    });

    assert.equal(result.eligibilityDecisions[0]?.reason, 'no_matching_rule');
    assert.equal(result.patterns[0]?.personalityEligible, false);
    assert.equal(result.patterns[0]?.personalityDimension, undefined);
    assert.deepEqual(result.personality.traits, []);
  });

  it('keeps serious context authoritative over personality style', () => {
    const result = runPersonalityBehaviorRuntime({
      personality,
      patterns: [],
      memories: [],
      behaviorContext: { serious: true },
    });

    assert.equal(result.behavior.action, 'stay_serious');
    assert.equal(result.expression.mode, 'serious');
    assert.equal(result.expression.allowQuip, false);
    assert.equal(result.expression.allowProfanity, false);
  });

  it('does not mutate the supplied personality or pattern state', () => {
    const beforePersonality = structuredClone(personality);
    const beforePattern = structuredClone(pattern);

    runPersonalityBehaviorRuntime({
      personality,
      patterns: [pattern],
      memories: [memory],
      eligibilityRules: [eligibilityRule],
    });

    assert.deepEqual(personality, beforePersonality);
    assert.deepEqual(pattern, beforePattern);
  });
});
