import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessChartPrimitiveTransfer,
  assessTraderReadiness,
  assertPaperBeforeLiveReview,
  type TraderReadinessInput,
  type TraderReadinessPolicy,
  type TrainingEvidence,
} from './trader-readiness-contracts.js';

const requiredSkills = [
  'CANDLESTICK_OHLC',
  'MARKET_STRUCTURE',
  'TREND',
  'RISK_MANAGEMENT',
  'ORDER_ENTRY',
  'CONTRACT_SEMANTICS',
] as const;

const policy: TraderReadinessPolicy = {
  policyId: 'test-paper-readiness',
  requiredSkills,
  minimumPaperTrades: 20,
  minimumPaperDays: 5,
  maximumRuleViolationRateBps: 500,
  maximumDrawdownBps: 1_500,
  requiresFrozenStrategy: true,
  requiresCompleteJournal: true,
  requiresRiskPlan: true,
};

function training(status: TrainingEvidence['status'] = 'DEMONSTRATED_IN_PAPER'): TrainingEvidence[] {
  return requiredSkills.map((skill) => ({
    skill,
    status,
    evidenceRefs: [`evidence:${skill}`],
    observedAt: '2026-09-26T20:00:00Z',
  }));
}

function input(
  overrides: Partial<TraderReadinessInput> = {},
): TraderReadinessInput {
  return {
    assessmentId: 'readiness:1',
    vehicle: 'OPTION',
    trainingEvidence: training(),
    paperTradeCount: 40,
    paperDayCount: 10,
    ruleViolationCount: 1,
    maxDrawdownBps: 800,
    strategyFrozen: true,
    journalComplete: true,
    riskPlanPresent: true,
    netPaperPnlMinor: 50_000n,
    evidenceRefs: ['paper-ledger:run-1'],
    assessedAt: '2026-09-26T21:00:00Z',
    ...overrides,
  };
}

test('MONEY-TRADER-READINESS-01 blocks a video-to-live-capital shortcut', () => {
  const assessment = assessTraderReadiness(
    input({
      paperTradeCount: 0,
      paperDayCount: 0,
      netPaperPnlMinor: 0n,
    }),
    policy,
  );

  assert.equal(assessment.status, 'NOT_READY');
  assert.equal(assessment.canAuthorizeLive, false);
  assert.equal(assessment.authority, 'EDUCATION_AND_REVIEW_ONLY');
  assert.throws(
    () => assertPaperBeforeLiveReview(assessment),
    /MONEY_TRADER_READINESS_REVIEW_NOT_ELIGIBLE/,
  );
});

test('MONEY-TRADER-READINESS-01 does not treat paper profit as sufficient evidence of readiness', () => {
  const assessment = assessTraderReadiness(
    input({
      netPaperPnlMinor: 1_000_000n,
      ruleViolationCount: 8,
      maxDrawdownBps: 2_500,
    }),
    policy,
  );

  assert.equal(assessment.status, 'PAPER_ONLY');
  assert.equal(assessment.paperProfitAloneIsInsufficient, true);
  assert.ok(assessment.reasonCodes.includes('RULE_VIOLATION_RATE_TOO_HIGH'));
  assert.ok(assessment.reasonCodes.includes('DRAWDOWN_TOO_HIGH'));
  assert.equal(assessment.canAuthorizeLive, false);
});

test('MONEY-TRADER-READINESS-01 allows review only after foundation and paper evidence pass policy', () => {
  const assessment = assessTraderReadiness(input(), policy);

  assert.equal(assessment.status, 'ELIGIBLE_FOR_REVIEW');
  assert.deepEqual(assessment.reasonCodes, []);
  assert.equal(assessment.canAuthorizeLive, false);
  assert.doesNotThrow(() => assertPaperBeforeLiveReview(assessment));
});

test('MONEY-TRADER-READINESS-01 requires demonstrated foundation skills rather than passive study', () => {
  const assessment = assessTraderReadiness(
    input({
      trainingEvidence: training('LEARNING'),
    }),
    policy,
  );

  assert.equal(assessment.status, 'PAPER_ONLY');
  assert.ok(
    assessment.reasonCodes.includes(
      'SKILL_NOT_DEMONSTRATED:CANDLESTICK_OHLC',
    ),
  );
});

test('MONEY-TRADER-READINESS-01 transfers chart primitives without assuming strategy edge transfers', () => {
  const transfer = assessChartPrimitiveTransfer(
    'OPTION',
    'FUTURE',
    'HIGH_LOW_STRUCTURE',
  );

  assert.equal(transfer.primitiveCanTransfer, true);
  assert.equal(transfer.strategyEdgeCanTransferWithoutValidation, false);
  assert.equal(transfer.requiresTargetVehicleValidation, true);
  assert.equal(transfer.authority, 'RESEARCH_ONLY');
});
