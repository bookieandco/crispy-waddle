import assert from 'node:assert/strict';
import test from 'node:test';
import { appendProfitabilitySnapshot, buildProfitabilitySnapshotEvent, InMemoryProfitabilitySnapshotLedger } from '../src/profitability-snapshot.ts';
import type { RealizedProfitability } from '../src/realized-profitability.ts';

const reconciliation: RealizedProfitability = {
  resourceId: 'asic-1',
  verifiedBtc: 0.002,
  realizedGrossUsd: 180,
  electricityUsd: 35,
  realizedNetUsd: 145,
  projectedGrossUsd: 200,
  projectedNetUsd: 165,
  varianceUsd: -20,
  verifiedPayoutCount: 1,
};

test('builds an immutable Money Core profitability snapshot', () => {
  const event = buildProfitabilitySnapshotEvent({
    reconciliation,
    eventIds: ['payout-1', 'electricity-1', 'projection-1'],
    occurredAt: '2026-08-12T12:00:00.000Z',
  });

  assert.ok(event);
  assert.equal(event.kind, 'mining_profitability_snapshot');
  assert.equal(event.source, 'money-core');
  assert.equal(event.immutable, true);
  assert.equal(event.realizedBtc, 0.002);
  assert.equal(event.realizedUsd, 180);
  assert.equal(event.electricityUsd, 35);
  assert.equal(event.netUsd, 145);
});

test('does not emit a USD snapshot without BTC valuation', () => {
  const event = buildProfitabilitySnapshotEvent({
    reconciliation: { ...reconciliation, realizedNetUsd: null },
    eventIds: ['payout-1'],
    occurredAt: '2026-08-12T12:00:00.000Z',
  });

  assert.equal(event, null);
});

test('is idempotent for the same source event set', () => {
  const ledger = new InMemoryProfitabilitySnapshotLedger();
  const input = {
    reconciliation,
    eventIds: ['payout-1', 'electricity-1'],
    occurredAt: '2026-08-12T12:00:00.000Z',
  };

  const first = appendProfitabilitySnapshot(ledger, input);
  const second = appendProfitabilitySnapshot(ledger, input);

  assert.ok(first);
  assert.strictEqual(second, first);
  assert.equal(ledger.has(first.eventId), true);
});

test('produces a different event identity for a different source event set', () => {
  const first = buildProfitabilitySnapshotEvent({ ...reconciliationInput(), eventIds: ['payout-1'] });
  const second = buildProfitabilitySnapshotEvent({ ...reconciliationInput(), eventIds: ['payout-2'] });

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.eventId, second.eventId);
});

function reconciliationInput() {
  return {
    reconciliation,
    occurredAt: '2026-08-12T12:00:00.000Z',
  };
}
