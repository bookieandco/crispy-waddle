import { describe, expect, it } from 'vitest';
import {
  assertMakeItMakeSenseCannotAuthorize,
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
