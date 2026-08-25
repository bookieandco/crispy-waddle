import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileTransactions } from './reconciliation';

test('reports source transactions that have not entered the capital projection', () => {
  const result = reconcileTransactions(
    [
      { id: 'bank-1', accountId: 'acct', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z' },
      { id: 'bank-2', accountId: 'acct', amount: -200, currency: 'USD', occurredAt: '2026-08-24T13:00:00Z' },
    ],
    [{ id: 'capital-bank-1', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 1, unitPrice: { amount: 100, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z' }],
  );
  assert.ok(result.some((r) => r.sourceTransactionId === 'bank-1' && r.status === 'matched'));
  assert.ok(result.some((r) => r.sourceTransactionId === 'bank-2' && r.status === 'missing-classification'));
});

test('detects duplicate projections and projections without a source event', () => {
  const result = reconcileTransactions(
    [{ id: 'bank-1', accountId: 'acct', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z' }],
    [
      { id: 'capital-bank-1', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 1, unitPrice: { amount: 100, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z' },
      { id: 'capital-bank-1', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 1, unitPrice: { amount: 100, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z' },
      { id: 'capital-ghost', accountId: 'acct', instrument: 'BTC', domain: 'crypto', side: 'buy', quantity: 1, unitPrice: { amount: 100, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z' },
    ],
  );
  assert.ok(result.some((r) => r.status === 'duplicate'));
  assert.ok(result.some((r) => r.status === 'invalid'));
});
