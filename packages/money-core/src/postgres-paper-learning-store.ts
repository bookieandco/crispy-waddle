import type { SqlClient } from './postgres-idempotency-store.js';
import {
  assertPaperLearningEvent,
  decodePaperLearningPayload,
  encodePaperLearningPayload,
  type PaperLearningAppendResult,
  type PaperLearningEvent,
  type PaperLearningEventKind,
  type PaperLearningStore,
} from './paper-learning-store.js';

type Row = {
  event_id: string;
  user_id: string;
  paper_run_id: string | null;
  strategy_id: string | null;
  instrument_id: string | null;
  kind: PaperLearningEventKind;
  occurred_at: string | Date;
  payload_json: unknown;
  payload_hash: string;
  evidence_ids: string[];
};

const iso = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function assertTable(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_PAPER_LEARNING_TABLE_INVALID');
  }
  return value;
}

function rowToEvent(row: Row): PaperLearningEvent {
  const event: PaperLearningEvent = Object.freeze({
    eventId: row.event_id,
    userId: row.user_id,
    paperRunId: row.paper_run_id ?? undefined,
    strategyId: row.strategy_id ?? undefined,
    instrumentId: row.instrument_id ?? undefined,
    kind: row.kind,
    occurredAt: iso(row.occurred_at),
    payload: decodePaperLearningPayload(row.payload_json),
    payloadHash: row.payload_hash,
    evidenceIds: Object.freeze([...(row.evidence_ids ?? [])].sort()),
    authority: 'LEARNING_RECORD_ONLY',
    canAuthorizeLive: false,
  });
  assertPaperLearningEvent(event);
  return event;
}

function validateLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('MONEY_PAPER_LEARNING_LIMIT_INVALID');
  }
  return limit;
}

export class PostgresPaperLearningStore implements PaperLearningStore {
  private readonly table: string;

  constructor(
    private readonly client: SqlClient,
    tableName = 'money_paper_learning_events',
  ) {
    this.table = assertTable(tableName);
  }

  async append(event: PaperLearningEvent): Promise<PaperLearningAppendResult> {
    assertPaperLearningEvent(event);

    const inserted = await this.client.query<Row>(
      `INSERT INTO ${this.table}
        (event_id,user_id,paper_run_id,strategy_id,instrument_id,kind,occurred_at,payload_json,payload_hash,evidence_ids)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::text[])
       ON CONFLICT(event_id) DO NOTHING
       RETURNING *`,
      [
        event.eventId,
        event.userId,
        event.paperRunId ?? null,
        event.strategyId ?? null,
        event.instrumentId ?? null,
        event.kind,
        event.occurredAt,
        encodePaperLearningPayload(event.payload),
        event.payloadHash,
        [...event.evidenceIds],
      ],
    );

    if (inserted.rows[0]) {
      return Object.freeze({
        disposition: 'INSERTED',
        event: rowToEvent(inserted.rows[0]),
      });
    }

    const existing = await this.client.query<Row>(
      `SELECT * FROM ${this.table} WHERE event_id=$1 LIMIT 1`,
      [event.eventId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('MONEY_PAPER_LEARNING_APPEND_RACE_UNRESOLVED');
    const prior = rowToEvent(row);

    if (
      prior.payloadHash !== event.payloadHash ||
      encodePaperLearningPayload(prior.payload) !==
        encodePaperLearningPayload(event.payload)
    ) {
      throw new Error('MONEY_PAPER_LEARNING_EVENT_CONFLICT');
    }

    return Object.freeze({ disposition: 'REPLAY', event: prior });
  }

  async get(eventId: string): Promise<PaperLearningEvent | undefined> {
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table} WHERE event_id=$1 LIMIT 1`,
      [eventId],
    );
    return result.rows[0] ? rowToEvent(result.rows[0]) : undefined;
  }

  async listByUser(
    userId: string,
    limit = 200,
  ): Promise<readonly PaperLearningEvent[]> {
    validateLimit(limit);
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table}
       WHERE user_id=$1
       ORDER BY occurred_at DESC,event_id DESC
       LIMIT $2`,
      [userId, limit],
    );
    return Object.freeze(result.rows.map(rowToEvent));
  }

  async listByStrategy(
    userId: string,
    strategyId: string,
    limit = 200,
  ): Promise<readonly PaperLearningEvent[]> {
    validateLimit(limit);
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table}
       WHERE user_id=$1 AND strategy_id=$2
       ORDER BY occurred_at DESC,event_id DESC
       LIMIT $3`,
      [userId, strategyId, limit],
    );
    return Object.freeze(result.rows.map(rowToEvent));
  }
}
