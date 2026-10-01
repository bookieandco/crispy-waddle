import type { StockBar } from './stock-market-reality.js';

export const STOCK_BASELINE_SCHEMA_VERSION = 'MONEY-STOCK-BASELINE-01' as const;

export type StockBaselineSignal = 'LONG_ENTRY' | 'EXIT' | 'HOLD';

export type StockBaselineDecision = Readonly<{
  schemaVersion: typeof STOCK_BASELINE_SCHEMA_VERSION;
  decisionId: string;
  instrumentId: string;
  strategyId: 'stock-baseline-sma-20-50';
  signal: StockBaselineSignal;
  fastWindow: 20;
  slowWindow: 50;
  previousFast: number;
  previousSlow: number;
  currentFast: number;
  currentSlow: number;
  referencePrice: number;
  informationCutoff: string;
  evidenceIds: readonly string[];
  authority: 'PAPER_SIGNAL_ONLY';
  canAuthorizeLive: false;
}>;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function close(bar: StockBar): number {
  const n = Number(bar.close);
  if (!Number.isFinite(n) || n <= 0) throw new Error('MONEY_STOCK_BASELINE_CLOSE_INVALID');
  return n;
}

function assertChronological(bars: readonly StockBar[]): void {
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1]!.startsAt >= bars[i]!.startsAt) {
      throw new Error('MONEY_STOCK_BASELINE_BARS_NOT_CHRONOLOGICAL');
    }
    if (bars[i - 1]!.instrumentId !== bars[i]!.instrumentId) {
      throw new Error('MONEY_STOCK_BASELINE_INSTRUMENT_MISMATCH');
    }
  }
}

export function evaluateStockSmaBaseline(
  bars: readonly StockBar[],
): StockBaselineDecision {
  if (bars.length < 51) throw new Error('MONEY_STOCK_BASELINE_REQUIRES_51_BARS');
  assertChronological(bars);

  const currentWindow = bars.slice(-50);
  const previousWindow = bars.slice(-51, -1);
  const instrumentId = bars.at(-1)!.instrumentId;

  const currentSlow = mean(currentWindow.map(close));
  const currentFast = mean(currentWindow.slice(-20).map(close));
  const previousSlow = mean(previousWindow.map(close));
  const previousFast = mean(previousWindow.slice(-20).map(close));

  let signal: StockBaselineSignal = 'HOLD';
  if (previousFast <= previousSlow && currentFast > currentSlow) {
    signal = 'LONG_ENTRY';
  } else if (previousFast >= previousSlow && currentFast < currentSlow) {
    signal = 'EXIT';
  }

  const last = bars.at(-1)!;
  const evidenceIds = Object.freeze(
    bars.slice(-51).map((bar) => bar.evidenceRef),
  );

  return Object.freeze({
    schemaVersion: STOCK_BASELINE_SCHEMA_VERSION,
    decisionId:
      'stock-baseline:' +
      instrumentId +
      ':' +
      last.endsAt +
      ':' +
      signal,
    instrumentId,
    strategyId: 'stock-baseline-sma-20-50',
    signal,
    fastWindow: 20,
    slowWindow: 50,
    previousFast,
    previousSlow,
    currentFast,
    currentSlow,
    referencePrice: close(last),
    informationCutoff: last.endsAt,
    evidenceIds,
    authority: 'PAPER_SIGNAL_ONLY',
    canAuthorizeLive: false,
  });
}
