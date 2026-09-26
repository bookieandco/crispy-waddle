export const TRADER_READINESS_SCHEMA_VERSION = 'MONEY-TRADER-READINESS-01' as const;

export type TradingVehicle =
  | 'STOCK'
  | 'OPTION'
  | 'FUTURE'
  | 'FOREX'
  | 'CRYPTO'
  | 'COMMODITY'
  | 'INDEX'
  | 'OTHER';

export type TradingFoundationSkill =
  | 'CANDLESTICK_OHLC'
  | 'MARKET_STRUCTURE'
  | 'TREND'
  | 'SUPPORT_RESISTANCE'
  | 'RISK_MANAGEMENT'
  | 'ORDER_ENTRY'
  | 'CONTRACT_SEMANTICS';

export type SkillStatus =
  | 'UNASSESSED'
  | 'LEARNING'
  | 'DEMONSTRATED_IN_REPLAY'
  | 'DEMONSTRATED_IN_PAPER';

export type TrainingEvidence = Readonly<{
  skill: TradingFoundationSkill;
  status: SkillStatus;
  evidenceRefs: readonly string[];
  observedAt: string;
}>;

export type TraderReadinessPolicy = Readonly<{
  policyId: string;
  requiredSkills: readonly TradingFoundationSkill[];
  minimumPaperTrades: number;
  minimumPaperDays: number;
  maximumRuleViolationRateBps: number;
  maximumDrawdownBps: number;
  requiresFrozenStrategy: boolean;
  requiresCompleteJournal: boolean;
  requiresRiskPlan: boolean;
}>;

export type TraderReadinessInput = Readonly<{
  assessmentId: string;
  vehicle: TradingVehicle;
  trainingEvidence: readonly TrainingEvidence[];
  paperTradeCount: number;
  paperDayCount: number;
  ruleViolationCount: number;
  maxDrawdownBps: number;
  strategyFrozen: boolean;
  journalComplete: boolean;
  riskPlanPresent: boolean;
  netPaperPnlMinor?: bigint;
  evidenceRefs: readonly string[];
  assessedAt: string;
}>;

export type TraderReadinessStatus =
  | 'NOT_READY'
  | 'PAPER_ONLY'
  | 'ELIGIBLE_FOR_REVIEW';

export type TraderReadinessAssessment = Readonly<{
  schemaVersion: typeof TRADER_READINESS_SCHEMA_VERSION;
  assessmentId: string;
  vehicle: TradingVehicle;
  status: TraderReadinessStatus;
  reasonCodes: readonly string[];
  paperProfitAloneIsInsufficient: true;
  requiresIndependentVehicleValidation: true;
  authority: 'EDUCATION_AND_REVIEW_ONLY';
  canAuthorizeLive: false;
}>;

export type PortableChartPrimitive =
  | 'OHLC_CANDLE'
  | 'HIGH_LOW_STRUCTURE'
  | 'TREND_DIRECTION'
  | 'SUPPORT_RESISTANCE'
  | 'VOLATILITY'
  | 'VOLUME';

export type VehicleTransferAssessment = Readonly<{
  sourceVehicle: TradingVehicle;
  targetVehicle: TradingVehicle;
  primitive: PortableChartPrimitive;
  primitiveCanTransfer: boolean;
  strategyEdgeCanTransferWithoutValidation: false;
  requiresTargetVehicleValidation: true;
  authority: 'RESEARCH_ONLY';
}>;

function assertIntegerAtLeastZero(value: number, code: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(code);
}

function assertBps(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 10_000) {
    throw new Error(code);
  }
}

function assertTimestamp(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

export function assertTraderReadinessPolicy(policy: TraderReadinessPolicy): void {
  if (!policy.policyId.trim()) throw new Error('MONEY_TRADER_READINESS_POLICY_ID_REQUIRED');
  if (policy.requiredSkills.length === 0) {
    throw new Error('MONEY_TRADER_READINESS_SKILLS_REQUIRED');
  }
  assertIntegerAtLeastZero(
    policy.minimumPaperTrades,
    'MONEY_TRADER_READINESS_MIN_TRADES_INVALID',
  );
  assertIntegerAtLeastZero(
    policy.minimumPaperDays,
    'MONEY_TRADER_READINESS_MIN_DAYS_INVALID',
  );
  assertBps(
    policy.maximumRuleViolationRateBps,
    'MONEY_TRADER_READINESS_RULE_RATE_INVALID',
  );
  assertBps(
    policy.maximumDrawdownBps,
    'MONEY_TRADER_READINESS_DRAWDOWN_INVALID',
  );
}

export function assessTraderReadiness(
  input: TraderReadinessInput,
  policy: TraderReadinessPolicy,
): TraderReadinessAssessment {
  assertTraderReadinessPolicy(policy);
  if (!input.assessmentId.trim()) {
    throw new Error('MONEY_TRADER_READINESS_ASSESSMENT_ID_REQUIRED');
  }
  if (input.evidenceRefs.length === 0) {
    throw new Error('MONEY_TRADER_READINESS_EVIDENCE_REQUIRED');
  }
  assertTimestamp(input.assessedAt, 'MONEY_TRADER_READINESS_TIME_INVALID');
  assertIntegerAtLeastZero(
    input.paperTradeCount,
    'MONEY_TRADER_READINESS_TRADE_COUNT_INVALID',
  );
  assertIntegerAtLeastZero(
    input.paperDayCount,
    'MONEY_TRADER_READINESS_DAY_COUNT_INVALID',
  );
  assertIntegerAtLeastZero(
    input.ruleViolationCount,
    'MONEY_TRADER_READINESS_VIOLATION_COUNT_INVALID',
  );
  assertBps(input.maxDrawdownBps, 'MONEY_TRADER_READINESS_INPUT_DRAWDOWN_INVALID');

  const reasons: string[] = [];
  const latestSkill = new Map<TradingFoundationSkill, TrainingEvidence>();
  for (const evidence of input.trainingEvidence) {
    assertTimestamp(evidence.observedAt, 'MONEY_TRADER_READINESS_SKILL_TIME_INVALID');
    const prior = latestSkill.get(evidence.skill);
    if (!prior || Date.parse(evidence.observedAt) >= Date.parse(prior.observedAt)) {
      latestSkill.set(evidence.skill, evidence);
    }
  }

  for (const skill of policy.requiredSkills) {
    const evidence = latestSkill.get(skill);
    if (!evidence) {
      reasons.push(`SKILL_MISSING:${skill}`);
      continue;
    }
    if (
      evidence.status !== 'DEMONSTRATED_IN_REPLAY' &&
      evidence.status !== 'DEMONSTRATED_IN_PAPER'
    ) {
      reasons.push(`SKILL_NOT_DEMONSTRATED:${skill}`);
    }
    if (evidence.evidenceRefs.length === 0) {
      reasons.push(`SKILL_EVIDENCE_MISSING:${skill}`);
    }
  }

  if (input.paperTradeCount < policy.minimumPaperTrades) {
    reasons.push('INSUFFICIENT_PAPER_TRADES');
  }
  if (input.paperDayCount < policy.minimumPaperDays) {
    reasons.push('INSUFFICIENT_PAPER_DAYS');
  }

  const violationRateBps =
    input.paperTradeCount === 0
      ? 10_000
      : Math.round((input.ruleViolationCount / input.paperTradeCount) * 10_000);

  if (violationRateBps > policy.maximumRuleViolationRateBps) {
    reasons.push('RULE_VIOLATION_RATE_TOO_HIGH');
  }
  if (input.maxDrawdownBps > policy.maximumDrawdownBps) {
    reasons.push('DRAWDOWN_TOO_HIGH');
  }
  if (policy.requiresFrozenStrategy && !input.strategyFrozen) {
    reasons.push('STRATEGY_NOT_FROZEN');
  }
  if (policy.requiresCompleteJournal && !input.journalComplete) {
    reasons.push('JOURNAL_INCOMPLETE');
  }
  if (policy.requiresRiskPlan && !input.riskPlanPresent) {
    reasons.push('RISK_PLAN_MISSING');
  }

  let status: TraderReadinessStatus;
  if (input.paperTradeCount === 0 || input.paperDayCount === 0) {
    status = 'NOT_READY';
  } else if (reasons.length > 0) {
    status = 'PAPER_ONLY';
  } else {
    status = 'ELIGIBLE_FOR_REVIEW';
  }

  return Object.freeze({
    schemaVersion: TRADER_READINESS_SCHEMA_VERSION,
    assessmentId: input.assessmentId,
    vehicle: input.vehicle,
    status,
    reasonCodes: Object.freeze(reasons),
    paperProfitAloneIsInsufficient: true,
    requiresIndependentVehicleValidation: true,
    authority: 'EDUCATION_AND_REVIEW_ONLY',
    canAuthorizeLive: false,
  });
}

export function assessChartPrimitiveTransfer(
  sourceVehicle: TradingVehicle,
  targetVehicle: TradingVehicle,
  primitive: PortableChartPrimitive,
): VehicleTransferAssessment {
  return Object.freeze({
    sourceVehicle,
    targetVehicle,
    primitive,
    primitiveCanTransfer: true,
    strategyEdgeCanTransferWithoutValidation: false,
    requiresTargetVehicleValidation: true,
    authority: 'RESEARCH_ONLY',
  });
}

export function assertPaperBeforeLiveReview(
  assessment: TraderReadinessAssessment,
): void {
  if (assessment.status !== 'ELIGIBLE_FOR_REVIEW') {
    throw new Error('MONEY_TRADER_READINESS_REVIEW_NOT_ELIGIBLE');
  }
  if (assessment.canAuthorizeLive !== false) {
    throw new Error('MONEY_TRADER_READINESS_LIVE_AUTHORITY_FORBIDDEN');
  }
}
