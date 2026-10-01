import type { SqlClient } from './postgres-idempotency-store.js';
import {
  createStockAlertRule,
  createStockWatchlistEntry,
  normalizeStockSymbol,
  type StockAlertCondition,
  type StockAlertRule,
  type StockWatchlistEntry,
  type StockWatchlistStore,
} from './stock-watchlist.js';

type EntryRow = {
  entry_id: string;
  user_id: string;
  symbol: string;
  enabled: boolean;
  added_at: string | Date;
  updated_at: string | Date;
  evidence_ids: string[];
};

type AlertRow = {
  alert_id: string;
  user_id: string;
  symbol: string;
  condition: StockAlertCondition;
  threshold: string | number;
  reference_price: string | number | null;
  enabled: boolean;
  repeat: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  evidence_ids: string[];
};

const iso = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function safeTable(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_STOCK_WATCHLIST_TABLE_INVALID');
  }
  return value;
}

function entryFromRow(row: EntryRow): StockWatchlistEntry {
  return createStockWatchlistEntry({
    userId: row.user_id,
    symbol: row.symbol,
    enabled: row.enabled,
    addedAt: iso(row.added_at),
    updatedAt: iso(row.updated_at),
    evidenceIds: row.evidence_ids ?? [],
  });
}

function alertFromRow(row: AlertRow): StockAlertRule {
  return createStockAlertRule({
    alertId: row.alert_id,
    userId: row.user_id,
    symbol: row.symbol,
    condition: row.condition,
    threshold: Number(row.threshold),
    referencePrice:
      row.reference_price === null ? undefined : Number(row.reference_price),
    enabled: row.enabled,
    repeat: row.repeat,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    evidenceIds: row.evidence_ids ?? [],
  });
}

export class PostgresStockWatchlistStore implements StockWatchlistStore {
  private readonly entryTable: string;
  private readonly alertTable: string;

  constructor(
    private readonly client: SqlClient,
    options: Readonly<{
      entryTable?: string;
      alertTable?: string;
    }> = {},
  ) {
    this.entryTable = safeTable(
      options.entryTable ?? 'money_stock_watchlist_entries',
    );
    this.alertTable = safeTable(
      options.alertTable ?? 'money_stock_alerts',
    );
  }

  async upsertEntry(entry: StockWatchlistEntry): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.entryTable}
        (entry_id,user_id,symbol,enabled,added_at,updated_at,evidence_ids)
       VALUES($1,$2,$3,$4,$5,$6,$7::text[])
       ON CONFLICT(user_id,symbol) DO UPDATE SET
        enabled=EXCLUDED.enabled,
        updated_at=EXCLUDED.updated_at,
        evidence_ids=EXCLUDED.evidence_ids`,
      [
        entry.entryId,
        entry.userId,
        entry.symbol,
        entry.enabled,
        entry.addedAt,
        entry.updatedAt,
        [...entry.evidenceIds],
      ],
    );
  }

  async removeEntry(userId: string, symbol: string): Promise<void> {
    const normalized = normalizeStockSymbol(symbol);
    await this.client.query(
      `DELETE FROM ${this.entryTable} WHERE user_id=$1 AND symbol=$2`,
      [userId, normalized],
    );
  }

  async listEntries(userId: string): Promise<readonly StockWatchlistEntry[]> {
    const result = await this.client.query<EntryRow>(
      `SELECT * FROM ${this.entryTable}
       WHERE user_id=$1
       ORDER BY symbol ASC`,
      [userId],
    );
    return Object.freeze(result.rows.map(entryFromRow));
  }

  async upsertAlert(alert: StockAlertRule): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.alertTable}
        (alert_id,user_id,symbol,condition,threshold,reference_price,enabled,repeat,created_at,updated_at,evidence_ids)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[])
       ON CONFLICT(alert_id) DO UPDATE SET
        condition=EXCLUDED.condition,
        threshold=EXCLUDED.threshold,
        reference_price=EXCLUDED.reference_price,
        enabled=EXCLUDED.enabled,
        repeat=EXCLUDED.repeat,
        updated_at=EXCLUDED.updated_at,
        evidence_ids=EXCLUDED.evidence_ids
       WHERE ${this.alertTable}.user_id=EXCLUDED.user_id`,
      [
        alert.alertId,
        alert.userId,
        alert.symbol,
        alert.condition,
        alert.threshold,
        alert.referencePrice ?? null,
        alert.enabled,
        alert.repeat,
        alert.createdAt,
        alert.updatedAt,
        [...alert.evidenceIds],
      ],
    );
  }

  async listAlerts(
    userId: string,
    symbol?: string,
  ): Promise<readonly StockAlertRule[]> {
    const values: unknown[] = [userId];
    let where = 'user_id=$1';
    if (symbol) {
      values.push(normalizeStockSymbol(symbol));
      where += ' AND symbol=$2';
    }
    const result = await this.client.query<AlertRow>(
      `SELECT * FROM ${this.alertTable}
       WHERE ${where}
       ORDER BY symbol ASC,alert_id ASC`,
      values,
    );
    return Object.freeze(result.rows.map(alertFromRow));
  }
}
