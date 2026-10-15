/**
 * JHADINA-KALSHI.03 - prospective research study, with no financial authority.
 *
 * This module is transport-agnostic: a separately authenticated read-only feed
 * supplies Kalshi frames. Google Drive is an export/archive, not a tick store.
 */
import {createHash} from 'node:crypto';
import {open as openFile, readFile, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {
  Kalshi15mFastPaper, type KalshiIndependentEstimate,
  type KalshiFastPaperDecision,
} from './kalshi-15m-fast-paper.js';

export const KALSHI_STUDY_SCHEMA = 'JHADINA-KALSHI-03' as const;
export const KALSHI_PREDICTION_HORIZONS_SEC = [600, 300, 60] as const;
export type KalshiStudyDirection = 'UP' | 'DOWN' | 'ABSTAIN';
export type KalshiStudyStatus = 'RECORDED' | 'ABSTAINED' | 'NOT_OBSERVED';

export type Kalshi15mMarket = Readonly<{
  ticker: string;
  eventTicker: string;
  closesAtMs: number;
  targetUsd: number;
  rulesPrimary: string;
  rulesSecondary: string;
  providerEvidenceHash: string;
  status: 'open';
}>;

export type KalshiStudyReceipt = Readonly<{
  schema: typeof KALSHI_STUDY_SCHEMA;
  id: string;
  marketTicker: string;
  eventTicker: string;
  horizonSeconds: number;
  checkpointAt: string;
  observedAt: string;
  informationCutoff: string;
  closesAt: string;
  targetUsd: number;
  brtiUsd: number | null;
  brtiDistanceUsd: number | null;
  yesAskUsd: number | null;
  noAskUsd: number | null;
  independentProbabilityUp: number | null;
  baselineDirection: 'UP' | 'DOWN' | null;
  direction: KalshiStudyDirection;
  modelId: string | null;
  feeUsdPerContract: number | null;
  netEdgeUsd: number | null;
  reason: string;
  marketEvidenceHash: string;
  observationHash: string;
  paperOnly: true;
  canSubmitOrders: false;
  settlementStatus: 'PENDING';
  officialOutcome: null;
  officialSettlementValueUsd: null;
}>;

export interface KalshiStudySink {
  /** Must persist before a receipt is acknowledged. Durable store is append-only. */
  append(receipt: KalshiStudyReceipt): Promise<void>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function hash(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
function requiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Only Kalshi provider metadata can activate a market. We do not parse strike
 * prices from URL slugs or assume that all BTC markets share settlement rules.
 */
export function parseKalshi15mMarket(input: unknown, nowMs: number): Kalshi15mMarket {
  if (!isObject(input)) throw new Error('KALSHI_STUDY_MARKET_INVALID');
  const ticker = requiredString(input.ticker);
  const eventTicker = requiredString(input.event_ticker);
  const rulesPrimary = requiredString(input.rules_primary);
  const rulesSecondary = requiredString(input.rules_secondary);
  const status = input.status;
  const closeTime = input.close_time;
  const floorStrike = input.floor_strike;
  const closeMs = typeof closeTime === 'string' ? Date.parse(closeTime) : NaN;
  if (!ticker.startsWith('KXBTC15M-') || !eventTicker ||
      status !== 'active' && status !== 'open' ||
      !Number.isFinite(closeMs) || closeMs <= nowMs ||
      closeMs - nowMs > 15 * 60_000 ||
      !Number.isFinite(floorStrike) || typeof floorStrike !== 'number' ||
      floorStrike <= 0 || !rulesPrimary ||
      input.strike_type !== 'greater_or_equal') {
    throw new Error('KALSHI_STUDY_MARKET_UNVERIFIED');
  }
  // The exact comparison operator must be verified separately. Never use a
  // "less"/"range" contract as an UP market by silently flipping labels.
  return Object.freeze({
    ticker, eventTicker, closesAtMs: closeMs,
    targetUsd: floorStrike, rulesPrimary, rulesSecondary,
    providerEvidenceHash: hash(input), status: 'open',
  });
}

/** First available active market whose verified expiry is still in the future. */
export function chooseKalshi15mMarket(markets: readonly unknown[], nowMs: number):
  Kalshi15mMarket | null {
  const valid: Kalshi15mMarket[] = [];
  for (const market of markets) {
    try {
      // Accept previously parsed market metadata from the read-only GET
      // adapter, but never accept an unchecked object with just a ticker.
      if (isObject(market) && market.status === 'open' &&
          typeof market.ticker === 'string' && market.ticker.startsWith('KXBTC15M-') &&
          typeof market.eventTicker === 'string' &&
          typeof market.closesAtMs === 'number' && market.closesAtMs > nowMs &&
          market.closesAtMs - nowMs <= 900_000 &&
          typeof market.targetUsd === 'number' && Number.isFinite(market.targetUsd) &&
          market.targetUsd > 0 && typeof market.rulesPrimary === 'string' &&
          market.rulesPrimary.trim().length > 0 &&
          typeof market.rulesSecondary === 'string' &&
          typeof market.providerEvidenceHash === 'string' &&
          /^[0-9a-f]{64}$/.test(market.providerEvidenceHash)) {
        valid.push(market as unknown as Kalshi15mMarket);
      } else {
        valid.push(parseKalshi15mMarket(market, nowMs));
      }
    } catch { /* Reject unverified or already-closed markets. */ }
  }
  valid.sort((a,b) => a.closesAtMs - b.closesAtMs);
  if (!valid.length) return null;
  if (valid.length > 1 && valid[0]!.closesAtMs === valid[1]!.closesAtMs) {
    throw new Error('KALSHI_STUDY_AMBIGUOUS_WINDOW');
  }
  return valid[0]!;
}

/** Network boundary is read-only: only GET /markets, never any order endpoint. */
export async function fetchKalshi15mMarkets(input: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  nowMs: number;
}): Promise<Kalshi15mMarket[]> {
  const baseUrl = input.baseUrl ?? 'https://external-api.kalshi.com/trade-api/v2';
  const allow = ['https://external-api.kalshi.com/trade-api/v2',
    'https://external-api.demo.kalshi.co/trade-api/v2'];
  if (!allow.includes(baseUrl)) throw new Error('KALSHI_STUDY_BASE_URL_FORBIDDEN');
  const url = baseUrl + '/markets?series_ticker=KXBTC15M&status=open&limit=200';
  const response = await (input.fetchImpl ?? fetch)(url, {
    method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(6000),
    headers: {accept: 'application/json'},
  });
  if (!response.ok) throw new Error('KALSHI_STUDY_MARKET_HTTP_' + response.status);
  const json: unknown = await response.json();
  if (!isObject(json) || !Array.isArray(json.markets)) throw new Error('KALSHI_STUDY_MARKET_JSON');
  // Do not silently admit partial results from a paginated market list.
  if (typeof json.cursor === 'string' && json.cursor.length > 0) {
    throw new Error('KALSHI_STUDY_PAGINATION_UNHANDLED');
  }
  return json.markets.flatMap((market: unknown) => {
    try { return [parseKalshi15mMarket(market, input.nowMs)]; }
    catch { return []; }
  });
}

/**
 * Records exactly one immutable study decision at each on-time horizon.
 * The independent model is optional: without one, baseline direction is
 * recorded as an uncalibrated guess, while trade action remains NO_TRADE.
 */
export class Kalshi15mStudySession {
  readonly market: Kalshi15mMarket;
  readonly engine: Kalshi15mFastPaper;
  private readonly sink: KalshiStudySink;
  private readonly done = new Set<number>();
  private failed = false;

  constructor(market: Kalshi15mMarket, sink: KalshiStudySink,
              previousHorizonSeconds: readonly number[] = []) {
    this.market = market;
    this.sink = sink;
    this.engine = new Kalshi15mFastPaper({
      marketTicker: market.ticker, targetUsd:market.targetUsd,
      closeAtMs:market.closesAtMs,
    });
    for (const horizon of previousHorizonSeconds) this.done.add(horizon);
  }

  /** Frames must come from an authenticated read-only Kalshi connection. */
  ingest(frame: unknown, receivedAtMs: number): ReturnType<Kalshi15mFastPaper['ingest']> {
    if (this.failed) throw new Error('KALSHI_STUDY_SINK_FAILED');
    return this.engine.ingest(frame, receivedAtMs);
  }

  /**
   * Call upon each new upstream event AND at each checkpoint. A checkpoint is
   * accepted only within 5 seconds after its scheduled instant, never late.
   * Return null outside its window; avoid post-hoc generated predictions.
   */
  async checkpoint(input: {
    nowMs: number;
    estimate?: KalshiIndependentEstimate;
    feeUsdPerContract?: number;
  }): Promise<KalshiStudyReceipt | null> {
    if (this.failed) throw new Error('KALSHI_STUDY_SINK_FAILED');
    const {nowMs, estimate, feeUsdPerContract} = input;
    if (!Number.isFinite(nowMs) || nowMs > this.market.closesAtMs)
      return null;
    const horizon = KALSHI_PREDICTION_HORIZONS_SEC.find(offset => {
      const at = this.market.closesAtMs - offset * 1000;
      return !this.done.has(offset) && nowMs >= at && nowMs <= at + 5000;
    });
    if (horizon === undefined) return null;

    const state = this.engine.snapshot(nowMs);
    const quoteReady = state.bookFresh && state.indexFresh &&
      state.indexUsd !== null && state.upAskUsd !== null && state.downAskUsd !== null;
    // At least one prior source tick is not an accurate settlement price:
    // baseline = only a naive snapshot direction, never probability.
    const baseline: 'UP' | 'DOWN' | null = state.indexFresh && state.indexUsd !== null
      ? (state.indexUsd >= this.market.targetUsd ? 'UP' : 'DOWN')
      : null;
    let decision: KalshiFastPaperDecision;
    try {
      decision = this.engine.decide({nowMs, estimate, feeUsdPerContract});
    } catch {
      decision = {
        action:'NO_TRADE',reason:'DECISION_INVALID',
        marketTicker:this.market.ticker,atMs:nowMs,targetUsd:this.market.targetUsd,
        secondsToClose:(this.market.closesAtMs-nowMs)/1000,
        authority:'PAPER_ONLY',canSubmitOrders:false,
      };
    }
    // The model itself must be fresh, independently evidenced and accepted by
    // the fast gate. We record the fallback UP/DOWN guess separately.
    const admitted = decision.action === 'PAPER_CANDIDATE' && quoteReady;
    const reason = quoteReady ? decision.reason : 'MARKET_REFERENCE_OR_BOOK_NOT_READY';
    const id = this.market.ticker + ':' + horizon;
    const body = {
      schema:KALSHI_STUDY_SCHEMA, id, marketTicker:this.market.ticker,
      eventTicker:this.market.eventTicker, horizonSeconds:horizon,
      checkpointAt:new Date(this.market.closesAtMs-horizon*1000).toISOString(),
      observedAt:new Date(nowMs).toISOString(), informationCutoff:new Date(nowMs).toISOString(),
      closesAt:new Date(this.market.closesAtMs).toISOString(),
      targetUsd:this.market.targetUsd,
      brtiUsd:state.indexFresh?state.indexUsd:null,
      brtiDistanceUsd:state.indexFresh?state.deltaFromTargetUsd:null,
      yesAskUsd:state.bookFresh?state.upAskUsd:null,
      noAskUsd:state.bookFresh?state.downAskUsd:null,
      independentProbabilityUp:admitted && estimate ? estimate.probabilityUp:null,
      baselineDirection:baseline, direction:admitted ? decision.side! : 'ABSTAIN' as KalshiStudyDirection,
      modelId:admitted && estimate ? estimate.modelId:null,
      feeUsdPerContract:admitted ? feeUsdPerContract ?? null:null,
      netEdgeUsd:admitted ? decision.estimatedNetEdgeUsd ?? null:null,
      reason, marketEvidenceHash:this.market.providerEvidenceHash,
      paperOnly:true as const, canSubmitOrders:false as const,
      settlementStatus:'PENDING' as const,
      officialOutcome:null, officialSettlementValueUsd:null,
    };
    const receipt: KalshiStudyReceipt = Object.freeze({
      ...body, observationHash:hash(body),
    });
    this.done.add(horizon);  // never retry a possibly-partial append as a new prediction
    try { await this.sink.append(receipt); }
    catch (error) {
      this.failed = true; // persistent errors halt session rather than fabricate data
      throw error;
    }
    return receipt;
  }

  completeHorizons(): readonly number[] {return [...this.done].sort((a,b)=>b-a);}
}

/**
 * Single-process durable JSONL receipt journal. Stores the immutable receipt
 * before acknowledgement; on restart callers replay IDs and never backfill a
 * missed horizon. This is a host-local journal, not a DB or Google Drive.
 */
export class KalshiStudyJsonlStore implements KalshiStudySink {
  private appendQueue: Promise<void> = Promise.resolve();
  private poisoned = false;
  private constructor(readonly filePath: string,
    private readonly seen: Set<string>) {}
  static async open(filePath: string): Promise<KalshiStudyJsonlStore> {
    await mkdir(dirname(filePath), {recursive:true});
    let existing = '';
    try { existing = await readFile(filePath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (existing && !existing.endsWith('\n')) throw new Error('KALSHI_STUDY_PARTIAL_LEDGER');
    const seen = new Set<string>();
    for (const line of existing.split('\n').filter(Boolean)) {
      const receipt: unknown = JSON.parse(line);
      if (!isObject(receipt) || receipt.schema !== KALSHI_STUDY_SCHEMA ||
          typeof receipt.id !== 'string' || typeof receipt.observationHash !== 'string' ||
          !receipt.paperOnly || receipt.canSubmitOrders !== false) {
        throw new Error('KALSHI_STUDY_LEDGER_CORRUPT');
      }
      const {observationHash,...data} = receipt;
      if (hash(data) !== observationHash || seen.has(receipt.id)) {
        throw new Error('KALSHI_STUDY_LEDGER_INTEGRITY');
      }
      seen.add(receipt.id);
    }
    return new KalshiStudyJsonlStore(filePath, seen);
  }
  async append(receipt: KalshiStudyReceipt): Promise<void> {
    // A lease excludes other processes; this queue also excludes overlapping
    // asynchronous appends within the sole writer process.
    const write = this.appendQueue.then(async () => {
      if (this.poisoned) throw new Error('KALSHI_STUDY_LEDGER_POISONED');
      if (this.seen.has(receipt.id)) throw new Error('KALSHI_STUDY_DUPLICATE');
      const {observationHash, ...body} = receipt;
      if (receipt.schema !== KALSHI_STUDY_SCHEMA || receipt.paperOnly !== true ||
          receipt.canSubmitOrders !== false || receipt.settlementStatus !== 'PENDING' ||
          receipt.officialOutcome !== null || receipt.officialSettlementValueUsd !== null ||
          receipt.id !== receipt.marketTicker + ':' + receipt.horizonSeconds ||
          hash(body) !== observationHash) {
        throw new Error('KALSHI_STUDY_UNVERIFIED_RECEIPT');
      }
      const line = JSON.stringify(receipt) + '\n';
      try {
        const file = await openFile(this.filePath, 'a');
        try {
          await file.writeFile(line, {encoding:'utf8'});
          await file.sync(); // no acknowledgement before committed bytes sync
        } finally {await file.close();}
        this.seen.add(receipt.id);
      } catch (error) {
        // An uncertain/partial filesystem write is never blindly retried.
        this.poisoned = true;
        throw error;
      }
    });
    this.appendQueue = write.catch(() => {});
    return write;
  }
  has(id: string): boolean {return this.seen.has(id);}
}

/** Export retains unknown settlements and abstentions; no imagined wins. */
export function kalshiStudySheetRows(receipts: readonly KalshiStudyReceipt[]): string[][] {
  const rows = [[
    'Kalshi market ticker','UTC checkpoint','Horizon s','Target USD','BRTI USD',
    'Distance USD','UP ask USD','DOWN ask USD','Independent P(UP)',
    'Naive direction (uncalibrated)','Paper action','Model ID',
    'Fee USD','Net edge USD','Official outcome','Official settlement USD',
    'Status','Evidence hash','Reason',
  ]];
  for (const r of receipts) {
    rows.push([
      r.marketTicker, r.observedAt, String(r.horizonSeconds), String(r.targetUsd),
      r.brtiUsd === null?'':String(r.brtiUsd),
      r.brtiDistanceUsd === null?'':String(r.brtiDistanceUsd),
      r.yesAskUsd === null?'':String(r.yesAskUsd),
      r.noAskUsd === null?'':String(r.noAskUsd),
      r.independentProbabilityUp === null?'':String(r.independentProbabilityUp),
      r.baselineDirection ?? '', r.direction, r.modelId ?? '',
      r.feeUsdPerContract === null?'':String(r.feeUsdPerContract),
      r.netEdgeUsd === null?'':String(r.netEdgeUsd),
      '', '', r.settlementStatus, r.observationHash, r.reason,
    ]);
  }
  return rows;
}
