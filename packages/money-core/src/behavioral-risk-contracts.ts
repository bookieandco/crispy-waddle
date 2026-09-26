export const BEHAVIORAL_RISK_SCHEMA_VERSION =
  'MONEY-BEHAVIORAL-RISK-01' as const;

export type BehavioralRiskTrigger =
  | 'POST_LOSS_SIZE_ESCALATION'
  | 'POST_WIN_SIZE_ESCALATION'
  | 'RAPID_REENTRY'
  | 'RULE_OVERRIDE'
  | 'STRATEGY_CHURN'
  | 'LOSS_CHASING';

export type BehavioralTradeObservation = Readonly<{
  observationId: string;
  strategyId: string;
  instrumentId: string;
  openedAt: string;
  closedAt?: string;
  realizedReturnBps?: number;
  plannedRiskBps: number;
  requestedRiskBps: number;
  ruleViolationCount: number;
  evidenceIds: readonly string[];
  authority: 'EVIDENCE_ONLY';
}>;

export type BehavioralRiskPolicy = Readonly<{
  policyId: string;
  maximumRiskBpsPerTrade: number;
  maximumPostLossRiskIncreaseBps: number;
  maximumPostWinRiskIncreaseBps: number;
  minimumReentryDelaySeconds: number;
  maximumRuleViolationsPerTrade: number;
  maximumStrategyChangesPerWindow: number;
  windowTradeCount: number;
  haltOnLossChasing: boolean;
}>;

export type BehavioralRiskAssessment = Readonly<{
  schemaVersion: typeof BEHAVIORAL_RISK_SCHEMA_VERSION;
  assessmentId: string;
  strategyId: string;
  status: 'PASS' | 'REVIEW' | 'HALT';
  triggers: readonly BehavioralRiskTrigger[];
  reasonCodes: readonly string[];
  observedTradeCount: number;
  authority: 'REVIEW_ONLY';
  canAuthorizeTrade: false;
}>;

export type ConstantFractionRiskPolicy = Readonly<{
  policyId: string;
  riskFractionBps: number;
  maximumRiskFractionBps: number;
  minimumRiskFractionBps: number;
  recentProfitCanIncreaseRiskFraction: false;
  recentLossCanIncreaseRiskFraction: false;
}>;

export type ConstantFractionRiskBudget = Readonly<{
  policyId: string;
  equity: number;
  riskFractionBps: number;
  maximumLossAmount: number;
  scalingMethod: 'CONSTANT_FRACTION_OF_EQUITY';
  martingaleAllowed: false;
  antiMartingaleAllowed: false;
  authority: 'RISK_BOUNDARY_ONLY';
}>;

export type ProcessConsistencyWindow = Readonly<{
  windowId: string;
  startAt: string;
  endAt: string;
  tradeCount: number;
  returnBps: number;
  maxDrawdownBps: number;
  ruleViolationCount: number;
  strategyChangeCount: number;
  evidenceIds: readonly string[];
}>;

export type ProcessConsistencyAssessment = Readonly<{
  strategyId: string;
  windowCount: number;
  profitableWindowRateBps: number;
  ruleViolationRateBps: number;
  averageMaxDrawdownBps: number;
  averageStrategyChangesPerWindow: number;
  status: 'INSUFFICIENT_HISTORY' | 'INCONSISTENT' | 'PROCESS_STABLE';
  profitAloneIsInsufficient: true;
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

function assertBps(value: number, code: string): void {
  assertFinite(value, code);
  if (value < 0 || value > 10_000) throw new Error(code);
}

function assertTimestamp(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

export function deriveConstantFractionRiskBudget(
  equity: number,
  policy: ConstantFractionRiskPolicy,
): ConstantFractionRiskBudget {
  assertFinite(equity, 'MONEY_BEHAVIORAL_RISK_EQUITY_INVALID');
  if (equity <= 0) throw new Error('MONEY_BEHAVIORAL_RISK_EQUITY_INVALID');
  assertBps(policy.riskFractionBps, 'MONEY_BEHAVIORAL_RISK_FRACTION_INVALID');
  assertBps(policy.maximumRiskFractionBps, 'MONEY_BEHAVIORAL_RISK_MAX_FRACTION_INVALID');
  assertBps(policy.minimumRiskFractionBps, 'MONEY_BEHAVIORAL_RISK_MIN_FRACTION_INVALID');
  if (
    policy.minimumRiskFractionBps > policy.riskFractionBps ||
    policy.riskFractionBps > policy.maximumRiskFractionBps
  ) {
    throw new Error('MONEY_BEHAVIORAL_RISK_FRACTION_ORDER_INVALID');
  }

  return Object.freeze({
    policyId: policy.policyId,
    equity,
    riskFractionBps: policy.riskFractionBps,
    maximumLossAmount: equity * (policy.riskFractionBps / 10_000),
    scalingMethod: 'CONSTANT_FRACTION_OF_EQUITY',
    martingaleAllowed: false,
    antiMartingaleAllowed: false,
    authority: 'RISK_BOUNDARY_ONLY',
  });
}

export function assessBehavioralRisk(
  observations: readonly BehavioralTradeObservation[],
  policy: BehavioralRiskPolicy,
): BehavioralRiskAssessment {
  if (!policy.policyId.trim()) throw new Error('MONEY_BEHAVIORAL_RISK_POLICY_ID_REQUIRED');
  assertBps(policy.maximumRiskBpsPerTrade, 'MONEY_BEHAVIORAL_RISK_MAX_TRADE_RISK_INVALID');
  assertBps(policy.maximumPostLossRiskIncreaseBps, 'MONEY_BEHAVIORAL_RISK_POST_LOSS_DELTA_INVALID');
  assertBps(policy.maximumPostWinRiskIncreaseBps, 'MONEY_BEHAVIORAL_RISK_POST_WIN_DELTA_INVALID');
  assertNonNegative(policy.minimumReentryDelaySeconds, 'MONEY_BEHAVIORAL_RISK_REENTRY_DELAY_INVALID');
  if (!Number.isInteger(policy.maximumRuleViolationsPerTrade) || policy.maximumRuleViolationsPerTrade < 0) {
    throw new Error('MONEY_BEHAVIORAL_RISK_RULE_LIMIT_INVALID');
  }
  if (!Number.isInteger(policy.maximumStrategyChangesPerWindow) || policy.maximumStrategyChangesPerWindow < 0) {
    throw new Error('MONEY_BEHAVIORAL_RISK_STRATEGY_CHANGE_LIMIT_INVALID');
  }
  if (!Number.isInteger(policy.windowTradeCount) || policy.windowTradeCount < 2) {
    throw new Error('MONEY_BEHAVIORAL_RISK_WINDOW_INVALID');
  }

  const sorted = observations.slice().sort((a, b) => a.openedAt.localeCompare(b.openedAt));

  for (const observation of sorted) {
    const open = assertTimestamp(observation.openedAt, 'MONEY_BEHAVIORAL_RISK_OPEN_TIME_INVALID');
    if (observation.closedAt) {
      const close = assertTimestamp(observation.closedAt, 'MONEY_BEHAVIORAL_RISK_CLOSE_TIME_INVALID');
      if (close < open) throw new Error('MONEY_BEHAVIORAL_RISK_CLOCK_ORDER_INVALID');
    }
    assertBps(observation.plannedRiskBps, 'MONEY_BEHAVIORAL_RISK_PLANNED_RISK_INVALID');
    assertBps(observation.requestedRiskBps, 'MONEY_BEHAVIORAL_RISK_REQUESTED_RISK_INVALID');
    if (!Number.isInteger(observation.ruleViolationCount) || observation.ruleViolationCount < 0) {
      throw new Error('MONEY_BEHAVIORAL_RISK_VIOLATION_COUNT_INVALID');
    }
    if (!observation.evidenceIds.length) throw new Error('MONEY_BEHAVIORAL_RISK_EVIDENCE_REQUIRED');
    if (observation.authority !== 'EVIDENCE_ONLY') throw new Error('MONEY_BEHAVIORAL_RISK_AUTHORITY_INVALID');
  }

  const triggers = new Set<BehavioralRiskTrigger>();
  const reasons = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (current.requestedRiskBps > policy.maximumRiskBpsPerTrade) {
      reasons.add('MAX_RISK_PER_TRADE_BREACH');
    }
    if (
      current.requestedRiskBps > current.plannedRiskBps ||
      current.ruleViolationCount > policy.maximumRuleViolationsPerTrade
    ) {
      triggers.add('RULE_OVERRIDE');
    }

    const previous = i > 0 ? sorted[i - 1] : undefined;
    if (!previous) continue;

    const riskIncrease = Math.max(0, current.requestedRiskBps - previous.requestedRiskBps);

    if (
      previous.realizedReturnBps !== undefined &&
      previous.realizedReturnBps < 0 &&
      riskIncrease > policy.maximumPostLossRiskIncreaseBps
    ) {
      triggers.add('POST_LOSS_SIZE_ESCALATION');
      triggers.add('LOSS_CHASING');
      if (policy.haltOnLossChasing) reasons.add('LOSS_CHASING_HALT');
    }

    if (
      previous.realizedReturnBps !== undefined &&
      previous.realizedReturnBps > 0 &&
      riskIncrease > policy.maximumPostWinRiskIncreaseBps
    ) {
      triggers.add('POST_WIN_SIZE_ESCALATION');
    }

    if (previous.closedAt) {
      const closed = assertTimestamp(previous.closedAt, 'MONEY_BEHAVIORAL_RISK_CLOSE_TIME_INVALID');
      const opened = assertTimestamp(current.openedAt, 'MONEY_BEHAVIORAL_RISK_OPEN_TIME_INVALID');
      if ((opened - closed) / 1000 < policy.minimumReentryDelaySeconds) {
        triggers.add('RAPID_REENTRY');
      }
    }
  }

  const recent = sorted.slice(-policy.windowTradeCount);
  let strategyChanges = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1]!.strategyId !== recent[i]!.strategyId) strategyChanges += 1;
  }
  if (strategyChanges > policy.maximumStrategyChangesPerWindow) {
    triggers.add('STRATEGY_CHURN');
  }

  let status: BehavioralRiskAssessment['status'] = 'PASS';
  if (reasons.has('MAX_RISK_PER_TRADE_BREACH') || reasons.has('LOSS_CHASING_HALT')) {
    status = 'HALT';
  } else if (triggers.size || reasons.size) {
    status = 'REVIEW';
  }

  return Object.freeze({
    schemaVersion: BEHAVIORAL_RISK_SCHEMA_VERSION,
    assessmentId: 'behavioral-risk:' + policy.policyId + ':' + sorted.map((x) => x.observationId).join(':'),
    strategyId: sorted.at(-1)?.strategyId ?? 'UNKNOWN',
    status,
    triggers: Object.freeze([...triggers].sort()),
    reasonCodes: Object.freeze([...reasons].sort()),
    observedTradeCount: sorted.length,
    authority: 'REVIEW_ONLY',
    canAuthorizeTrade: false,
  });
}

export function assessProcessConsistency(
  strategyId: string,
  windows: readonly ProcessConsistencyWindow[],
  minimumWindows: number,
): ProcessConsistencyAssessment {
  if (!strategyId.trim()) throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_STRATEGY_ID_REQUIRED');
  if (!Number.isInteger(minimumWindows) || minimumWindows < 2) {
    throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_MIN_WINDOWS_INVALID');
  }

  const xs = windows.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (const window of xs) {
    const start = assertTimestamp(window.startAt, 'MONEY_BEHAVIORAL_CONSISTENCY_START_INVALID');
    const end = assertTimestamp(window.endAt, 'MONEY_BEHAVIORAL_CONSISTENCY_END_INVALID');
    if (end <= start) throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_WINDOW_ORDER_INVALID');
    if (!Number.isInteger(window.tradeCount) || window.tradeCount < 0) {
      throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_TRADE_COUNT_INVALID');
    }
    assertBps(window.maxDrawdownBps, 'MONEY_BEHAVIORAL_CONSISTENCY_DRAWDOWN_INVALID');
    if (!Number.isInteger(window.ruleViolationCount) || window.ruleViolationCount < 0) {
      throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_VIOLATIONS_INVALID');
    }
    if (!Number.isInteger(window.strategyChangeCount) || window.strategyChangeCount < 0) {
      throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_CHANGES_INVALID');
    }
    if (!window.evidenceIds.length) throw new Error('MONEY_BEHAVIORAL_CONSISTENCY_EVIDENCE_REQUIRED');
  }

  const totalTrades = xs.reduce((n, x) => n + x.tradeCount, 0);
  const totalViolations = xs.reduce((n, x) => n + x.ruleViolationCount, 0);
  const profitable = xs.filter((x) => x.returnBps > 0).length;
  const profitableWindowRateBps = xs.length ? Math.round((profitable / xs.length) * 10_000) : 0;
  const ruleViolationRateBps = totalTrades ? Math.round((totalViolations / totalTrades) * 10_000) : 0;
  const averageMaxDrawdownBps = xs.length
    ? Math.round(xs.reduce((n, x) => n + x.maxDrawdownBps, 0) / xs.length)
    : 0;
  const averageStrategyChangesPerWindow = xs.length
    ? xs.reduce((n, x) => n + x.strategyChangeCount, 0) / xs.length
    : 0;

  let status: ProcessConsistencyAssessment['status'] = 'INSUFFICIENT_HISTORY';
  if (xs.length >= minimumWindows) {
    status =
      ruleViolationRateBps <= 500 &&
      averageStrategyChangesPerWindow <= 1
        ? 'PROCESS_STABLE'
        : 'INCONSISTENT';
  }

  return Object.freeze({
    strategyId,
    windowCount: xs.length,
    profitableWindowRateBps,
    ruleViolationRateBps,
    averageMaxDrawdownBps,
    averageStrategyChangesPerWindow,
    status,
    profitAloneIsInsufficient: true,
    authority: 'RESEARCH_ONLY',
    canAuthorizeTrade: false,
  });
}
