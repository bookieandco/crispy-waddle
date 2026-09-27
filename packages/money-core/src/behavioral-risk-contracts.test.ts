import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessBehavioralRisk,
  assessProcessConsistency,
  deriveConstantFractionRiskBudget,
  type BehavioralRiskPolicy,
  type BehavioralTradeObservation,
} from './behavioral-risk-contracts.js';

const policy: BehavioralRiskPolicy = {
  policyId: 'behavioral-v1',
  maximumRiskBpsPerTrade: 100,
  maximumPostLossRiskIncreaseBps: 0,
  maximumPostWinRiskIncreaseBps: 25,
  minimumReentryDelaySeconds: 300,
  maximumRuleViolationsPerTrade: 0,
  maximumStrategyChangesPerWindow: 1,
  windowTradeCount: 5,
  haltOnLossChasing: true,
};

function trade(
  overrides: Partial<BehavioralTradeObservation> = {},
): BehavioralTradeObservation {
  return {
    observationId: 'trade:1',
    strategyId: 'strategy:a',
    instrumentId: 'fx:EURUSD',
    openedAt: '2026-09-26T20:00:00Z',
    closedAt: '2026-09-26T20:10:00Z',
    realizedReturnBps: -50,
    plannedRiskBps: 50,
    requestedRiskBps: 50,
    ruleViolationCount: 0,
    evidenceIds: ['paper:trade:1'],
    authority: 'EVIDENCE_ONLY',
    ...overrides,
  };
}

test('MONEY-BEHAVIORAL-RISK-01 scales absolute risk with equity without increasing the risk fraction', () => {
  const p = {
    policyId: 'constant-fraction',
    riskFractionBps: 50,
    maximumRiskFractionBps: 100,
    minimumRiskFractionBps: 25,
    recentProfitCanIncreaseRiskFraction: false as const,
    recentLossCanIncreaseRiskFraction: false as const,
  };

  const small = deriveConstantFractionRiskBudget(10_000, p);
  const large = deriveConstantFractionRiskBudget(20_000, p);

  assert.equal(small.maximumLossAmount, 50);
  assert.equal(large.maximumLossAmount, 100);
  assert.equal(small.riskFractionBps, large.riskFractionBps);
  assert.equal(small.martingaleAllowed, false);
  assert.equal(small.antiMartingaleAllowed, false);
});

test('MONEY-BEHAVIORAL-RISK-01 halts post-loss size escalation when loss chasing is forbidden', () => {
  const assessment = assessBehavioralRisk(
    [
      trade(),
      trade({
        observationId: 'trade:2',
        openedAt: '2026-09-26T20:11:00Z',
        closedAt: '2026-09-26T20:20:00Z',
        realizedReturnBps: 80,
        plannedRiskBps: 50,
        requestedRiskBps: 100,
        evidenceIds: ['paper:trade:2'],
      }),
    ],
    policy,
  );

  assert.equal(assessment.status, 'HALT');
  assert.ok(assessment.triggers.includes('POST_LOSS_SIZE_ESCALATION'));
  assert.ok(assessment.triggers.includes('LOSS_CHASING'));
  assert.ok(assessment.reasonCodes.includes('LOSS_CHASING_HALT'));
  assert.equal(assessment.canAuthorizeTrade, false);
});

test('MONEY-BEHAVIORAL-RISK-01 flags rapid reentry and rule overrides without pretending they prove bad psychology', () => {
  const assessment = assessBehavioralRisk(
    [
      trade(),
      trade({
        observationId: 'trade:2',
        openedAt: '2026-09-26T20:10:30Z',
        closedAt: '2026-09-26T20:25:00Z',
        realizedReturnBps: 40,
        plannedRiskBps: 50,
        requestedRiskBps: 70,
        ruleViolationCount: 1,
        evidenceIds: ['paper:trade:2'],
      }),
    ],
    {
      ...policy,
      haltOnLossChasing: false,
      maximumPostLossRiskIncreaseBps: 50,
    },
  );

  assert.equal(assessment.status, 'REVIEW');
  assert.ok(assessment.triggers.includes('RAPID_REENTRY'));
  assert.ok(assessment.triggers.includes('RULE_OVERRIDE'));
  assert.equal(assessment.authority, 'REVIEW_ONLY');
});

test('MONEY-BEHAVIORAL-RISK-01 detects strategy churn in the observation window', () => {
  const xs = [
    trade({ observationId: 'a1', strategyId: 'a' }),
    trade({ observationId: 'b1', strategyId: 'b', openedAt: '2026-09-26T21:00:00Z' }),
    trade({ observationId: 'a2', strategyId: 'a', openedAt: '2026-09-26T22:00:00Z' }),
  ];

  const assessment = assessBehavioralRisk(xs, {
    ...policy,
    haltOnLossChasing: false,
    maximumStrategyChangesPerWindow: 1,
    maximumPostLossRiskIncreaseBps: 100,
    minimumReentryDelaySeconds: 0,
  });

  assert.equal(assessment.status, 'REVIEW');
  assert.ok(assessment.triggers.includes('STRATEGY_CHURN'));
});

test('MONEY-BEHAVIORAL-RISK-01 does not call a profitable but undisciplined history process-stable', () => {
  const assessment = assessProcessConsistency(
    'strategy:a',
    [
      {
        windowId: 'm1',
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-01-31T23:59:59Z',
        tradeCount: 20,
        returnBps: 1500,
        maxDrawdownBps: 900,
        ruleViolationCount: 4,
        strategyChangeCount: 3,
        evidenceIds: ['month:1'],
      },
      {
        windowId: 'm2',
        startAt: '2026-02-01T00:00:00Z',
        endAt: '2026-02-28T23:59:59Z',
        tradeCount: 20,
        returnBps: 1800,
        maxDrawdownBps: 1000,
        ruleViolationCount: 4,
        strategyChangeCount: 2,
        evidenceIds: ['month:2'],
      },
      {
        windowId: 'm3',
        startAt: '2026-03-01T00:00:00Z',
        endAt: '2026-03-31T23:59:59Z',
        tradeCount: 20,
        returnBps: 2000,
        maxDrawdownBps: 1200,
        ruleViolationCount: 3,
        strategyChangeCount: 2,
        evidenceIds: ['month:3'],
      },
    ],
    3,
  );

  assert.equal(assessment.profitableWindowRateBps, 10_000);
  assert.equal(assessment.status, 'INCONSISTENT');
  assert.equal(assessment.profitAloneIsInsufficient, true);
  assert.equal(assessment.canAuthorizeTrade, false);
});

test('MONEY-BEHAVIORAL-RISK-01 can label a multi-window process stable without claiming future profitability', () => {
  const assessment = assessProcessConsistency(
    'strategy:a',
    [
      {
        windowId: 'm1',
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-01-31T23:59:59Z',
        tradeCount: 20,
        returnBps: 200,
        maxDrawdownBps: 300,
        ruleViolationCount: 0,
        strategyChangeCount: 0,
        evidenceIds: ['month:1'],
      },
      {
        windowId: 'm2',
        startAt: '2026-02-01T00:00:00Z',
        endAt: '2026-02-28T23:59:59Z',
        tradeCount: 20,
        returnBps: -100,
        maxDrawdownBps: 400,
        ruleViolationCount: 0,
        strategyChangeCount: 0,
        evidenceIds: ['month:2'],
      },
      {
        windowId: 'm3',
        startAt: '2026-03-01T00:00:00Z',
        endAt: '2026-03-31T23:59:59Z',
        tradeCount: 20,
        returnBps: 150,
        maxDrawdownBps: 350,
        ruleViolationCount: 0,
        strategyChangeCount: 0,
        evidenceIds: ['month:3'],
      },
    ],
    3,
  );

  assert.equal(assessment.status, 'PROCESS_STABLE');
  assert.ok(assessment.profitableWindowRateBps < 10_000);
  assert.equal(assessment.authority, 'RESEARCH_ONLY');
});
