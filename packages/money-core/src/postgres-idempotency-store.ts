import type {
  IdempotencyRecord,
  IdempotencyStore,
  TransactionWriteResult,
} from './idempotency-store.js';

/** Minimal SQL surface so money-core does not depend directly on a PostgreSQL driver. */
export type SqlClient = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export type PostgresIdempotencyStoreOptions = {
  client: SqlClient;
  tableName?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

type IdempotencyRow = {
  request_id: string;
  user_id: string;
  capability: string;
  status: 'processing' | 'completed';
  provider_reference: string | null;
  result_status: string | null;
};

function toRecord(row: IdempotencyRow): IdempotencyRecord {
  const record: IdempotencyRecord = {
    requestId: row.request_id,
    userId: row.user_id,
    capability: row.capability,
    status: row.status,
  };

  if (row.provider_reference !== null && row.result_status !== null) {
    record.result = {
      providerReference: row.provider_reference,
      status: row.result_status,
    };
  }

  return record;
}

function assertSafeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_IDEMPOTENCY_TABLE_INVALID');
  }
  return value;
}

/**
 * PostgreSQL-backed idempotency store.
 *
 * The database owns the race: claim() uses UNIQUE(request_id) and
 * INSERT ... ON CONFLICT DO NOTHING. No process-local lock is involved.
 */
export class PostgresIdempotencyStore implements IdempotencyStore {
  private readonly client: SqlClient;
  private readonly table: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: PostgresIdempotencyStoreOptions) {
    this.client = options.client;
    this.table = assertSafeIdentifier(options.tableName ?? 'money_transaction_requests');
    this.pollIntervalMs = options.pollIntervalMs ?? 25;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async claim(input: Omit<IdempotencyRecord, 'status' | 'result'>) {
    const inserted = await this.client.query<IdempotencyRow>(
      `
        INSERT INTO ${this.table}
          (request_id, user_id, capability, status)
        VALUES ($1, $2, $3, 'processing')
        ON CONFLICT (request_id) DO NOTHING
        RETURNING request_id, user_id, capability, status,
                  provider_reference, result_status
      `,
      [input.requestId, input.userId, input.capability],
    );

    if (inserted.rows[0]) return { claimed: true as const };

    const existing = await this.find(input.requestId);
    if (!existing) throw new Error('MONEY_IDEMPOTENCY_NOT_FOUND');
    return { claimed: false as const, record: existing };
  }

  async complete(requestId: string, result: TransactionWriteResult): Promise<void> {
    const updated = await this.client.query<IdempotencyRow>(
      `
        UPDATE ${this.table}
        SET status = 'completed',
            provider_reference = $2,
            result_status = $3,
            completed_at = CURRENT_TIMESTAMP
        WHERE request_id = $1
          AND status = 'processing'
        RETURNING request_id
      `,
      [requestId, result.providerReference, result.status],
    );

    if (!updated.rows[0]) throw new Error('MONEY_IDEMPOTENCY_NOT_CLAIMED');
  }

  async waitForCompletion(requestId: string): Promise<TransactionWriteResult> {
    const deadline = Date.now() + this.timeoutMs;

    while (Date.now() <= deadline) {
      const record = await this.find(requestId);
      if (!record) throw new Error('MONEY_IDEMPOTENCY_NOT_FOUND');
      if (record.status === 'completed' && record.result) return record.result;
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error('MONEY_IDEMPOTENCY_TIMEOUT');
  }

  private async find(requestId: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.client.query<IdempotencyRow>(
      `
        SELECT request_id, user_id, capability, status,
               provider_reference, result_status
        FROM ${this.table}
        WHERE request_id = $1
        LIMIT 1
      `,
      [requestId],
    );

    const row = result.rows[0];
    return row ? toRecord(row) : undefined;
  }
}
