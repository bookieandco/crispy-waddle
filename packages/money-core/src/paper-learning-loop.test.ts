import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaperDecision,
  evaluatePaperAutopilot,
  learnFromPaperDecision,
  resolvePaperDecision,
} from './paper-learning-loop.js';

test('paper loop learns from NO_TRADE as a first-class decision', () => {
  const decision = createPaperDecision({
    decisionId: 'decision:1',
    paperRunId: 'run:1',
    accountId: 'paper:acct1',
    instrumentId: 'stock:AAPL',
    strategyId: 'stock-baseline-sma-20-50',
    scenarioId: 'daily:aapl',
    action: 'NO_TRADE',
    signal: 'HOLD',
    referencePrice: 100,
    evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    reasonCodes: ['NO_SIGNAL'],
    informationCutoff: '2026-09-25T20:00:00Z',
    createdAt: '2026-09-25T20:00:01Z',
    evidenceIds: ['quote:1', 'bars:1'],
  });
  const resolution = resolvePaperDecision(decision, {
    resolvedAt: '2026-09-26T20:00:00Z',
    realizedReturnBps: -250,
    maxFavorableExcursionBps: 50,
    maxAdverseExcursionBps: -300,
    resolutionBasis: 'COUNTERFACTUAL_MARK',
    evidenceIds: ['resolution:1'],
  });
  const learning = learnFromPaperDecision(decision, resolution);

  assert.equal(learning.action, 'NO_TRADE');
  assert.equal(learning.avoidedLossBps, 250);
  assert.equal(learning.missedGainBps, 0);
  assert.ok(learning.decisionQualityScore > 0);
  assert.equal(learning.canAuthorizeLive, false);
});

test('NO_TRADE is penalized for a missed positive move rather than silently rewarded', () => {
  const decision = createPaperDecision({
    decisionId: 'decision:2',
    paperRunId: 'run:2',
    accountId: 'paper:acct1',
    instrumentId: 'stock:MSFT',
    strategyId: 'stock-baseline-sma-20-50',
    scenarioId: 'daily:msft',
    action: 'NO_TRADE',
    signal: 'HOLD',
    referencePrice: 100,
    evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    reasonCodes: ['NO_SIGNAL'],
    informationCutoff: '2026-09-25T20:00:00Z',
    createdAt: '2026-09-25T20:00:01Z',
    evidenceIds: ['quote:2'],
  });
  const learning = learnFromPaperDecision(
    decision,
    resolvePaperDecision(decision, {
      resolvedAt: '2026-09-26T20:00:00Z',
      realizedReturnBps: 300,
      maxFavorableExcursionBps: 350,
      maxAdverseExcursionBps: -20,
    resolutionBasis: 'COUNTERFACTUAL_MARK',
      evidenceIds: ['resolution:2'],
    }),
  );

  assert.equal(learning.missedGainBps, 300);
  assert.equal(learning.avoidedLossBps, 0);
  assert.ok(learning.decisionQualityScore < 0);
});

test('paper autopilot cannot operate against a live account', () => {
  const result = evaluatePaperAutopilot({
    mode: 'PAPER_AUTO',
    accountEnvironment: 'LIVE',
    signal: 'LONG_ENTRY',
        referencePrice: 100,
        evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    mimsStatus: 'PASS',
    hardRiskStatus: 'PASS',
    behavioralRiskStatus: 'PASS',
    providerHealth: 'HEALTHY',
    unresolvedExecutionCount: 0,
  });
  assert.equal(result.disposition, 'HALT');
  assert.ok(result.reasonCodes.includes('PAPER_ENVIRONMENT_REQUIRED'));
  assert.equal(result.canAuthorizeLive, false);
});

test('full paper auto requires supported calibration while reduced mode stays bounded', () => {
  const insufficient = evaluatePaperAutopilot({
    mode: 'PAPER_AUTO',
    accountEnvironment: 'PAPER',
    signal: 'LONG_ENTRY',
        referencePrice: 100,
        evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    mimsStatus: 'PASS',
    hardRiskStatus: 'PASS',
    behavioralRiskStatus: 'PASS',
    providerHealth: 'HEALTHY',
    unresolvedExecutionCount: 0,
  });
  assert.equal(insufficient.disposition, 'NO_TRADE');
  assert.ok(
    insufficient.reasonCodes.includes(
      'PAPER_AUTO_REQUIRES_SUPPORTED_CALIBRATION',
    ),
  );

  const reduced = evaluatePaperAutopilot({
    mode: 'PAPER_AUTO_REDUCED',
    accountEnvironment: 'PAPER',
    signal: 'LONG_ENTRY',
        referencePrice: 100,
        evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    mimsStatus: 'PASS',
    hardRiskStatus: 'PASS',
    behavioralRiskStatus: 'PASS',
    providerHealth: 'HEALTHY',
    unresolvedExecutionCount: 0,
  });
  assert.equal(reduced.disposition, 'PAPER_TRADE_ELIGIBLE');
  assert.equal(reduced.notionalMultiplierBps, 2500);
});

test('review/degraded state becomes NO_TRADE rather than a paper order', () => {
  const result = evaluatePaperAutopilot({
    mode: 'PAPER_AUTO_REDUCED',
    accountEnvironment: 'PAPER',
    signal: 'LONG_ENTRY',
        referencePrice: 100,
        evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
    mimsStatus: 'REVIEW',
    hardRiskStatus: 'PASS',
    behavioralRiskStatus: 'PASS',
    providerHealth: 'DEGRADED',
    unresolvedExecutionCount: 0,
  });
  assert.equal(result.disposition, 'NO_TRADE');
  assert.equal(result.notionalMultiplierBps, 0);
});

test('HOLD can never become a trade action', () => {
  assert.throws(
    () =>
      createPaperDecision({
        decisionId: 'decision:bad',
        paperRunId: 'run:bad',
        accountId: 'paper:acct',
        instrumentId: 'stock:AAPL',
        strategyId: 's',
        scenarioId: 'x',
        action: 'PAPER_TRADE',
        side: 'BUY',
        signal: 'HOLD',
    referencePrice: 100,
    evaluationHorizon: 'NEXT_COMPLETED_DAILY_BAR',
        reasonCodes: ['bad'],
        informationCutoff: '2026-09-25T20:00:00Z',
        createdAt: '2026-09-25T20:00:01Z',
        evidenceIds: ['e'],
      }),
    /MONEY_PAPER_LOOP_HOLD_MUST_BE_NO_TRADE/,
  );
});
