import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERSONALITY_ELIGIBILITY_RULES,
  createPersonalityEligibilityClassifier,
} from './personality-eligibility.js';
import { emptyPersonalityState } from './personality-core.js';
import { runPersonalityBehaviorRuntime } from './personality-behavior-runtime.js';
import type {
  EvidenceRef,
  MemoryProposal,
  PatternObservation,
  PersonalityDimension,
} from './types.js';

const supported: ReadonlyArray<{
  id: string;
  statement: string;
  dimension: PersonalityDimension;
}> = [
  { id: 'personality-signal:communication:directness', statement: 'prefers direct communication', dimension: 'communication' },
  { id: 'personality-signal:communication:concision', statement: 'prefers concise communication', dimension: 'communication' },
  { id: 'personality-signal:communication:warmth', statement: 'prefers warm communication', dimension: 'communication' },
  { id: 'personality-signal:communication:formality', statement: 'prefers formal communication', dimension: 'communication' },
  { id: 'personality-signal:humor:enabled', statement: 'prefers humorous communication', dimension: 'humor' },
  { id: 'personality-signal:communication:profanity', statement: 'allows conversational profanity', dimension: 'communication' },
  { id: 'personality-signal:communication:pushback', statement: 'prefers active pushback', dimension: 'communication' },
  { id: 'personality-signal:communication:technical-depth', statement: 'prefers technical depth', dimension: 'communication' },
  { id: 'personality-signal:preference:continuous-workflow', statement: 'prefers continuous workflow', dimension: 'preference' },
  { id: 'personality-signal:taste:experimentation', statement: 'prefers experimental creativity', dimension: 'taste' },
  { id: 'personality-signal:relationship:familiar-tone', statement: 'prefers familiar tone', dimension: 'relationship' },
];

function evidence(id: string, statement: string): EvidenceRef {
  return {
    id,
    source: 'memory',
    observedAt: '2026-09-20T12:00:00.000Z',
    summary: statement,
    immutable: true,
  };
}

function fixture(item: typeof supported[number], index: number): {
  pattern: PatternObservation;
  memory: MemoryProposal;
} {
  const refs = [1, 2, 3].map((n) => evidence(`${index}-e${n}`, item.statement));
  return {
    pattern: {
      id: item.id,
      pattern: item.statement,
      evidence: refs,
      confidence: 1,
      occurrences: 3,
      contradictions: [],
      lastObservedAt: '2026-09-20T12:00:00.000Z',
      personalityEligible: false,
      personalityDimension: item.dimension,
    },
    memory: {
      id: `memory-${index}`,
      content: item.statement,
      reason: 'approved certification evidence',
      evidence: refs,
      disposition: 'SAVE',
    },
  };
}

describe('PERSONALITY-V2.FINAL certification', () => {
  it('has one explicit immutable-evidence governance rule for every supported semantic family', () => {
    const classifier = createPersonalityEligibilityClassifier();
    expect(DEFAULT_PERSONALITY_ELIGIBILITY_RULES).toHaveLength(supported.length);

    for (const [index, item] of supported.entries()) {
      const { pattern } = fixture(item, index);
      const decision = classifier.classify(pattern);
      expect(decision.eligible, item.id).toBe(true);
      expect(decision.dimension, item.id).toBe(item.dimension);
      const rule = DEFAULT_PERSONALITY_ELIGIBILITY_RULES.find((candidate) => candidate.ruleId === decision.ruleId);
      expect(rule?.minimumEvidence, item.id).toBe(3);
      expect(rule?.minimumObservations, item.id).toBe(3);
      expect(rule?.requireImmutableEvidence, item.id).toBe(true);
    }
  });

  it('certifies the complete governed semantic vertical and deterministic conflict precedence', () => {
    const fixtures = supported.map(fixture);
    let nextId = 0;
    const result = runPersonalityBehaviorRuntime({
      personality: emptyPersonalityState('2026-09-20T11:00:00.000Z'),
      patterns: fixtures.map((item) => item.pattern),
      memories: fixtures.map((item) => item.memory),
      now: '2026-09-20T12:01:00.000Z',
      idFactory: () => `certified-trait-${++nextId}`,
    });

    expect(result.eligibilityDecisions.every((decision) => decision.eligible)).toBe(true);
    expect(result.personality.traits).toHaveLength(supported.length);
    expect(result.personality.traits.every((trait) => trait.status === 'accepted')).toBe(true);
    expect(result.behavior.directness).toBeGreaterThan(0.7);
    expect(result.behavior.warmth).toBeGreaterThan(0.6);
    expect(result.behavior.reasoningDepth).toBeGreaterThan(0.7);
    expect(result.behavior.workflowContinuity).toBeGreaterThan(0.7);
    expect(result.behavior.disagreementDirectness).toBeGreaterThan(0.8);
    expect(result.expression.responseLength).toBe('brief');
    expect(result.expression.tone).toBe('formal');
    expect(result.expression.reasoningDepth).toBe('technical');
    expect(result.expression.interactionStyle).toBe('continuous');
    expect(result.expression.creativeStyle).toBe('experimental');

    const replay = runPersonalityBehaviorRuntime({
      personality: result.personality,
      patterns: fixtures.map((item) => item.pattern),
      memories: fixtures.map((item) => item.memory),
      now: '2026-09-20T12:02:00.000Z',
    });
    expect(replay.personality.version).toBe(result.personality.version);
    expect(replay.personality).toEqual(result.personality);
  });

  it('keeps safety/precision context above learned style and denies generic confidence bypass', () => {
    const generic: PatternObservation = {
      ...fixture(supported[0], 99).pattern,
      id: 'recurrence:direct',
      confidence: 1,
      personalityEligible: true,
    };
    const genericMemory = fixture(supported[0], 99).memory;
    const denied = runPersonalityBehaviorRuntime({
      personality: emptyPersonalityState(),
      patterns: [generic],
      memories: [genericMemory],
    });
    expect(denied.eligibilityDecisions[0]?.reason).toBe('no_matching_rule');
    expect(denied.personality.traits).toEqual([]);

    const fixtures = supported.map(fixture);
    let nextId = 0;
    const serious = runPersonalityBehaviorRuntime({
      personality: emptyPersonalityState(),
      patterns: fixtures.map((item) => item.pattern),
      memories: fixtures.map((item) => item.memory),
      behaviorContext: { serious: true, requiresPrecision: true },
      idFactory: () => `serious-trait-${++nextId}`,
    });
    expect(serious.behavior.action).toBe('stay_serious');
    expect(serious.expression.mode).toBe('serious');
    expect(serious.expression.allowProfanity).toBe(false);
    expect(serious.expression.allowQuip).toBe(false);
    expect(serious.expression.tone).toBe('formal');
    expect(serious.expression.creativeStyle).toBe('conventional');
  });
});
