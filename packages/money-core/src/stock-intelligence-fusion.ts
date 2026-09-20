import type { DecisionAssessment, DecisionCase } from './decision-workflow-contracts.js';
import type { NormalizedMetric, TtmMetric } from './fundamental-normalization-contracts.js';
import type { StockIssuerMarketState, StockMarketSnapshot } from './stock-market-reality.js';

export const STOCK_INTELLIGENCE_SCHEMA_VERSION = 'MONEY-STOCK-02' as const;

export type StockFactorCategory =
  | 'VALUATION'
  | 'QUALITY'
  | 'GROWTH'
  | 'MOMENTUM'
  | 'VOLATILITY'
  | 'LIQUIDITY'
  | 'RELATIVE_STRENGTH'
  | 'EVENT'
  | 'OTHER';

export type StockFactorObservation = Readonly<{
  factorId: string;
  instrumentId: string;
  issuerId: string;
  category: StockFactorCategory;
  name: string;
  value: number;
  unit: string;
  directionalScore?: number;
  informationCutoff: string;
  sourceMetricIds: readonly string[];
  sourceMarketEvidenceRefs: readonly string[];
  sourceBenchmarkIds: readonly string[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type StockFactorSet = Readonly<{
  factorSetId: string;
  instrumentId: string;
  issuerId: string;
  informationCutoff: string;
  marketSnapshotId: string;
  issuerMarketStateId: string;
  factors: readonly StockFactorObservation[];
  methodologyVersion: string;
  inputSnapshotHash: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type StockForecastScenario = Readonly<{
  scenarioId: string;
  label: string;
  probability: number;
  expectedReturn: number;
  minReturnInclusive?: number;
  maxReturnExclusive?: number;
}>;

export type StockForecastCalibrationStatus =
  | 'CALIBRATED'
  | 'PARTIAL'
  | 'UNCALIBRATED'
  | 'STALE'
  | 'UNKNOWN';

export type StockForecastDistribution = Readonly<{
  forecastId: string;
  instrumentId: string;
  issuerId: string;
  informationCutoff: string;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  methodologyVersion: string;
  factorSetId: string;
  marketSnapshotId: string;
  issuerMarketStateId: string;
  scenarios: readonly StockForecastScenario[];
  calibrationStatus: StockForecastCalibrationStatus;
  priorCalibrationScore?: number;
  evidenceRefs: readonly string[];
  inputSnapshotHash: string;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type StockLiquidityRisk =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'UNKNOWN';

export type StockStressScenario = Readonly<{
  stressId: string;
  label: string;
  shockedReturn: number;
  rationale: string;
  evidenceRefs: readonly string[];
}>;

export type StockRiskAssessment = Readonly<{
  riskAssessmentId: string;
  instrumentId: string;
  issuerId: string;
  informationCutoff: string;
  forecastId: string;
  volatilityEstimate?: number;
  downsideEstimate?: number;
  liquidityRisk: StockLiquidityRisk;
  stressScenarios: readonly StockStressScenario[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type StockIntelligenceSnapshot = Readonly<{
  schemaVersion: typeof STOCK_INTELLIGENCE_SCHEMA_VERSION;
  intelligenceId: string;
  instrumentId: string;
  issuerId: string;
  informationCutoff: string;
  factorSet: StockFactorSet;
  forecast: StockForecastDistribution;
  risk: StockRiskAssessment;
  decisionCase: DecisionCase;
  assessment: DecisionAssessment;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type StockForecastResolution = Readonly<{
  resolutionId: string;
  forecastId: string;
  instrumentId: string;
  targetAt: string;
  resolvedAt: string;
  referencePrice: number;
  resolvedPrice: number;
  realizedReturn: number;
  matchedScenarioId?: string;
  authority: string;
  ruleVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type StockForecastScore = Readonly<{
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

export type FundamentalResearchMetric = NormalizedMetric | TtmMetric;

export type BuildStockFactorSetInput = Readonly<{
  marketSnapshot: StockMarketSnapshot;
  issuerMarketState: StockIssuerMarketState;
  fundamentalMetrics: readonly FundamentalResearchMetric[];
  factors: readonly Omit<
    StockFactorObservation,
    'instrumentId' | 'issuerId' | 'informationCutoff'
  >[];
  methodologyVersion: string;
  inputSnapshotHash: string;
  provenanceHash: string;
}>;

export type BuildStockForecastInput = Readonly<{
  factorSet: StockFactorSet;
  marketSnapshot: StockMarketSnapshot;
  issuerMarketState: StockIssuerMarketState;
  forecastId: string;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  methodologyVersion: string;
  scenarios: readonly StockForecastScenario[];
  calibrationStatus: StockForecastCalibrationStatus;
  priorCalibrationScore?: number;
  evidenceRefs: readonly string[];
  inputSnapshotHash: string;
  provenanceHash: string;
}>;

export type BuildStockRiskAssessmentInput = Readonly<{
  forecast: StockForecastDistribution;
  riskAssessmentId: string;
  volatilityEstimate?: number;
  downsideEstimate?: number;
  liquidityRisk: StockLiquidityRisk;
  stressScenarios: readonly StockStressScenario[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>;

export type BuildStockIntelligenceSnapshotInput = Readonly<{
  accountId: string;
  requestedBy: string;
  createdAt: string;
  factorSet: StockFactorSet;
  forecast: StockForecastDistribution;
  risk: StockRiskAssessment;
  intelligenceId: string;
  provenanceHash: string;
}>;

const EPSILON = 1e-6;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function parseTimestamp(value: string, code: string): number {
  assertNonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function assertFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertUnitInterval(value: number, code: string): void {
  assertFinite(value, code);
  if (value < 0 || value > 1) throw new Error(code);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function midpoint(snapshot: StockMarketSnapshot): number | undefined {
  if (!snapshot.quote) return undefined;
  const bid = Number(snapshot.quote.bidPrice);
  const ask = Number(snapshot.quote.askPrice);
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return undefined;
  return (bid + ask) / 2;
}

function closingPrice(snapshot: StockMarketSnapshot): number | undefined {
  const lastBar = snapshot.bars[snapshot.bars.length - 1];
  if (!lastBar) return undefined;
  const close = Number(lastBar.close);
  return Number.isFinite(close) ? close : undefined;
}

export function stockReferencePrice(snapshot: StockMarketSnapshot): number {
  const price = midpoint(snapshot) ?? closingPrice(snapshot);
  if (price === undefined || price <= 0) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_REFERENCE_PRICE_REQUIRED');
  }
  return price;
}

export function deriveMarketMicrostructureFactors(
  snapshot: StockMarketSnapshot,
  issuerId: string,
  methodologyVersion: string,
  provenanceHash: string,
): readonly StockFactorObservation[] {
  assertNonEmpty(issuerId, 'MONEY_STOCK_FACTOR_ISSUER_REQUIRED');
  assertNonEmpty(methodologyVersion, 'MONEY_STOCK_FACTOR_METHODOLOGY_REQUIRED');
  assertNonEmpty(provenanceHash, 'MONEY_STOCK_FACTOR_PROVENANCE_REQUIRED');

  const factors: StockFactorObservation[] = [];

  if (snapshot.quote) {
    const bid = Number(snapshot.quote.bidPrice);
    const ask = Number(snapshot.quote.askPrice);
    const mid = (bid + ask) / 2;
    const spreadBps = mid > 0 ? ((ask - bid) / mid) * 10_000 : Number.NaN;
    assertFinite(spreadBps, 'MONEY_STOCK_FACTOR_SPREAD_INVALID');

    factors.push(
      Object.freeze({
        factorId: `${snapshot.snapshotId}:spread-bps`,
        instrumentId: snapshot.instrumentId,
        issuerId,
        category: 'LIQUIDITY',
        name: 'BID_ASK_SPREAD_BPS',
        value: spreadBps,
        unit: 'BPS',
        informationCutoff: snapshot.informationCutoff,
        sourceMetricIds: Object.freeze([]),
        sourceMarketEvidenceRefs: Object.freeze([snapshot.quote.evidenceRef]),
        sourceBenchmarkIds: Object.freeze([]),
        methodologyVersion,
        evidenceRefs: Object.freeze([snapshot.quote.evidenceRef]),
        provenanceHash,
      }),
    );
  }

  if (snapshot.orderBook) {
    const bestBid = snapshot.orderBook.bids[0];
    const bestAsk = snapshot.orderBook.asks[0];
    if (bestBid && bestAsk) {
      const bidSize = Number(bestBid.size);
      const askSize = Number(bestAsk.size);
      const total = bidSize + askSize;
      if (Number.isFinite(total) && total > 0) {
        const imbalance = (bidSize - askSize) / total;
        factors.push(
          Object.freeze({
            factorId: `${snapshot.snapshotId}:top-book-imbalance`,
            instrumentId: snapshot.instrumentId,
            issuerId,
            category: 'LIQUIDITY',
            name: 'TOP_BOOK_IMBALANCE',
            value: imbalance,
            unit: 'RATIO',
            directionalScore: imbalance,
            informationCutoff: snapshot.informationCutoff,
            sourceMetricIds: Object.freeze([]),
            sourceMarketEvidenceRefs: Object.freeze([
              snapshot.orderBook.evidenceRef,
            ]),
            sourceBenchmarkIds: Object.freeze([]),
            methodologyVersion,
            evidenceRefs: Object.freeze([snapshot.orderBook.evidenceRef]),
            provenanceHash,
          }),
        );
      }
    }
  }

  if (snapshot.bars.length >= 2) {
    const first = Number(snapshot.bars[0]!.close);
    const last = Number(snapshot.bars[snapshot.bars.length - 1]!.close);
    if (Number.isFinite(first) && Number.isFinite(last) && first > 0) {
      const trailingReturn = last / first - 1;
      factors.push(
        Object.freeze({
          factorId: `${snapshot.snapshotId}:trailing-return`,
          instrumentId: snapshot.instrumentId,
          issuerId,
          category: 'MOMENTUM',
          name: 'SNAPSHOT_TRAILING_RETURN',
          value: trailingReturn,
          unit: 'RETURN',
          informationCutoff: snapshot.informationCutoff,
          sourceMetricIds: Object.freeze([]),
          sourceMarketEvidenceRefs: Object.freeze(
            unique([
              snapshot.bars[0]!.evidenceRef,
              snapshot.bars[snapshot.bars.length - 1]!.evidenceRef,
            ]),
          ),
          sourceBenchmarkIds: Object.freeze([]),
          methodologyVersion,
          evidenceRefs: Object.freeze(
            unique([
              snapshot.bars[0]!.evidenceRef,
              snapshot.bars[snapshot.bars.length - 1]!.evidenceRef,
            ]),
          ),
          provenanceHash,
        }),
      );
    }
  }

  return Object.freeze(factors);
}

export function buildRatioFactorObservation(input: Readonly<{
  factorId: string;
  instrumentId: string;
  issuerId: string;
  category: StockFactorCategory;
  name: string;
  numerator: number;
  denominator: number;
  unit: string;
  directionalScore?: number;
  informationCutoff: string;
  sourceMetricIds: readonly string[];
  sourceMarketEvidenceRefs: readonly string[];
  sourceBenchmarkIds: readonly string[];
  methodologyVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): StockFactorObservation {
  assertFinite(input.numerator, 'MONEY_STOCK_FACTOR_NUMERATOR_INVALID');
  assertFinite(input.denominator, 'MONEY_STOCK_FACTOR_DENOMINATOR_INVALID');
  if (input.denominator === 0) {
    throw new Error('MONEY_STOCK_FACTOR_DENOMINATOR_ZERO');
  }
  const value = input.numerator / input.denominator;
  assertFinite(value, 'MONEY_STOCK_FACTOR_RATIO_INVALID');
  return Object.freeze({
    factorId: input.factorId,
    instrumentId: input.instrumentId,
    issuerId: input.issuerId,
    category: input.category,
    name: input.name,
    value,
    unit: input.unit,
    directionalScore: input.directionalScore,
    informationCutoff: input.informationCutoff,
    sourceMetricIds: Object.freeze([...input.sourceMetricIds]),
    sourceMarketEvidenceRefs: Object.freeze([...input.sourceMarketEvidenceRefs]),
    sourceBenchmarkIds: Object.freeze([...input.sourceBenchmarkIds]),
    methodologyVersion: input.methodologyVersion,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
  });
}

function assertFactorObservation(
  factor: StockFactorObservation,
  instrumentId: string,
  issuerId: string,
  informationCutoff: string,
  metricIds: ReadonlySet<string>,
  marketEvidenceRefs: ReadonlySet<string>,
  benchmarkIds: ReadonlySet<string>,
): void {
  assertNonEmpty(factor.factorId, 'MONEY_STOCK_FACTOR_ID_REQUIRED');
  assertNonEmpty(factor.name, 'MONEY_STOCK_FACTOR_NAME_REQUIRED');
  assertNonEmpty(factor.unit, 'MONEY_STOCK_FACTOR_UNIT_REQUIRED');
  assertNonEmpty(factor.methodologyVersion, 'MONEY_STOCK_FACTOR_METHODOLOGY_REQUIRED');
  assertNonEmpty(factor.provenanceHash, 'MONEY_STOCK_FACTOR_PROVENANCE_REQUIRED');
  assertFinite(factor.value, 'MONEY_STOCK_FACTOR_VALUE_INVALID');

  if (factor.instrumentId !== instrumentId) {
    throw new Error('MONEY_STOCK_FACTOR_INSTRUMENT_MISMATCH');
  }
  if (factor.issuerId !== issuerId) {
    throw new Error('MONEY_STOCK_FACTOR_ISSUER_MISMATCH');
  }
  if (factor.informationCutoff !== informationCutoff) {
    throw new Error('MONEY_STOCK_FACTOR_CUTOFF_MISMATCH');
  }
  if (
    factor.directionalScore !== undefined &&
    (!Number.isFinite(factor.directionalScore) ||
      factor.directionalScore < -1 ||
      factor.directionalScore > 1)
  ) {
    throw new Error('MONEY_STOCK_FACTOR_DIRECTIONAL_SCORE_INVALID');
  }
  if (factor.evidenceRefs.length === 0) {
    throw new Error('MONEY_STOCK_FACTOR_EVIDENCE_REQUIRED');
  }

  for (const metricId of factor.sourceMetricIds) {
    if (!metricIds.has(metricId)) {
      throw new Error('MONEY_STOCK_FACTOR_UNKNOWN_FUNDAMENTAL_METRIC');
    }
  }
  for (const evidenceRef of factor.sourceMarketEvidenceRefs) {
    if (!marketEvidenceRefs.has(evidenceRef)) {
      throw new Error('MONEY_STOCK_FACTOR_UNKNOWN_MARKET_EVIDENCE');
    }
  }
  for (const benchmarkId of factor.sourceBenchmarkIds) {
    if (!benchmarkIds.has(benchmarkId)) {
      throw new Error('MONEY_STOCK_FACTOR_UNKNOWN_BENCHMARK');
    }
  }
}

export function buildStockFactorSet(
  input: BuildStockFactorSetInput,
): StockFactorSet {
  if (input.marketSnapshot.instrumentId !== input.issuerMarketState.instrumentId) {
    throw new Error('MONEY_STOCK_FACTOR_STATE_INSTRUMENT_MISMATCH');
  }
  if (
    input.marketSnapshot.informationCutoff !==
    input.issuerMarketState.informationCutoff
  ) {
    throw new Error('MONEY_STOCK_FACTOR_STATE_CUTOFF_MISMATCH');
  }
  if (input.marketSnapshot.executionAuthority !== 'NONE') {
    throw new Error('MONEY_STOCK_FACTOR_MARKET_AUTHORITY_FORBIDDEN');
  }
  if (input.issuerMarketState.financialAuthority !== 'NONE') {
    throw new Error('MONEY_STOCK_FACTOR_FINANCIAL_AUTHORITY_FORBIDDEN');
  }

  assertNonEmpty(input.methodologyVersion, 'MONEY_STOCK_FACTOR_SET_METHODOLOGY_REQUIRED');
  assertNonEmpty(input.inputSnapshotHash, 'MONEY_STOCK_FACTOR_SET_INPUT_HASH_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_FACTOR_SET_PROVENANCE_REQUIRED');

  const cutoff = parseTimestamp(
    input.marketSnapshot.informationCutoff,
    'MONEY_STOCK_FACTOR_SET_CUTOFF_INVALID',
  );
  const metricIds = new Set<string>();
  const metricEvidence: string[] = [];

  for (const metric of input.fundamentalMetrics) {
    if (metric.issuerId !== input.issuerMarketState.issuerId) {
      throw new Error('MONEY_STOCK_FACTOR_METRIC_ISSUER_MISMATCH');
    }
    if (Date.parse(metric.informationCutoff) > cutoff) {
      throw new Error('MONEY_STOCK_FACTOR_METRIC_FUTURE_LEAK');
    }
    if (!metric.provenanceHash) {
      throw new Error('MONEY_STOCK_FACTOR_METRIC_UNPROVEN');
    }
    metricIds.add(metric.metricId);
    metricEvidence.push(...metric.evidenceRefs.map((ref) => ref.evidenceId));
  }

  const marketEvidenceRefs = new Set(input.marketSnapshot.marketEvidenceRefs);
  const benchmarkIds = new Set(
    input.marketSnapshot.benchmarks.map((state) => state.reference.benchmarkId),
  );
  const factorIds = new Set<string>();

  const factors = input.factors.map((factor) => {
    const complete: StockFactorObservation = Object.freeze({
      ...factor,
      instrumentId: input.marketSnapshot.instrumentId,
      issuerId: input.issuerMarketState.issuerId,
      informationCutoff: input.marketSnapshot.informationCutoff,
      sourceMetricIds: Object.freeze([...factor.sourceMetricIds]),
      sourceMarketEvidenceRefs: Object.freeze([
        ...factor.sourceMarketEvidenceRefs,
      ]),
      sourceBenchmarkIds: Object.freeze([...factor.sourceBenchmarkIds]),
      evidenceRefs: Object.freeze([...factor.evidenceRefs]),
    });

    assertFactorObservation(
      complete,
      input.marketSnapshot.instrumentId,
      input.issuerMarketState.issuerId,
      input.marketSnapshot.informationCutoff,
      metricIds,
      marketEvidenceRefs,
      benchmarkIds,
    );
    if (factorIds.has(complete.factorId)) {
      throw new Error('MONEY_STOCK_FACTOR_DUPLICATE_ID');
    }
    factorIds.add(complete.factorId);
    return complete;
  });

  if (factors.length === 0) {
    throw new Error('MONEY_STOCK_FACTOR_SET_EMPTY');
  }

  const evidenceRefs = unique([
    ...input.marketSnapshot.marketEvidenceRefs,
    ...metricEvidence,
    ...factors.flatMap((factor) => factor.evidenceRefs),
  ]);

  return Object.freeze({
    factorSetId: `${input.marketSnapshot.snapshotId}:factors:${input.inputSnapshotHash}`,
    instrumentId: input.marketSnapshot.instrumentId,
    issuerId: input.issuerMarketState.issuerId,
    informationCutoff: input.marketSnapshot.informationCutoff,
    marketSnapshotId: input.marketSnapshot.snapshotId,
    issuerMarketStateId: input.issuerMarketState.stateId,
    factors: Object.freeze(factors),
    methodologyVersion: input.methodologyVersion,
    inputSnapshotHash: input.inputSnapshotHash,
    evidenceRefs,
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

function assertForecastScenario(scenario: StockForecastScenario): void {
  assertNonEmpty(scenario.scenarioId, 'MONEY_STOCK_FORECAST_SCENARIO_ID_REQUIRED');
  assertNonEmpty(scenario.label, 'MONEY_STOCK_FORECAST_SCENARIO_LABEL_REQUIRED');
  assertUnitInterval(
    scenario.probability,
    'MONEY_STOCK_FORECAST_PROBABILITY_INVALID',
  );
  assertFinite(
    scenario.expectedReturn,
    'MONEY_STOCK_FORECAST_EXPECTED_RETURN_INVALID',
  );

  if (
    scenario.minReturnInclusive !== undefined &&
    !Number.isFinite(scenario.minReturnInclusive)
  ) {
    throw new Error('MONEY_STOCK_FORECAST_MIN_RETURN_INVALID');
  }
  if (
    scenario.maxReturnExclusive !== undefined &&
    !Number.isFinite(scenario.maxReturnExclusive)
  ) {
    throw new Error('MONEY_STOCK_FORECAST_MAX_RETURN_INVALID');
  }
  if (
    scenario.minReturnInclusive !== undefined &&
    scenario.maxReturnExclusive !== undefined &&
    scenario.maxReturnExclusive <= scenario.minReturnInclusive
  ) {
    throw new Error('MONEY_STOCK_FORECAST_RANGE_INVALID');
  }
}

function assertScenarioRangesDoNotOverlap(
  scenarios: readonly StockForecastScenario[],
): void {
  const intervals = scenarios
    .map((scenario) => ({
      scenarioId: scenario.scenarioId,
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
      throw new Error('MONEY_STOCK_FORECAST_SCENARIO_RANGES_OVERLAP');
    }
  }
}

export function buildStockForecast(
  input: BuildStockForecastInput,
): StockForecastDistribution {
  if (input.factorSet.instrumentId !== input.marketSnapshot.instrumentId) {
    throw new Error('MONEY_STOCK_FORECAST_INSTRUMENT_MISMATCH');
  }
  if (input.factorSet.issuerId !== input.issuerMarketState.issuerId) {
    throw new Error('MONEY_STOCK_FORECAST_ISSUER_MISMATCH');
  }
  if (
    input.factorSet.marketSnapshotId !== input.marketSnapshot.snapshotId ||
    input.factorSet.issuerMarketStateId !== input.issuerMarketState.stateId
  ) {
    throw new Error('MONEY_STOCK_FORECAST_LINEAGE_MISMATCH');
  }
  if (
    input.factorSet.informationCutoff !== input.marketSnapshot.informationCutoff
  ) {
    throw new Error('MONEY_STOCK_FORECAST_CUTOFF_MISMATCH');
  }

  assertNonEmpty(input.forecastId, 'MONEY_STOCK_FORECAST_ID_REQUIRED');
  assertNonEmpty(input.horizonLabel, 'MONEY_STOCK_FORECAST_HORIZON_REQUIRED');
  assertNonEmpty(input.modelId, 'MONEY_STOCK_FORECAST_MODEL_ID_REQUIRED');
  assertNonEmpty(input.modelVersion, 'MONEY_STOCK_FORECAST_MODEL_VERSION_REQUIRED');
  assertNonEmpty(
    input.methodologyVersion,
    'MONEY_STOCK_FORECAST_METHODOLOGY_REQUIRED',
  );
  assertNonEmpty(input.inputSnapshotHash, 'MONEY_STOCK_FORECAST_INPUT_HASH_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_FORECAST_PROVENANCE_REQUIRED');

  const cutoff = parseTimestamp(
    input.factorSet.informationCutoff,
    'MONEY_STOCK_FORECAST_CUTOFF_INVALID',
  );
  const issuedAt = parseTimestamp(
    input.issuedAt,
    'MONEY_STOCK_FORECAST_ISSUED_AT_INVALID',
  );
  const targetAt = parseTimestamp(
    input.targetAt,
    'MONEY_STOCK_FORECAST_TARGET_AT_INVALID',
  );
  if (issuedAt < cutoff) {
    throw new Error('MONEY_STOCK_FORECAST_ISSUED_BEFORE_CUTOFF');
  }
  if (targetAt <= issuedAt) {
    throw new Error('MONEY_STOCK_FORECAST_TARGET_NOT_FUTURE');
  }
  if (input.scenarios.length < 2) {
    throw new Error('MONEY_STOCK_FORECAST_SCENARIOS_INSUFFICIENT');
  }

  const ids = new Set<string>();
  let probabilityMass = 0;
  for (const scenario of input.scenarios) {
    assertForecastScenario(scenario);
    if (ids.has(scenario.scenarioId)) {
      throw new Error('MONEY_STOCK_FORECAST_DUPLICATE_SCENARIO');
    }
    ids.add(scenario.scenarioId);
    probabilityMass += scenario.probability;
  }
  if (Math.abs(probabilityMass - 1) > EPSILON) {
    throw new Error('MONEY_STOCK_FORECAST_PROBABILITY_MASS_INVALID');
  }
  assertScenarioRangesDoNotOverlap(input.scenarios);

  if (
    input.priorCalibrationScore !== undefined &&
    (!Number.isFinite(input.priorCalibrationScore) ||
      input.priorCalibrationScore < 0)
  ) {
    throw new Error('MONEY_STOCK_FORECAST_CALIBRATION_SCORE_INVALID');
  }

  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.marketSnapshot.executionAuthority !== 'NONE' ||
    input.issuerMarketState.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_STOCK_FORECAST_AUTHORITY_FORBIDDEN');
  }

  return Object.freeze({
    forecastId: input.forecastId,
    instrumentId: input.factorSet.instrumentId,
    issuerId: input.factorSet.issuerId,
    informationCutoff: input.factorSet.informationCutoff,
    issuedAt: input.issuedAt,
    targetAt: input.targetAt,
    horizonLabel: input.horizonLabel,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    methodologyVersion: input.methodologyVersion,
    factorSetId: input.factorSet.factorSetId,
    marketSnapshotId: input.marketSnapshot.snapshotId,
    issuerMarketStateId: input.issuerMarketState.stateId,
    scenarios: Object.freeze(input.scenarios.map((scenario) => Object.freeze({ ...scenario }))),
    calibrationStatus: input.calibrationStatus,
    priorCalibrationScore: input.priorCalibrationScore,
    evidenceRefs: unique([...input.factorSet.evidenceRefs, ...input.evidenceRefs]),
    inputSnapshotHash: input.inputSnapshotHash,
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildStockRiskAssessment(
  input: BuildStockRiskAssessmentInput,
): StockRiskAssessment {
  assertNonEmpty(
    input.riskAssessmentId,
    'MONEY_STOCK_RISK_ASSESSMENT_ID_REQUIRED',
  );
  assertNonEmpty(input.methodologyVersion, 'MONEY_STOCK_RISK_METHODOLOGY_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_RISK_PROVENANCE_REQUIRED');

  if (input.forecast.financialAuthority !== 'NONE') {
    throw new Error('MONEY_STOCK_RISK_FORECAST_AUTHORITY_FORBIDDEN');
  }
  if (
    input.volatilityEstimate !== undefined &&
    (!Number.isFinite(input.volatilityEstimate) ||
      input.volatilityEstimate < 0)
  ) {
    throw new Error('MONEY_STOCK_RISK_VOLATILITY_INVALID');
  }
  if (
    input.downsideEstimate !== undefined &&
    (!Number.isFinite(input.downsideEstimate) || input.downsideEstimate > 0)
  ) {
    throw new Error('MONEY_STOCK_RISK_DOWNSIDE_INVALID');
  }

  const stressIds = new Set<string>();
  for (const stress of input.stressScenarios) {
    assertNonEmpty(stress.stressId, 'MONEY_STOCK_STRESS_ID_REQUIRED');
    assertNonEmpty(stress.label, 'MONEY_STOCK_STRESS_LABEL_REQUIRED');
    assertNonEmpty(stress.rationale, 'MONEY_STOCK_STRESS_RATIONALE_REQUIRED');
    assertFinite(stress.shockedReturn, 'MONEY_STOCK_STRESS_RETURN_INVALID');
    if (stress.evidenceRefs.length === 0) {
      throw new Error('MONEY_STOCK_STRESS_EVIDENCE_REQUIRED');
    }
    if (stressIds.has(stress.stressId)) {
      throw new Error('MONEY_STOCK_STRESS_DUPLICATE_ID');
    }
    stressIds.add(stress.stressId);
  }

  return Object.freeze({
    riskAssessmentId: input.riskAssessmentId,
    instrumentId: input.forecast.instrumentId,
    issuerId: input.forecast.issuerId,
    informationCutoff: input.forecast.informationCutoff,
    forecastId: input.forecast.forecastId,
    volatilityEstimate: input.volatilityEstimate,
    downsideEstimate: input.downsideEstimate,
    liquidityRisk: input.liquidityRisk,
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
      ...input.evidenceRefs,
      ...input.stressScenarios.flatMap((stress) => stress.evidenceRefs),
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildStockIntelligenceSnapshot(
  input: BuildStockIntelligenceSnapshotInput,
): StockIntelligenceSnapshot {
  assertNonEmpty(input.accountId, 'MONEY_STOCK_INTELLIGENCE_ACCOUNT_REQUIRED');
  assertNonEmpty(input.requestedBy, 'MONEY_STOCK_INTELLIGENCE_REQUESTER_REQUIRED');
  assertNonEmpty(input.intelligenceId, 'MONEY_STOCK_INTELLIGENCE_ID_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_INTELLIGENCE_PROVENANCE_REQUIRED');
  const createdAt = parseTimestamp(
    input.createdAt,
    'MONEY_STOCK_INTELLIGENCE_CREATED_AT_INVALID',
  );
  const cutoff = parseTimestamp(
    input.factorSet.informationCutoff,
    'MONEY_STOCK_INTELLIGENCE_CUTOFF_INVALID',
  );
  if (createdAt < cutoff) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_CREATED_BEFORE_CUTOFF');
  }

  if (
    input.factorSet.instrumentId !== input.forecast.instrumentId ||
    input.forecast.instrumentId !== input.risk.instrumentId
  ) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_INSTRUMENT_MISMATCH');
  }
  if (
    input.factorSet.issuerId !== input.forecast.issuerId ||
    input.forecast.issuerId !== input.risk.issuerId
  ) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_ISSUER_MISMATCH');
  }
  if (
    input.factorSet.informationCutoff !== input.forecast.informationCutoff ||
    input.forecast.informationCutoff !== input.risk.informationCutoff
  ) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_CUTOFF_MISMATCH');
  }
  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.forecast.financialAuthority !== 'NONE' ||
    input.risk.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_STOCK_INTELLIGENCE_AUTHORITY_FORBIDDEN');
  }

  const decisionCase: DecisionCase = Object.freeze({
    caseId: `stock-intelligence:${input.intelligenceId}`,
    accountId: input.accountId,
    subjectId: input.factorSet.instrumentId,
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
      input.risk.stressScenarios.length > 0 ? 'ASSESSED' : 'NOT_PROVIDED',
    simulationStatus: 'NOT_RUN',
    liquidityStatus: input.risk.liquidityRisk,
    calibrationStatus: input.forecast.calibrationStatus,
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  });

  return Object.freeze({
    schemaVersion: STOCK_INTELLIGENCE_SCHEMA_VERSION,
    intelligenceId: input.intelligenceId,
    instrumentId: input.factorSet.instrumentId,
    issuerId: input.factorSet.issuerId,
    informationCutoff: input.factorSet.informationCutoff,
    factorSet: input.factorSet,
    forecast: input.forecast,
    risk: input.risk,
    decisionCase,
    assessment,
    evidenceRefs: unique([
      ...input.factorSet.evidenceRefs,
      ...input.forecast.evidenceRefs,
      ...input.risk.evidenceRefs,
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

function scenarioMatchesReturn(
  scenario: StockForecastScenario,
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

export function resolveStockForecast(input: Readonly<{
  forecast: StockForecastDistribution;
  resolutionId: string;
  resolvedAt: string;
  referencePrice: number;
  resolvedPrice: number;
  authority: string;
  ruleVersion: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): StockForecastResolution {
  assertNonEmpty(input.resolutionId, 'MONEY_STOCK_RESOLUTION_ID_REQUIRED');
  assertNonEmpty(input.authority, 'MONEY_STOCK_RESOLUTION_AUTHORITY_REQUIRED');
  assertNonEmpty(input.ruleVersion, 'MONEY_STOCK_RESOLUTION_RULE_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_RESOLUTION_PROVENANCE_REQUIRED');
  if (input.evidenceRefs.length === 0) {
    throw new Error('MONEY_STOCK_RESOLUTION_EVIDENCE_REQUIRED');
  }

  const resolvedAt = parseTimestamp(
    input.resolvedAt,
    'MONEY_STOCK_RESOLUTION_RESOLVED_AT_INVALID',
  );
  const targetAt = parseTimestamp(
    input.forecast.targetAt,
    'MONEY_STOCK_RESOLUTION_TARGET_AT_INVALID',
  );
  if (resolvedAt < targetAt) {
    throw new Error('MONEY_STOCK_RESOLUTION_BEFORE_TARGET');
  }

  assertFinite(input.referencePrice, 'MONEY_STOCK_RESOLUTION_REFERENCE_PRICE_INVALID');
  assertFinite(input.resolvedPrice, 'MONEY_STOCK_RESOLUTION_PRICE_INVALID');
  if (input.referencePrice <= 0 || input.resolvedPrice <= 0) {
    throw new Error('MONEY_STOCK_RESOLUTION_PRICE_NONPOSITIVE');
  }

  const realizedReturn = input.resolvedPrice / input.referencePrice - 1;
  const matches = input.forecast.scenarios.filter((scenario) =>
    scenarioMatchesReturn(scenario, realizedReturn),
  );
  if (matches.length > 1) {
    throw new Error('MONEY_STOCK_RESOLUTION_AMBIGUOUS_SCENARIO');
  }

  return Object.freeze({
    resolutionId: input.resolutionId,
    forecastId: input.forecast.forecastId,
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

export function scoreStockForecast(input: Readonly<{
  forecast: StockForecastDistribution;
  resolution: StockForecastResolution;
  scoreId: string;
  scoredAt: string;
  methodologyVersion: string;
  provenanceHash: string;
}>): StockForecastScore {
  assertNonEmpty(input.scoreId, 'MONEY_STOCK_SCORE_ID_REQUIRED');
  assertNonEmpty(input.methodologyVersion, 'MONEY_STOCK_SCORE_METHODOLOGY_REQUIRED');
  assertNonEmpty(input.provenanceHash, 'MONEY_STOCK_SCORE_PROVENANCE_REQUIRED');
  parseTimestamp(input.scoredAt, 'MONEY_STOCK_SCORE_AT_INVALID');

  if (input.resolution.forecastId !== input.forecast.forecastId) {
    throw new Error('MONEY_STOCK_SCORE_FORECAST_MISMATCH');
  }

  const expectedReturn = input.forecast.scenarios.reduce(
    (sum, scenario) => sum + scenario.probability * scenario.expectedReturn,
    0,
  );
  const absoluteExpectedReturnError = Math.abs(
    expectedReturn - input.resolution.realizedReturn,
  );

  let multiclassBrierScore: number | undefined;
  if (input.resolution.matchedScenarioId !== undefined) {
    multiclassBrierScore = input.forecast.scenarios.reduce((sum, scenario) => {
      const outcome = scenario.scenarioId === input.resolution.matchedScenarioId ? 1 : 0;
      return sum + (scenario.probability - outcome) ** 2;
    }, 0);
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
