import assert from 'node:assert/strict';
import test from 'node:test';
import { writeReplayProjection, type ProjectionStore } from './projection-writer';

test('writes only validated projection state and delegates idempotency to unique store operations', () => {
  const calls: string[] = [];
  const store: ProjectionStore = {
    upsertTransaction: (row) => calls.push(`tx:${row.sourceTransactionId}`),
    upsertPosition: (row) => calls.push(`position:${row.id}`),
    upsertLot: (row) => calls.push(`lot:${row.id}`),
  };
  writeReplayProjection(
    [{ sourceTransactionId: 'source-1', accountId: 'acct', domain: 'equities', instrument: 'AAPL', side: 'buy', quantity: 1, unitPrice: 100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z' }],
    { positions: [], lots: [], appliedSourceTransactionIds: ['source-1'] },
    store,
  );
  assert.deepEqual(calls, ['tx:source-1']);
});
