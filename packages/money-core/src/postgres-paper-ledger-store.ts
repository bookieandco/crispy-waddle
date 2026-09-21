import type { SqlClient } from './postgres-idempotency-store.js'
import {
  assertPaperLedgerEvent,
  decodePaperLedgerPayload,
  encodePaperLedgerPayload,
  type PaperLedgerAppendResult,
  type PaperLedgerEvent,
  type PaperLedgerEventKind,
  type PaperLedgerStore,
} from './paper-ledger.js'

type Row = {
  event_id: string
  paper_run_id: string
  kind: PaperLedgerEventKind
  occurred_at: string | Date
  payload_json: unknown
  payload_hash: string
  evidence_ids: string[]
}

const iso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()

function rowToEvent(row: Row): PaperLedgerEvent {
  const event = Object.freeze({
    eventId: row.event_id,
    paperRunId: row.paper_run_id,
    kind: row.kind,
    occurredAt: iso(row.occurred_at),
    payload: decodePaperLedgerPayload(row.payload_json),
    payloadHash: row.payload_hash,
    evidenceIds: Object.freeze([...(row.evidence_ids ?? [])].sort()),
    authority: 'SIMULATION_RECORD_ONLY' as const,
  })
  assertPaperLedgerEvent(event)
  return event
}

export class PostgresPaperLedgerStore implements PaperLedgerStore {
  constructor(
    private readonly client: SqlClient,
    private readonly table = 'money_paper_execution_events',
  ) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error('MONEY_043_LEDGER_TABLE_INVALID')
  }

  async append(event: PaperLedgerEvent): Promise<PaperLedgerAppendResult> {
    assertPaperLedgerEvent(event)
    const inserted = await this.client.query<Row>(
      `INSERT INTO ${this.table}
        (event_id,paper_run_id,kind,occurred_at,payload_json,payload_hash,evidence_ids)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::text[])
       ON CONFLICT(event_id) DO NOTHING
       RETURNING *`,
      [
        event.eventId,
        event.paperRunId,
        event.kind,
        event.occurredAt,
        encodePaperLedgerPayload(event.payload),
        event.payloadHash,
        [...event.evidenceIds],
      ],
    )
    if (inserted.rows[0]) return Object.freeze({ disposition: 'INSERTED', event: rowToEvent(inserted.rows[0]) })

    const existing = await this.client.query<Row>(
      `SELECT * FROM ${this.table} WHERE event_id=$1 LIMIT 1`,
      [event.eventId],
    )
    const row = existing.rows[0]
    if (!row) throw new Error('MONEY_043_LEDGER_APPEND_RACE_UNRESOLVED')
    const prior = rowToEvent(row)
    if (prior.payloadHash !== event.payloadHash || encodePaperLedgerPayload(prior.payload) !== encodePaperLedgerPayload(event.payload)) {
      throw new Error('MONEY_043_LEDGER_EVENT_CONFLICT')
    }
    return Object.freeze({ disposition: 'REPLAY', event: prior })
  }

  async get(eventId: string): Promise<PaperLedgerEvent | undefined> {
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table} WHERE event_id=$1 LIMIT 1`,
      [eventId],
    )
    return result.rows[0] ? rowToEvent(result.rows[0]) : undefined
  }

  async list(paperRunId: string): Promise<readonly PaperLedgerEvent[]> {
    const result = await this.client.query<Row>(
      `SELECT * FROM ${this.table} WHERE paper_run_id=$1 ORDER BY occurred_at ASC,event_id ASC`,
      [paperRunId],
    )
    return Object.freeze(result.rows.map(rowToEvent))
  }
}
