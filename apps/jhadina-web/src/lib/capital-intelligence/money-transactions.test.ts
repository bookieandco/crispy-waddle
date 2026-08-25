import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMoneyTransaction } from './money-transactions';

test('requires explicit classification before a money transaction becomes a position transaction', () => {
  const result = classifyMoneyTransaction(
    { id: 'bank-1', accountId: 'acct-1', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z', description: 'broker purchase' },
    { domain: 'equities', instrument: 'AAPL', side: 'buy', quantity: 1, unitPrice: { amount: 100, currency: 'USD' } },
  );
  assert.equal(result.sourceTransactionId, 'bank-1');
  assert.equal(result.instrument, 'AAPL');
  assert.equal(result.side, 'buy');
});

test('rejects invalid quantities instead of guessing', () => {
  assert.throws(() => classifyMoneyTransaction(
    { id: 'bank-2', accountId: 'acct-1', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z' },
    { domain: 'crypto', instrument: 'BTC', side: 'buy', quantity: 0, unitPrice: { amount: 100000, currency: 'USD' } },
  ), /CAPITAL_TRANSACTION_INVALID/);
});
