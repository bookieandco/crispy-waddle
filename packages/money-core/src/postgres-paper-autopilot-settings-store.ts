import type { SqlClient } from './postgres-idempotency-store.js';
import {
  createPaperAutopilotSettings,
  type PaperAutopilotSettings,
  type PaperAutopilotSettingsStore,
} from './paper-autopilot-settings.js';
import type { AlpacaStockFeed } from './alpaca-stock-market-data.js';
import type { PaperAutopilotMode } from './paper-learning-loop.js';

type Row = {
  user_id: string;
  provider: 'alpaca';
  account_id: string;
  mode: PaperAutopilotMode;
  stock_feed: AlpacaStockFeed;
  strategy_id: string;
  base_order_notional_minor: string | number | bigint;
  max_order_notional_minor: string | number | bigint;
  maximum_concurrent_positions: number;
  updated_at: string | Date;
  evidence_ids: string[];
};

const iso = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function safeTable(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_PAPER_SETTINGS_TABLE_INVALID');
  }
  return value;
}

function fromRow(row: Row): PaperAutopilotSettings {
  return createPaperAutopilotSettings({
    userId: row.user_id,
    accountId: row.account_id,
    mode: row.mode,
    stockFeed: row.stock_feed,
    strategyId: row.strategy_id,
    baseOrderNotionalMinor: String(row.base_order_notional_minor),
    maxOrderNotionalMinor: String(row.max_order_notional_minor),
    maximumConcurrentPositions: row.maximum_concurrent_positions,
    updatedAt: iso(row.updated_at),
    evidenceIds: row.evidence_ids ?? [],
  });
}

export class PostgresPaperAutopilotSettingsStore
  implements PaperAutopilotSettingsStore
{
  private readonly table: string;

  constructor(
    private readonly client: SqlClient,
    tableName = 'money_paper_autopilot_settings',
  ) {
    this.table = safeTable(tableName);
  }

  async put(settings: PaperAutopilotSettings): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.table}
        (user_id,provider,account_id,mode,stock_feed,strategy_id,base_order_notional_minor,max_order_notional_minor,maximum_concurrent_positions,updated_at,evidence_ids)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[])
       ON CONFLICT(user_id,provider,account_id) DO UPDATE SET
        mode=EXCLUDED.mode,
        stock_feed=EXCLUDED.stock_feed,
        strategy_id=EXCLUDED.strategy_id,
        base_order_notional_minor=EXCLUDED.base_order_notional_minor,
        max_order_notional_minor=EXCLUDED.max_order_notional_minor,
        maximum_concurrent_positions=EXCLUDED.maximum_concurrent_positions,
        updated_at=EXCLUDED.updated_at,
        evidence_ids=EXCLUDED.evidence_ids`,
      [
        settings.userId,
        settings.provider,
        settings.accountId,
        settings.mode,
        settings.stockFeed,
        settings.strategyId,
        settings.baseOrderNotionalMinor,
        settings.maxOrderNotionalMinor,
        settings.maximumConcurrentPositions,
        settings.updatedAt,
        [...settings.evidenceIds],
      ],
    );
  }

  async get(
    userId: string,
    provider: 'alpaca',
    accountId: string,
  ): Promise<PaperAutopilotSettings | undefined> {
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table}
       WHERE user_id=$1 AND provider=$2 AND account_id=$3
       LIMIT 1`,
      [userId, provider, accountId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  }
}
