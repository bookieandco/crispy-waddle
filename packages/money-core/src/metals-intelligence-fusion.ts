import type { DecisionAssessment, DecisionCase } from './decision-workflow-contracts.js';
import type { MetalMarketSnapshot, PreciousMetalCode } from './metals-market-reality.js';

export const METALS_INTELLIGENCE_SCHEMA_VERSION = 'MONEY-METALS-02' as const;

export type MetalFactorKind =
  | 'SPREAD'
  | 'MOMENTUM'
  | 'REAL_RATE'
  | 'USD'
  | 'INFLATION'
  | 'PHYSICAL_PREMIUM'
  | 'INVENTORY'
  | 'FUTURES_BASIS'
  | 'OTHER';

export type MetalFactorObservation = Readonly<{
  factorId: string;
  kind: MetalFactorKind;
  value: number;
  unit: string;
  informationCutoff: string;
  sourceSnapshotIds: readonly string[];
  evidenceRefs: readonly string[];
  methodologyVersion: string;
  provenanceHash: string;
}>;

export type MetalFactorSet = Readonly<{
  factorSetId: string;
  metal: PreciousMetalCode;
  instrumentId: string;
  marketSnapshotId: string;
  informationCutoff: string;
  factors: readonly MetalFactorObservation[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type MetalRegimeLabel =
  | 'DEFENSIVE'
  | 'INFLATION_SENSITIVE'
  | 'REAL_RATE_PRESSURE'
  | 'USD_PRESSURE'
  | 'SUPPLY_TIGHTNESS'
  | 'TREND'
  | 'RANGE'
  | 'MIXED'
  | 'UNKNOWN';

export type MetalRegimeAssessment = Readonly<{
  regimeId: string;
  factorSetId: string;
  metal: PreciousMetalCode;
  instrumentId: string;
  informationCutoff: string;
  label: MetalRegimeLabel;
  confidence: number;
  rationale: string;
  sourceFactorIds: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type MetalForecastScenario = Readonly<{
  scenarioId: string;
  label: string;
  probability: number;
  expectedReturn: number;
  minReturnInclusive?: number;
  maxReturnExclusive?: number;
}>;

export type MetalForecastDistribution = Readonly<{
  forecastId: string;
  metal: PreciousMetalCode;
  instrumentId: string;
  informationCutoff: string;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  factorSetId: string;
  regimeId: string;
  marketSnapshotId: string;
  scenarios: readonly MetalForecastScenario[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type MetalStressScenario = Readonly<{
  stressId: string;
  label: string;
  shockedReturn: number;
  spreadShockBps?: number;
  rationale: string;
  evidenceRefs: readonly string[];
}>;

export type MetalRiskAssessment = Readonly<{
  riskAssessmentId: string;
  metal: PreciousMetalCode;
  instrumentId: string;
  informationCutoff: string;
  forecastId: string;
  liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  observedSpreadBps: number;
  stressScenarios: readonly MetalStressScenario[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type MetalIntelligenceSnapshot = Readonly<{
  schemaVersion: typeof METALS_INTELLIGENCE_SCHEMA_VERSION;
  intelligenceId: string;
  metal: PreciousMetalCode;
  instrumentId: string;
  informationCutoff: string;
  factorSet: MetalFactorSet;
  regime: MetalRegimeAssessment;
  forecast: MetalForecastDistribution;
  risk: MetalRiskAssessment;
  decisionCase: DecisionCase;
  assessment: DecisionAssessment;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function ts(value: string, code: string): number {
  nonEmpty(value, code);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

function unit(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

function finite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function assertRealityAuthority(snapshot: MetalMarketSnapshot): void {
  if (
    snapshot.researchAuthority !== 'INTELLIGENCE_ONLY' ||
    snapshot.executionAuthority !== 'NONE' ||
    snapshot.financialAuthority !== 'NONE'
  ) {
    throw new Error('MONEY_METALS_REALITY_AUTHORITY_FORBIDDEN');
  }
}

export function buildMetalFactorSet(input: Readonly<{
  factorSetId: string;
  marketSnapshot: MetalMarketSnapshot;
  factors: readonly MetalFactorObservation[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): MetalFactorSet {
  assertRealityAuthority(input.marketSnapshot);
  nonEmpty(input.factorSetId, 'MONEY_METALS_FACTOR_SET_ID_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_METALS_FACTOR_SET_PROVENANCE_REQUIRED');

  const seen = new Set<string>();
  for (const factor of input.factors) {
    nonEmpty(factor.factorId, 'MONEY_METALS_FACTOR_ID_REQUIRED');
    nonEmpty(factor.unit, 'MONEY_METALS_FACTOR_UNIT_REQUIRED');
    nonEmpty(factor.methodologyVersion, 'MONEY_METALS_FACTOR_METHODOLOGY_REQUIRED');
    nonEmpty(factor.provenanceHash, 'MONEY_METALS_FACTOR_PROVENANCE_REQUIRED');
    finite(factor.value, 'MONEY_METALS_FACTOR_VALUE_INVALID');
    if (factor.evidenceRefs.length === 0) throw new Error('MONEY_METALS_FACTOR_EVIDENCE_REQUIRED');
    if (factor.sourceSnapshotIds.length === 0) throw new Error('MONEY_METALS_FACTOR_SNAPSHOT_REQUIRED');
    if (!factor.sourceSnapshotIds.includes(input.marketSnapshot.snapshotId)) {
      throw new Error('MONEY_METALS_FACTOR_SNAPSHOT_LINEAGE_INVALID');
    }
    if (ts(factor.informationCutoff, 'MONEY_METALS_FACTOR_CUTOFF_INVALID') > ts(input.marketSnapshot.informationCutoff, 'MONEY_METALS_SNAPSHOT_CUTOFF_INVALID')) {
      throw new Error('MONEY_METALS_FACTOR_FUTURE_INFORMATION');
    }
    if (seen.has(factor.factorId)) throw new Error('MONEY_METALS_FACTOR_DUPLICATE');
    seen.add(factor.factorId);
  }

  const spreadFactor: MetalFactorObservation = Object.freeze({
    factorId: `${input.factorSetId}:spread`,
    kind: 'SPREAD',
    value: input.marketSnapshot.spreadBps,
    unit: 'BPS',
    informationCutoff: input.marketSnapshot.informationCutoff,
    sourceSnapshotIds: Object.freeze([input.marketSnapshot.snapshotId]),
    evidenceRefs: Object.freeze([...input.marketSnapshot.evidenceRefs]),
    methodologyVersion: 'canonical-spread-v1',
    provenanceHash: input.marketSnapshot.snapshotHash,
  });

  const factors = input.factors.some((f) => f.kind === 'SPREAD')
    ? Object.freeze([...input.factors])
    : Object.freeze([spreadFactor, ...input.factors]);

  return Object.freeze({
    factorSetId: input.factorSetId,
    metal: input.marketSnapshot.metal,
    instrumentId: input.marketSnapshot.instrumentId,
    marketSnapshotId: input.marketSnapshot.snapshotId,
    informationCutoff: input.marketSnapshot.informationCutoff,
    factors,
    evidenceRefs: unique([
      ...input.marketSnapshot.evidenceRefs,
      ...input.evidenceRefs,
      ...factors.flatMap((factor) => factor.evidenceRefs),
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildMetalRegime(input: Readonly<{
  regimeId: string;
  factorSet: MetalFactorSet;
  label: MetalRegimeLabel;
  confidence: number;
  rationale: string;
  sourceFactorIds: readonly string[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): MetalRegimeAssessment {
  if (input.factorSet.financialAuthority !== 'NONE') throw new Error('MONEY_METALS_REGIME_AUTHORITY_FORBIDDEN');
  nonEmpty(input.regimeId, 'MONEY_METALS_REGIME_ID_REQUIRED');
  nonEmpty(input.rationale, 'MONEY_METALS_REGIME_RATIONALE_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_METALS_REGIME_PROVENANCE_REQUIRED');
  unit(input.confidence, 'MONEY_METALS_REGIME_CONFIDENCE_INVALID');
  if (input.sourceFactorIds.length === 0) throw new Error('MONEY_METALS_REGIME_FACTORS_REQUIRED');
  const ids = new Set(input.factorSet.factors.map((factor) => factor.factorId));
  if (input.sourceFactorIds.some((id) => !ids.has(id))) throw new Error('MONEY_METALS_REGIME_UNKNOWN_FACTOR');

  return Object.freeze({
    regimeId: input.regimeId,
    factorSetId: input.factorSet.factorSetId,
    metal: input.factorSet.metal,
    instrumentId: input.factorSet.instrumentId,
    informationCutoff: input.factorSet.informationCutoff,
    label: input.label,
    confidence: input.confidence,
    rationale: input.rationale,
    sourceFactorIds: unique(input.sourceFactorIds),
    evidenceRefs: unique([...input.factorSet.evidenceRefs, ...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

function assertRanges(scenarios: readonly MetalForecastScenario[]): void {
  const intervals = scenarios
    .filter((s) => s.minReturnInclusive !== undefined || s.maxReturnExclusive !== undefined)
    .map((s) => ({
      min: s.minReturnInclusive ?? Number.NEGATIVE_INFINITY,
      max: s.maxReturnExclusive ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.min - b.min);
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i]!.min < intervals[i - 1]!.max) throw new Error('MONEY_METALS_FORECAST_RANGES_OVERLAP');
  }
}

export function buildMetalForecast(input: Readonly<{
  forecastId: string;
  marketSnapshot: MetalMarketSnapshot;
  factorSet: MetalFactorSet;
  regime: MetalRegimeAssessment;
  issuedAt: string;
  targetAt: string;
  horizonLabel: string;
  modelId: string;
  modelVersion: string;
  scenarios: readonly MetalForecastScenario[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): MetalForecastDistribution {
  assertRealityAuthority(input.marketSnapshot);
  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.regime.financialAuthority !== 'NONE'
  ) throw new Error('MONEY_METALS_FORECAST_AUTHORITY_FORBIDDEN');
  if (input.factorSet.marketSnapshotId !== input.marketSnapshot.snapshotId) throw new Error('MONEY_METALS_FORECAST_SNAPSHOT_MISMATCH');
  if (input.regime.factorSetId !== input.factorSet.factorSetId) throw new Error('MONEY_METALS_FORECAST_FACTOR_SET_MISMATCH');

  nonEmpty(input.forecastId, 'MONEY_METALS_FORECAST_ID_REQUIRED');
  nonEmpty(input.horizonLabel, 'MONEY_METALS_FORECAST_HORIZON_REQUIRED');
  nonEmpty(input.modelId, 'MONEY_METALS_FORECAST_MODEL_REQUIRED');
  nonEmpty(input.modelVersion, 'MONEY_METALS_FORECAST_MODEL_VERSION_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_METALS_FORECAST_PROVENANCE_REQUIRED');
  const issued = ts(input.issuedAt, 'MONEY_METALS_FORECAST_ISSUED_INVALID');
  const cutoff = ts(input.factorSet.informationCutoff, 'MONEY_METALS_FORECAST_CUTOFF_INVALID');
  const target = ts(input.targetAt, 'MONEY_METALS_FORECAST_TARGET_INVALID');
  if (issued < cutoff) throw new Error('MONEY_METALS_FORECAST_ISSUED_BEFORE_CUTOFF');
  if (target <= issued) throw new Error('MONEY_METALS_FORECAST_TARGET_NOT_FUTURE');
  if (input.scenarios.length < 2) throw new Error('MONEY_METALS_FORECAST_SCENARIOS_INSUFFICIENT');

  let mass = 0;
  const ids = new Set<string>();
  for (const scenario of input.scenarios) {
    nonEmpty(scenario.scenarioId, 'MONEY_METALS_FORECAST_SCENARIO_ID_REQUIRED');
    nonEmpty(scenario.label, 'MONEY_METALS_FORECAST_SCENARIO_LABEL_REQUIRED');
    unit(scenario.probability, 'MONEY_METALS_FORECAST_PROBABILITY_INVALID');
    finite(scenario.expectedReturn, 'MONEY_METALS_FORECAST_RETURN_INVALID');
    if (scenario.minReturnInclusive !== undefined) finite(scenario.minReturnInclusive, 'MONEY_METALS_FORECAST_MIN_INVALID');
    if (scenario.maxReturnExclusive !== undefined) finite(scenario.maxReturnExclusive, 'MONEY_METALS_FORECAST_MAX_INVALID');
    if (
      scenario.minReturnInclusive !== undefined &&
      scenario.maxReturnExclusive !== undefined &&
      scenario.maxReturnExclusive <= scenario.minReturnInclusive
    ) throw new Error('MONEY_METALS_FORECAST_RANGE_INVALID');
    if (ids.has(scenario.scenarioId)) throw new Error('MONEY_METALS_FORECAST_DUPLICATE_SCENARIO');
    ids.add(scenario.scenarioId);
    mass += scenario.probability;
  }
  if (Math.abs(mass - 1) > 1e-9) throw new Error('MONEY_METALS_FORECAST_PROBABILITY_MASS_INVALID');
  assertRanges(input.scenarios);

  return Object.freeze({
    forecastId: input.forecastId,
    metal: input.factorSet.metal,
    instrumentId: input.factorSet.instrumentId,
    informationCutoff: input.factorSet.informationCutoff,
    issuedAt: input.issuedAt,
    targetAt: input.targetAt,
    horizonLabel: input.horizonLabel,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    factorSetId: input.factorSet.factorSetId,
    regimeId: input.regime.regimeId,
    marketSnapshotId: input.marketSnapshot.snapshotId,
    scenarios: Object.freeze(input.scenarios.map((scenario) => Object.freeze({ ...scenario }))),
    evidenceRefs: unique([...input.factorSet.evidenceRefs, ...input.regime.evidenceRefs, ...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildMetalRiskAssessment(input: Readonly<{
  riskAssessmentId: string;
  marketSnapshot: MetalMarketSnapshot;
  forecast: MetalForecastDistribution;
  liquidityRisk: MetalRiskAssessment['liquidityRisk'];
  stressScenarios: readonly MetalStressScenario[];
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): MetalRiskAssessment {
  assertRealityAuthority(input.marketSnapshot);
  if (input.forecast.financialAuthority !== 'NONE') throw new Error('MONEY_METALS_RISK_AUTHORITY_FORBIDDEN');
  if (input.forecast.marketSnapshotId !== input.marketSnapshot.snapshotId) throw new Error('MONEY_METALS_RISK_SNAPSHOT_MISMATCH');
  nonEmpty(input.riskAssessmentId, 'MONEY_METALS_RISK_ID_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_METALS_RISK_PROVENANCE_REQUIRED');

  const ids = new Set<string>();
  for (const stress of input.stressScenarios) {
    nonEmpty(stress.stressId, 'MONEY_METALS_STRESS_ID_REQUIRED');
    nonEmpty(stress.label, 'MONEY_METALS_STRESS_LABEL_REQUIRED');
    nonEmpty(stress.rationale, 'MONEY_METALS_STRESS_RATIONALE_REQUIRED');
    finite(stress.shockedReturn, 'MONEY_METALS_STRESS_RETURN_INVALID');
    if (stress.spreadShockBps !== undefined && (!Number.isFinite(stress.spreadShockBps) || stress.spreadShockBps < 0)) {
      throw new Error('MONEY_METALS_STRESS_SPREAD_INVALID');
    }
    if (stress.evidenceRefs.length === 0) throw new Error('MONEY_METALS_STRESS_EVIDENCE_REQUIRED');
    if (ids.has(stress.stressId)) throw new Error('MONEY_METALS_STRESS_DUPLICATE');
    ids.add(stress.stressId);
  }

  return Object.freeze({
    riskAssessmentId: input.riskAssessmentId,
    metal: input.forecast.metal,
    instrumentId: input.forecast.instrumentId,
    informationCutoff: input.forecast.informationCutoff,
    forecastId: input.forecast.forecastId,
    liquidityRisk: input.liquidityRisk,
    observedSpreadBps: input.marketSnapshot.spreadBps,
    stressScenarios: Object.freeze(input.stressScenarios.map((stress) => Object.freeze({
      ...stress,
      evidenceRefs: Object.freeze([...stress.evidenceRefs]),
    }))),
    evidenceRefs: unique([
      ...input.forecast.evidenceRefs,
      ...input.marketSnapshot.evidenceRefs,
      ...input.evidenceRefs,
      ...input.stressScenarios.flatMap((stress) => stress.evidenceRefs),
    ]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildMetalIntelligenceSnapshot(input: Readonly<{
  intelligenceId: string;
  accountId: string;
  requestedBy: string;
  createdAt: string;
  factorSet: MetalFactorSet;
  regime: MetalRegimeAssessment;
  forecast: MetalForecastDistribution;
  risk: MetalRiskAssessment;
  provenanceHash: string;
}>): MetalIntelligenceSnapshot {
  nonEmpty(input.intelligenceId, 'MONEY_METALS_INTELLIGENCE_ID_REQUIRED');
  nonEmpty(input.accountId, 'MONEY_METALS_INTELLIGENCE_ACCOUNT_REQUIRED');
  nonEmpty(input.requestedBy, 'MONEY_METALS_INTELLIGENCE_REQUESTER_REQUIRED');
  nonEmpty(input.provenanceHash, 'MONEY_METALS_INTELLIGENCE_PROVENANCE_REQUIRED');
  if (ts(input.createdAt, 'MONEY_METALS_INTELLIGENCE_CREATED_INVALID') < ts(input.factorSet.informationCutoff, 'MONEY_METALS_INTELLIGENCE_CUTOFF_INVALID')) {
    throw new Error('MONEY_METALS_INTELLIGENCE_CREATED_BEFORE_CUTOFF');
  }
  if (
    input.factorSet.financialAuthority !== 'NONE' ||
    input.regime.financialAuthority !== 'NONE' ||
    input.forecast.financialAuthority !== 'NONE' ||
    input.risk.financialAuthority !== 'NONE'
  ) throw new Error('MONEY_METALS_INTELLIGENCE_AUTHORITY_FORBIDDEN');
  if (
    input.factorSet.instrumentId !== input.regime.instrumentId ||
    input.regime.instrumentId !== input.forecast.instrumentId ||
    input.forecast.instrumentId !== input.risk.instrumentId
  ) throw new Error('MONEY_METALS_INTELLIGENCE_INSTRUMENT_MISMATCH');
  if (
    input.factorSet.informationCutoff !== input.regime.informationCutoff ||
    input.regime.informationCutoff !== input.forecast.informationCutoff ||
    input.forecast.informationCutoff !== input.risk.informationCutoff
  ) throw new Error('MONEY_METALS_INTELLIGENCE_CUTOFF_MISMATCH');

  const decisionCase: DecisionCase = Object.freeze({
    caseId: `metals-intelligence:${input.intelligenceId}`,
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
    stressStatus: input.risk.stressScenarios.length > 0 ? 'ASSESSED' : 'NOT_PROVIDED',
    simulationStatus: 'NOT_RUN',
    liquidityStatus: input.risk.liquidityRisk,
    calibrationStatus: 'UNSCORED',
    authorityStatus: 'MISSING',
    disposition: 'RESEARCH_ONLY',
  });

  return Object.freeze({
    schemaVersion: METALS_INTELLIGENCE_SCHEMA_VERSION,
    intelligenceId: input.intelligenceId,
    metal: input.factorSet.metal,
    instrumentId: input.factorSet.instrumentId,
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
