import { createHash } from 'node:crypto';
import type { HttpClient } from './read-only-http-bank-adapter.js';
import type { StockBar, StockQuote } from './stock-market-reality.js';

export const ALPACA_STOCK_DATA_BASE_URL = 'https://data.alpaca.markets' as const;
export type AlpacaStockFeed = 'iex' | 'sip' | 'delayed_sip';

export type AlpacaStockDataCredentials = Readonly<{
  keyId: string;
  secretKey: string;
}>;

export type AlpacaStockObservationBundle = Readonly<{
  symbol: string;
  feed: AlpacaStockFeed;
  quote?: StockQuote;
  dailyBars: readonly StockBar[];
  observedAt: string;
  evidenceIds: readonly string[];
  provenanceHash: string;
  authority: 'EVIDENCE_ONLY';
}>;

type Json = Record<string, unknown>;
type ClientOptions = Readonly<{
  credentials: () => AlpacaStockDataCredentials | Promise<AlpacaStockDataCredentials>;
  fetchImpl?: HttpClient;
  timeoutMs?: number;
  baseUrl?: string;
}>;

const hash = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');

function stringField(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function numberField(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function positiveNumber(value: unknown, code: string): number {
  const n = numberField(value, code);
  if (n <= 0) throw new Error(code);
  return n;
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    throw new Error('MONEY_ALPACA_STOCK_SYMBOL_INVALID');
  }
  return symbol;
}

function iso(value: unknown, code: string): string {
  const s = stringField(value, code);
  if (Number.isNaN(Date.parse(s))) throw new Error(code);
  return s;
}

function barEnd(startsAt: string): string {
  return new Date(Date.parse(startsAt) + 24 * 60 * 60 * 1000).toISOString();
}

export class AlpacaStockMarketDataClient {
  readonly provider = 'alpaca-market-data';
  readonly baseUrl: string;
  private readonly fetchImpl: HttpClient;

  constructor(private readonly options: ClientOptions) {
    this.baseUrl = options.baseUrl ?? ALPACA_STOCK_DATA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, now: string): Promise<{
    payload: unknown;
    requestId: string;
  }> {
    const credentials = await this.options.credentials();
    if (!credentials.keyId || !credentials.secretKey) {
      throw new Error('MONEY_ALPACA_STOCK_DATA_CREDENTIALS_MISSING');
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 10_000,
    );
    try {
      const response = await this.fetchImpl(new URL(path, this.baseUrl), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'APCA-API-KEY-ID': credentials.keyId,
          'APCA-API-SECRET-KEY': credentials.secretKey,
          'X-Jhadina-Observed-At': now,
        },
        signal: controller.signal,
      });
      const requestId = response.headers.get('x-request-id') ?? 'missing-request-id';
      if (!response.ok) {
        throw new Error(
          'MONEY_ALPACA_STOCK_DATA_HTTP:' + response.status + ':' + requestId,
        );
      }
      return { payload: await response.json(), requestId };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getStockBundle(input: Readonly<{
    symbol: string;
    start: string;
    end: string;
    now: string;
    feed?: AlpacaStockFeed;
    maxBars?: number;
  }>): Promise<AlpacaStockObservationBundle> {
    const symbol = normalizeSymbol(input.symbol);
    const startMs = Date.parse(input.start);
    const endMs = Date.parse(input.end);
    const nowMs = Date.parse(input.now);
    if (
      Number.isNaN(startMs) ||
      Number.isNaN(endMs) ||
      Number.isNaN(nowMs) ||
      endMs < startMs ||
      endMs > nowMs
    ) {
      throw new Error('MONEY_ALPACA_STOCK_DATA_TIME_INVALID');
    }

    const feed = input.feed ?? 'iex';
    const maxBars = input.maxBars ?? 80;
    if (!Number.isInteger(maxBars) || maxBars < 2 || maxBars > 500) {
      throw new Error('MONEY_ALPACA_STOCK_DATA_BAR_LIMIT_INVALID');
    }

    const snapshotPath =
      '/v2/stocks/snapshots?symbols=' +
      encodeURIComponent(symbol) +
      '&feed=' +
      encodeURIComponent(feed);

    const barsPath =
      '/v2/stocks/' +
      encodeURIComponent(symbol) +
      '/bars?timeframe=1Day&start=' +
      encodeURIComponent(input.start) +
      '&end=' +
      encodeURIComponent(input.end) +
      '&limit=' +
      maxBars +
      '&feed=' +
      encodeURIComponent(feed) +
      '&sort=asc';

    const [snapshotResponse, barsResponse] = await Promise.all([
      this.request(snapshotPath, input.now),
      this.request(barsPath, input.now),
    ]);

    const snapshotRoot = snapshotResponse.payload as Json;
    const snapshots = snapshotRoot.snapshots as Json | undefined;
    const rawSnapshot = snapshots?.[symbol] as Json | undefined;
    const rawQuote = rawSnapshot?.latestQuote as Json | undefined;

    let quote: StockQuote | undefined;
    if (rawQuote) {
      const observedAt = iso(
        rawQuote.t,
        'MONEY_ALPACA_STOCK_DATA_QUOTE_TIME_INVALID',
      );
      const bid = positiveNumber(
        rawQuote.bp,
        'MONEY_ALPACA_STOCK_DATA_BID_INVALID',
      );
      const ask = positiveNumber(
        rawQuote.ap,
        'MONEY_ALPACA_STOCK_DATA_ASK_INVALID',
      );
      if (ask < bid) throw new Error('MONEY_ALPACA_STOCK_DATA_CROSSED_QUOTE');

      const evidenceRef =
        'alpaca-stock-snapshot:' + snapshotResponse.requestId + ':' + symbol;
      quote = Object.freeze({
        quoteId: evidenceRef,
        instrumentId: 'stock:' + symbol,
        venue: String(rawQuote.z ?? rawQuote.ax ?? rawQuote.bx ?? 'UNKNOWN'),
        currency: 'USD',
        bidPrice: String(bid),
        askPrice: String(ask),
        bidSize:
          rawQuote.bs === undefined ? undefined : String(numberField(rawQuote.bs, 'MONEY_ALPACA_STOCK_DATA_BID_SIZE_INVALID')),
        askSize:
          rawQuote.as === undefined ? undefined : String(numberField(rawQuote.as, 'MONEY_ALPACA_STOCK_DATA_ASK_SIZE_INVALID')),
        observedAt,
        availableAt: observedAt,
        receivedAt: input.now,
        provider: this.provider + ':' + feed,
        evidenceRef,
        provenanceHash: hash({ requestId: snapshotResponse.requestId, symbol, rawQuote }),
      });
    }

    const barsRoot = barsResponse.payload as Json;
    const rawBars = Array.isArray(barsRoot.bars) ? barsRoot.bars : [];
    const dailyBars: StockBar[] = rawBars.slice(-maxBars).map((raw, index) => {
      const bar = raw as Json;
      const startsAt = iso(
        bar.t,
        'MONEY_ALPACA_STOCK_DATA_BAR_TIME_INVALID',
      );
      const evidenceRef =
        'alpaca-stock-bar:' + barsResponse.requestId + ':' + symbol + ':' + index;
      return Object.freeze({
        barId: evidenceRef,
        instrumentId: 'stock:' + symbol,
        venue: feed.toUpperCase(),
        currency: 'USD',
        interval: '1D',
        startsAt,
        endsAt: barEnd(startsAt),
        observedAt: startsAt,
        availableAt: startsAt,
        receivedAt: input.now,
        open: String(positiveNumber(bar.o, 'MONEY_ALPACA_STOCK_DATA_OPEN_INVALID')),
        high: String(positiveNumber(bar.h, 'MONEY_ALPACA_STOCK_DATA_HIGH_INVALID')),
        low: String(positiveNumber(bar.l, 'MONEY_ALPACA_STOCK_DATA_LOW_INVALID')),
        close: String(positiveNumber(bar.c, 'MONEY_ALPACA_STOCK_DATA_CLOSE_INVALID')),
        volume: String(numberField(bar.v, 'MONEY_ALPACA_STOCK_DATA_VOLUME_INVALID')),
        tradeCount:
          bar.n === undefined
            ? undefined
            : Math.trunc(numberField(bar.n, 'MONEY_ALPACA_STOCK_DATA_TRADE_COUNT_INVALID')),
        adjustmentStatus: 'UNADJUSTED',
        provider: this.provider + ':' + feed,
        evidenceRef,
        provenanceHash: hash({ requestId: barsResponse.requestId, symbol, bar }),
      });
    });

    if (dailyBars.length < 2) {
      throw new Error('MONEY_ALPACA_STOCK_DATA_INSUFFICIENT_BARS');
    }

    const evidenceIds = Object.freeze([
      ...(quote ? [quote.evidenceRef] : []),
      ...dailyBars.map((bar) => bar.evidenceRef),
    ]);
    return Object.freeze({
      symbol,
      feed,
      quote,
      dailyBars: Object.freeze(dailyBars),
      observedAt: input.now,
      evidenceIds,
      provenanceHash: hash({
        symbol,
        feed,
        snapshotRequestId: snapshotResponse.requestId,
        barsRequestId: barsResponse.requestId,
        evidenceIds,
      }),
      authority: 'EVIDENCE_ONLY',
    });
  }
}
