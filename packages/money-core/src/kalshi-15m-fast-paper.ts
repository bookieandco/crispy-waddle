/**
 * JHADINA-KALSHI.02 — fail-closed, event-driven BTC 15m read-only/paper processor.
 *
 * This module NEVER opens a socket or submits an order. A separately audited
 * read-only transport supplies the authenticated Kalshi WebSocket frames.
 * Do not substitute the visible spot price for the official BRTI settlement feed.
 * Reference: docs.kalshi.com/websockets/orderbook-updates
 *            docs.kalshi.com/websockets/cfbenchmarks-value
 */

export type KalshiPaperSide = 'UP' | 'DOWN';
export type KalshiFastPaperDecision = Readonly<{
  action: 'PAPER_CANDIDATE' | 'NO_TRADE';
  reason: string;
  marketTicker: string;
  atMs: number;
  indexUsd?: number;
  targetUsd: number;
  secondsToClose: number;
  side?: KalshiPaperSide;
  askUsd?: number;
  quoteAvailableContracts?: number;
  estimatedNetEdgeUsd?: number;
  authority: 'PAPER_ONLY';
  canSubmitOrders: false;
}>;

export type KalshiIndependentEstimate = Readonly<{
  marketTicker: string;
  probabilityUp: number;
  observedAtMs: number;
  modelId: string;
  evidenceIds: readonly string[];
}>;

export type KalshiFastConfig = Readonly<{
  marketTicker: string;
  targetUsd: number;
  closeAtMs: number;
  /** Measured local wall-clock freshness limits, not latency guarantees. */
  maxAgeMs?: number;
  maxClockSkewMs?: number;
  minSecondsToClose?: number;
  /** Required estimated edge per one-dollar binary contract, after specified fees. */
  minNetEdgeUsd?: number;
}>;

type Side = 'yes' | 'no';
type Depth = Map<number, number>;
type Book = Readonly<{seq: number; sid: number; atMs: number; yes: Depth; no: Depth}>;
type Index = Readonly<{seq: number; sid: number; sourceAtMs: number; receivedAtMs: number; valueUsd: number}>;
type RecordLike = Record<string, unknown>;

function object(input: unknown): RecordLike | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as RecordLike : null;
}
function decimal(v: unknown, name: string): number {
  if (typeof v !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v)) throw new Error('KALSHI_FAST_INVALID_' + name);
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isSafeInteger(Math.floor(Math.abs(n)))) throw new Error('KALSHI_FAST_INVALID_' + name);
  return n;
}
function finite(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('KALSHI_FAST_INVALID_' + name);
  return v;
}
function levelPrice(v: unknown): number {
  const n = decimal(v, 'PRICE');
  if (n <= 0 || n >= 1) throw new Error('KALSHI_FAST_PRICE_RANGE');
  return n;
}
function cloneLevels(value: unknown): Depth {
  if (!Array.isArray(value)) throw new Error('KALSHI_FAST_BOOK_LEVELS_INVALID');
  const result = new Map<number, number>();
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error('KALSHI_FAST_BOOK_PAIR_INVALID');
    const price = levelPrice(pair[0]);
    const size = decimal(pair[1], 'SIZE');
    if (size < 0) throw new Error('KALSHI_FAST_NEGATIVE_DEPTH');
    if (size > 0) result.set(price, size);
  }
  return result;
}
function applyDelta(book: Depth, price: number, delta: number): Depth {
  const copy = new Map(book);
  const next = (copy.get(price) ?? 0) + delta;
  if (next < -1e-8) throw new Error('KALSHI_FAST_DEPTH_UNDERFLOW');
  if (next <= 1e-8) copy.delete(price);
  else copy.set(price, next);
  return copy;
}
function bestBid(levels: Depth): {price: number; size: number} | null {
  let best: {price: number; size: number} | null = null;
  for (const [price, size] of levels) {
    if (size > 0 && (best === null || price > best.price)) best = {price, size};
  }
  return best;
}

export class Kalshi15mFastPaper {
  readonly config: Required<KalshiFastConfig>;
  private book: Book | null = null;
  private index: Index | null = null;
  private bookNeedsSnapshot = true;

  constructor(config: KalshiFastConfig) {
    if (!config.marketTicker.startsWith('KXBTC15M-') ||
        !Number.isFinite(config.targetUsd) || config.targetUsd <= 0 ||
        !Number.isFinite(config.closeAtMs)) throw new Error('KALSHI_FAST_CONFIG_INVALID');
    this.config = {
      ...config,
      maxAgeMs: config.maxAgeMs ?? 1800,
      maxClockSkewMs: config.maxClockSkewMs ?? 1000,
      minSecondsToClose: config.minSecondsToClose ?? 15,
      minNetEdgeUsd: config.minNetEdgeUsd ?? 0.025,
    };
    if (this.config.maxAgeMs <= 0 || this.config.maxClockSkewMs < 0 ||
        this.config.minSecondsToClose < 0 || this.config.minNetEdgeUsd < 0) {
      throw new Error('KALSHI_FAST_CONFIG_LIMIT_INVALID');
    }
  }

  /** Receives already-parsed or JSON-stringified authenticated read-only frames. */
  ingest(raw: unknown, receivedAtMs: number): 'BOOK_READY' | 'INDEX_READY' | 'BOOK_RESNAPSHOT_REQUIRED' | 'IGNORED' {
    const frame = object(typeof raw === 'string' ? JSON.parse(raw) : raw);
    if (!frame) return 'IGNORED';
    const msg = object(frame.msg);
    if (!msg) return 'IGNORED';
    const sid = frame.sid;
    const seq = frame.seq;
    const sendingTs = frame.sending_ts_ms;
    if (typeof sid !== 'number' || !Number.isSafeInteger(sid) ||
        typeof seq !== 'number' || !Number.isSafeInteger(seq) ||
        !Number.isFinite(receivedAtMs) || !Number.isFinite(sendingTs)) return 'IGNORED';

    if (frame.type === 'orderbook_snapshot' || frame.type === 'orderbook_delta') {
      if (msg.market_ticker !== this.config.marketTicker) return 'IGNORED';
      if (frame.type === 'orderbook_snapshot') {
        try {
          const yes = cloneLevels(msg.yes_dollars_fp);
          const no = cloneLevels(msg.no_dollars_fp);
          this.book = {sid, seq, atMs: receivedAtMs, yes, no};
          this.bookNeedsSnapshot = false;
          return 'BOOK_READY';
        } catch {
          this.book = null;
          this.bookNeedsSnapshot = true;
          return 'BOOK_RESNAPSHOT_REQUIRED';
        }
      }
      if (!this.book || this.bookNeedsSnapshot || sid !== this.book.sid ||
          seq !== this.book.seq + 1) {
        this.book = null;
        this.bookNeedsSnapshot = true;
        return 'BOOK_RESNAPSHOT_REQUIRED';
      }
      try {
        const side = msg.side;
        if (side !== 'yes' && side !== 'no') throw new Error('KALSHI_FAST_SIDE_INVALID');
        const price = levelPrice(msg.price_dollars);
        const delta = decimal(msg.delta_fp, 'DELTA');
        this.book = {...this.book, seq, atMs: receivedAtMs,
          [side]: applyDelta(this.book[side as Side], price, delta)};
        return 'BOOK_READY';
      } catch {
        this.book = null;
        this.bookNeedsSnapshot = true;
        return 'BOOK_RESNAPSHOT_REQUIRED';
      }
    }

    if (frame.type === 'cfbenchmarks_value' && msg.index_id === 'BRTI') {
      try {
        const upstream = object(JSON.parse(String(msg.data)));
        if (!upstream || upstream.id !== 'BRTI' || upstream.type !== 'value') return 'IGNORED';
        const sourceAtMs = finite(upstream.time, 'INDEX_TIME');
        const valueUsd = decimal(upstream.value, 'INDEX_VALUE');
        if (valueUsd <= 0 || sourceAtMs > receivedAtMs + this.config.maxClockSkewMs) return 'IGNORED';
        if (this.index && sid === this.index.sid &&
            (seq <= this.index.seq || sourceAtMs <= this.index.sourceAtMs)) return 'IGNORED';
        this.index = {sid, seq, sourceAtMs, receivedAtMs, valueUsd};
        return 'INDEX_READY';
      } catch { return 'IGNORED'; }
    }
    return 'IGNORED';
  }

  snapshot(nowMs: number) {
    const bookFresh = !!this.book && !this.bookNeedsSnapshot &&
      this.book.atMs <= nowMs + this.config.maxClockSkewMs &&
      nowMs - this.book.atMs <= this.config.maxAgeMs;
    const indexFresh = !!this.index &&
      this.index.sourceAtMs <= nowMs + this.config.maxClockSkewMs &&
      nowMs - this.index.sourceAtMs <= this.config.maxAgeMs &&
      this.index.receivedAtMs <= nowMs + this.config.maxClockSkewMs;
    const yesBid = this.book ? bestBid(this.book.yes) : null;
    const noBid = this.book ? bestBid(this.book.no) : null;
    return Object.freeze({
      bookFresh, indexFresh, needsResnapshot: this.bookNeedsSnapshot,
      indexUsd: indexFresh ? this.index!.valueUsd : null,
      deltaFromTargetUsd: indexFresh ? this.index!.valueUsd - this.config.targetUsd : null,
      upAskUsd: bookFresh && noBid ? 1 - noBid.price : null,
      downAskUsd: bookFresh && yesBid ? 1 - yesBid.price : null,
      upAskSize: bookFresh && noBid ? noBid.size : 0,
      downAskSize: bookFresh && yesBid ? yesBid.size : 0,
    });
  }

  /**
   * An independently evidenced probability, live reference tick, live book, fee
   * estimate and sufficient time MUST all exist. No model => no prediction.
   * This is not a real order, not an authorization, and not a guaranteed fill.
   */
  decide(input: Readonly<{
    nowMs: number;
    estimate?: KalshiIndependentEstimate;
    feeUsdPerContract?: number;
    minimumAvailableContracts?: number;
  }>): KalshiFastPaperDecision {
    const {nowMs, estimate, feeUsdPerContract, minimumAvailableContracts = 1} = input;
    const secondsToClose = (this.config.closeAtMs - nowMs) / 1000;
    const result = (reason: string, extra: Partial<KalshiFastPaperDecision> = {}): KalshiFastPaperDecision =>
      Object.freeze({
        action: 'NO_TRADE', reason, marketTicker: this.config.marketTicker,
        atMs: nowMs, targetUsd: this.config.targetUsd, secondsToClose,
        authority: 'PAPER_ONLY', canSubmitOrders: false, ...extra,
      });
    if (!Number.isFinite(nowMs)) return result('INVALID_CLOCK');
    if (secondsToClose < this.config.minSecondsToClose) return result('TOO_CLOSE_TO_SETTLEMENT');
    if (!this.book || this.bookNeedsSnapshot) return result('BOOK_NOT_SYNCHRONIZED');
    const state = this.snapshot(nowMs);
    if (!state.indexFresh || !state.bookFresh || state.indexUsd === null) return result('STALE_OR_MISSING_FEED');
    if (!estimate || estimate.marketTicker !== this.config.marketTicker ||
        !estimate.modelId.trim() || !estimate.evidenceIds.length ||
        !Number.isFinite(estimate.probabilityUp) ||
        estimate.probabilityUp < 0 || estimate.probabilityUp > 1) return result('INDEPENDENT_ESTIMATE_REQUIRED');
    if (!Number.isFinite(estimate.observedAtMs) ||
        estimate.observedAtMs > nowMs + this.config.maxClockSkewMs ||
        nowMs - estimate.observedAtMs > this.config.maxAgeMs) return result('STALE_ESTIMATE');
    if (feeUsdPerContract === undefined || !Number.isFinite(feeUsdPerContract) ||
        feeUsdPerContract < 0 || !Number.isFinite(minimumAvailableContracts) ||
        minimumAvailableContracts <= 0) return result('EXECUTION_COSTS_REQUIRED');

    const candidates: {side: KalshiPaperSide; askUsd: number; size: number; edge: number}[] = [];
    if (state.upAskUsd !== null && state.upAskSize >= minimumAvailableContracts) {
      candidates.push({side:'UP', askUsd:state.upAskUsd, size:state.upAskSize,
        edge:estimate.probabilityUp - state.upAskUsd - feeUsdPerContract});
    }
    if (state.downAskUsd !== null && state.downAskSize >= minimumAvailableContracts) {
      candidates.push({side:'DOWN', askUsd:state.downAskUsd, size:state.downAskSize,
        edge:(1 - estimate.probabilityUp) - state.downAskUsd - feeUsdPerContract});
    }
    candidates.sort((a,b)=>b.edge-a.edge);
    const top = candidates[0];
    if (!top || top.edge < this.config.minNetEdgeUsd) return result('NO_EVIDENCED_NET_EDGE', {indexUsd:state.indexUsd});
    return result('EVIDENCED_PAPER_EDGE_ONLY', {
      action:'PAPER_CANDIDATE', side:top.side, askUsd:top.askUsd,
      quoteAvailableContracts:top.size, estimatedNetEdgeUsd:top.edge,
      indexUsd:state.indexUsd,
    });
  }
}
