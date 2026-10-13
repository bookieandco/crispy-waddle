/**
 * JHADINA-KALSHI.03 read-only study supervisor.
 *
 * Host supplies an AUTHENTICATED Kalshi websocket feed implementation with
 * NO writable order methods. This orchestrator never trades or handles keys.
 * Clock and source are injected to enable deterministic forward-only tests.
 */
import {setTimeout as wait} from 'node:timers/promises';
import {
  KALSHI_PREDICTION_HORIZONS_SEC,
  Kalshi15mStudySession, chooseKalshi15mMarket, type Kalshi15mMarket,
  type KalshiStudyReceipt,
} from './kalshi-15m-study-recorder.js';
import type {KalshiIndependentEstimate} from './kalshi-15m-fast-paper.js';

export interface KalshiReadOnlyFeedConnection {
  close(): Promise<void>;
}
export interface KalshiReadOnlyFeed {
  readonly authority: 'LIVE_READ_ONLY';
  subscribe(
    marketTicker: string,
    receive: (frame: unknown, receivedAtMs: number) => void,
    disconnected: () => void,
  ): Promise<KalshiReadOnlyFeedConnection>;
}

export interface KalshiContinuousStudyOptions {
  readonly now: () => number;
  readonly listMarkets: (nowMs: number) => Promise<readonly unknown[]>;
  readonly feed: KalshiReadOnlyFeed;
  readonly sink: {
    append(receipt: KalshiStudyReceipt): Promise<void>;
    has(id: string): boolean;
  };
  readonly estimate?: (market: Kalshi15mMarket, nowMs: number) =>
    Promise<KalshiIndependentEstimate | undefined>;
  readonly feeUsdPerContract?: number; // require explicit verified cost
  readonly report?: (receipt: KalshiStudyReceipt) => void;
}

export type KalshiStudyWorkerHealth = Readonly<{
  state: 'NO_MARKET' | 'CONNECTING' | 'STREAMING' | 'DISCONNECTED' | 'STOPPED' | 'FAILED';
  ticker: string | null;
  connected: boolean;
  recordedThisProcess: number;
  lastReceiptAt: string | null;
  lastErrorCode: string | null;
  authority: 'PAPER_ONLY';
  canSubmitOrders: false;
}>;

/** Supervises market rotation and chronological checkpoints without orders. */
export class Kalshi15mContinuousStudyWorker {
  private readonly options: KalshiContinuousStudyOptions;
  private current: Kalshi15mStudySession | null = null;
  private connection: KalshiReadOnlyFeedConnection | null = null;
  private interrupted = false;
  private failed = false;
  private stopped = false;
  private lastErrorCode: string | null = null;
  private nextDiscoveryAt = 0;
  private cached: readonly unknown[] = [];
  private count = 0;
  private lastReceiptAt: string | null = null;

  constructor(options: KalshiContinuousStudyOptions) {
    if (options.feed.authority !== 'LIVE_READ_ONLY') {
      throw new Error('KALSHI_STUDY_FEED_MUST_BE_READ_ONLY');
    }
    this.options = options;
  }

  health(): KalshiStudyWorkerHealth {
    const state = this.stopped?'STOPPED':this.failed?'FAILED':
      !this.current?'NO_MARKET':
      this.interrupted?'DISCONNECTED':
      this.connection?'STREAMING':'CONNECTING';
    return Object.freeze({
      state,ticker:this.current?.market.ticker ?? null,
      connected:state==='STREAMING',recordedThisProcess:this.count,
      lastReceiptAt:this.lastReceiptAt,lastErrorCode:this.lastErrorCode,
      authority:'PAPER_ONLY',canSubmitOrders:false,
    });
  }

  private async disconnect(): Promise<void> {
    const connection=this.connection;
    this.connection=null;
    this.interrupted=true;
    if (connection) await connection.close();
  }

  async cycle(): Promise<KalshiStudyReceipt | null> {
    if (this.stopped || this.failed) throw new Error('KALSHI_STUDY_WORKER_STOPPED');
    const nowMs=this.options.now();
    if (!Number.isFinite(nowMs)) throw new Error('KALSHI_STUDY_INVALID_CLOCK');
    if (nowMs >= this.nextDiscoveryAt || this.current?.market.closesAtMs! <= nowMs) {
      this.nextDiscoveryAt=nowMs + 15_000;
      try {
        this.cached=await this.options.listMarkets(nowMs);
      } catch {
        this.lastErrorCode='MARKET_DISCOVERY_FAILED';
        // Do not admit new markets using guessed ticker/time metadata.
        if (!this.current || this.current.market.closesAtMs<=nowMs) this.cached=[];
      }
    }
    let proposed: Kalshi15mMarket | null=null;
    try {proposed=chooseKalshi15mMarket(this.cached,nowMs);} catch {
      this.lastErrorCode='AMBIGUOUS_MARKET';
    }
    if (!proposed && this.current && this.current.market.closesAtMs>nowMs) {
      proposed=this.current.market; // valid same-window market already admitted
    }
    if (this.current?.market.ticker !== proposed?.ticker) {
      await this.disconnect();
      this.current=proposed ? new Kalshi15mStudySession(
        proposed, this.options.sink,
        KALSHI_PREDICTION_HORIZONS_SEC.filter(h=>
          this.options.sink.has(proposed!.ticker+':'+h)),
      ):null;
    }
    if (!this.current) return null;
    if (this.interrupted) {
      await this.disconnect();
      // Explicitly reset all book/index state. Old timestamps cannot leak
      // across disconnected socket generations.
      this.current=new Kalshi15mStudySession(
        this.current.market,this.options.sink,
        KALSHI_PREDICTION_HORIZONS_SEC.filter(h=>
          this.options.sink.has(this.current!.market.ticker+':'+h)),
      );
      this.interrupted=false;
    }
    if (!this.connection) {
      const session=this.current;
      try {
        this.connection=await this.options.feed.subscribe(session.market.ticker,
          (frame,receivedAtMs)=>{
            if (this.current !== session || this.interrupted) return;
            try {
              const outcome=session.ingest(frame,receivedAtMs);
              if (outcome==='BOOK_RESNAPSHOT_REQUIRED') {
                this.interrupted=true;
                this.lastErrorCode='BOOK_SEQUENCE_GAP';
              }
            } catch {
              this.interrupted=true;
              this.lastErrorCode='FRAME_REJECTED';
            }
          },
          ()=>{
            if (this.current===session) {
              this.interrupted=true;
              this.lastErrorCode='FEED_DISCONNECTED';
            }
          });
      } catch {
        this.lastErrorCode='FEED_CONNECT_FAILED';
        this.interrupted=true;
        return null;
      }
    }
    // A discovery/handshake may take seconds. Never use the clock captured
    // before network awaits to manufacture an on-time forecast.
    // Even with an open socket, missing/stale data produces ABSTAIN.
    let estimate: KalshiIndependentEstimate | undefined;
    if (this.options.estimate && this.connection && !this.interrupted) {
      try {estimate=await this.options.estimate(this.current.market,this.options.now());}
      catch {this.lastErrorCode='INDEPENDENT_MODEL_FAILED';}
    }
    try {
      const committedAtMs=this.options.now();
      // Checkpoint itself enforces its 5-second receipt admission window;
      // after a slow connect, all missed checkpoints remain unobserved.
      const receipt=await this.current.checkpoint({
        nowMs:committedAtMs,estimate,feeUsdPerContract:this.options.feeUsdPerContract,
      });
      if (receipt) {
        this.count++;
        this.lastReceiptAt=receipt.observedAt;
        this.options.report?.(receipt);
      }
      return receipt;
    } catch {
      this.failed=true;
      this.lastErrorCode='DURABLE_RECEIPT_FAILED';
      await this.disconnect();
      throw new Error('KALSHI_STUDY_DURABLE_WRITE_FAILED');
    }
  }

  async run(signal: AbortSignal): Promise<void> {
    if (this.stopped || this.failed) throw new Error('KALSHI_STUDY_WORKER_STOPPED');
    try {
      while (!signal.aborted && !this.stopped) {
        await this.cycle();
        try {await wait(1000,undefined,{signal});}
        catch {if (!signal.aborted) throw new Error('KALSHI_STUDY_SLEEP_FAILED');}
      }
    } finally {await this.stop();}
  }
  async stop(): Promise<void> {
    this.stopped=true;
    await this.disconnect();
  }
}
