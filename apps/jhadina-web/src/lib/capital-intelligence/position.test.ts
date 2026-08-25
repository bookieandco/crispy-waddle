import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBuy, matchLotsForSale } from './position';

test('builds a position and lot from a buy', () => {
  const result = applyBuy(undefined, {
    id: 't1', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 10,
    unitPrice: { amount: 100, currency: 'USD' }, fees: { amount: 5, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z',
  });
  assert.equal(result.position.quantity, 10);
  assert.equal(result.position.averageCost.amount, 10.5);
  assert.equal(result.lot.quantity, 10);
});

test('matches a sale FIFO and calculates realized PnL', () => {
  const first = applyBuy(undefined, {
    id: 't1', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 10,
    unitPrice: { amount: 100, currency: 'USD' }, occurredAt: '2026-08-24T12:00:00Z',
  });
  const second = applyBuy(first.position, {
    id: 't2', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'buy', quantity: 10,
    unitPrice: { amount: 120, currency: 'USD' }, occurredAt: '2026-08-25T12:00:00Z',
  });
  const matches = matchLotsForSale([first.lot, second.lot], {
    id: 't3', accountId: 'acct', instrument: 'AAPL', domain: 'equities', side: 'sell', quantity: 15,
    unitPrice: { amount: 130, currency: 'USD' }, occurredAt: '2026-08-26T12:00:00Z',
  });
  assert.deepEqual(matches.map((m) => m.quantity), [10, 5]);
  assert.equal(matches[0].realizedPnl.amount, 300);
  assert.equal(matches[1].realizedPnl.amount, 50);
});
