import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessBrokerExecutionQuality,
  assessPaperExecutionFidelity,
  assertAutomationEconomicsNonExecutable,
  createTradingAutomationClaim,
  evaluateStrategyEconomics,
  minimumCapitalForFixedCostBurden,
  spreadCostShareOfExpectedEdge,
  type BrokerExecutionPolicy,
  type StrategyEconomicsScenario,
} from './automated-trading-economics-contracts.js';

const policy: BrokerExecutionPolicy = {
  minimumSampleSize: 100,
  maximumP95SpreadBps: 12,
  maximumP95SlippageBps: 8,
  maximumRejectionRateBps: 100,
  maximumP95LatencyMs: 600,
};

function scenario(
  overrides: Partial<StrategyEconomicsScenario> = {},
): StrategyEconomicsScenario {
  return {
    scenarioId: 'econ:1',
    capital: 10_000,
    expectedTradesPerMonth: 20,
    averageTurnoverFractionPerTrade: 0.5,
    expectedGrossEdgeBpsPerTrade: 25,
    spreadBpsPerTrade: 2,
    slippageBpsPerTrade: 1,
    commissionBpsPerTrade: 0.5,
    otherVariableCostBpsPerTrade: 0,
    fixedMonthlyCost: 0,
    modelVersion: '1',
    evidenceIds: ['paper-run:1'],
    assumptionIds: ['assumption:edge:1'],
    ...overrides,
  };
}

test('MONEY-AUTO-ECON-01 keeps uptime claims separate from return claims', () => {
  const uptime = createTradingAutomationClaim({
    claimId: 'claim:uptime',
    category: 'UPTIME_SLO',
    summary: 'Infrastructure uptime target',
    numericValue: 99.9,
    unit: 'PERCENT',
    sourceEvidenceIds: ['source:auto-trader-transcript'],
    observedAt: '2026-09-26T22:30:00Z',
  });

  const returns = createTradingAutomationClaim({
    claimId: 'claim:return',
    category: 'RETURN_TARGET',
    summary: 'Monthly return target asserted by vendor',
    numericValue: 10,
    unit: 'PERCENT_PER_MONTH',
    sourceEvidenceIds: ['source:auto-trader-transcript'],
    observedAt: '2026-09-26T22:30:00Z',
  });

  assert.equal(uptime.status, 'SOURCE_ASSERTION');
  assert.equal(returns.status, 'SOURCE_ASSERTION');
  assert.equal(uptime.authority, 'NONE');
  assert.equal(returns.authority, 'NONE');
  assert.notEqual(uptime.category, returns.category);
});

test('MONEY-AUTO-ECON-01 derives capital burden from fixed cost instead of hard-coding a minimum account', () => {
  assert.equal(minimumCapitalForFixedCostBurden(300, 100), 30_000);
  assert.equal(minimumCapitalForFixedCostBurden(300, 500), 6_000);
});

test('MONEY-AUTO-ECON-01 computes spread share from strategy edge rather than treating it as a universal percent of profit', () => {
  assert.equal(spreadCostShareOfExpectedEdge(20, 2), 0.1);
  assert.equal(spreadCostShareOfExpectedEdge(5, 2), 0.4);
  assert.equal(spreadCostShareOfExpectedEdge(0, 2), null);
});

test('MONEY-AUTO-ECON-01 rejects positive gross edge when costs erase it', () => {
  const assessment = evaluateStrategyEconomics(
    scenario({
      capital: 500,
      fixedMonthlyCost: 300,
      expectedGrossEdgeBpsPerTrade: 25,
    }),
  );

  assert.ok(assessment.grossExpectedPnl > 0);
  assert.ok(assessment.netScenarioPnl < 0);
  assert.equal(assessment.status, 'NEGATIVE_AFTER_COSTS');
  assert.equal(assessment.canAuthorizeTrade, false);
  assert.doesNotThrow(() =>
    assertAutomationEconomicsNonExecutable(assessment),
  );
});

test('MONEY-AUTO-ECON-01 paper execution can be useful when friction assumptions are calibrated', () => {
  const close = assessPaperExecutionFidelity({
    modelId: 'paper-model:1',
    paperSpreadBps: 2.0,
    paperSlippageBps: 1.2,
    paperFeeBps: 0.5,
    observedMedianSpreadBps: 2.2,
    observedMedianSlippageBps: 1.0,
    observedFeeBps: 0.5,
    toleranceBps: 0.3,
    evidenceIds: ['shadow-session:1'],
  });

  const unrealistic = assessPaperExecutionFidelity({
    modelId: 'paper-model:2',
    paperSpreadBps: 0,
    paperSlippageBps: 0,
    paperFeeBps: 0,
    observedMedianSpreadBps: 3,
    observedMedianSlippageBps: 4,
    observedFeeBps: 1,
    toleranceBps: 0.5,
    evidenceIds: ['shadow-session:2'],
  });

  assert.equal(close.status, 'WITHIN_TOLERANCE');
  assert.equal(close.paperTradingCanStillBeUseful, true);
  assert.equal(unrealistic.status, 'CALIBRATION_REQUIRED');
  assert.equal(unrealistic.paperTradingCanStillBeUseful, true);
});

test('MONEY-AUTO-ECON-01 broker compatibility is empirical rather than based on vendor preference', () => {
  const pass = assessBrokerExecutionQuality(
    {
      provider: 'broker-a',
      instrumentId: 'fx:EURUSD',
      environment: 'SHADOW',
      sampleSize: 250,
      medianSpreadBps: 2,
      p95SpreadBps: 7,
      medianSlippageBps: 1,
      p95SlippageBps: 4,
      rejectionRateBps: 20,
      p95LatencyMs: 250,
      observedAt: '2026-09-26T22:30:00Z',
      evidenceIds: ['shadow:broker-a'],
    },
    policy,
  );

  const reject = assessBrokerExecutionQuality(
    {
      provider: 'broker-b',
      instrumentId: 'fx:EURUSD',
      environment: 'SHADOW',
      sampleSize: 250,
      medianSpreadBps: 6,
      p95SpreadBps: 25,
      medianSlippageBps: 7,
      p95SlippageBps: 18,
      rejectionRateBps: 500,
      p95LatencyMs: 1200,
      observedAt: '2026-09-26T22:30:00Z',
      evidenceIds: ['shadow:broker-b'],
    },
    policy,
  );

  assert.equal(pass.status, 'PASS');
  assert.deepEqual(pass.reasonCodes, []);
  assert.equal(reject.status, 'REJECT');
  assert.ok(reject.reasonCodes.includes('P95_SPREAD_TOO_HIGH'));
  assert.ok(reject.reasonCodes.includes('P95_SLIPPAGE_TOO_HIGH'));
  assert.ok(reject.reasonCodes.includes('REJECTION_RATE_TOO_HIGH'));
  assert.ok(reject.reasonCodes.includes('P95_LATENCY_TOO_HIGH'));
  assert.equal(reject.canAuthorizeTrade, false);
});
