import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileRealizedProfitability } from '../src/realized-profitability.ts';
import type { MiningFinancialEvent } from '../src/financial-events.ts';

const address = 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg';
const base = { schemaVersion: 1 as const, resourceId: 'asic-1', occurredAt: '2026-08-12T12:00:00.000Z', immutable: true as const };

function payout(amountBtc: number, confirmations = 6): MiningFinancialEvent {
  return { ...base, kind: 'mining_payout_verified', currency: 'BTC', source: 'bitcoin-core', eventId: `payout-${amountBtc}-${confirmations}`, walletAddress: address, txid: `tx-${amountBtc}-${confirmations}`, amountBtc, confirmations, verifiedAt: base.occurredAt };
}
function electricity(amountUsd: number): MiningFinancialEvent {
  return { ...base, kind: 'electricity_expense_observed', currency: 'USD', source: 'meter', eventId: `electricity-${amountUsd}`, amountUsd, powerWatts: 1000, durationSeconds: 3600, rateUsdPerKwh: amountUsd };
}
function projection(gross: number, net: number): MiningFinancialEvent {
  return { ...base, kind: 'mining_economics_projected', currency: 'USD', source: 'energy-opportunity-core', eventId: `projection-${gross}-${net}`, estimatedGrossPerHour: gross, estimatedElectricityPerHour: gross - net, estimatedNetPerHour: net, confidence: 0.9 };
}

test('counts only confirmed payouts and excludes zero-confirmation payouts', () => {
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 100000, events: [payout(0.001), payout(0.002, 0)] });
  assert.equal(result.verifiedBtc, 0.001); assert.equal(result.verifiedPayoutCount, 1); assert.equal(result.realizedGrossUsd, 100);
});

test('converts verified BTC to USD only when a valuation is supplied', () => {
  const events: MiningFinancialEvent[] = [payout(0.002)];
  const withoutRate = reconcileRealizedProfitability({ resourceId: 'asic-1', events });
  const withRate = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events });
  assert.equal(withoutRate.verifiedBtc, 0.002); assert.equal(withoutRate.realizedGrossUsd, 0); assert.equal(withoutRate.realizedNetUsd, null);
  assert.equal(withRate.realizedGrossUsd, 180); assert.equal(withRate.realizedNetUsd, 180);
});

test('deducts observed electricity from realized gross proceeds', () => {
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events: [payout(0.002), electricity(35)] });
  assert.equal(result.realizedGrossUsd, 180); assert.equal(result.electricityUsd, 35); assert.equal(result.realizedNetUsd, 145);
});

test('calculates projected-vs-realized variance', () => {
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events: [payout(0.002), electricity(35), projection(200, 160)] });
  assert.equal(result.projectedGrossUsd, 200); assert.equal(result.projectedNetUsd, 165); assert.equal(result.realizedNetUsd, 145); assert.equal(result.varianceUsd, -20);
});

test('ignores events belonging to another resource', () => {
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 100000, events: [payout(0.001), { ...electricity(999), resourceId: 'asic-2' }] });
  assert.equal(result.verifiedBtc, 0.001); assert.equal(result.electricityUsd, 0);
});
