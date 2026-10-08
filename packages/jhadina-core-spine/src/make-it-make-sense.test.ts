import { expect, it } from 'vitest';
import {
  assertMakeItMakeSenseCannotAuthorize,
  bindMakeItMakeSenseStage,
  makeItMakeSense,
  type MakeItMakeSenseCheck,
} from './make-it-make-sense.js';

function checks(
  override?: Partial<Record<MakeItMakeSenseCheck['dimension'], MakeItMakeSenseCheck['status']>>,
): MakeItMakeSenseCheck[] {
  return ([
    'EVIDENCE',
    'CHRONOLOGY',
    'CAUSAL_LOGIC',
    'INCENTIVES',
    'BASE_RATES',
    'CONTRADICTIONS',
    'ALTERNATIVES',
  ] as const).map((dimension) => ({
    dimension,
    status: override?.[dimension] ?? 'PASS',
    rationale: dimension + ' checked',
    evidenceRefs: ['e:' + dimension],
  }));
}

it('MIMS keeps coherence separate from truth or authority', () => {
  const vote = makeItMakeSense({
    voteId: 'mims:1',
    subjectId: 'stock:AAPL:baseline',
    checks: checks(),
  });
  expect(vote.status).toBe('PASS');
  expect(vote.coherentNotEquivalentToTrue).toBe(true);
  expect(vote.independentValidationStillRequired).toBe(true);
  expect(vote.authority).toBe('ADVISORY_ONLY');
  expect(() => assertMakeItMakeSenseCannotAuthorize(vote)).not.toThrow();
});

it('MIMS fails on any failed dimension and reviews uncertainty explicitly', () => {
  const failed = makeItMakeSense({
    voteId: 'mims:2',
    subjectId: 'claim:2',
    checks: checks({ CONTRADICTIONS: 'FAIL' }),
  });
  expect(failed.status).toBe('FAIL');
  expect(failed.reasonCodes).toContain('CONTRADICTIONS_FAILED');

  const review = makeItMakeSense({
    voteId: 'mims:3',
    subjectId: 'claim:3',
    checks: checks({ BASE_RATES: 'REVIEW' }),
  });
  expect(review.status).toBe('REVIEW');
  expect(review.reasonCodes).toContain('BASE_RATES_REVIEW');
});

it('MIMS requires every universal dimension', () => {
  expect(() =>
      makeItMakeSense({
        voteId: 'mims:bad',
        subjectId: 'claim:bad',
        checks: checks().filter((x) => x.dimension !== 'ALTERNATIVES'),
      }),
    ).toThrow(/JHADINA_MIMS_DIMENSION_REQUIRED:ALTERNATIVES/);
});


it('MIMS stage binding preserves advisory-only authority and subject identity', () => {
  const vote = makeItMakeSense({
    voteId: 'mims:stage',
    subjectId: 'subject:1',
    checks: [
      { dimension: 'EVIDENCE', status: 'PASS', rationale: 'Evidence is present.', evidenceRefs: ['e1'] },
      { dimension: 'CHRONOLOGY', status: 'PASS', rationale: 'Chronology is valid.', evidenceRefs: ['e1'] },
      { dimension: 'CAUSAL_LOGIC', status: 'REVIEW', rationale: 'Causal claim remains under review.', evidenceRefs: ['e1'] },
      { dimension: 'INCENTIVES', status: 'PASS', rationale: 'Incentives are represented.', evidenceRefs: ['e1'] },
      { dimension: 'BASE_RATES', status: 'PASS', rationale: 'Base rates are represented.', evidenceRefs: ['e1'] },
      { dimension: 'CONTRADICTIONS', status: 'PASS', rationale: 'Contradictions are represented.', evidenceRefs: ['e1'] },
      { dimension: 'ALTERNATIVES', status: 'PASS', rationale: 'Alternatives are represented.', evidenceRefs: ['e1'] },
    ],
  });
  const staged = bindMakeItMakeSenseStage({ stage: 'TRADE', vote, expectedSubjectId: 'subject:1' });
  expect(staged.stage).toBe('TRADE');
  expect(staged.vote.status).toBe('REVIEW');
  expect(staged.authority).toBe('ADVISORY_ONLY');
  expect(staged.canAuthorizeAction).toBe(false);
  expect(() => bindMakeItMakeSenseStage({ stage: 'TRADE', vote, expectedSubjectId: 'subject:2' })).toThrow('JHADINA_MIMS_SUBJECT_BINDING_MISMATCH');
});


it('can report an evidence-free REVIEW without fabricating a citation or authorizing anything', () => {
  const unresolved = makeItMakeSense({
    voteId: 'mims:unresolved',
    subjectId: 'ask:unverified',
    checks: checks().map((check) => ({
      ...check,
      status: 'REVIEW' as const,
      evidenceRefs: [] as string[],
      rationale: 'Independent validation is not available.',
    })),
  });
  expect(unresolved.status).toBe('REVIEW');
  expect(unresolved.checks.every((check) => check.evidenceRefs.length === 0)).toBe(true);
  expect(unresolved.authority).toBe('ADVISORY_ONLY');
  expect(unresolved.independentValidationStillRequired).toBe(true);
  expect(() => makeItMakeSense({
    voteId: 'mims:unsupported-pass',
    subjectId: 'ask:unverified',
    checks: checks().map((check) => ({
      ...check,
      ...(check.dimension === 'EVIDENCE' ? { evidenceRefs: [] } : {}),
    })),
  })).toThrow(/JHADINA_MIMS_EVIDENCE_REQUIRED/);
});
