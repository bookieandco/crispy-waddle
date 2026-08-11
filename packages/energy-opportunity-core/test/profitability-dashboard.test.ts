import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMiningProfitabilityDashboard } from '../src/profitability-dashboard.ts';
import type { MiningFinancialEvent } from '../src/financial-events.ts';

test('builds a read-only profitability dashboard from governed events', () => {
  const events: MiningFinancialEvent[] = [
    {
      schemaVersion: 1, eventId: 'e1', kind: 'mining_economics_projected', resourceId: 'bitaxe-01',
      occurredAt: '2026-08-11T00:00:00Z', currency: 'USD', source: 'energy-opportunity-core', immutable: true,
      estimatedGrossPerHour: 0.10, estimatedElectricityPerHour: 0.03, estimatedNetPerHour: 0.07, confidence: 0.9,
    },
    {
      schemaVersion: 1, eventId: 'e2', kind: 'electricity_expense_observed', resourceId: 'bitaxe-01',
      occurredAt: '2026-08-11T01:00:00Z', currency: 'USD', source: 'meter', immutable: true,
      amountUsd: 0.03, powerWatts: 150, durationSeconds: 3600, rateUsdPerKwh: 0.20,
    },
    {
      schemaVersion: 1, eventId: 'e3', kind: 'mining_payout_verified', resourceId: 'bitaxe-01',
      occurredAt: '2026-08-11T02:00:00Z', currency: 'BTC', source: 'bitcoin-core', immutable: true,
      walletAddress: 'bc1qmine', txid: 'tx-1', amountBtc: 0.00001, confirmations: 2, verifiedAt: '2026-08-11T02:00:00Z',
    },
  ];

  const dashboard = buildMiningProfitabilityDashboard('bitaxe-01', events);
  assert.equal(dashboard.eventCount, 3);
  assert.equal(dashboard.electricityUsd, 0.03);
  assert.equal(dashboard.realizedBtc, 0.00001);
  assert.equal(dashboard.status, 'profitable');
});
