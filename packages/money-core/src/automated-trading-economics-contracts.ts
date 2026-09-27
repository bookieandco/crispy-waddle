export const AUTOMATED_TRADING_ECONOMICS_SCHEMA_VERSION =
  'MONEY-AUTO-ECON-01' as const;

export type TradingAutomationClaimCategory =
  | 'MINIMUM_CAPITAL'
  | 'RETURN_TARGET'
  | 'UPTIME_SLO'
  | 'BROKER_COMPATIBILITY'
  | 'DEMO_REALISM'
  | 'SUBSCRIPTION_COST'
  | 'SERVICE_SUPPORT'
  | 'ANECDOTAL_OUTCOME'
  | 'OTHER';

export type TradingAutomationClaim = Readonly<{
  schemaVersion: typeof AUTOMATED_TRADING_ECONOMICS_SCHEMA_VERSION;
  claimId: string;
  category: TradingAutomationClaimCategory;
  summary: string;
  numericValue?: number;
  unit?: string;
  sourceEvidenceIds: readonly string[];
  observedAt: string;
  status: 'SOURCE_ASSERTION';
  authority: 'NONE';
}>;

export type StrategyEconomicsScenario = Readonly<{
  scenarioId: string;
  capital: number;
  expectedTradesPerMonth: number;
  averageTurnoverFractionPerTrade: number;
  expectedGrossEdgeBpsPerTrade: number;
  spreadBpsPerTrade: number;
  slippageBpsPerTrade: number;
  commissionBpsPerTrade: number;
  otherVariableCostBpsPerTrade: number;
  fixedMonthlyCost: number;
  modelVersion: string;
  evidenceIds: readonly string[];
  assumptionIds: readonly string[];
}>;

export type StrategyEconomicsAssessment = Readonly<{
  schemaVersion: typeof AUTOMATED_TRADING_ECONOMICS_SCHEMA_VERSION;
  scenarioId: string;
  grossExpectedPnl: number;
  variableExecutionCost: number;
  fixedMonthlyCost: number;
  netScenarioPnl: number;
  grossReturnPct: number;
  netReturnPct: number;
  variableCostBpsPerTrade: number;
  fixedCostBurdenBps: number;
  costToGrossEdgeRatio: number | null;
  status:
    | 'INSUFFICIENT_EDGE'
    | 'NEGATIVE_AFTER_COSTS'
    | 'POSITIVE_SCENARIO';
  interpretiveOnly: true;
  canAuthorizeTrade: false;
  authority: 'RESEARCH_ONLY';
}>;

export type BrokerExecutionEvidence = Readonly<{
  provider: string;
  instrumentId: string;
  environment: 'PAPER' | 'SHADOW' | 'LIVE_OBSERVED';
  sampleSize: number;
  medianSpreadBps: number;
  p95SpreadBps: number;
  medianSlippageBps: number;
  p95SlippageBps: number;
  rejectionRateBps: number;
  p95LatencyMs: number;
  observedAt: string;
  evidenceIds: readonly string[];
}>;

export type BrokerExecutionPolicy = Readonly<{
  minimumSampleSize: number;
  maximumP95SpreadBps: number;
  maximumP95SlippageBps: number;
  maximumRejectionRateBps: number;
  maximumP95LatencyMs: number;
}>;

export type BrokerExecutionAssessment = Readonly<{
  provider: string;
  instrumentId: string;
  status: 'INSUFFICIENT_DATA' | 'PASS' | 'REVIEW' | 'REJECT';
  reasonCodes: readonly string[];
  authority: 'REVIEW_ONLY';
  canAuthorizeTrade: false;
}>;

export type PaperExecutionFidelityInput = Readonly<{
  modelId: string;
  paperSpreadBps: number;
  paperSlippageBps: number;
  paperFeeBps: number;
  observedMedianSpreadBps: number;
  observedMedianSlippageBps: number;
  observedFeeBps: number;
  toleranceBps: number;
  evidenceIds: readonly string[];
}>;

export type PaperExecutionFidelityAssessment = Readonly<{
  modelId: string;
  status: 'WITHIN_TOLERANCE' | 'CALIBRATION_REQUIRED';
  spreadGapBps: number;
  slippageGapBps: number;
  feeGapBps: number;
  maxGapBps: number;
  paperTradingCanStillBeUseful: true;
  authority: 'RESEARCH_ONLY';
  canAuthorizeTrade: false;
}>;

function assertFinite(value: number, code: string): void {
  if (!Number.isFinite(value)) throw new Error(code);
}

function assertNonNegative(value: number, code: string): void {
  assertFinite(value, code);
  if (value < 0) throw new Error(code);
}

function assertPositive(value: number, code: string): void {
  assertFinite(value, code);
  if (value <= 0) throw new Error(code);
}

function assertTimestamp(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

export function createTradingAutomationClaim(
  input: Omit<TradingAutomationClaim, 'schemaVersion' | 'status' | 'authority'>,
): TradingAutomationClaim {
  if (!input.claimId.trim() || !input.summary.trim()) {
    throw new Error('MONEY_AUTO_ECON_CLAIM_ID_REQUIRED');
  }
  if (input.sourceEvidenceIds.length === 0) {
    throw new Error('MONEY_AUTO_ECON_CLAIM_EVIDENCE_REQUIRED');
  }
  assertTimestamp(input.observedAt, 'MONEY_AUTO_ECON_CLAIM_TIME_INVALID');
  if (input.numericValue !== undefined) {
    assertFinite(input.numericValue, 'MONEY_AUTO_ECON_CLAIM_VALUE_INVALID');
  }

  return Object.freeze({
    ...input,
    sourceEvidenceIds: Object.freeze([...input.sourceEvidenceIds]),
    schemaVersion: AUTOMATED_TRADING_ECONOMICS_SCHEMA_VERSION,
    status: 'SOURCE_ASSERTION',
    authority: 'NONE',
  });
}

export function evaluateStrategyEconomics(
  scenario: StrategyEconomicsScenario,
): StrategyEconomicsAssessment {
  if (!scenario.scenarioId.trim() || !scenario.modelVersion.trim()) {
    throw new Error('MONEY_AUTO_ECON_SCENARIO_ID_REQUIRED');
  }
  assertPositive(scenario.capital, 'MONEY_AUTO_ECON_CAPITAL_INVALID');
  assertNonNegative(
    scenario.expectedTradesPerMonth,
    'MONEY_AUTO_ECON_TRADE_COUNT_INVALID',
  );
  assertNonNegative(
    scenario.averageTurnoverFractionPerTrade,
    'MONEY_AUTO_ECON_TURNOVER_INVALID',
  );
  assertFinite(
    scenario.expectedGrossEdgeBpsPerTrade,
    'MONEY_AUTO_ECON_EDGE_INVALID',
  );
  for (const [value, code] of [
    [scenario.spreadBpsPerTrade, 'MONEY_AUTO_ECON_SPREAD_INVALID'],
    [scenario.slippageBpsPerTrade, 'MONEY_AUTO_ECON_SLIPPAGE_INVALID'],
    [scenario.commissionBpsPerTrade, 'MONEY_AUTO_ECON_COMMISSION_INVALID'],
    [scenario.otherVariableCostBpsPerTrade, 'MONEY_AUTO_ECON_OTHER_COST_INVALID'],
    [scenario.fixedMonthlyCost, 'MONEY_AUTO_ECON_FIXED_COST_INVALID'],
  ] as const) {
    assertNonNegative(value, code);
  }
  if (scenario.evidenceIds.length === 0 || scenario.assumptionIds.length === 0) {
    throw new Error('MONEY_AUTO_ECON_PROVENANCE_REQUIRED');
  }

  const tradedNotionalPerTrade =
    scenario.capital * scenario.averageTurnoverFractionPerTrade;
  const monthlyTradedNotional =
    tradedNotionalPerTrade * scenario.expectedTradesPerMonth;

  const grossExpectedPnl =
    monthlyTradedNotional * (scenario.expectedGrossEdgeBpsPerTrade / 10_000);

  const variableCostBpsPerTrade =
    scenario.spreadBpsPerTrade +
    scenario.slippageBpsPerTrade +
    scenario.commissionBpsPerTrade +
    scenario.otherVariableCostBpsPerTrade;

  const variableExecutionCost =
    monthlyTradedNotional * (variableCostBpsPerTrade / 10_000);

  const netScenarioPnl =
    grossExpectedPnl -
    variableExecutionCost -
    scenario.fixedMonthlyCost;

  const grossReturnPct = (grossExpectedPnl / scenario.capital) * 100;
  const netReturnPct = (netScenarioPnl / scenario.capital) * 100;
  const fixedCostBurdenBps =
    (scenario.fixedMonthlyCost / scenario.capital) * 10_000;

  const totalCost = variableExecutionCost + scenario.fixedMonthlyCost;
  const costToGrossEdgeRatio =
    grossExpectedPnl > 0 ? totalCost / grossExpectedPnl : null;

  const status =
    grossExpectedPnl <= 0
      ? 'INSUFFICIENT_EDGE'
      : netScenarioPnl <= 0
        ? 'NEGATIVE_AFTER_COSTS'
        : 'POSITIVE_SCENARIO';

  return Object.freeze({
    schemaVersion: AUTOMATED_TRADING_ECONOMICS_SCHEMA_VERSION,
    scenarioId: scenario.scenarioId,
    grossExpectedPnl,
    variableExecutionCost,
    fixedMonthlyCost: scenario.fixedMonthlyCost,
    netScenarioPnl,
    grossReturnPct,
    netReturnPct,
    variableCostBpsPerTrade,
    fixedCostBurdenBps,
    costToGrossEdgeRatio,
    status,
    interpretiveOnly: true,
    canAuthorizeTrade: false,
    authority: 'RESEARCH_ONLY',
  });
}

export function minimumCapitalForFixedCostBurden(
  fixedMonthlyCost: number,
  maximumFixedCostBurdenBps: number,
): number {
  assertNonNegative(
    fixedMonthlyCost,
    'MONEY_AUTO_ECON_FIXED_COST_INVALID',
  );
  assertPositive(
    maximumFixedCostBurdenBps,
    'MONEY_AUTO_ECON_COST_BURDEN_INVALID',
  );
  return fixedMonthlyCost * (10_000 / maximumFixedCostBurdenBps);
}

export function spreadCostShareOfExpectedEdge(
  expectedGrossEdgeBpsPerTrade: number,
  spreadBpsPerTrade: number,
): number | null {
  assertFinite(
    expectedGrossEdgeBpsPerTrade,
    'MONEY_AUTO_ECON_EDGE_INVALID',
  );
  assertNonNegative(
    spreadBpsPerTrade,
    'MONEY_AUTO_ECON_SPREAD_INVALID',
  );
  if (expectedGrossEdgeBpsPerTrade <= 0) return null;
  return spreadBpsPerTrade / expectedGrossEdgeBpsPerTrade;
}

export function assessBrokerExecutionQuality(
  evidence: BrokerExecutionEvidence,
  policy: BrokerExecutionPolicy,
): BrokerExecutionAssessment {
  if (!evidence.provider.trim() || !evidence.instrumentId.trim()) {
    throw new Error('MONEY_AUTO_ECON_BROKER_ID_REQUIRED');
  }
  if (evidence.evidenceIds.length === 0) {
    throw new Error('MONEY_AUTO_ECON_BROKER_EVIDENCE_REQUIRED');
  }
  assertTimestamp(evidence.observedAt, 'MONEY_AUTO_ECON_BROKER_TIME_INVALID');
  for (const value of [
    evidence.sampleSize,
    evidence.medianSpreadBps,
    evidence.p95SpreadBps,
    evidence.medianSlippageBps,
    evidence.p95SlippageBps,
    evidence.rejectionRateBps,
    evidence.p95LatencyMs,
    policy.minimumSampleSize,
    policy.maximumP95SpreadBps,
    policy.maximumP95SlippageBps,
    policy.maximumRejectionRateBps,
    policy.maximumP95LatencyMs,
  ]) {
    assertNonNegative(value, 'MONEY_AUTO_ECON_BROKER_METRIC_INVALID');
  }

  const reasons: string[] = [];

  if (evidence.sampleSize < policy.minimumSampleSize) {
    reasons.push('INSUFFICIENT_SAMPLE');
  }
  if (evidence.p95SpreadBps > policy.maximumP95SpreadBps) {
    reasons.push('P95_SPREAD_TOO_HIGH');
  }
  if (evidence.p95SlippageBps > policy.maximumP95SlippageBps) {
    reasons.push('P95_SLIPPAGE_TOO_HIGH');
  }
  if (evidence.rejectionRateBps > policy.maximumRejectionRateBps) {
    reasons.push('REJECTION_RATE_TOO_HIGH');
  }
  if (evidence.p95LatencyMs > policy.maximumP95LatencyMs) {
    reasons.push('P95_LATENCY_TOO_HIGH');
  }

  const status =
    evidence.sampleSize < policy.minimumSampleSize
      ? 'INSUFFICIENT_DATA'
      : reasons.length === 0
        ? 'PASS'
        : reasons.length >= 3
          ? 'REJECT'
          : 'REVIEW';

  return Object.freeze({
    provider: evidence.provider,
    instrumentId: evidence.instrumentId,
    status,
    reasonCodes: Object.freeze(reasons),
    authority: 'REVIEW_ONLY',
    canAuthorizeTrade: false,
  });
}

export function assessPaperExecutionFidelity(
  input: PaperExecutionFidelityInput,
): PaperExecutionFidelityAssessment {
  if (!input.modelId.trim() || input.evidenceIds.length === 0) {
    throw new Error('MONEY_AUTO_ECON_PAPER_FIDELITY_EVIDENCE_REQUIRED');
  }
  for (const value of [
    input.paperSpreadBps,
    input.paperSlippageBps,
    input.paperFeeBps,
    input.observedMedianSpreadBps,
    input.observedMedianSlippageBps,
    input.observedFeeBps,
    input.toleranceBps,
  ]) {
    assertNonNegative(value, 'MONEY_AUTO_ECON_PAPER_FIDELITY_METRIC_INVALID');
  }

  const spreadGapBps = Math.abs(
    input.paperSpreadBps - input.observedMedianSpreadBps,
  );
  const slippageGapBps = Math.abs(
    input.paperSlippageBps - input.observedMedianSlippageBps,
  );
  const feeGapBps = Math.abs(input.paperFeeBps - input.observedFeeBps);
  const maxGapBps = Math.max(spreadGapBps, slippageGapBps, feeGapBps);

  return Object.freeze({
    modelId: input.modelId,
    status:
      maxGapBps <= input.toleranceBps
        ? 'WITHIN_TOLERANCE'
        : 'CALIBRATION_REQUIRED',
    spreadGapBps,
    slippageGapBps,
    feeGapBps,
    maxGapBps,
    paperTradingCanStillBeUseful: true,
    authority: 'RESEARCH_ONLY',
    canAuthorizeTrade: false,
  });
}

export type ConstantReturnProjection = Readonly<{
  startingCapital: number;
  periodicReturnRate: number;
  periods: number;
  projectedEndingCapital: number;
  totalProjectedReturnPct: number;
  projectionOnly: true;
  empiricalForecast: false;
  canAuthorizeTrade: false;
  authority: 'MATH_ONLY';
}>;

export function projectConstantReturn(
  startingCapital: number,
  periodicReturnRate: number,
  periods: number,
): ConstantReturnProjection {
  assertPositive(
    startingCapital,
    'MONEY_AUTO_ECON_PROJECTION_CAPITAL_INVALID',
  );
  assertFinite(
    periodicReturnRate,
    'MONEY_AUTO_ECON_PROJECTION_RATE_INVALID',
  );
  if (periodicReturnRate <= -1) {
    throw new Error('MONEY_AUTO_ECON_PROJECTION_RATE_INVALID');
  }
  if (!Number.isInteger(periods) || periods < 0) {
    throw new Error('MONEY_AUTO_ECON_PROJECTION_PERIODS_INVALID');
  }

  const projectedEndingCapital =
    startingCapital * Math.pow(1 + periodicReturnRate, periods);
  const totalProjectedReturnPct =
    ((projectedEndingCapital / startingCapital) - 1) * 100;

  return Object.freeze({
    startingCapital,
    periodicReturnRate,
    periods,
    projectedEndingCapital,
    totalProjectedReturnPct,
    projectionOnly: true,
    empiricalForecast: false,
    canAuthorizeTrade: false,
    authority: 'MATH_ONLY',
  });
}

export function assertAutomationEconomicsNonExecutable(
  assessment:
    | StrategyEconomicsAssessment
    | BrokerExecutionAssessment
    | PaperExecutionFidelityAssessment,
): void {
  if (assessment.canAuthorizeTrade !== false) {
    throw new Error('MONEY_AUTO_ECON_EXECUTION_AUTHORITY_FORBIDDEN');
  }
}
