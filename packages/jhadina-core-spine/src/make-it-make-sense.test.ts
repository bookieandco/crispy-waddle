import test from 'node:test';
import assert from 'node:assert/strict';
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

test('MIMS keeps coherence separate from truth or authority', () => {
  const vote = makeItMakeSense({
    voteId: 'mims:1',
    subjectId: 'stock:AAPL:baseline',
    checks: checks(),
  });
  assert.equal(vote.status, 'PASS');
  assert.equal(vote.coherentNotEquivalentToTrue, true);
  assert.equal(vote.independentValidationStillRequired, true);
  assert.equal(vote.authority, 'ADVISORY_ONLY');
  assert.doesNotThrow(() => assertMakeItMakeSenseCannotAuthorize(vote));
});

test('MIMS fails on any failed dimension and reviews uncertainty explicitly', () => {
  const failed = makeItMakeSense({
    voteId: 'mims:2',
    subjectId: 'claim:2',
    checks: checks({ CONTRADICTIONS: 'FAIL' }),
  });
  assert.equal(failed.status, 'FAIL');
  assert.ok(failed.reasonCodes.includes('CONTRADICTIONS_FAILED'));

  const review = makeItMakeSense({
    voteId: 'mims:3',
    subjectId: 'claim:3',
    checks: checks({ BASE_RATES: 'REVIEW' }),
  });
  assert.equal(review.status, 'REVIEW');
  assert.ok(review.reasonCodes.includes('BASE_RATES_REVIEW'));
});

test('MIMS requires every universal dimension', () => {
  assert.throws(
    () =>
      makeItMakeSense({
        voteId: 'mims:bad',
        subjectId: 'claim:bad',
        checks: checks().filter((x) => x.dimension !== 'ALTERNATIVES'),
      }),
    /JHADINA_MIMS_DIMENSION_REQUIRED:ALTERNATIVES/,
  );
});
