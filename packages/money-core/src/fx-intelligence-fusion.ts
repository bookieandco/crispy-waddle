import type {
  DecisionAssessment,
  DecisionCase,
} from './decision-workflow-contracts.js';
import {
  FX_MARKET_REALITY_SCHEMA_VERSION,
  type FxMarketSnapshot,
} from './fx-market-reality.js';

export const FX_INTELLIGENCE_SCHEMA_VERSION = 'MONEY-FOREX-02' as const;

export type FxFactorCategory =
  | 'MACRO_RELATIVE'
  | 'CARRY'
  | 'LIQUIDITY'
  | 'SESSION'
  | 'CROSS_PAIR'
  | 'MOMENTUM'
  | 'VOLATILITY'
  | 'EVENT'
  | 'OTHER';

export type FxFactorObservation = Readonly<{
  factorId: string;
  pairId: string;
  instrumentId: string;
  baseCurrency: string;
  quoteCurrency: string;
  category: FxFactorCategory;
  name: string;
  value: number;
  unit: string;
  directionalScore?: number;
  informationCutoff: string;
  sourceEvidenceRefs: readonly string[];
  sourceMacroArtifactIds: readonly string[];
  sourceSnapshotIds: readonly string[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxFactorSet = Readonly<{
  factorSetId: string;
  pairId: string;
  instrumentId: string;
  baseCurrency: string;
  quoteCurrency: string;
  informationCutoff: string;
  marketSnapshotId: string;
  relatedSnapshotIds: readonly string[];
  factors: readonly FxFactorObservation[];
  methodologyVersion: string;
  inputSnapshotHash: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type FxRegimeLabel =
  | 'BASE_RATE_ADVANTAGE'
  | 'QUOTE_RATE_ADVANTAGE'
  | 'SESSION_OVERLAP'
  | 'TIGHT_LIQUIDITY'
  | 'WIDE_LIQUIDITY'
  | 'TREND'
  | 'RANGE'
  | 'EVENT_RISK'
  | 'MIXED'
  | 'UNKNOWN';

export type FxRegimeAssessment = Readonly<{
  regimeId: string;
  pairId: string;
  instrumentId: string;
  informationCutoff: string;
  label: FxRegimeLabel;
  confidence: number;
  rationale: string;
  sourceFactorIds: readonly string[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type FxForecastScenario = Readonly<{
  scenarioId: string;
  label: string;
  probability: number;
  expectedReturn: number;
  minReturnInclusive?: number;
  maxReturnExclusive?: number;
}>;

export type FxForecastCalibrationStatus =
  | 'CALIBRATED'
  | 'PARTIAL'
  | 'UNCALIBRATED'
  | 'STALE'
  | 'UNKNOWN';

export type FxForecastDistribution = Readonly<{
  forecastId: string;
  pairId: string;
  instrumentId: string;
  baseCurrency: string;
  quoteCurrency: string;
  informationCutoff: string;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  methodologyVersion: string;
  factorSetId: string;
  regimeId: string;
  marketSnapshotId: string;
  scenarios: readonly FxForecastScenario[];
  calibrationStatus: FxForecastCalibrationStatus;
  priorCalibrationScore?: number;
  evidenceRefs: readonly string[];
  inputSnapshotHash: string;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type FxLiquidityRisk =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'UNKNOWN';

export type FxStressScenario = Readonly<{
  stressId: string;
  label: string;
  shockedReturn: number;
  spreadShockPips?: number;
  carryDifferentialShockPct?: number;
  rationale: string;
  evidenceRefs: readonly string[];
}>;

export type FxRiskAssessment = Readonly<{
  riskAssessmentId: string;
  pairId: string;
  instrumentId: string;
  informationCutoff: string;
  forecastId: string;
  volatilityEstimate?: number;
  downsideEstimate?: number;
  liquidityRisk: FxLiquidityRisk;
  observedSpreadPips: number;
  stressScenarios: readonly FxStressScenario[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type FxIntelligenceSnapshot = Readonly<{
  schemaVersion: typeof FX_INTELLIGENCE_SCHEMA_VERSION;
  intelligenceId: string;
  pairId: string;
  instrumentId: string;
  baseCurrency: string;
  quoteCurrency: string;
  informationCutoff: string;
  factorSet: FxFactorSet;
  regime: FxRegimeAssessment;
  forecast: FxForecastDistribution;
  risk: FxRiskAssessment;
  decisionCase: DecisionCase;
  assessment: DecisionAssessment;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type FxForecastResolution = Readonly<{
  resolutionId: string;
  forecastId: string;
  pairId: string;
  instrumentId: string;
  targetAt: string;
  resolvedAt: string;
  referencePrice: string;
  resolvedPrice: string;
  realizedReturn: number;
  matchedScenarioId?: string;
  authority: string;
  ruleVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type FxForecastScore = Readonly<{
  scoreId: string;
  forecastId: string;
  resolutionId: string;
  matchedScenarioId?: string;
  multiclassBrierScore?: number;
  absoluteExpectedReturnError: number;
  scoredAt: string;
  methodologyVersion: string;
  provenanceHash: string;
}>;

export type BuildFxFactorSetInput = Readonly<{
  marketSnapshot: FxMarketSnapshot;
  relatedSnapshots: readonly FxMarketSnapshot[];
  factors: readonly Omit<
    FxFactorObservation,
    | 'pairId'
    | 'instrumentId'
    | 'baseCurrency'
    | 'quoteCurrency'
    | 'informationCutoff'
  >[];
  methodologyVersion: string;
  inputSnapshotHash: string;
  provenanceHash: string;
}>;

export type BuildFxRegimeAssessmentInput = Readonly<{
  factorSet: FxFactorSet;
  regimeId: string;
  label: FxRegimeLabel;
  confidence: number;
  rationale: string;
  sourceFactorIds: readonly string[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type BuildFxForecastInput = Readonly<{
  factorSet: FxFactorSet;
  regime: FxRegimeAssessment;
  marketSnapshot: FxMarketSnapshot;
  forecastId: string;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  methodologyVersion: string;
  scenarios: readonly FxForecastScenario[];
  calibrationStatus: FxForecastCalibrationStatus;
  priorCalibrationScore?: number;
  evidenceRefs: readonly string[];
  inputSnapshotHash: string;
  provenanceHash: string;
}>;

export type BuildFxRiskAssessmentInput = Readonly<{
  forecast: FxForecastDistribution;
  marketSnapshot: FxMarketSnapshot;
  riskAssessmentId: string;
  volatilityEstimate?: number;
  downsideEstimate?: number;
  liquidityRisk: FxLiquidityRisk;
  stressScenarios: readonly FxStressScenario[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type BuildFxIntelligenceSnapshotInput = Readonly<{
  accountId: string;
  requestedBy: string;
  createdAt: string;
  intelligenceId: string;
  factorSet: FxFactorSet;
  regime: FxRegimeAssessment;
  forecast: FxForecastDistribution;
  risk: FxRiskAssessment;
  provenanceHash: string;
}>;

type ParsedDecimal = Readonly<{
  coefficient: bigint;
  scale: number;
}>;

const PROBABILITY_EPSILON = 1e-6;
const RETURN_SCALE = 1_000_000_000_000n;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function parseTimestamp(value: string, code: string): number {
  assertNonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function assertFiniteNumber(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertUnitInterval(value: number, code: string): void {
  assertFiniteNumber(value, code);
  if (value < 0 || value > 1) throw new Error(code);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function parsePositiveDecimal(value: string, code: string): ParsedDecimal {
  assertNonEmpty(value, code);
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(code);
  }
  const [whole = '0', fraction = ''] = value.split('.');
  const coefficient = BigInt(`${whole}${fraction}`);
  if (coefficient <= 0n) throw new Error(code);
  return Object.freeze({
    coefficient,
    scale: fraction.length,
  });
}

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function rescaleExact(value: ParsedDecimal, targetScale: number): bigint {
  if (targetScale < value.scale) {
    throw new Error('MONEY_FX_INTELLIGENCE_DECIMAL_SCALE_LOSS');
  }
  return value.coefficient * pow10(targetScale - value.scale);
}

function roundedDividePositive(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error('MONEY_FX_INTELLIGENCE_DIVISION_INVALID');
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function formatScaled(coefficient: bigint, scale: number): string {
  const raw = coefficient.toString();
  if (scale === 0) return raw;
  const padded = raw.padStart(scale + 1, '0');
  return `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

function signedDecimalToNumber(value: string, code: string): number {
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new Error(code);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function assertFxSnapshotAuthority(snapshot: FxMarketSnapshot): void {
  if (snapshot.schemaVersion !== FX_MARKET_REALITY_SCHEMA_VERSION) {
    throw new Error('MONEY_FX_INTELLIGENCE_SNAPSHOT_SCHEMA_UNSUPPORTED');
  }
  if (
    snapshot.researchAuthority !== 'INTELLIGENCE_ONLY' ||
    snapshot.executionAuthority !== 'NONE' ||
    snapshot.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_FX_INTELLIGENCE_SOURCE_AUTHORITY_FORBIDDEN');
  }
}

export function fxReferenceMidPrice(snapshot: FxMarketSnapshot): string {
  assertFxSnapshotAuthority(snapshot);
  const bid = parsePositiveDecimal(
    snapshot.quote.bidPrice,
    'MONEY_FX_INTELLIGENCE_BID_INVALID',
  );
  const ask = parsePositiveDecimal(
    snapshot.quote.askPrice,
    'MONEY_FX_INTELLIGENCE_ASK_INVALID',
  );
  const scale = Math.max(bid.scale, ask.scale);
  const bidScaled = rescaleExact(bid, scale);
  const askScaled = rescaleExact(ask, scale);
  if (askScaled < bidScaled) {
    throw new Error('MONEY_FX_INTELLIGENCE_CROSSED_QUOTE');
  }
  const midpoint = roundedDividePositive(bidScaled + askScaled, 2n);
  return formatScaled(midpoint, scale);
}

export function deriveFxRealityFactors(
  snapshot: FxMarketSnapshot,
  methodologyVersion: string,
  provenanceHash: string,
): readonly FxFactorObservation[] {
  assertFxSnapshotAuthority(snapshot);
  assertNonEmpty(
    methodologyVersion,
    'MONEY_FX_FACTOR_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    provenanceHash,
    'MONEY_FX_FACTOR_PROVENANCE_REQUIRED',
  );

  const quoteEvidence = Object.freeze([...snapshot.quote.evidenceRefs]);
  const factors: FxFactorObservation[] = [
    Object.freeze({
      factorId: `${snapshot.snapshotId}:spread-pips`,
      pairId: snapshot.pairId,
      instrumentId: snapshot.instrumentId,
      baseCurrency: snapshot.baseCurrency,
      quoteCurrency: snapshot.quoteCurrency,
      category: 'LIQUIDITY',
      name: 'SPREAD_PIPS',
      value: snapshot.spreadPips,
      unit: 'PIPS',
      informationCutoff: snapshot.informationCutoff,
      sourceEvidenceRefs: quoteEvidence,
      sourceMacroArtifactIds: Object.freeze([]),
      sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
      methodologyVersion,
      evidenceRefs: quoteEvidence,
      provenanceHash,
    }),
    Object.freeze({
      factorId: `${snapshot.snapshotId}:active-session-count`,
      pairId: snapshot.pairId,
      instrumentId: snapshot.instrumentId,
      baseCurrency: snapshot.baseCurrency,
      quoteCurrency: snapshot.quoteCurrency,
      category: 'SESSION',
      name: 'ACTIVE_SESSION_COUNT',
      value: snapshot.activeSessions.length,
      unit: 'COUNT',
      informationCutoff: snapshot.informationCutoff,
      sourceEvidenceRefs: Object.freeze(
        snapshot.activeSessions.flatMap((session) => session.evidenceRefs),
      ),
      sourceMacroArtifactIds: Object.freeze([]),
      sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
      methodologyVersion,
      evidenceRefs: Object.freeze(
        unique(
          snapshot.activeSessions.flatMap(
            (session) => session.evidenceRefs,
          ),
        ),
      ),
      provenanceHash,
    }),
    Object.freeze({
      factorId: `${snapshot.snapshotId}:session-overlap`,
      pairId: snapshot.pairId,
      instrumentId: snapshot.instrumentId,
      baseCurrency: snapshot.baseCurrency,
      quoteCurrency: snapshot.quoteCurrency,
      category: 'SESSION',
      name: 'SESSION_OVERLAP',
      value: snapshot.activeSessions.length > 1 ? 1 : 0,
      unit: 'BOOLEAN',
      informationCutoff: snapshot.informationCutoff,
      sourceEvidenceRefs: Object.freeze(
        snapshot.activeSessions.flatMap((session) => session.evidenceRefs),
      ),
      sourceMacroArtifactIds: Object.freeze([]),
      sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
      methodologyVersion,
      evidenceRefs: Object.freeze(
        unique(
          snapshot.activeSessions.flatMap(
            (session) => session.evidenceRefs,
          ),
        ),
      ),
      provenanceHash,
    }),
  ];

  if (snapshot.carry) {
    const macroIds = unique([
      ...snapshot.baseMacroContext.macroArtifactIds,
      ...snapshot.quoteMacroContext.macroArtifactIds,
    ]);
    const carryEvidence = unique([
      ...snapshot.carry.evidenceRefs,
      ...snapshot.baseMacroContext.evidenceRefs,
      ...snapshot.quoteMacroContext.evidenceRefs,
    ]);

    factors.push(
      Object.freeze({
        factorId: `${snapshot.snapshotId}:policy-rate-differential`,
        pairId: snapshot.pairId,
        instrumentId: snapshot.instrumentId,
        baseCurrency: snapshot.baseCurrency,
        quoteCurrency: snapshot.quoteCurrency,
        category: 'MACRO_RELATIVE',
        name: 'POLICY_RATE_DIFFERENTIAL_PCT',
        value: snapshot.carry.rateDifferentialPct,
        unit: 'PERCENTAGE_POINTS',
        informationCutoff: snapshot.informationCutoff,
        sourceEvidenceRefs: Object.freeze([...carryEvidence]),
        sourceMacroArtifactIds: Object.freeze([...macroIds]),
        sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
        methodologyVersion,
        evidenceRefs: Object.freeze([...carryEvidence]),
        provenanceHash,
      }),
      Object.freeze({
        factorId: `${snapshot.snapshotId}:long-swap`,
        pairId: snapshot.pairId,
        instrumentId: snapshot.instrumentId,
        baseCurrency: snapshot.baseCurrency,
        quoteCurrency: snapshot.quoteCurrency,
        category: 'CARRY',
        name: 'LONG_SWAP_POINTS',
        value: signedDecimalToNumber(
          snapshot.carry.longSwapPoints,
          'MONEY_FX_FACTOR_LONG_SWAP_INVALID',
        ),
        unit:
          snapshot.carry.swapPointUnit === 'PIPS'
            ? 'PIPS'
            : 'PRICE',
        informationCutoff: snapshot.informationCutoff,
        sourceEvidenceRefs: Object.freeze([
          ...snapshot.carry.evidenceRefs,
        ]),
        sourceMacroArtifactIds: Object.freeze([...macroIds]),
        sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
        methodologyVersion,
        evidenceRefs: Object.freeze([
          ...snapshot.carry.evidenceRefs,
        ]),
        provenanceHash,
      }),
      Object.freeze({
        factorId: `${snapshot.snapshotId}:short-swap`,
        pairId: snapshot.pairId,
        instrumentId: snapshot.instrumentId,
        baseCurrency: snapshot.baseCurrency,
        quoteCurrency: snapshot.quoteCurrency,
        category: 'CARRY',
        name: 'SHORT_SWAP_POINTS',
        value: signedDecimalToNumber(
          snapshot.carry.shortSwapPoints,
          'MONEY_FX_FACTOR_SHORT_SWAP_INVALID',
        ),
        unit:
          snapshot.carry.swapPointUnit === 'PIPS'
            ? 'PIPS'
            : 'PRICE',
        informationCutoff: snapshot.informationCutoff,
        sourceEvidenceRefs: Object.freeze([
          ...snapshot.carry.evidenceRefs,
        ]),
        sourceMacroArtifactIds: Object.freeze([...macroIds]),
        sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
        methodologyVersion,
        evidenceRefs: Object.freeze([
          ...snapshot.carry.evidenceRefs,
        ]),
        provenanceHash,
      }),
    );
  }

  if (snapshot.quote.sourceType === 'CROSS_DERIVED') {
    factors.push(
      Object.freeze({
        factorId: `${snapshot.snapshotId}:cross-derived`,
        pairId: snapshot.pairId,
        instrumentId: snapshot.instrumentId,
        baseCurrency: snapshot.baseCurrency,
        quoteCurrency: snapshot.quoteCurrency,
        category: 'CROSS_PAIR',
        name: 'CROSS_DERIVED_QUOTE',
        value: 1,
        unit: 'BOOLEAN',
        informationCutoff: snapshot.informationCutoff,
        sourceEvidenceRefs: quoteEvidence,
        sourceMacroArtifactIds: Object.freeze([]),
        sourceSnapshotIds: Object.freeze([snapshot.snapshotId]),
        methodologyVersion,
        evidenceRefs: quoteEvidence,
        provenanceHash,
      }),
    );
  }

  return Object.freeze(factors);
}

function assertFactor(
  factor: FxFactorObservation,
  primary: FxMarketSnapshot,
  knownEvidenceRefs: ReadonlySet<string>,
  knownMacroArtifactIds: ReadonlySet<string>,
  knownSnapshotIds: ReadonlySet<string>,
): void {
  assertNonEmpty(factor.factorId, 'MONEY_FX_FACTOR_ID_REQUIRED');
  assertNonEmpty(factor.name, 'MONEY_FX_FACTOR_NAME_REQUIRED');
  assertNonEmpty(factor.unit, 'MONEY_FX_FACTOR_UNIT_REQUIRED');
  assertNonEmpty(
    factor.methodologyVersion,
    'MONEY_FX_FACTOR_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    factor.provenanceHash,
    'MONEY_FX_FACTOR_PROVENANCE_REQUIRED',
  );
  assertFiniteNumber(factor.value, 'MONEY_FX_FACTOR_VALUE_INVALID');

  if (
    factor.pairId !== primary.pairId ||
    factor.instrumentId !== primary.instrumentId
  ) {
    throw new Error('MONEY_FX_FACTOR_PRIMARY_IDENTITY_MISMATCH');
  }
  if (
    factor.baseCurrency !== primary.baseCurrency ||
    factor.quoteCurrency !== primary.quoteCurrency
  ) {
    throw new Error('MONEY_FX_FACTOR_CURRENCY_MISMATCH');
  }
  if (factor.informationCutoff !== primary.informationCutoff) {
    throw new Error('MONEY_FX_FACTOR_CUTOFF_MISMATCH');
  }
  if (
    factor.directionalScore !== undefined &&
    (!Number.isFinite(factor.directionalScore) ||
      factor.directionalScore < -1 ||
      factor.directionalScore > 1)
  ) {
    throw new Error('MONEY_FX_FACTOR_DIRECTIONAL_SCORE_INVALID');
  }
  if (factor.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_FACTOR_EVIDENCE_REQUIRED');
  }
  if (factor.sourceSnapshotIds.length === 0) {
    throw new Error('MONEY_FX_FACTOR_SOURCE_SNAPSHOT_REQUIRED');
  }

  for (const evidenceRef of factor.sourceEvidenceRefs) {
    if (!knownEvidenceRefs.has(evidenceRef)) {
      throw new Error('MONEY_FX_FACTOR_UNKNOWN_EVIDENCE');
    }
  }
  for (const artifactId of factor.sourceMacroArtifactIds) {
    if (!knownMacroArtifactIds.has(artifactId)) {
      throw new Error('MONEY_FX_FACTOR_UNKNOWN_MACRO_ARTIFACT');
    }
  }
  for (const snapshotId of factor.sourceSnapshotIds) {
    if (!knownSnapshotIds.has(snapshotId)) {
      throw new Error('MONEY_FX_FACTOR_UNKNOWN_SNAPSHOT');
    }
  }
}

export function buildFxFactorSet(
  input: BuildFxFactorSetInput,
): FxFactorSet {
  const primary = input.marketSnapshot;
  assertFxSnapshotAuthority(primary);
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_FACTOR_SET_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.inputSnapshotHash,
    'MONEY_FX_FACTOR_SET_INPUT_HASH_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_FACTOR_SET_PROVENANCE_REQUIRED',
  );

  const primaryCutoff = parseTimestamp(
    primary.informationCutoff,
    'MONEY_FX_FACTOR_SET_CUTOFF_INVALID',
  );
  const snapshotIds = new Set<string>([primary.snapshotId]);
  const allSnapshots = [primary, ...input.relatedSnapshots];

  for (const related of input.relatedSnapshots) {
    assertFxSnapshotAuthority(related);
    if (snapshotIds.has(related.snapshotId)) {
      throw new Error('MONEY_FX_FACTOR_DUPLICATE_RELATED_SNAPSHOT');
    }
    if (Date.parse(related.informationCutoff) > primaryCutoff) {
      throw new Error('MONEY_FX_FACTOR_RELATED_SNAPSHOT_FUTURE_LEAK');
    }
    snapshotIds.add(related.snapshotId);
  }

  const knownEvidenceRefs = new Set(
    allSnapshots.flatMap((snapshot) => snapshot.evidenceRefs),
  );
  const knownMacroArtifactIds = new Set(
    allSnapshots.flatMap((snapshot) => [
      ...snapshot.baseMacroContext.macroArtifactIds,
      ...snapshot.quoteMacroContext.macroArtifactIds,
    ]),
  );

  const factorIds = new Set<string>();
  const factors = input.factors.map((factor) => {
    const complete: FxFactorObservation = Object.freeze({
      ...factor,
      pairId: primary.pairId,
      instrumentId: primary.instrumentId,
      baseCurrency: primary.baseCurrency,
      quoteCurrency: primary.quoteCurrency,
      informationCutoff: primary.informationCutoff,
      sourceEvidenceRefs: Object.freeze([
        ...factor.sourceEvidenceRefs,
      ]),
      sourceMacroArtifactIds: Object.freeze([
        ...factor.sourceMacroArtifactIds,
      ]),
      sourceSnapshotIds: Object.freeze([
        ...factor.sourceSnapshotIds,
      ]),
      evidenceRefs: Object.freeze([...factor.evidenceRefs]),
    });

    assertFactor(
      complete,
      primary,
      knownEvidenceRefs,
      knownMacroArtifactIds,
      snapshotIds,
    );
    if (factorIds.has(complete.factorId)) {
      throw new Error('MONEY_FX_FACTOR_DUPLICATE_ID');
    }
    factorIds.add(complete.factorId);
    return complete;
  });

  if (factors.length === 0) {
    throw new Error('MONEY_FX_FACTOR_SET_EMPTY');
  }

  return Object.freeze({
    factorSetId: `${primary.snapshotId}:factors:${input.inputSnapshotHash}`,
    pairId: primary.pairId,
    instrumentId: primary.instrumentId,
    baseCurrency: primary.baseCurrency,
    quoteCurrency: primary.quoteCurrency,
    informationCutoff: primary.informationCutoff,
    marketSnapshotId: primary.snapshotId,
    relatedSnapshotIds: Object.freeze(
      input.relatedSnapshots.map((snapshot) => snapshot.snapshotId),
    ),
    factors: Object.freeze(factors),
    methodologyVersion: input.methodologyVersion,
    inputSnapshotHash: input.inputSnapshotHash,
    evidenceRefs: unique([
      ...primary.evidenceRefs,
      ...input.relatedSnapshots.flatMap(
        (snapshot) => snapshot.evidenceRefs,
      ),
      ...factors.flatMap((factor) => factor.evidenceRefs),
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildFxRegimeAssessment(
  input: BuildFxRegimeAssessmentInput,
): FxRegimeAssessment {
  assertNonEmpty(input.regimeId, 'MONEY_FX_REGIME_ID_REQUIRED');
  assertNonEmpty(input.rationale, 'MONEY_FX_REGIME_RATIONALE_REQUIRED');
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_REGIME_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_REGIME_PROVENANCE_REQUIRED',
  );
  assertUnitInterval(
    input.confidence,
    'MONEY_FX_REGIME_CONFIDENCE_INVALID',
  );

  if (input.factorSet.financialAuthority !== 'NONE') {
    throw new Error('MONEY_FX_REGIME_FACTOR_AUTHORITY_FORBIDDEN');
  }
  if (input.sourceFactorIds.length === 0) {
    throw new Error('MONEY_FX_REGIME_FACTORS_REQUIRED');
  }
  if (input.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_REGIME_EVIDENCE_REQUIRED');
  }

  const availableFactorIds = new Set(
    input.factorSet.factors.map((factor) => factor.factorId),
  );
  for (const factorId of input.sourceFactorIds) {
    if (!availableFactorIds.has(factorId)) {
      throw new Error('MONEY_FX_REGIME_UNKNOWN_FACTOR');
    }
  }

  return Object.freeze({
    regimeId: input.regimeId,
    pairId: input.factorSet.pairId,
    instrumentId: input.factorSet.instrumentId,
    informationCutoff: input.factorSet.informationCutoff,
    label: input.label,
    confidence: input.confidence,
    rationale: input.rationale,
    sourceFactorIds: unique(input.sourceFactorIds),
    methodologyVersion: input.methodologyVersion,
    evidenceRefs: unique([
      ...input.factorSet.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

function assertForecastScenario(
  scenario: FxForecastScenario,
): void {
  assertNonEmpty(
    scenario.scenarioId,
    'MONEY_FX_FORECAST_SCENARIO_ID_REQUIRED',
  );
  assertNonEmpty(
    scenario.label,
    'MONEY_FX_FORECAST_SCENARIO_LABEL_REQUIRED',
  );
  assertUnitInterval(
    scenario.probability,
    'MONEY_FX_FORECAST_PROBABILITY_INVALID',
  );
  assertFiniteNumber(
    scenario.expectedReturn,
    'MONEY_FX_FORECAST_EXPECTED_RETURN_INVALID',
  );

  if (
    scenario.minReturnInclusive !== undefined &&
    !Number.isFinite(scenario.minReturnInclusive)
  ) {
    throw new Error('MONEY_FX_FORECAST_MIN_RETURN_INVALID');
  }
  if (
    scenario.maxReturnExclusive !== undefined &&
    !Number.isFinite(scenario.maxReturnExclusive)
  ) {
    throw new Error('MONEY_FX_FORECAST_MAX_RETURN_INVALID');
  }
  if (
    scenario.minReturnInclusive !== undefined &&
    scenario.maxReturnExclusive !== undefined &&
    scenario.maxReturnExclusive <= scenario.minReturnInclusive
  ) {
    throw new Error('MONEY_FX_FORECAST_RANGE_INVALID');
  }
}

function assertScenarioRangesDoNotOverlap(
  scenarios: readonly FxForecastScenario[],
): void {
  const intervals = scenarios
    .map((scenario) => ({
      min:
        scenario.minReturnInclusive === undefined
          ? Number.NEGATIVE_INFINITY
          : scenario.minReturnInclusive,
      max:
        scenario.maxReturnExclusive === undefined
          ? Number.POSITIVE_INFINITY
          : scenario.maxReturnExclusive,
    }))
    .sort((a, b) => a.min - b.min);

  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index]!.min < intervals[index - 1]!.max) {
      throw new Error('MONEY_FX_FORECAST_SCENARIO_RANGES_OVERLAP');
    }
  }
}

export function buildFxForecast(
  input: BuildFxForecastInput,
): FxForecastDistribution {
  assertFxSnapshotAuthority(input.marketSnapshot);
  if (
    input.factorSet.marketSnapshotId !== input.marketSnapshot.snapshotId
  ) {
    throw new Error('MONEY_FX_FORECAST_SNAPSHOT_LINEAGE_MISMATCH');
  }
  if (
    input.factorSet.pairId !== input.marketSnapshot.pairId ||
    input.regime.pairId !== input.factorSet.pairId
  ) {
    throw new Error('MONEY_FX_FORECAST_PAIR_MISMATCH');
  }
  if (
    input.factorSet.instrumentId !== input.marketSnapshot.instrumentId ||
    input.regime.instrumentId !== input.factorSet.instrumentId
  ) {
    throw new Error('MONEY_FX_FORECAST_INSTRUMENT_MISMATCH');
  }
  if (
    input.regime.informationCutoff !== input.factorSet.informationCutoff
  ) {
    throw new Error('MONEY_FX_FORECAST_REGIME_CUTOFF_MISMATCH');
  }
  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.regime.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_FX_FORECAST_AUTHORITY_FORBIDDEN');
  }

  assertNonEmpty(input.forecastId, 'MONEY_FX_FORECAST_ID_REQUIRED');
  assertNonEmpty(
    input.horizonLabel,
    'MONEY_FX_FORECAST_HORIZON_REQUIRED',
  );
  assertNonEmpty(input.modelId, 'MONEY_FX_FORECAST_MODEL_ID_REQUIRED');
  assertNonEmpty(
    input.modelVersion,
    'MONEY_FX_FORECAST_MODEL_VERSION_REQUIRED',
  );
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_FORECAST_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.inputSnapshotHash,
    'MONEY_FX_FORECAST_INPUT_HASH_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_FORECAST_PROVENANCE_REQUIRED',
  );

  const cutoff = parseTimestamp(
    input.factorSet.informationCutoff,
    'MONEY_FX_FORECAST_CUTOFF_INVALID',
  );
  const issuedAt = parseTimestamp(
    input.issuedAt,
    'MONEY_FX_FORECAST_ISSUED_AT_INVALID',
  );
  const targetAt = parseTimestamp(
    input.targetAt,
    'MONEY_FX_FORECAST_TARGET_AT_INVALID',
  );
  if (issuedAt < cutoff) {
    throw new Error('MONEY_FX_FORECAST_ISSUED_BEFORE_CUTOFF');
  }
  if (targetAt <= issuedAt) {
    throw new Error('MONEY_FX_FORECAST_TARGET_NOT_FUTURE');
  }
  if (input.scenarios.length < 2) {
    throw new Error('MONEY_FX_FORECAST_SCENARIOS_INSUFFICIENT');
  }

  const scenarioIds = new Set<string>();
  let probabilityMass = 0;
  for (const scenario of input.scenarios) {
    assertForecastScenario(scenario);
    if (scenarioIds.has(scenario.scenarioId)) {
      throw new Error('MONEY_FX_FORECAST_DUPLICATE_SCENARIO');
    }
    scenarioIds.add(scenario.scenarioId);
    probabilityMass += scenario.probability;
  }
  if (Math.abs(probabilityMass - 1) > PROBABILITY_EPSILON) {
    throw new Error('MONEY_FX_FORECAST_PROBABILITY_MASS_INVALID');
  }
  assertScenarioRangesDoNotOverlap(input.scenarios);

  if (
    input.priorCalibrationScore !== undefined &&
    (!Number.isFinite(input.priorCalibrationScore) ||
      input.priorCalibrationScore < 0)
  ) {
    throw new Error('MONEY_FX_FORECAST_CALIBRATION_SCORE_INVALID');
  }

  return Object.freeze({
    forecastId: input.forecastId,
    pairId: input.factorSet.pairId,
    instrumentId: input.factorSet.instrumentId,
    baseCurrency: input.factorSet.baseCurrency,
    quoteCurrency: input.factorSet.quoteCurrency,
    informationCutoff: input.factorSet.informationCutoff,
    issuedAt: input.issuedAt,
    targetAt: input.targetAt,
    horizonLabel: input.horizonLabel,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    methodologyVersion: input.methodologyVersion,
    factorSetId: input.factorSet.factorSetId,
    regimeId: input.regime.regimeId,
    marketSnapshotId: input.marketSnapshot.snapshotId,
    scenarios: Object.freeze(
      input.scenarios.map((scenario) =>
        Object.freeze({ ...scenario }),
      ),
    ),
    calibrationStatus: input.calibrationStatus,
    priorCalibrationScore: input.priorCalibrationScore,
    evidenceRefs: unique([
      ...input.factorSet.evidenceRefs,
      ...input.regime.evidenceRefs,
      ...input.evidenceRefs,
    ]),
    inputSnapshotHash: input.inputSnapshotHash,
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildFxRiskAssessment(
  input: BuildFxRiskAssessmentInput,
): FxRiskAssessment {
  assertFxSnapshotAuthority(input.marketSnapshot);
  assertNonEmpty(
    input.riskAssessmentId,
    'MONEY_FX_RISK_ID_REQUIRED',
  );
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_RISK_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_RISK_PROVENANCE_REQUIRED',
  );

  if (
    input.forecast.marketSnapshotId !== input.marketSnapshot.snapshotId
  ) {
    throw new Error('MONEY_FX_RISK_SNAPSHOT_LINEAGE_MISMATCH');
  }
  if (input.forecast.financialAuthority !== 'NONE') {
    throw new Error('MONEY_FX_RISK_FORECAST_AUTHORITY_FORBIDDEN');
  }
  if (
    input.volatilityEstimate !== undefined &&
    (!Number.isFinite(input.volatilityEstimate) ||
      input.volatilityEstimate < 0)
  ) {
    throw new Error('MONEY_FX_RISK_VOLATILITY_INVALID');
  }
  if (
    input.downsideEstimate !== undefined &&
    (!Number.isFinite(input.downsideEstimate) ||
      input.downsideEstimate > 0)
  ) {
    throw new Error('MONEY_FX_RISK_DOWNSIDE_INVALID');
  }

  const stressIds = new Set<string>();
  for (const stress of input.stressScenarios) {
    assertNonEmpty(stress.stressId, 'MONEY_FX_STRESS_ID_REQUIRED');
    assertNonEmpty(stress.label, 'MONEY_FX_STRESS_LABEL_REQUIRED');
    assertNonEmpty(
      stress.rationale,
      'MONEY_FX_STRESS_RATIONALE_REQUIRED',
    );
    assertFiniteNumber(
      stress.shockedReturn,
      'MONEY_FX_STRESS_RETURN_INVALID',
    );
    if (
      stress.spreadShockPips !== undefined &&
      (!Number.isFinite(stress.spreadShockPips) ||
        stress.spreadShockPips < 0)
    ) {
      throw new Error('MONEY_FX_STRESS_SPREAD_INVALID');
    }
    if (
      stress.carryDifferentialShockPct !== undefined &&
      !Number.isFinite(stress.carryDifferentialShockPct)
    ) {
      throw new Error('MONEY_FX_STRESS_CARRY_INVALID');
    }
    if (stress.evidenceRefs.length === 0) {
      throw new Error('MONEY_FX_STRESS_EVIDENCE_REQUIRED');
    }
    if (stressIds.has(stress.stressId)) {
      throw new Error('MONEY_FX_STRESS_DUPLICATE_ID');
    }
    stressIds.add(stress.stressId);
  }

  return Object.freeze({
    riskAssessmentId: input.riskAssessmentId,
    pairId: input.forecast.pairId,
    instrumentId: input.forecast.instrumentId,
    informationCutoff: input.forecast.informationCutoff,
    forecastId: input.forecast.forecastId,
    volatilityEstimate: input.volatilityEstimate,
    downsideEstimate: input.downsideEstimate,
    liquidityRisk: input.liquidityRisk,
    observedSpreadPips: input.marketSnapshot.spreadPips,
    stressScenarios: Object.freeze(
      input.stressScenarios.map((stress) =>
        Object.freeze({
          ...stress,
          evidenceRefs: Object.freeze([...stress.evidenceRefs]),
        }),
      ),
    ),
    methodologyVersion: input.methodologyVersion,
    evidenceRefs: unique([
      ...input.forecast.evidenceRefs,
      ...input.marketSnapshot.evidenceRefs,
      ...input.evidenceRefs,
      ...input.stressScenarios.flatMap(
        (stress) => stress.evidenceRefs,
      ),
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildFxIntelligenceSnapshot(
  input: BuildFxIntelligenceSnapshotInput,
): FxIntelligenceSnapshot {
  assertNonEmpty(
    input.accountId,
    'MONEY_FX_INTELLIGENCE_ACCOUNT_REQUIRED',
  );
  assertNonEmpty(
    input.requestedBy,
    'MONEY_FX_INTELLIGENCE_REQUESTER_REQUIRED',
  );
  assertNonEmpty(
    input.intelligenceId,
    'MONEY_FX_INTELLIGENCE_ID_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_INTELLIGENCE_PROVENANCE_REQUIRED',
  );

  const createdAt = parseTimestamp(
    input.createdAt,
    'MONEY_FX_INTELLIGENCE_CREATED_AT_INVALID',
  );
  const cutoff = parseTimestamp(
    input.factorSet.informationCutoff,
    'MONEY_FX_INTELLIGENCE_CUTOFF_INVALID',
  );
  if (createdAt < cutoff) {
    throw new Error('MONEY_FX_INTELLIGENCE_CREATED_BEFORE_CUTOFF');
  }

  if (
    input.factorSet.pairId !== input.regime.pairId ||
    input.regime.pairId !== input.forecast.pairId ||
    input.forecast.pairId !== input.risk.pairId
  ) {
    throw new Error('MONEY_FX_INTELLIGENCE_PAIR_MISMATCH');
  }
  if (
    input.factorSet.instrumentId !== input.regime.instrumentId ||
    input.regime.instrumentId !== input.forecast.instrumentId ||
    input.forecast.instrumentId !== input.risk.instrumentId
  ) {
    throw new Error('MONEY_FX_INTELLIGENCE_INSTRUMENT_MISMATCH');
  }
  if (
    input.factorSet.informationCutoff !== input.regime.informationCutoff ||
    input.regime.informationCutoff !== input.forecast.informationCutoff ||
    input.forecast.informationCutoff !== input.risk.informationCutoff
  ) {
    throw new Error('MONEY_FX_INTELLIGENCE_CUTOFF_MISMATCH');
  }
  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.regime.financialAuthority !== 'NONE' ||
    input.forecast.financialAuthority !== 'NONE' ||
    input.risk.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_FX_INTELLIGENCE_AUTHORITY_FORBIDDEN');
  }

  const decisionCase: DecisionCase = Object.freeze({
    caseId: `fx-intelligence:${input.intelligenceId}`,
    accountId: input.accountId,
    subjectId: input.factorSet.pairId,
    requestedBy: input.requestedBy,
    informationCutoff: input.factorSet.informationCutoff,
    createdAt: input.createdAt,
    status: 'RESEARCH_ONLY',
    provenanceHash: input.provenanceHash,
  });

  const assessment: DecisionAssessment = Object.freeze({
    caseId: decisionCase.caseId,
    evidenceStatus: 'DERIVED',
    freshnessStatus: 'POINT_IN_TIME_BOUND',
    riskStatus: 'ASSESSED',
    stressStatus:
      input.risk.stressScenarios.length > 0
        ? 'ASSESSED'
        : 'NOT_PROVIDED',
    simulationStatus: 'NOT_RUN',
    liquidityStatus: input.risk.liquidityRisk,
    calibrationStatus: input.forecast.calibrationStatus,
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  });

  return Object.freeze({
    schemaVersion: FX_INTELLIGENCE_SCHEMA_VERSION,
    intelligenceId: input.intelligenceId,
    pairId: input.factorSet.pairId,
    instrumentId: input.factorSet.instrumentId,
    baseCurrency: input.factorSet.baseCurrency,
    quoteCurrency: input.factorSet.quoteCurrency,
    informationCutoff: input.factorSet.informationCutoff,
    factorSet: input.factorSet,
    regime: input.regime,
    forecast: input.forecast,
    risk: input.risk,
    decisionCase,
    assessment,
    evidenceRefs: unique([
      ...input.factorSet.evidenceRefs,
      ...input.regime.evidenceRefs,
      ...input.forecast.evidenceRefs,
      ...input.risk.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

function exactRealizedReturn(
  referencePrice: string,
  resolvedPrice: string,
): number {
  const reference = parsePositiveDecimal(
    referencePrice,
    'MONEY_FX_RESOLUTION_REFERENCE_PRICE_INVALID',
  );
  const resolved = parsePositiveDecimal(
    resolvedPrice,
    'MONEY_FX_RESOLUTION_PRICE_INVALID',
  );
  const scale = Math.max(reference.scale, resolved.scale);
  const referenceScaled = rescaleExact(reference, scale);
  const resolvedScaled = rescaleExact(resolved, scale);
  const difference = resolvedScaled - referenceScaled;
  const sign = difference < 0n ? -1n : 1n;
  const magnitude = difference < 0n ? -difference : difference;
  const scaledReturn =
    (magnitude * RETURN_SCALE) / referenceScaled;
  const result =
    Number(sign * scaledReturn) / Number(RETURN_SCALE);
  if (!Number.isFinite(result)) {
    throw new Error('MONEY_FX_RESOLUTION_RETURN_INVALID');
  }
  return result;
}

function scenarioMatchesReturn(
  scenario: FxForecastScenario,
  realizedReturn: number,
): boolean {
  const meetsMin =
    scenario.minReturnInclusive === undefined ||
    realizedReturn >= scenario.minReturnInclusive;
  const meetsMax =
    scenario.maxReturnExclusive === undefined ||
    realizedReturn < scenario.maxReturnExclusive;
  return meetsMin && meetsMax;
}

export function resolveFxForecast(input: Readonly<{
  forecast: FxForecastDistribution;
  resolutionId: string;
  resolvedAt: string;
  referencePrice: string;
  resolvedPrice: string;
  authority: string;
  ruleVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): FxForecastResolution {
  assertNonEmpty(
    input.resolutionId,
    'MONEY_FX_RESOLUTION_ID_REQUIRED',
  );
  assertNonEmpty(
    input.authority,
    'MONEY_FX_RESOLUTION_AUTHORITY_REQUIRED',
  );
  assertNonEmpty(
    input.ruleVersion,
    'MONEY_FX_RESOLUTION_RULE_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_RESOLUTION_PROVENANCE_REQUIRED',
  );
  if (input.evidenceRefs.length === 0) {
    throw new Error('MONEY_FX_RESOLUTION_EVIDENCE_REQUIRED');
  }

  const resolvedAt = parseTimestamp(
    input.resolvedAt,
    'MONEY_FX_RESOLUTION_RESOLVED_AT_INVALID',
  );
  const targetAt = parseTimestamp(
    input.forecast.targetAt,
    'MONEY_FX_RESOLUTION_TARGET_AT_INVALID',
  );
  if (resolvedAt < targetAt) {
    throw new Error('MONEY_FX_RESOLUTION_BEFORE_TARGET');
  }

  const realizedReturn = exactRealizedReturn(
    input.referencePrice,
    input.resolvedPrice,
  );
  const matches = input.forecast.scenarios.filter((scenario) =>
    scenarioMatchesReturn(scenario, realizedReturn),
  );
  if (matches.length > 1) {
    throw new Error('MONEY_FX_RESOLUTION_AMBIGUOUS_SCENARIO');
  }

  return Object.freeze({
    resolutionId: input.resolutionId,
    forecastId: input.forecast.forecastId,
    pairId: input.forecast.pairId,
    instrumentId: input.forecast.instrumentId,
    targetAt: input.forecast.targetAt,
    resolvedAt: input.resolvedAt,
    referencePrice: input.referencePrice,
    resolvedPrice: input.resolvedPrice,
    realizedReturn,
    matchedScenarioId: matches[0]?.scenarioId,
    authority: input.authority,
    ruleVersion: input.ruleVersion,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
  });
}

export function scoreFxForecast(input: Readonly<{
  forecast: FxForecastDistribution;
  resolution: FxForecastResolution;
  scoreId: string;
  scoredAt: string;
  methodologyVersion: string;
  provenanceHash: string;
}>): FxForecastScore {
  assertNonEmpty(input.scoreId, 'MONEY_FX_SCORE_ID_REQUIRED');
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_FX_SCORE_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(
    input.provenanceHash,
    'MONEY_FX_SCORE_PROVENANCE_REQUIRED',
  );

  const scoredAt = parseTimestamp(
    input.scoredAt,
    'MONEY_FX_SCORE_AT_INVALID',
  );
  if (input.resolution.forecastId !== input.forecast.forecastId) {
    throw new Error('MONEY_FX_SCORE_FORECAST_MISMATCH');
  }
  if (
    scoredAt <
    parseTimestamp(
      input.resolution.resolvedAt,
      'MONEY_FX_SCORE_RESOLUTION_AT_INVALID',
    )
  ) {
    throw new Error('MONEY_FX_SCORE_BEFORE_RESOLUTION');
  }

  const expectedReturn = input.forecast.scenarios.reduce(
    (sum, scenario) =>
      sum + scenario.probability * scenario.expectedReturn,
    0,
  );
  const absoluteExpectedReturnError = Math.abs(
    expectedReturn - input.resolution.realizedReturn,
  );

  let multiclassBrierScore: number | undefined;
  if (input.resolution.matchedScenarioId !== undefined) {
    multiclassBrierScore = input.forecast.scenarios.reduce(
      (sum, scenario) => {
        const outcome =
          scenario.scenarioId ===
          input.resolution.matchedScenarioId
            ? 1
            : 0;
        return sum + (scenario.probability - outcome) ** 2;
      },
      0,
    );
  }

  return Object.freeze({
    scoreId: input.scoreId,
    forecastId: input.forecast.forecastId,
    resolutionId: input.resolution.resolutionId,
    matchedScenarioId: input.resolution.matchedScenarioId,
    multiclassBrierScore,
    absoluteExpectedReturnError,
    scoredAt: input.scoredAt,
    methodologyVersion: input.methodologyVersion,
    provenanceHash: input.provenanceHash,
  });
}
