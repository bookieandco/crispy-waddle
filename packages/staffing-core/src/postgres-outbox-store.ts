import type { OutboxRecord, OutboxStore } from "./outbox-worker.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresOutboxStore implements OutboxStore {
  constructor(private readonly db: SqlExecutor) {}

  async claimBatch(limit: number, now: string): Promise<OutboxRecord[]> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<OutboxRecord>(
        `select id, event_type as "eventType", aggregate_id as "aggregateId",
                organization_id as "organizationId", occurred_at as "occurredAt",
                payload, attempts, available_at as "availableAt"
         from staffing_event_outbox
         where status = 'PENDING' and available_at <= $1
         order by occurred_at asc
         for update skip locked
         limit $2`,
        [now, limit],
      );

      for (const row of rows) {
        await tx.query(
          `update staffing_event_outbox
           set attempts = attempts + 1
           where id = $1 and status = 'PENDING'`,
          [row.id],
        );
      }

      return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }));
    });
  }

  async markPublished(id: string, publishedAt: string): Promise<void> {
    await this.db.query(
      `update staffing_event_outbox
       set status = 'PUBLISHED', published_at = $2
       where id = $1 and status = 'PENDING'`,
      [id, publishedAt],
    );
  }

  async markFailed(id: string, nextAvailableAt: string, error: string): Promise<void> {
    await this.db.query(
      `update staffing_event_outbox
       set status = 'PENDING', available_at = $2, last_error = $3
       where id = $1 and status = 'PENDING'`,
      [id, nextAvailableAt, error.slice(0, 2000)],
    );
  }
}
