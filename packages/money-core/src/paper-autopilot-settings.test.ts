import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaperAutopilotSettings,
} from './paper-autopilot-settings.js';

test('paper settings separate account risk budget from price stop distance', () => {
  const settings = createPaperAutopilotSettings({
    userId: 'u1',
    accountId: 'paper-acct',
    mode: 'PAPER_AUTO_REDUCED',
    stockFeed: 'iex',
    strategyId: 'stock-baseline-sma-20-50',
    baseOrderNotionalMinor: '100000',
    maxOrderNotionalMinor: '500000',
    maximumConcurrentPositions: 5,
    riskFractionBps: 50,
    stopLossBps: 200,
    takeProfitBps: 400,
    updatedAt: '2026-09-27T00:00:00Z',
    evidenceIds: ['user:settings'],
  });
  assert.equal(settings.riskFractionBps, 50);
  assert.equal(settings.stopLossBps, 200);
  assert.equal(settings.takeProfitBps, 400);
  assert.equal(settings.canAuthorizeLive, false);
});

test('paper settings reject oversized account-risk fractions independently of stop geometry', () => {
  assert.throws(
    () =>
      createPaperAutopilotSettings({
        userId: 'u1',
        accountId: 'paper-acct',
        mode: 'ADVISE',
        stockFeed: 'iex',
        strategyId: 'stock-baseline-sma-20-50',
        baseOrderNotionalMinor: '100000',
        maxOrderNotionalMinor: '500000',
        maximumConcurrentPositions: 5,
        riskFractionBps: 500,
        stopLossBps: 200,
        takeProfitBps: 400,
        updatedAt: '2026-09-27T00:00:00Z',
        evidenceIds: ['user:settings'],
      }),
    /MONEY_PAPER_SETTINGS_RISK_FRACTION_INVALID/,
  );
});
