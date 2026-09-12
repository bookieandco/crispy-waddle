import { describe, expect, it } from 'vitest';
import type { EvidenceRef } from './types.js';
import { assessRegret } from './regret-assessment.js';

const evidence: readonly EvidenceRef[] = Object.freeze([
  Object.freeze({
    id: 'evidence-001',
    source: 'test',
    observedAt: '2026-09-12T00:00:00.000Z',
    summary: 'Verified outcome evidence.',
    immutable: true,
  }),
]);

const base = {
  subjectType: 'decision' as const,
  subjectId: 'decision-001',
  originalBelief: 'The chosen action would succeed.',
  expectedOutcome: 'Success.',
  actualOutcome: 'Failure.',
  outcomeEvidence: evidence,
  discrepancy: 'Expected success did not occur.',
  severity: 'R2' as const,
  avoidability: 'high' as const,
  couldHaveKnown: true,
  couldHaveActedDifferently: true,
  alternativeLikelyImprovedOutcome: true,
};

describe('assessRegret', () => {
  it('returns insufficient evidence when no verified outcome evidence exists', () => {
    const result = assessRegret({ ...base, outcomeEvidence: [] });

    expect(result.disposition).toBe('insufficient_evidence');
    expect(result.preventable).toBe(false);
    expect(result.learningWarranted).toBe(false);
  });

  it('returns no_regret for an unavoidable failure', () => {
    const result = assessRegret({
      ...base,
      couldHaveKnown: false,
      couldHaveActedDifferently: true,
      alternativeLikelyImprovedOutcome: true,
    });

    expect(result.disposition).toBe('no_regret');
    expect(result.preventable).toBe(false);
    expect(result.learningWarranted).toBe(false);
  });

  it('returns insufficient_evidence when the counterfactual is unresolved', () => {
    const result = assessRegret({
      ...base,
      couldHaveKnown: null,
    });

    expect(result.disposition).toBe('insufficient_evidence');
    expect(result.preventable).toBe(false);
    expect(result.learningWarranted).toBe(false);
  });

  it('returns regret only when all three preventability conditions are established', () => {
    const result = assessRegret(base);

    expect(result.disposition).toBe('regret');
    expect(result.preventable).toBe(true);
    expect(result.learningWarranted).toBe(true);
    expect(result.evidence).toEqual(evidence);
  });

  it('does not expose an authority or policy mutation field', () => {
    const result = assessRegret(base);

    expect(result).not.toHaveProperty('authority');
    expect(result).not.toHaveProperty('policy');
    expect(result).not.toHaveProperty('policyChange');
  });

  it('freezes the assessment and its evidence collection', () => {
    const result = assessRegret(base);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });
});
