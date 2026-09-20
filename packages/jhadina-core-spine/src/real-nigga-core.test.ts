import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveRealNiggaBehavior } from './real-nigga-core.js';
import type { PersonalityState } from './types.js';

const personality = {
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
} satisfies PersonalityState;

describe('Real Nigga Core', () => {
  it('derives a relationship- and taste-calibrated posture without mutating PersonalityState', () => {
    const before = structuredClone(personality);
    const behavior = deriveRealNiggaBehavior(personality);

    assert.equal(behavior.directness, 0.9);
    assert.equal(behavior.warmth, 0.7);
    assert.equal(behavior.verbosity, 0.4);
    assert.equal(behavior.formality, 0.5);
    assert.equal(behavior.reasoningDepth, 0.5);
    assert.equal(behavior.workflowContinuity, 0.5);
    assert.equal(behavior.explanationStyle, 'standard');
    assert.equal(behavior.decisionPresentation, 'balanced');
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
      voice: { ...personality.voice!, directness: 0.62 },
      relationship: {
        ...personality.relationship!,
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
        ...personality.taste!,
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
  it('uses only an accepted governed communication trait to calibrate directness', () => {
    const learned: PersonalityState = {
      ...personality,
      voice: { ...personality.voice!, directness: 0.5 },
      traits: [{
        id: 'trait-direct',
        statement: 'prefers direct communication',
        dimension: 'communication',
        confidence: 0.9,
        stability: 1,
        evidence: [{ id: 'e1', source: 'memory', observedAt: '2026-09-01T00:00:00.000Z', summary: 'direct', immutable: true }],
        contradictions: [],
        status: 'accepted',
        firstObservedAt: '2026-09-01T00:00:00.000Z',
        lastObservedAt: '2026-09-02T00:00:00.000Z',
        revision: 0,
      }],
    };

    const behavior = deriveRealNiggaBehavior(learned);
    assert.ok(behavior.directness > 0.63);
    assert.ok(behavior.directness < 0.64);
    assert.deepEqual(behavior.preferredInteractionModes, []);

    const contested = deriveRealNiggaBehavior({
      ...learned,
      traits: [{ ...learned.traits[0], status: 'contested' }],
    });
    assert.equal(contested.directness, 0.5);
  });

  it('uses only an accepted governed concision trait to reduce verbosity', () => {
    const learned: PersonalityState = {
      ...personality,
      voice: { ...personality.voice!, verbosity: 0.6 },
      traits: [{
        id: 'trait-concise',
        statement: 'prefers concise communication',
        dimension: 'communication',
        confidence: 0.8,
        stability: 1,
        evidence: [{ id: 'e1', source: 'memory', observedAt: '2026-09-01T00:00:00.000Z', summary: 'brief answers', immutable: true }],
        contradictions: [],
        status: 'accepted',
      }],
    };

    assert.ok(Math.abs(deriveRealNiggaBehavior(learned).verbosity - 0.4) < 1e-12);
    assert.equal(deriveRealNiggaBehavior({
      ...learned,
      traits: [{ ...learned.traits[0], status: 'candidate' }],
    }).verbosity, 0.6);
  });

  it('calibrates only accepted semantic traits and preserves serious-context precedence', () => {
    const trait = (
      id: string,
      statement: string,
      dimension: NonNullable<PersonalityState['traits'][number]['dimension']>,
    ): PersonalityState['traits'][number] => ({
      id,
      statement,
      dimension,
      confidence: 0.8,
      stability: 1,
      evidence: [{ id: `e-${id}`, source: 'memory', observedAt: '2026-09-01T00:00:00.000Z', summary: statement, immutable: true }],
      contradictions: [],
      status: 'accepted',
    });
    const learned: PersonalityState = {
      ...personality,
      traits: [
        trait('warm', 'prefers warm communication', 'communication'),
        trait('formal', 'prefers formal communication', 'communication'),
        trait('humor', 'prefers humorous communication', 'humor'),
        trait('profanity', 'allows conversational profanity', 'communication'),
        trait('pushback', 'prefers active pushback', 'communication'),
        trait('depth', 'prefers technical depth', 'communication'),
        trait('workflow', 'prefers continuous workflow', 'preference'),
        trait('steps', 'prefers step-by-step explanations', 'communication'),
        trait('evidence-first', 'prefers evidence-first explanations', 'communication'),
        trait('options', 'prefers multiple options', 'preference'),
        trait('creative', 'prefers experimental creativity', 'taste'),
        trait('familiar', 'prefers familiar tone', 'relationship'),
      ],
    };

    const behavior = deriveRealNiggaBehavior(learned);
    assert.ok(behavior.warmth > personality.voice.warmth);
    assert.ok(behavior.formality > 0.7);
    assert.ok(behavior.reasoningDepth > 0.7);
    assert.ok(behavior.workflowContinuity > 0.7);
    assert.equal(behavior.explanationStyle, 'evidence-first');
    assert.equal(behavior.decisionPresentation, 'options');
    assert.ok(behavior.humor > personality.voice.humor);
    assert.ok(behavior.disagreementDirectness > personality.voice.disagreementDirectness);
    assert.ok(behavior.creativeLatitude > 0.5);

    const serious = deriveRealNiggaBehavior(learned, { serious: true, requiresPrecision: true });
    assert.equal(serious.humor, 0);
    assert.equal(serious.profanityAllowed, false);
    assert.equal(serious.creativeLatitude, 0);
    assert.ok(serious.formality >= 0.75);
    assert.ok(serious.reasoningDepth >= behavior.reasoningDepth);
  });

  it('does not let candidate semantic traits affect behavior', () => {
    const candidate: PersonalityState = {
      ...personality,
      traits: [{
        id: 'candidate-pushback',
        statement: 'prefers active pushback',
        dimension: 'communication',
        confidence: 0.99,
        stability: 1,
        evidence: [{ id: 'e-candidate', source: 'memory', observedAt: '2026-09-01T00:00:00.000Z', summary: 'push back', immutable: true }],
        contradictions: [],
        status: 'candidate',
      }],
    };
    assert.equal(
      deriveRealNiggaBehavior(candidate).disagreementDirectness,
      personality.voice.disagreementDirectness,
    );
  });

});
