import assert from 'node:assert/strict';
import { CompositePatternDetectionStrategy } from './composite-pattern-strategy.js';
import type { Experience, MemoryProposal, PatternObservation } from './types.js';

const experience = {
  id: 'experience-1', occurredAt: '2026-09-03T00:00:00.000Z', source: 'test', actor: 'user', content: 'test', evidence: [],
} as Experience;
const memories = [] as MemoryProposal[];
const observation = (id: string): PatternObservation => ({
  id, pattern: id, evidence: [], confidence: 0.5, occurrences: 1, contradictions: [], lastObservedAt: experience.occurredAt,
  personalityEligible: false,
});

describe('Composite Pattern Detection Strategy', () => {
  it('composes independent strategies and de-duplicates by observation id', () => {
    const strategy = new CompositePatternDetectionStrategy([
      { detect: () => [observation('b'), observation('a')] },
      { detect: () => [observation('a'), observation('c')] },
    ]);
    assert.deepEqual(strategy.detect(experience, memories).map((item) => item.id), ['a', 'b', 'c']);
  });

  it('fails closed when no strategies are supplied', () => {
    assert.throws(() => new CompositePatternDetectionStrategy([]), /at least one pattern strategy/);
  });
});
