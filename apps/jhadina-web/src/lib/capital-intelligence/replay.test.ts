import assert from 'node:assert/strict';
import test from 'node:test';
import { replayTransactions } from './replay';

const classification = () => ({ domain: 'equities' as const, instrument: 'AAPL', side: 'buy' as const, quantity: 1, unitPrice: { amount: 100, currency: 'USD' } });

const tx = (id: string, occurredAt: string) => ({ id, accountId: 'acct', amount: -100, currency: 'USD', occurredAt, description: 'broker purchase' });

test('replays historical transactions deterministically and idempotently', () => {
  const source = [tx('2', '2026-08-25T00:00:00Z'), tx('1', '2026-08-24T00:00:00Z'), tx('1', '2026-08-24T00:00:00Z')];
  const first = replayTransactions(source, classification);
  assert.deepEqual(first.applied, ['1', '2']);
  assert.equal(first.state.positions[0]?.quantity, 2);
  assert.deepEqual(first.skipped, []);

  const second = replayTransactions(source, classification, first.state);
  assert.equal(second.applied.length, 0);
  assert.equal(second.skipped.length, 3);
  assert.equal(second.state.positions[0]?.quantity, 2);
});

test('does not guess unclassified transactions', () => {
  const result = replayTransactions([tx('1', '2026-08-24T00:00:00Z')], () => undefined);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.unresolved, ['1']);
  assert.equal(result.errors.length, 0);
});

test('does not partially apply an invalid sale', () => {
  const result = replayTransactions([
    { ...tx('buy', '2026-08-24T00:00:00Z'), amount: -100 },
    { id: 'sell', accountId: 'acct', amount: 200, currency: 'USD', occurredAt: '2026-08-25T00:00:00Z', description: 'sale' },
  ], (transaction) => transaction.id === 'buy' ? classification() : ({ domain: 'equities' as const, instrument: 'AAPL', side: 'sell' as const, quantity: 2, unitPrice: { amount: 100, currency: 'USD' } }));
  assert.deepEqual(result.applied, ['buy']);
  assert.equal(result.errors[0]?.code, 'POSITION_INSUFFICIENT_LOTS');
  assert.equal(result.state.positions[0]?.quantity, 1);
  assert.equal(result.state.lots[0]?.quantity, 1);
});
