import assert from 'node:assert/strict';
import test from 'node:test';
import { electricityExpenseUsd, isGovernedMiningFinancialEvent } from '../src/financial-events.ts';

test('calculates electricity expense from watts, duration, and tariff', () => {
  assert.equal(electricityExpenseUsd(1000, 3600, 0.20), 0.2);
});

test('accepts only versioned immutable governed events', () => {
  assert.equal(isGovernedMiningFinancialEvent({
    schemaVersion: 1,
    eventId: 'evt-1',
    kind: 'electricity_expense_observed',
    resourceId: 'bitaxe-01',
    occurredAt: '2026-08-11T00:00:00Z',
    currency: 'USD',
    source: 'meter',
    immutable: true,
    amountUsd: 0.02,
    powerWatts: 100,
    durationSeconds: 3600,
    rateUsdPerKwh: 0.2,
  }), true);
  assert.equal(isGovernedMiningFinancialEvent({ schemaVersion: 1, immutable: false }), false);
});
