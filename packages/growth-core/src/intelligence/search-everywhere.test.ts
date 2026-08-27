import { describe, expect, it } from 'vitest';
import { buildSearchEverywherePlan, validateAnswerConsistency } from './search-everywhere.js';

describe('search everywhere engine', () => {
  it('translates one core answer across discovery surfaces', () => {
    const plan = buildSearchEverywherePlan({
      brandId: 'brand:truckeros',
      question: {
        id: 'question:loads',
        question: 'How can owner-operators find better loads?',
        intent: 'commercial',
        audienceSignals: ['owner-operator', 'trucker'],
        priority: 90,
      },
      coreAnswer: {
        id: 'answer:better-loads',
        brandId: 'brand:truckeros',
        topic: 'better loads',
        thesis: 'Truckeros helps owner-operators discover and evaluate better load opportunities.',
        evidence: ['product workflow', 'customer proof'],
      },
    });

    expect(plan.surfaces).toHaveLength(5);
    expect(new Set(plan.surfaces.map((surface) => surface.coreAnswerId))).toEqual(new Set(['answer:better-loads']));
    expect(validateAnswerConsistency(plan).consistent).toBe(true);
  });

  it('detects a surface that drifts from the core answer', () => {
    const plan = buildSearchEverywherePlan({
      brandId: 'brand:test',
      question: { id: 'question:test', question: 'What is this?', intent: 'informational', audienceSignals: [], priority: 50 },
      coreAnswer: { id: 'answer:test', brandId: 'brand:test', topic: 'test', thesis: 'The canonical answer.', evidence: [] },
    });

    const drifted = { ...plan, surfaces: [{ ...plan.surfaces[0], body: 'A conflicting answer.' }, ...plan.surfaces.slice(1)] };
    const result = validateAnswerConsistency(drifted);
    expect(result.consistent).toBe(false);
    expect(result.mismatchedCoreAnswerIds).toContain(plan.surfaces[0].id);
  });
});
