import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStockAlertRule,
  createStockWatchlistEntry,
  evaluateStockAlert,
  InMemoryStockWatchlistStore,
} from './stock-watchlist.js';
import type { StockQuote } from './stock-market-reality.js';

const quote = (bid: string, ask: string): StockQuote => ({
  quoteId: 'q1',
  instrumentId: 'stock:AAPL',
  venue: 'IEX',
  currency: 'USD',
  bidPrice: bid,
  askPrice: ask,
  observedAt: '2026-09-26T20:00:00Z',
  availableAt: '2026-09-26T20:00:00Z',
  receivedAt: '2026-09-26T20:00:01Z',
  provider: 'test',
  evidenceRef: 'e:q1',
  provenanceHash: 'p:q1',
});

test('watchlist normalizes symbols and stays configuration-only', () => {
  const entry = createStockWatchlistEntry({
    userId: 'u1',
    symbol: 'aapl',
    addedAt: '2026-09-26T20:00:00Z',
    evidenceIds: ['user:add'],
  });
  assert.equal(entry.symbol, 'AAPL');
  assert.equal(entry.instrumentId, 'stock:AAPL');
  assert.equal(entry.authority, 'USER_CONFIG_ONLY');
  assert.equal(entry.canAuthorizeTrade, false);
});

test('price alerts are attention only and never authorize a trade', () => {
  const rule = createStockAlertRule({
    alertId: 'a1',
    userId: 'u1',
    symbol: 'AAPL',
    condition: 'ABOVE',
    threshold: 200,
    createdAt: '2026-09-26T19:00:00Z',
    evidenceIds: ['user:alert'],
  });
  const result = evaluateStockAlert(rule, quote('200', '202'));
  assert.equal(result.triggered, true);
  assert.equal(result.authority, 'ATTENTION_ONLY');
  assert.equal(result.canAuthorizeTrade, false);
});

test('movement alert measures bps from its explicit reference', () => {
  const rule = createStockAlertRule({
    alertId: 'a2',
    userId: 'u1',
    symbol: 'AAPL',
    condition: 'MOVE_FROM_REFERENCE_BPS',
    threshold: 100,
    referencePrice: 100,
    createdAt: '2026-09-26T19:00:00Z',
    evidenceIds: ['user:alert'],
  });
  const result = evaluateStockAlert(rule, quote('101', '101'));
  assert.equal(result.triggered, true);
  assert.equal(Math.round(result.observedMoveBps!), 100);
});

test('in-memory store is user scoped', () => {
  const store = new InMemoryStockWatchlistStore();
  store.upsertEntry(
    createStockWatchlistEntry({
      userId: 'u1',
      symbol: 'AAPL',
      addedAt: '2026-09-26T20:00:00Z',
      evidenceIds: ['u1'],
    }),
  );
  store.upsertEntry(
    createStockWatchlistEntry({
      userId: 'u2',
      symbol: 'MSFT',
      addedAt: '2026-09-26T20:00:00Z',
      evidenceIds: ['u2'],
    }),
  );
  assert.deepEqual(store.listEntries('u1').map((x) => x.symbol), ['AAPL']);
  assert.deepEqual(store.listEntries('u2').map((x) => x.symbol), ['MSFT']);
});
