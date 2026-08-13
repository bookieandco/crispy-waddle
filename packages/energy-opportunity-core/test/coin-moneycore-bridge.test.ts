import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCoinMoney } from '../src/coin-moneycore-bridge.ts';

test('projects ranked coin economics without turning estimates into realized money', () => {
  const result = projectCoinMoney({
    profitability: {
      symbol: 'DOGE',
      compatible: true,
      expectedNetPerHour: 1.35,
      confidence: 0.92,
      reasonCodes: ['ECONOMICS_EVALUATED'],
    },
    grossRevenuePerHour: 1.5,
    electricityCostPerHour: 0.1,
    poolFeesPerHour: 0.05,
  });

  assert.equal(result.symbol, 'DOGE');
  assert.equal(result.currency, 'USD');
  assert.equal(result.status, 'projected');
  assert.equal(result.expectedGrossPerHour, 1.5);
  assert.equal(result.electricityPerHour, 0.1);
  assert.equal(result.poolFeesPerHour, 0.05);
  assert.equal(result.expectedNetPerHour, 1.35);
  assert.equal(result.confidence, 0.92);
});

test('normalizes negative financial inputs while preserving the profitability projection', () => {
  const result = projectCoinMoney({
    profitability: {
      symbol: 'BTC',
      compatible: true,
      expectedNetPerHour: 0.4,
      confidence: 0.8,
      reasonCodes: ['ECONOMICS_EVALUATED'],
    },
    grossRevenuePerHour: -2,
    electricityCostPerHour: -0.2,
    poolFeesPerHour: -0.1,
  });

  assert.equal(result.expectedGrossPerHour, 0);
  assert.equal(result.electricityPerHour, 0);
  assert.equal(result.poolFeesPerHour, 0);
  assert.equal(result.expectedNetPerHour, 0.4);
  assert.equal(result.status, 'projected');
});
