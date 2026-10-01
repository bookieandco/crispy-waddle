import { createHash } from 'node:crypto';
import type { StockQuote } from './stock-market-reality.js';

export const STOCK_WATCHLIST_SCHEMA_VERSION = 'MONEY-STOCK-WATCHLIST-01' as const;

export type StockWatchlistEntry = Readonly<{
  schemaVersion: typeof STOCK_WATCHLIST_SCHEMA_VERSION;
  entryId: string;
  userId: string;
  symbol: string;
  instrumentId: string;
  enabled: boolean;
  addedAt: string;
  updatedAt: string;
  evidenceIds: readonly string[];
  authority: 'USER_CONFIG_ONLY';
  canAuthorizeTrade: false;
}>;

export type StockAlertCondition =
  | 'ABOVE'
  | 'BELOW'
  | 'MOVE_FROM_REFERENCE_BPS';

export type StockAlertRule = Readonly<{
  schemaVersion: typeof STOCK_WATCHLIST_SCHEMA_VERSION;
  alertId: string;
  userId: string;
  symbol: string;
  condition: StockAlertCondition;
  threshold: number;
  referencePrice?: number;
  enabled: boolean;
  repeat: boolean;
  createdAt: string;
  updatedAt: string;
  evidenceIds: readonly string[];
  authority: 'USER_CONFIG_ONLY';
  canAuthorizeTrade: false;
}>;

export type StockAlertEvaluation = Readonly<{
  alertId: string;
  symbol: string;
  triggered: boolean;
  observedPrice: number;
  observedMoveBps?: number;
  message?: string;
  observedAt: string;
  evidenceIds: readonly string[];
  authority: 'ATTENTION_ONLY';
  canAuthorizeTrade: false;
}>;

export interface StockWatchlistStore {
  upsertEntry(entry: StockWatchlistEntry): Promise<void> | void;
  removeEntry(userId: string, symbol: string): Promise<void> | void;
  listEntries(userId: string): Promise<readonly StockWatchlistEntry[]> | readonly StockWatchlistEntry[];
  upsertAlert(alert: StockAlertRule): Promise<void> | void;
  listAlerts(userId: string, symbol?: string): Promise<readonly StockAlertRule[]> | readonly StockAlertRule[];
}

function assertIso(value: string, code: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code);
}

export function normalizeStockSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    throw new Error('MONEY_STOCK_WATCHLIST_SYMBOL_INVALID');
  }
  return symbol;
}

export function createStockWatchlistEntry(input: Readonly<{
  userId: string;
  symbol: string;
  enabled?: boolean;
  addedAt: string;
  updatedAt?: string;
  evidenceIds: readonly string[];
}>): StockWatchlistEntry {
  if (!input.userId.trim()) throw new Error('MONEY_STOCK_WATCHLIST_USER_REQUIRED');
  const symbol = normalizeStockSymbol(input.symbol);
  const updatedAt = input.updatedAt ?? input.addedAt;
  assertIso(input.addedAt, 'MONEY_STOCK_WATCHLIST_ADDED_AT_INVALID');
  assertIso(updatedAt, 'MONEY_STOCK_WATCHLIST_UPDATED_AT_INVALID');
  if (updatedAt < input.addedAt) throw new Error('MONEY_STOCK_WATCHLIST_TIME_ORDER_INVALID');
  if (!input.evidenceIds.length) throw new Error('MONEY_STOCK_WATCHLIST_EVIDENCE_REQUIRED');

  const entryId =
    'stock-watchlist:' +
    createHash('sha256')
      .update(input.userId + ':' + symbol)
      .digest('hex');

  return Object.freeze({
    schemaVersion: STOCK_WATCHLIST_SCHEMA_VERSION,
    entryId,
    userId: input.userId,
    symbol,
    instrumentId: 'stock:' + symbol,
    enabled: input.enabled ?? true,
    addedAt: input.addedAt,
    updatedAt,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    authority: 'USER_CONFIG_ONLY',
    canAuthorizeTrade: false,
  });
}

export function createStockAlertRule(input: Readonly<{
  alertId: string;
  userId: string;
  symbol: string;
  condition: StockAlertCondition;
  threshold: number;
  referencePrice?: number;
  enabled?: boolean;
  repeat?: boolean;
  createdAt: string;
  updatedAt?: string;
  evidenceIds: readonly string[];
}>): StockAlertRule {
  if (!input.alertId.trim() || !input.userId.trim()) {
    throw new Error('MONEY_STOCK_ALERT_IDENTITY_REQUIRED');
  }
  const symbol = normalizeStockSymbol(input.symbol);
  if (!Number.isFinite(input.threshold) || input.threshold <= 0) {
    throw new Error('MONEY_STOCK_ALERT_THRESHOLD_INVALID');
  }
  if (
    input.condition === 'MOVE_FROM_REFERENCE_BPS' &&
    (!Number.isFinite(input.referencePrice) || (input.referencePrice ?? 0) <= 0)
  ) {
    throw new Error('MONEY_STOCK_ALERT_REFERENCE_PRICE_REQUIRED');
  }
  const updatedAt = input.updatedAt ?? input.createdAt;
  assertIso(input.createdAt, 'MONEY_STOCK_ALERT_CREATED_AT_INVALID');
  assertIso(updatedAt, 'MONEY_STOCK_ALERT_UPDATED_AT_INVALID');
  if (!input.evidenceIds.length) throw new Error('MONEY_STOCK_ALERT_EVIDENCE_REQUIRED');

  return Object.freeze({
    schemaVersion: STOCK_WATCHLIST_SCHEMA_VERSION,
    alertId: input.alertId,
    userId: input.userId,
    symbol,
    condition: input.condition,
    threshold: input.threshold,
    referencePrice: input.referencePrice,
    enabled: input.enabled ?? true,
    repeat: input.repeat ?? false,
    createdAt: input.createdAt,
    updatedAt,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    authority: 'USER_CONFIG_ONLY',
    canAuthorizeTrade: false,
  });
}

function quoteMid(quote: StockQuote): number {
  const bid = Number(quote.bidPrice);
  const ask = Number(quote.askPrice);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) {
    throw new Error('MONEY_STOCK_ALERT_QUOTE_INVALID');
  }
  return (bid + ask) / 2;
}

export function evaluateStockAlert(
  rule: StockAlertRule,
  quote: StockQuote,
): StockAlertEvaluation {
  if (quote.instrumentId !== 'stock:' + rule.symbol) {
    throw new Error('MONEY_STOCK_ALERT_INSTRUMENT_MISMATCH');
  }
  const price = quoteMid(quote);
  let triggered = false;
  let observedMoveBps: number | undefined;

  if (rule.enabled) {
    if (rule.condition === 'ABOVE') triggered = price >= rule.threshold;
    else if (rule.condition === 'BELOW') triggered = price <= rule.threshold;
    else {
      const reference = rule.referencePrice!;
      observedMoveBps = ((price / reference) - 1) * 10_000;
      triggered = Math.abs(observedMoveBps) >= rule.threshold;
    }
  }

  const message = triggered
    ? rule.condition === 'MOVE_FROM_REFERENCE_BPS'
      ? `${rule.symbol} moved ${Math.round(observedMoveBps!)} bps from the alert reference.`
      : `${rule.symbol} is ${price.toFixed(2)} and triggered ${rule.condition} ${rule.threshold}.`
    : undefined;

  return Object.freeze({
    alertId: rule.alertId,
    symbol: rule.symbol,
    triggered,
    observedPrice: price,
    observedMoveBps,
    message,
    observedAt: quote.receivedAt,
    evidenceIds: Object.freeze([
      ...new Set([...rule.evidenceIds, quote.evidenceRef]),
    ]),
    authority: 'ATTENTION_ONLY',
    canAuthorizeTrade: false,
  });
}

export class InMemoryStockWatchlistStore implements StockWatchlistStore {
  private readonly entries = new Map<string, StockWatchlistEntry>();
  private readonly alerts = new Map<string, StockAlertRule>();

  upsertEntry(entry: StockWatchlistEntry): void {
    this.entries.set(entry.userId + ':' + entry.symbol, entry);
  }

  removeEntry(userId: string, symbol: string): void {
    this.entries.delete(userId + ':' + normalizeStockSymbol(symbol));
  }

  listEntries(userId: string): readonly StockWatchlistEntry[] {
    return Object.freeze(
      [...this.entries.values()]
        .filter((entry) => entry.userId === userId)
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    );
  }

  upsertAlert(alert: StockAlertRule): void {
    this.alerts.set(alert.alertId, alert);
  }

  listAlerts(userId: string, symbol?: string): readonly StockAlertRule[] {
    const normalized = symbol ? normalizeStockSymbol(symbol) : undefined;
    return Object.freeze(
      [...this.alerts.values()]
        .filter(
          (alert) =>
            alert.userId === userId &&
            (normalized === undefined || alert.symbol === normalized),
        )
        .sort((a, b) => a.alertId.localeCompare(b.alertId)),
    );
  }
}
