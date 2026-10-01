export const MAKE_IT_MAKE_SENSE_SCHEMA_VERSION =
  'JHADINA-MIMS-01' as const;

export type MakeItMakeSenseDimension =
  | 'EVIDENCE'
  | 'CHRONOLOGY'
  | 'CAUSAL_LOGIC'
  | 'INCENTIVES'
  | 'BASE_RATES'
  | 'CONTRADICTIONS'
  | 'ALTERNATIVES';

export type MakeItMakeSenseDimensionStatus =
  | 'PASS'
  | 'REVIEW'
  | 'FAIL'
  | 'NOT_APPLICABLE';

export type MakeItMakeSenseCheck = Readonly<{
  dimension: MakeItMakeSenseDimension;
  status: MakeItMakeSenseDimensionStatus;
  rationale: string;
  evidenceRefs: readonly string[];
}>;

export type MakeItMakeSenseVote = Readonly<{
  schemaVersion: typeof MAKE_IT_MAKE_SENSE_SCHEMA_VERSION;
  voteId: string;
  subjectId: string;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  checks: readonly MakeItMakeSenseCheck[];
  reasonCodes: readonly string[];
  coherentNotEquivalentToTrue: true;
  independentValidationStillRequired: true;
  authority: 'ADVISORY_ONLY';
}>;

const REQUIRED_DIMENSIONS: readonly MakeItMakeSenseDimension[] = Object.freeze([
  'EVIDENCE',
  'CHRONOLOGY',
  'CAUSAL_LOGIC',
  'INCENTIVES',
  'BASE_RATES',
  'CONTRADICTIONS',
  'ALTERNATIVES',
]);

function assertCheck(check: MakeItMakeSenseCheck): void {
  if (!check.rationale.trim()) {
    throw new Error('JHADINA_MIMS_RATIONALE_REQUIRED');
  }
  if (
    check.status !== 'NOT_APPLICABLE' &&
    check.evidenceRefs.length === 0
  ) {
    throw new Error('JHADINA_MIMS_EVIDENCE_REQUIRED');
  }
}

export function makeItMakeSense(input: Readonly<{
  voteId: string;
  subjectId: string;
  checks: readonly MakeItMakeSenseCheck[];
}>): MakeItMakeSenseVote {
  if (!input.voteId.trim() || !input.subjectId.trim()) {
    throw new Error('JHADINA_MIMS_IDENTITY_REQUIRED');
  }

  const byDimension = new Map<MakeItMakeSenseDimension, MakeItMakeSenseCheck>();
  for (const check of input.checks) {
    assertCheck(check);
    if (byDimension.has(check.dimension)) {
      throw new Error('JHADINA_MIMS_DUPLICATE_DIMENSION:' + check.dimension);
    }
    byDimension.set(check.dimension, check);
  }

  for (const dimension of REQUIRED_DIMENSIONS) {
    if (!byDimension.has(dimension)) {
      throw new Error('JHADINA_MIMS_DIMENSION_REQUIRED:' + dimension);
    }
  }

  const ordered = Object.freeze(
    REQUIRED_DIMENSIONS.map((dimension) => byDimension.get(dimension)!),
  );
  const reasonCodes: string[] = [];

  for (const check of ordered) {
    if (check.status === 'FAIL') {
      reasonCodes.push(check.dimension + '_FAILED');
    } else if (check.status === 'REVIEW') {
      reasonCodes.push(check.dimension + '_REVIEW');
    }
  }

  const status: MakeItMakeSenseVote['status'] = ordered.some(
    (check) => check.status === 'FAIL',
  )
    ? 'FAIL'
    : ordered.some((check) => check.status === 'REVIEW')
      ? 'REVIEW'
      : 'PASS';

  return Object.freeze({
    schemaVersion: MAKE_IT_MAKE_SENSE_SCHEMA_VERSION,
    voteId: input.voteId,
    subjectId: input.subjectId,
    status,
    checks: ordered,
    reasonCodes: Object.freeze(reasonCodes),
    coherentNotEquivalentToTrue: true,
    independentValidationStillRequired: true,
    authority: 'ADVISORY_ONLY',
  });
}

export function assertMakeItMakeSenseCannotAuthorize(
  vote: MakeItMakeSenseVote,
): void {
  if (
    vote.authority !== 'ADVISORY_ONLY' ||
    vote.coherentNotEquivalentToTrue !== true ||
    vote.independentValidationStillRequired !== true
  ) {
    throw new Error('JHADINA_MIMS_AUTHORITY_FORBIDDEN');
  }
}
