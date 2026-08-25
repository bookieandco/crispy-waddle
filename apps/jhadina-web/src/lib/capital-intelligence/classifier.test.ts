import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTransactionCandidate } from './classifier';

test('classifies explicit stock and crypto identifiers conservatively', () => {
  const stock = classifyTransactionCandidate({ id: '1', accountId: 'a', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z', description: 'AAPL purchase' });
  assert.equal(stock.status, 'classified');
  assert.equal(stock.candidate?.domain, 'equities');
  assert.equal(stock.candidate?.instrument, 'AAPL');

  const crypto = classifyTransactionCandidate({ id: '2', accountId: 'a', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z', description: 'Bitcoin buy BTC' });
  assert.equal(crypto.status, 'classified');
  assert.equal(crypto.candidate?.domain, 'crypto');
  assert.equal(crypto.candidate?.instrument, 'BTC');
});

test('does not guess an ambiguous transaction', () => {
  const result = classifyTransactionCandidate({ id: '3', accountId: 'a', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z', description: 'brokerage purchase' });
  assert.equal(result.status, 'unresolved');
  assert.equal(result.candidate, undefined);
});

test('does not classify descriptions containing multiple instruments', () => {
  const result = classifyTransactionCandidate({ id: '4', accountId: 'a', amount: -100, currency: 'USD', occurredAt: '2026-08-24T12:00:00Z', description: 'AAPL / MSFT rebalance' });
  assert.equal(result.status, 'unresolved');
});
