import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPACA_STOCK_DATA_BASE_URL,
  AlpacaStockMarketDataClient,
} from './alpaca-stock-market-data.js';
import type { HttpClient } from './read-only-http-bank-adapter.js';

function fakeFetch(log: string[]): HttpClient {
  return async (input) => {
    const url = String(input);
    log.push(url);

    if (url.includes('/v2/stocks/snapshots')) {
      return new Response(
        JSON.stringify({
          snapshots: {
            AAPL: {
              latestQuote: {
                t: '2026-09-25T19:59:59Z',
                bp: 199.9,
                ap: 200.1,
                bs: 10,
                as: 12,
                bx: 'V',
                ax: 'V',
                z: 'C',
              },
            },
          },
        }),
        { status: 200, headers: { 'X-Request-ID': 'req-snapshot' } },
      );
    }

    if (url.includes('/v2/stocks/AAPL/bars')) {
      return new Response(
        JSON.stringify({
          bars: [
            { t: '2026-09-24T04:00:00Z', o: 195, h: 201, l: 194, c: 199, v: 100000, n: 1000 },
            { t: '2026-09-25T04:00:00Z', o: 199, h: 202, l: 198, c: 200, v: 120000, n: 1200 },
          ],
          next_page_token: null,
        }),
        { status: 200, headers: { 'X-Request-ID': 'req-bars' } },
      );
    }

    return new Response('{}', { status: 404, headers: { 'X-Request-ID': 'req-404' } });
  };
}

const credentials = () => ({ keyId: 'paper-key', secretKey: 'paper-secret' });

test('Alpaca stock adapter uses market-data host and keeps execution authority absent', async () => {
  const log: string[] = [];
  const client = new AlpacaStockMarketDataClient({ credentials, fetchImpl: fakeFetch(log) });

  assert.equal(client.baseUrl, ALPACA_STOCK_DATA_BASE_URL);

  const bundle = await client.getStockBundle({
    symbol: 'aapl',
    start: '2026-09-20T00:00:00Z',
    end: '2026-09-25T23:59:59Z',
    now: '2026-09-26T00:00:00Z',
    feed: 'iex',
  });

  assert.equal(bundle.symbol, 'AAPL');
  assert.equal(bundle.authority, 'EVIDENCE_ONLY');
  assert.equal(bundle.quote?.instrumentId, 'stock:AAPL');
  assert.equal(bundle.quote?.bidPrice, '199.9');
  assert.equal(bundle.quote?.askPrice, '200.1');
  assert.equal(bundle.dailyBars.length, 2);
  assert.ok(log.every((url) => url.startsWith(ALPACA_STOCK_DATA_BASE_URL)));
  assert.ok(log.some((url) => url.includes('feed=iex')));
});

test('Alpaca stock adapter rejects future data windows and crossed quotes', async () => {
  const client = new AlpacaStockMarketDataClient({ credentials, fetchImpl: fakeFetch([]) });

  await assert.rejects(
    () =>
      client.getStockBundle({
        symbol: 'AAPL',
        start: '2026-09-20T00:00:00Z',
        end: '2026-09-27T00:00:00Z',
        now: '2026-09-26T00:00:00Z',
      }),
    /MONEY_ALPACA_STOCK_DATA_TIME_INVALID/,
  );

  const crossedFetch: HttpClient = async (input) => {
    const url = String(input);
    if (url.includes('/snapshots')) {
      return new Response(
        JSON.stringify({
          snapshots: {
            AAPL: {
              latestQuote: { t: '2026-09-25T19:59:59Z', bp: 201, ap: 200 },
            },
          },
        }),
        { status: 200, headers: { 'X-Request-ID': 'crossed' } },
      );
    }
    return new Response(
      JSON.stringify({
        bars: [
          { t: '2026-09-24T04:00:00Z', o: 195, h: 201, l: 194, c: 199, v: 100 },
          { t: '2026-09-25T04:00:00Z', o: 199, h: 202, l: 198, c: 200, v: 120 },
        ],
      }),
      { status: 200, headers: { 'X-Request-ID': 'bars' } },
    );
  };

  await assert.rejects(
    () =>
      new AlpacaStockMarketDataClient({ credentials, fetchImpl: crossedFetch }).getStockBundle({
        symbol: 'AAPL',
        start: '2026-09-20T00:00:00Z',
        end: '2026-09-25T23:59:59Z',
        now: '2026-09-26T00:00:00Z',
      }),
    /MONEY_ALPACA_STOCK_DATA_CROSSED_QUOTE/,
  );
});
