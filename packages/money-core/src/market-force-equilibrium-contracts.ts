export const MARKET_FORCE_SCHEMA_VERSION = 'MONEY-MARKET-FORCE-01' as const;

export type MarketForceName =
  | 'DEMAND'
  | 'SUPPLY'
  | 'VOLATILITY'
  | 'LIQUIDITY'
  | 'SPECULATION';

export type SignedMarketForces = Readonly<Record<MarketForceName, number>>;
export type MarketForceWeights = Readonly<Record<MarketForceName, number>>;

export type MarketForceCalibrationStatus =
  | 'UNVALIDATED'
  | 'RESEARCH_CALIBRATED'
  | 'OUT_OF_SAMPLE_VALIDATED';

export type MarketForceModel = Readonly<{
  modelId: string;
  modelVersion: string;
  weights: MarketForceWeights;
  maxAbsShiftPct: number;
  baseBandPct: number;
  dispersionBandScale: number;
  volatilityBandScale: number;
  maxBandPct: number;
  tensionVolatilityScale: number;
  calibrationStatus: MarketForceCalibrationStatus;
  methodologyNotes: readonly string[];
}>;

export type MarketForceSnapshot = Readonly<{
  schemaVersion: typeof MARKET_FORCE_SCHEMA_VERSION;
  snapshotId: string;
  instrumentId: string;
  currentPrice: number;
  forces: SignedMarketForces;
  observedAt: string;
  availableAt: string;
  evidenceIds: readonly string[];
  provenanceHash: string;
  signConvention: 'POSITIVE_UPWARD_NEGATIVE_DOWNWARD';
  authority: 'EVIDENCE_ONLY';
}>;

export type MarketForceDiagnostic = Readonly<{
  schemaVersion: typeof MARKET_FORCE_SCHEMA_VERSION;
  diagnosticId: string;
  snapshotId: string;
  instrumentId: string;
  modelId: string;
  modelVersion: string;
  calibrationStatus: MarketForceCalibrationStatus;
  normalizedWeights: MarketForceWeights;
  contributions: SignedMarketForces;
  netForce: number;
  equilibriumShiftPct: number;
  heuristicCenterPrice: number;
  lowerBandPrice: number;
  upperBandPrice: number;
  forceDispersion: number;
  tensionScore: number;
  interpretiveOnly: true;
  canAuthorizeTrade: false;
  authority: 'RESEARCH_ONLY';
  provenanceHash: string;
}>;

export type MarketForceScenario = Readonly<{
  scenarioId: string;
  baselineSnapshotId: string;
  forceDeltas: Partial<Record<MarketForceName, number>>;
  notes: readonly string[];
}>;

function assertFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertUnitForce(value: number, code: string): void {
  assertFinite(value, code);
  if (value < -1 || value > 1) throw new Error(code);
}

function assertFraction(value: number, code: string): void {
  assertFinite(value, code);
  if (value < 0 || value > 1) throw new Error(code);
}

function assertTimestamp(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

const FORCE_NAMES: readonly MarketForceName[] = Object.freeze([
  'DEMAND',
  'SUPPLY',
  'VOLATILITY',
  'LIQUIDITY',
  'SPECULATION',
]);

export function assertMarketForceModel(model: MarketForceModel): void {
  if (!model.modelId.trim() || !model.modelVersion.trim()) {
    throw new Error('MONEY_MARKET_FORCE_MODEL_ID_REQUIRED');
  }
  let weightSum = 0;
  for (const name of FORCE_NAMES) {
    const weight = model.weights[name];
    assertFinite(weight, 'MONEY_MARKET_FORCE_WEIGHT_INVALID');
    if (weight < 0) throw new Error('MONEY_MARKET_FORCE_NEGATIVE_WEIGHT_FORBIDDEN');
    weightSum += weight;
  }
  if (weightSum <= 0) throw new Error('MONEY_MARKET_FORCE_WEIGHT_SUM_INVALID');

  assertFraction(model.maxAbsShiftPct, 'MONEY_MARKET_FORCE_SHIFT_LIMIT_INVALID');
  assertFraction(model.baseBandPct, 'MONEY_MARKET_FORCE_BASE_BAND_INVALID');
  assertFraction(model.dispersionBandScale, 'MONEY_MARKET_FORCE_DISPERSION_SCALE_INVALID');
  assertFraction(model.volatilityBandScale, 'MONEY_MARKET_FORCE_VOL_SCALE_INVALID');
  assertFraction(model.maxBandPct, 'MONEY_MARKET_FORCE_MAX_BAND_INVALID');
  if (model.baseBandPct > model.maxBandPct) {
    throw new Error('MONEY_MARKET_FORCE_BAND_ORDER_INVALID');
  }
  assertFinite(model.tensionVolatilityScale, 'MONEY_MARKET_FORCE_TENSION_SCALE_INVALID');
  if (model.tensionVolatilityScale < 0 || model.tensionVolatilityScale > 2) {
    throw new Error('MONEY_MARKET_FORCE_TENSION_SCALE_INVALID');
  }
  if (model.methodologyNotes.length === 0) {
    throw new Error('MONEY_MARKET_FORCE_METHODOLOGY_REQUIRED');
  }
}

export function assertMarketForceSnapshot(snapshot: MarketForceSnapshot): void {
  if (snapshot.schemaVersion !== MARKET_FORCE_SCHEMA_VERSION) {
    throw new Error('MONEY_MARKET_FORCE_SCHEMA_INVALID');
  }
  if (!snapshot.snapshotId.trim() || !snapshot.instrumentId.trim()) {
    throw new Error('MONEY_MARKET_FORCE_ID_REQUIRED');
  }
  assertFinite(snapshot.currentPrice, 'MONEY_MARKET_FORCE_PRICE_INVALID');
  if (snapshot.currentPrice <= 0) throw new Error('MONEY_MARKET_FORCE_PRICE_INVALID');
  for (const name of FORCE_NAMES) {
    assertUnitForce(snapshot.forces[name], 'MONEY_MARKET_FORCE_VALUE_INVALID');
  }
  assertTimestamp(snapshot.observedAt, 'MONEY_MARKET_FORCE_OBSERVED_AT_INVALID');
  assertTimestamp(snapshot.availableAt, 'MONEY_MARKET_FORCE_AVAILABLE_AT_INVALID');
  if (Date.parse(snapshot.availableAt) < Date.parse(snapshot.observedAt)) {
    throw new Error('MONEY_MARKET_FORCE_CLOCK_ORDER_INVALID');
  }
  if (snapshot.evidenceIds.length === 0 || !snapshot.provenanceHash.trim()) {
    throw new Error('MONEY_MARKET_FORCE_PROVENANCE_REQUIRED');
  }
  if (snapshot.signConvention !== 'POSITIVE_UPWARD_NEGATIVE_DOWNWARD') {
    throw new Error('MONEY_MARKET_FORCE_SIGN_CONVENTION_INVALID');
  }
  if (snapshot.authority !== 'EVIDENCE_ONLY') {
    throw new Error('MONEY_MARKET_FORCE_SNAPSHOT_AUTHORITY_INVALID');
  }
}

function normalizedWeights(weights: MarketForceWeights): MarketForceWeights {
  const sum = FORCE_NAMES.reduce((total, name) => total + weights[name], 0);
  return Object.freeze(
    Object.fromEntries(
      FORCE_NAMES.map((name) => [name, weights[name] / sum]),
    ) as Record<MarketForceName, number>,
  );
}

export function computeMarketForceDiagnostic(
  snapshot: MarketForceSnapshot,
  model: MarketForceModel,
): MarketForceDiagnostic {
  assertMarketForceSnapshot(snapshot);
  assertMarketForceModel(model);

  const weights = normalizedWeights(model.weights);
  const contributions = Object.freeze(
    Object.fromEntries(
      FORCE_NAMES.map((name) => [name, weights[name] * snapshot.forces[name]]),
    ) as Record<MarketForceName, number>,
  );

  const netForce = FORCE_NAMES.reduce(
    (total, name) => total + contributions[name],
    0,
  );

  const forceDispersion = FORCE_NAMES.reduce(
    (total, name) =>
      total + weights[name] * Math.abs(snapshot.forces[name] - netForce),
    0,
  );

  const equilibriumShiftPct = clamp(
    netForce * model.maxAbsShiftPct,
    -model.maxAbsShiftPct,
    model.maxAbsShiftPct,
  );

  const volatilityMagnitude = Math.abs(snapshot.forces.VOLATILITY);
  const bandHalfWidthPct = clamp(
    model.baseBandPct +
      forceDispersion * model.dispersionBandScale +
      volatilityMagnitude * model.volatilityBandScale,
    model.baseBandPct,
    model.maxBandPct,
  );

  const tensionScore = clamp(
    forceDispersion + volatilityMagnitude * model.tensionVolatilityScale,
    0,
    2,
  );

  const heuristicCenterPrice =
    snapshot.currentPrice * (1 + equilibriumShiftPct);

  const provenanceHash = [
    snapshot.provenanceHash,
    model.modelId,
    model.modelVersion,
    netForce.toFixed(12),
    forceDispersion.toFixed(12),
    equilibriumShiftPct.toFixed(12),
  ].join(':');

  return Object.freeze({
    schemaVersion: MARKET_FORCE_SCHEMA_VERSION,
    diagnosticId: `market-force:${snapshot.snapshotId}:${model.modelId}:${model.modelVersion}`,
    snapshotId: snapshot.snapshotId,
    instrumentId: snapshot.instrumentId,
    modelId: model.modelId,
    modelVersion: model.modelVersion,
    calibrationStatus: model.calibrationStatus,
    normalizedWeights: weights,
    contributions,
    netForce,
    equilibriumShiftPct,
    heuristicCenterPrice,
    lowerBandPrice: heuristicCenterPrice * (1 - bandHalfWidthPct),
    upperBandPrice: heuristicCenterPrice * (1 + bandHalfWidthPct),
    forceDispersion,
    tensionScore,
    interpretiveOnly: true,
    canAuthorizeTrade: false,
    authority: 'RESEARCH_ONLY',
    provenanceHash,
  });
}

export function applyMarketForceScenario(
  baseline: MarketForceSnapshot,
  scenario: MarketForceScenario,
  availableAt: string,
  provenanceHash: string,
): MarketForceSnapshot {
  assertMarketForceSnapshot(baseline);
  if (scenario.baselineSnapshotId !== baseline.snapshotId) {
    throw new Error('MONEY_MARKET_FORCE_SCENARIO_BASELINE_MISMATCH');
  }
  assertTimestamp(availableAt, 'MONEY_MARKET_FORCE_SCENARIO_TIME_INVALID');
  if (!scenario.scenarioId.trim() || !provenanceHash.trim()) {
    throw new Error('MONEY_MARKET_FORCE_SCENARIO_PROVENANCE_REQUIRED');
  }

  const nextForces = Object.freeze(
    Object.fromEntries(
      FORCE_NAMES.map((name) => {
        const delta = scenario.forceDeltas[name] ?? 0;
        assertFinite(delta, 'MONEY_MARKET_FORCE_SCENARIO_DELTA_INVALID');
        return [name, clamp(baseline.forces[name] + delta, -1, 1)];
      }),
    ) as Record<MarketForceName, number>,
  );

  return Object.freeze({
    ...baseline,
    snapshotId: `${baseline.snapshotId}:scenario:${scenario.scenarioId}`,
    forces: nextForces,
    observedAt: baseline.observedAt,
    availableAt,
    evidenceIds: Object.freeze([
      ...baseline.evidenceIds,
      `scenario:${scenario.scenarioId}`,
    ]),
    provenanceHash,
    authority: 'EVIDENCE_ONLY',
  });
}

export function assertMarketForceDiagnosticNonExecutable(
  diagnostic: MarketForceDiagnostic,
): void {
  if (
    diagnostic.authority !== 'RESEARCH_ONLY' ||
    diagnostic.canAuthorizeTrade !== false ||
    diagnostic.interpretiveOnly !== true
  ) {
    throw new Error('MONEY_MARKET_FORCE_EXECUTION_AUTHORITY_FORBIDDEN');
  }
}
