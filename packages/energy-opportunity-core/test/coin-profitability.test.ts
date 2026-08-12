import assert from 'node:assert/strict';
import test from 'node:test';
import { rankMiningProfitability } from '../src/coin-profitability.ts';
import type { MiningOpportunity } from '../src/coin-registry.ts';

function opportunity(symbol: string, compatible = true): MiningOpportunity {
  return {
    coin: { symbol, name: symbol, algorithm: symbol === 'XMR' ? 'randomx' : symbol === 'BTC' ? 'sha256' : 'scrypt', mergedMiningWith: symbol === 'DOGE' || symbol === 'LTC' ? ['DOGE', 'LTC'] : undefined },
    compatible,
    reasonCodes: compatible ? [] : ['ALGORITHM_UNSUPPORTED'],
  } as MiningOpportunity;
}

test('ranks opportunities by expected net per hour', () => {
  const ranked = rankMiningProfitability([
    { opportunity: opportunity('BTC'), grossRevenuePerHour: 1, electricityCostPerHour: 0.4, poolFeesPerHour: 0.05, confidence: 0.9 },
    { opportunity: opportunity('DOGE'), grossRevenuePerHour: 2, electricityCostPerHour: 0.5, poolFeesPerHour: 0.1, confidence: 0.95 },
    { opportunity: opportunity('XMR'), grossRevenuePerHour: 0.5, electricityCostPerHour: 0.1, poolFeesPerHour: 0.02, confidence: 0.8 },
  ]);
  assert.deepEqual(ranked.map(item => item.symbol), ['DOGE', 'BTC', 'XMR']);
  assert.deepEqual(ranked.map(item => item.expectedNetPerHour), [1.4, 0.55, 0.38]);
});

test('preserves incompatibility reasons and never makes an unsupported coin executable', () => {
  const [result] = rankMiningProfitability([
    { opportunity: opportunity('BTC', false), grossRevenuePerHour: 10, electricityCostPerHour: 1, poolFeesPerHour: 0, confidence: 1 },
  ]);
  assert.equal(result.compatible, false);
  assert.ok(result.reasonCodes.includes('ALGORITHM_UNSUPPORTED'));
  assert.ok(result.reasonCodes.includes('NOT_ELIGIBLE'));
});

test('includes electricity and pool fees in net economics', () => {
  const [result] = rankMiningProfitability([
    { opportunity: opportunity('LTC'), grossRevenuePerHour: 1, electricityCostPerHour: 0.25, poolFeesPerHour: 0.15, confidence: 0.9 },
  ]);
  assert.equal(result.expectedNetPerHour, 0.6);
});
