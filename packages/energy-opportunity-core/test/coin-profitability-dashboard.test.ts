import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCoinProfitabilityDashboard } from '../src/coin-profitability-dashboard.ts';
import type { CoinMoneyProjection } from '../src/coin-moneycore-bridge.ts';
import type { CoinProfitability } from '../src/coin-profitability.ts';

const profitability: CoinProfitability[] = [
  { symbol: 'BTC', compatible: true, expectedNetPerHour: 0.55, confidence: 0.9, reasonCodes: ['ECONOMICS_EVALUATED'] },
  { symbol: 'DOGE', compatible: true, expectedNetPerHour: 1.4, confidence: 0.95, reasonCodes: ['ECONOMICS_EVALUATED'] },
  { symbol: 'LTC', compatible: true, expectedNetPerHour: 0.7, confidence: 0.85, reasonCodes: ['ECONOMICS_EVALUATED'] },
  { symbol: 'XMR', compatible: false, expectedNetPerHour: 0.9, confidence: 0.8, reasonCodes: ['ALGORITHM_UNSUPPORTED'] },
];

const projections: CoinMoneyProjection[] = [
  { symbol: 'BTC', currency: 'USD', expectedNetPerHour: 0.55, expectedGrossPerHour: 1, electricityPerHour: 0.4, poolFeesPerHour: 0.05, confidence: 0.9, status: 'projected' },
  { symbol: 'DOGE', currency: 'USD', expectedNetPerHour: 1.4, expectedGrossPerHour: 2, electricityPerHour: 0.5, poolFeesPerHour: 0.1, confidence: 0.95, status: 'projected' },
  { symbol: 'LTC', currency: 'USD', expectedNetPerHour: 0.7, expectedGrossPerHour: 1.1, electricityPerHour: 0.3, poolFeesPerHour: 0.1, confidence: 0.85, status: 'projected' },
];

test('ranks projected opportunities and selects the compatible recommendation', () => {
  const dashboard = buildCoinProfitabilityDashboard(profitability, projections, 2.25, '2026-08-12T12:00:00.000Z');
  assert.deepEqual(dashboard.projected.map(item => item.symbol), ['DOGE', 'LTC', 'BTC']);
  assert.equal(dashboard.recommendedSymbol, 'DOGE');
  assert.equal(dashboard.projectedNetPerHour, 1.4);
  assert.equal(dashboard.realizedNet, 2.25);
  assert.equal(dashboard.generatedAt, '2026-08-12T12:00:00.000Z');
});

test('does not recommend an incompatible coin', () => {
  const dashboard = buildCoinProfitabilityDashboard(
    [{ symbol: 'XMR', compatible: false, expectedNetPerHour: 10, confidence: 1, reasonCodes: ['ALGORITHM_UNSUPPORTED'] }],
    [{ symbol: 'XMR', currency: 'USD', expectedNetPerHour: 10, expectedGrossPerHour: 12, electricityPerHour: 1, poolFeesPerHour: 1, confidence: 1, status: 'projected' }],
  );
  assert.equal(dashboard.recommendedSymbol, null);
  assert.equal(dashboard.projectedNetPerHour, 10);
});

test('keeps projected and realized values separate', () => {
  const dashboard = buildCoinProfitabilityDashboard(profitability, projections, -0.75, '2026-08-12T12:00:00.000Z');
  assert.equal(dashboard.projectedNetPerHour, 1.4);
  assert.equal(dashboard.realizedNet, -0.75);
  assert.notEqual(dashboard.projectedNetPerHour, dashboard.realizedNet);
});

test('handles an empty opportunity set safely', () => {
  const dashboard = buildCoinProfitabilityDashboard([], [], 0, '2026-08-12T12:00:00.000Z');
  assert.equal(dashboard.recommendedSymbol, null);
  assert.equal(dashboard.projectedNetPerHour, 0);
  assert.equal(dashboard.realizedNet, 0);
  assert.deepEqual(dashboard.projected, []);
});
