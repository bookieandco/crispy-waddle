import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateStockSmaBaseline,
} from './stock-paper-baseline-strategy.js';
import type { StockBar } from './stock-market-reality.js';

function bars(closes: readonly number[]): StockBar[] {
  return closes.map((value, index) => {
    const startsAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
    const endsAt = new Date(Date.UTC(2026, 0, index + 2)).toISOString();
    return {
      barId: 'bar:' + index,
      instrumentId: 'stock:TEST',
      venue: 'IEX',
      currency: 'USD',
      interval: '1D',
      startsAt,
      endsAt,
      observedAt: startsAt,
      availableAt: startsAt,
      receivedAt: endsAt,
      open: String(value),
      high: String(value + 1),
      low: String(Math.max(0.01, value - 1)),
      close: String(value),
      volume: '100',
      adjustmentStatus: 'UNADJUSTED',
      provider: 'test',
      evidenceRef: 'e:' + index,
      provenanceHash: 'p:' + index,
    } as const;
  });
}

test('20/50 baseline emits long entry only on an actual upward crossover', () => {
  const xs = [...Array.from({ length: 50 }, () => 100), 200];
  const decision = evaluateStockSmaBaseline(bars(xs));
  assert.equal(decision.signal, 'LONG_ENTRY');
  assert.ok(decision.previousFast <= decision.previousSlow);
  assert.ok(decision.currentFast > decision.currentSlow);
  assert.equal(decision.canAuthorizeLive, false);
});

test('20/50 baseline emits exit only on an actual downward crossover', () => {
  const xs = [...Array.from({ length: 50 }, () => 100), 1];
  const decision = evaluateStockSmaBaseline(bars(xs));
  assert.equal(decision.signal, 'EXIT');
  assert.ok(decision.previousFast >= decision.previousSlow);
  assert.ok(decision.currentFast < decision.currentSlow);
});

test('20/50 baseline refuses insufficient or non-chronological history', () => {
  assert.throws(
    () => evaluateStockSmaBaseline(bars(Array.from({ length: 50 }, () => 100))),
    /MONEY_STOCK_BASELINE_REQUIRES_51_BARS/,
  );

  const xs = bars(Array.from({ length: 51 }, () => 100));
  xs[50] = { ...xs[50]!, startsAt: xs[49]!.startsAt };
  assert.throws(
    () => evaluateStockSmaBaseline(xs),
    /MONEY_STOCK_BASELINE_BARS_NOT_CHRONOLOGICAL/,
  );
});
