import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileRealizedProfitability } from '../src/realized-profitability.ts';
import type { MiningFinancialEvent } from '../src/financial-events.ts';

const base = { resourceId: 'asic-1', occurredAt: '2026-08-12T12:00:00.000Z' };

function payout(amountBtc: number, verified = true): MiningFinancialEvent {
  return {
    ...base,
    kind: 'mining_payout_verified',
    amountBtc,
    transactionId: verified ? `verified-${amountBtc}` : `unverified-${amountBtc}`,
    confirmations: verified ? 6 : 0,
    payoutAddress: 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg',
  };
}

test('counts only verified payouts and excludes zero-confirmation payouts', () => {
  const result = reconcileRealizedProfitability({
    resourceId: 'asic-1',
    btcUsdRate: 100000,
    events: [payout(0.001), payout(0.002, false)],
  });

  assert.equal(result.verifiedBtc, 0.001);
  assert.equal(result.verifiedPayoutCount, 1);
  assert.equal(result.realizedGrossUsd, 100);
});

test('converts verified BTC to USD only when a valuation is supplied', () => {
  const events: MiningFinancialEvent[] = [payout(0.002)];
  const withoutRate = reconcileRealizedProfitability({ resourceId: 'asic-1', events });
  const withRate = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events });

  assert.equal(withoutRate.verifiedBtc, 0.002);
  assert.equal(withoutRate.realizedGrossUsd, 0);
  assert.equal(withoutRate.realizedNetUsd, null);
  assert.equal(withRate.realizedGrossUsd, 180);
  assert.equal(withRate.realizedNetUsd, 180);
});

test('deducts observed electricity from realized gross proceeds', () => {
  const events: MiningFinancialEvent[] = [
    payout(0.002),
    { ...base, kind: 'electricity_expense_observed', amountUsd: 35, currency: 'USD', source: 'meter' },
  ];
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events });

  assert.equal(result.realizedGrossUsd, 180);
  assert.equal(result.electricityUsd, 35);
  assert.equal(result.realizedNetUsd, 145);
});

test('calculates projected-vs-realized variance', () => {
  const events: MiningFinancialEvent[] = [
    payout(0.002),
    { ...base, kind: 'electricity_expense_observed', amountUsd: 35, currency: 'USD', source: 'meter' },
    {
      ...base,
      kind: 'mining_economics_projected',
      estimatedGrossPerHour: 200,
      estimatedNetPerHour: 160,
      electricityCostPerHour: 35,
      providerFeesPerHour: 5,
      confidence: 0.9,
    },
  ];
  const result = reconcileRealizedProfitability({ resourceId: 'asic-1', btcUsdRate: 90000, events });

  assert.equal(result.projectedGrossUsd, 200);
  assert.equal(result.projectedNetUsd, 165);
  assert.equal(result.realizedNetUsd, 145);
  assert.equal(result.varianceUsd, -20);
});

test('ignores events belonging to another resource', () => {
  const result = reconcileRealizedProfitability({
    resourceId: 'asic-1',
    btcUsdRate: 100000,
    events: [
      payout(0.001),
      { ...base, resourceId: 'asic-2', kind: 'electricity_expense_observed', amountUsd: 999, currency: 'USD', source: 'meter' },
    ],
  });

  assert.equal(result.verifiedBtc, 0.001);
  assert.equal(result.electricityUsd, 0);
});
