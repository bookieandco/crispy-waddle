import type { FxFactorObservation } from './fx-intelligence-fusion.js';

export const INSTITUTIONAL_FLOW_SCHEMA_VERSION =
  'MONEY-INSTITUTIONAL-FLOW-01' as const;

export type InstitutionalFlowSourceKind =
  | 'DIRECT_PARTICIPANT_CLASSIFIED'
  | 'REGULATORY_AGGREGATE'
  | 'EXCHANGE_AGGREGATE'
  | 'BROKER_AGGREGATE'
  | 'VENDOR_INFERRED'
  | 'PUBLIC_REPORT'
  | 'VENDOR_ASSERTION';

export type InstitutionalActorConfidence =
  | 'NAMED_VERIFIED'
  | 'SECTOR_AGGREGATE'
  | 'INFERRED'
  | 'UNKNOWN';

export type InstitutionalFlowStatus =
  | 'OBSERVED'
  | 'CORROBORATED'
  | 'INFERRED'
  | 'ASSERTED_ONLY'
  | 'REJECTED';

export type InstitutionalTradeSide = 'BUY' | 'SELL' | 'REDUCE' | 'UNKNOWN';

export type InstitutionalFlowObservation = Readonly<{
  schemaVersion: typeof INSTITUTIONAL_FLOW_SCHEMA_VERSION;
  observationId: string;
  instrumentId: string;
  market: 'FOREX' | 'STOCK' | 'FUTURE' | 'OPTION' | 'CRYPTO' | 'OTHER';
  sourceKind: InstitutionalFlowSourceKind;
  sourceGroup: string;
  actorName?: string;
  actorConfidence: InstitutionalActorConfidence;
  side: InstitutionalTradeSide;
  notionalAmount?: number;
  notionalCurrency?: string;
  positionChangeFraction?: number;
  effectiveAt: string;
  observedAt: string;
  receivedAt: string;
  availableAt: string;
  evidenceIds: readonly string[];
  provenanceHash: string;
  status: InstitutionalFlowStatus;
  authority: 'EVIDENCE_ONLY';
}>;

export type InstitutionalBehaviorExample = Readonly<{
  exampleId: string;
  observationId: string;
  instrumentId: string;
  featureCutoff: string;
  actionObservedAt: string;
  action: InstitutionalTradeSide;
  conditionIds: readonly string[];
  outcomeAvailableAt?: string;
  outcomeLabel?: string;
  evidenceIds: readonly string[];
  authority: 'LEARNING_ONLY';
  canAuthorizeTrade: false;
}>;

export type InstitutionalPatternCalibrationStatus =
  | 'UNVALIDATED'
  | 'REPLAY_SUPPORTED'
  | 'OUT_OF_SAMPLE_SUPPORTED'
  | 'REJECTED';

export type InstitutionalBehaviorPattern = Readonly<{
  patternId: string;
  instrumentId: string;
  sampleSize: number;
  independentSourceGroupCount: number;
  conditionIds: readonly string[];
  dominantAction: InstitutionalTradeSide;
  dominantActionRateBps: number;
  forwardOutcomeHitRateBps?: number;
  calibrationStatus: InstitutionalPatternCalibrationStatus;
  sourceObservationIds: readonly string[];
  sourceGroupIds: readonly string[];
  methodologyVersion: string;
  evidenceIds: readonly string[];
  provenanceHash: string;
  authority: 'RESEARCH_ONLY';
  canAuthorizeTrade: false;
}>;

export type InstitutionalFlowClaim = Readonly<{
  claimId: string;
  statement: string;
  claimedActorName?: string;
  claimedNotionalAmount?: number;
  claimedNotionalCurrency?: string;
  claimedParticipantCount?: number;
  claimedDataCostPerYear?: number;
  sourceEvidenceIds: readonly string[];
  status: 'SOURCE_ASSERTION';
  authority: 'NONE';
}>;

function assertTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function assertNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
}

function namedIdentityAllowed(
  sourceKind: InstitutionalFlowSourceKind,
  actorConfidence: InstitutionalActorConfidence,
): boolean {
  return (
    actorConfidence === 'NAMED_VERIFIED' &&
    sourceKind === 'DIRECT_PARTICIPANT_CLASSIFIED'
  );
}

export function assertInstitutionalFlowObservation(
  observation: InstitutionalFlowObservation,
): void {
  if (observation.schemaVersion !== INSTITUTIONAL_FLOW_SCHEMA_VERSION) {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_SCHEMA_INVALID');
  }

  assertNonEmpty(observation.observationId, 'MONEY_INSTITUTIONAL_FLOW_ID_REQUIRED');
  assertNonEmpty(observation.instrumentId, 'MONEY_INSTITUTIONAL_FLOW_INSTRUMENT_REQUIRED');
  assertNonEmpty(observation.sourceGroup, 'MONEY_INSTITUTIONAL_FLOW_SOURCE_GROUP_REQUIRED');
  assertNonEmpty(observation.provenanceHash, 'MONEY_INSTITUTIONAL_FLOW_PROVENANCE_REQUIRED');

  if (observation.evidenceIds.length === 0) {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_EVIDENCE_REQUIRED');
  }

  const effectiveAt = assertTimestamp(
    observation.effectiveAt,
    'MONEY_INSTITUTIONAL_FLOW_EFFECTIVE_TIME_INVALID',
  );
  const observedAt = assertTimestamp(
    observation.observedAt,
    'MONEY_INSTITUTIONAL_FLOW_OBSERVED_TIME_INVALID',
  );
  const receivedAt = assertTimestamp(
    observation.receivedAt,
    'MONEY_INSTITUTIONAL_FLOW_RECEIVED_TIME_INVALID',
  );
  const availableAt = assertTimestamp(
    observation.availableAt,
    'MONEY_INSTITUTIONAL_FLOW_AVAILABLE_TIME_INVALID',
  );

  if (observedAt < effectiveAt || receivedAt < observedAt || availableAt < receivedAt) {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_CLOCK_ORDER_INVALID');
  }

  if (observation.notionalAmount !== undefined) {
    assertNonNegative(
      observation.notionalAmount,
      'MONEY_INSTITUTIONAL_FLOW_NOTIONAL_INVALID',
    );
    if (!observation.notionalCurrency?.trim()) {
      throw new Error('MONEY_INSTITUTIONAL_FLOW_NOTIONAL_CURRENCY_REQUIRED');
    }
  }

  if (observation.positionChangeFraction !== undefined) {
    if (
      !Number.isFinite(observation.positionChangeFraction) ||
      observation.positionChangeFraction < -1 ||
      observation.positionChangeFraction > 1
    ) {
      throw new Error('MONEY_INSTITUTIONAL_FLOW_POSITION_CHANGE_INVALID');
    }
  }

  if (observation.actorName) {
    if (!namedIdentityAllowed(observation.sourceKind, observation.actorConfidence)) {
      throw new Error('MONEY_INSTITUTIONAL_FLOW_NAMED_ACTOR_UNVERIFIED');
    }
  } else if (observation.actorConfidence === 'NAMED_VERIFIED') {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_ACTOR_NAME_REQUIRED');
  }

  if (
    observation.sourceKind === 'VENDOR_ASSERTION' &&
    observation.status !== 'ASSERTED_ONLY'
  ) {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_VENDOR_ASSERTION_STATUS_INVALID');
  }

  if (observation.authority !== 'EVIDENCE_ONLY') {
    throw new Error('MONEY_INSTITUTIONAL_FLOW_AUTHORITY_FORBIDDEN');
  }
}

export function createInstitutionalBehaviorExample(
  observation: InstitutionalFlowObservation,
  input: Readonly<{
    exampleId: string;
    featureCutoff: string;
    conditionIds: readonly string[];
    outcomeAvailableAt?: string;
    outcomeLabel?: string;
    evidenceIds: readonly string[];
  }>,
): InstitutionalBehaviorExample {
  assertInstitutionalFlowObservation(observation);
  assertNonEmpty(input.exampleId, 'MONEY_INSTITUTIONAL_EXAMPLE_ID_REQUIRED');

  const featureCutoff = assertTimestamp(
    input.featureCutoff,
    'MONEY_INSTITUTIONAL_FEATURE_CUTOFF_INVALID',
  );
  const actionObservedAt = assertTimestamp(
    observation.observedAt,
    'MONEY_INSTITUTIONAL_ACTION_TIME_INVALID',
  );

  if (featureCutoff > actionObservedAt) {
    throw new Error('MONEY_INSTITUTIONAL_FEATURE_FUTURE_LEAK');
  }

  if (input.conditionIds.length === 0 || input.evidenceIds.length === 0) {
    throw new Error('MONEY_INSTITUTIONAL_EXAMPLE_EVIDENCE_REQUIRED');
  }

  if (input.outcomeAvailableAt) {
    const outcomeAvailableAt = assertTimestamp(
      input.outcomeAvailableAt,
      'MONEY_INSTITUTIONAL_OUTCOME_TIME_INVALID',
    );
    if (outcomeAvailableAt <= actionObservedAt) {
      throw new Error('MONEY_INSTITUTIONAL_OUTCOME_CLOCK_INVALID');
    }
  }

  if (observation.status === 'ASSERTED_ONLY' || observation.status === 'REJECTED') {
    throw new Error('MONEY_INSTITUTIONAL_EXAMPLE_SOURCE_NOT_LEARNABLE');
  }

  return Object.freeze({
    exampleId: input.exampleId,
    observationId: observation.observationId,
    instrumentId: observation.instrumentId,
    featureCutoff: input.featureCutoff,
    actionObservedAt: observation.observedAt,
    action: observation.side,
    conditionIds: Object.freeze([...input.conditionIds]),
    outcomeAvailableAt: input.outcomeAvailableAt,
    outcomeLabel: input.outcomeLabel,
    evidenceIds: Object.freeze([
      ...new Set([...observation.evidenceIds, ...input.evidenceIds]),
    ]),
    authority: 'LEARNING_ONLY',
    canAuthorizeTrade: false,
  });
}

export function buildInstitutionalBehaviorPattern(input: Readonly<{
  patternId: string;
  instrumentId: string;
  examples: readonly InstitutionalBehaviorExample[];
  observationById: ReadonlyMap<string, InstitutionalFlowObservation>;
  minimumSamples: number;
  methodologyVersion: string;
  evidenceIds: readonly string[];
  provenanceHash: string;
}>): InstitutionalBehaviorPattern {
  assertNonEmpty(input.patternId, 'MONEY_INSTITUTIONAL_PATTERN_ID_REQUIRED');
  assertNonEmpty(input.instrumentId, 'MONEY_INSTITUTIONAL_PATTERN_INSTRUMENT_REQUIRED');
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_INSTITUTIONAL_PATTERN_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_INSTITUTIONAL_PATTERN_PROVENANCE_REQUIRED',
  );

  if (!Number.isInteger(input.minimumSamples) || input.minimumSamples < 2) {
    throw new Error('MONEY_INSTITUTIONAL_PATTERN_MIN_SAMPLES_INVALID');
  }
  if (input.evidenceIds.length === 0) {
    throw new Error('MONEY_INSTITUTIONAL_PATTERN_EVIDENCE_REQUIRED');
  }

  const examples = input.examples.filter(
    (example) => example.instrumentId === input.instrumentId,
  );

  if (
    examples.some(
      (example) =>
        example.authority !== 'LEARNING_ONLY' ||
        example.canAuthorizeTrade !== false,
    )
  ) {
    throw new Error('MONEY_INSTITUTIONAL_PATTERN_EXAMPLE_AUTHORITY_INVALID');
  }

  const observations = examples.map((example) => {
    const observation = input.observationById.get(example.observationId);
    if (!observation) {
      throw new Error('MONEY_INSTITUTIONAL_PATTERN_OBSERVATION_MISSING');
    }
    assertInstitutionalFlowObservation(observation);
    return observation;
  });

  const actionCounts = new Map<InstitutionalTradeSide, number>();
  for (const example of examples) {
    actionCounts.set(example.action, (actionCounts.get(example.action) ?? 0) + 1);
  }

  const dominantEntry = [...actionCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  })[0] ?? ['UNKNOWN', 0] as const;

  const conditionIds = Object.freeze(
    [...new Set(examples.flatMap((example) => example.conditionIds))].sort(),
  );
  const sourceGroupIds = Object.freeze(
    [...new Set(observations.map((observation) => observation.sourceGroup))].sort(),
  );
  const sourceObservationIds = Object.freeze(
    observations.map((observation) => observation.observationId).sort(),
  );

  const resolvedExamples = examples.filter(
    (example) => Boolean(example.outcomeAvailableAt && example.outcomeLabel),
  );
  const hits = resolvedExamples.filter(
    (example) => example.outcomeLabel === 'MATCHED',
  ).length;

  const sampleSize = examples.length;
  const dominantActionRateBps =
    sampleSize === 0 ? 0 : Math.round((dominantEntry[1] / sampleSize) * 10_000);

  const forwardOutcomeHitRateBps =
    resolvedExamples.length === 0
      ? undefined
      : Math.round((hits / resolvedExamples.length) * 10_000);

  let calibrationStatus: InstitutionalPatternCalibrationStatus = 'UNVALIDATED';
  if (sampleSize >= input.minimumSamples) {
    calibrationStatus =
      resolvedExamples.length >= input.minimumSamples &&
      forwardOutcomeHitRateBps !== undefined &&
      forwardOutcomeHitRateBps >= 5_500
        ? 'REPLAY_SUPPORTED'
        : 'UNVALIDATED';
  }

  return Object.freeze({
    patternId: input.patternId,
    instrumentId: input.instrumentId,
    sampleSize,
    independentSourceGroupCount: sourceGroupIds.length,
    conditionIds,
    dominantAction: dominantEntry[0],
    dominantActionRateBps,
    forwardOutcomeHitRateBps,
    calibrationStatus,
    sourceObservationIds,
    sourceGroupIds,
    methodologyVersion: input.methodologyVersion,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    provenanceHash: input.provenanceHash,
    authority: 'RESEARCH_ONLY',
    canAuthorizeTrade: false,
  });
}

export function createInstitutionalFlowClaim(
  input: Omit<InstitutionalFlowClaim, 'status' | 'authority'>,
): InstitutionalFlowClaim {
  assertNonEmpty(input.claimId, 'MONEY_INSTITUTIONAL_CLAIM_ID_REQUIRED');
  assertNonEmpty(input.statement, 'MONEY_INSTITUTIONAL_CLAIM_STATEMENT_REQUIRED');
  if (input.sourceEvidenceIds.length === 0) {
    throw new Error('MONEY_INSTITUTIONAL_CLAIM_EVIDENCE_REQUIRED');
  }
  if (input.claimedNotionalAmount !== undefined) {
    assertNonNegative(
      input.claimedNotionalAmount,
      'MONEY_INSTITUTIONAL_CLAIM_NOTIONAL_INVALID',
    );
  }
  if (input.claimedParticipantCount !== undefined) {
    assertNonNegative(
      input.claimedParticipantCount,
      'MONEY_INSTITUTIONAL_CLAIM_PARTICIPANTS_INVALID',
    );
  }
  if (input.claimedDataCostPerYear !== undefined) {
    assertNonNegative(
      input.claimedDataCostPerYear,
      'MONEY_INSTITUTIONAL_CLAIM_DATA_COST_INVALID',
    );
  }

  return Object.freeze({
    ...input,
    sourceEvidenceIds: Object.freeze([...input.sourceEvidenceIds]),
    status: 'SOURCE_ASSERTION',
    authority: 'NONE',
  });
}

export function toObservedFxPositioningFactor(
  observation: InstitutionalFlowObservation,
  input: Readonly<{
    pairId: string;
    baseCurrency: string;
    quoteCurrency: string;
    informationCutoff: string;
    methodologyVersion: string;
    provenanceHash: string;
  }>,
): FxFactorObservation {
  assertInstitutionalFlowObservation(observation);

  if (observation.market !== 'FOREX') {
    throw new Error('MONEY_INSTITUTIONAL_FX_MARKET_REQUIRED');
  }
  if (
    observation.status !== 'OBSERVED' &&
    observation.status !== 'CORROBORATED'
  ) {
    throw new Error('MONEY_INSTITUTIONAL_FX_FLOW_NOT_OBSERVED');
  }

  const cutoff = assertTimestamp(
    input.informationCutoff,
    'MONEY_INSTITUTIONAL_FX_CUTOFF_INVALID',
  );
  const availableAt = assertTimestamp(
    observation.availableAt,
    'MONEY_INSTITUTIONAL_FLOW_AVAILABLE_TIME_INVALID',
  );
  if (availableAt > cutoff) {
    throw new Error('MONEY_INSTITUTIONAL_FX_FUTURE_FLOW');
  }

  for (const [value, code] of [
    [input.pairId, 'MONEY_INSTITUTIONAL_FX_PAIR_REQUIRED'],
    [input.baseCurrency, 'MONEY_INSTITUTIONAL_FX_BASE_REQUIRED'],
    [input.quoteCurrency, 'MONEY_INSTITUTIONAL_FX_QUOTE_REQUIRED'],
    [input.methodologyVersion, 'MONEY_INSTITUTIONAL_FX_METHODOLOGY_REQUIRED'],
    [input.provenanceHash, 'MONEY_INSTITUTIONAL_FX_PROVENANCE_REQUIRED'],
  ] as const) {
    assertNonEmpty(value, code);
  }

  const directionalScore =
    observation.side === 'BUY'
      ? 1
      : observation.side === 'SELL'
        ? -1
        : 0;

  return Object.freeze({
    factorId: `${observation.observationId}:fx-positioning`,
    pairId: input.pairId,
    instrumentId: observation.instrumentId,
    baseCurrency: input.baseCurrency,
    quoteCurrency: input.quoteCurrency,
    category: 'POSITIONING',
    name: 'OBSERVED_INSTITUTIONAL_FLOW_DIRECTION',
    value: directionalScore,
    unit: 'SIGNED_DIRECTION',
    directionalScore,
    informationCutoff: input.informationCutoff,
    sourceEvidenceRefs: Object.freeze([...observation.evidenceIds]),
    sourceMacroArtifactIds: Object.freeze([]),
    sourceSnapshotIds: Object.freeze([]),
    methodologyVersion: input.methodologyVersion,
    evidenceRefs: Object.freeze([...observation.evidenceIds]),
    provenanceHash: input.provenanceHash,
  });
}

export function assertInstitutionalPatternNonExecutable(
  pattern: InstitutionalBehaviorPattern,
): void {
  if (
    pattern.authority !== 'RESEARCH_ONLY' ||
    pattern.canAuthorizeTrade !== false
  ) {
    throw new Error('MONEY_INSTITUTIONAL_PATTERN_EXECUTION_AUTHORITY_FORBIDDEN');
  }
}
