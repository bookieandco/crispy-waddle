import type { MarketplaceJobRecord, MarketplaceJobStore } from "./marketplace-consumer.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresMarketplaceJobStore implements MarketplaceJobStore {
  constructor(private readonly db: SqlExecutor) {}

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const rows = await this.db.query<{ exists: boolean }>(
      `select exists(
         select 1 from staffing_marketplace_event_receipts where event_id = $1
       ) as exists`,
      [eventId],
    );
    return Boolean(rows[0]?.exists);
  }

  async publishJob(record: MarketplaceJobRecord): Promise<void> {
    await this.db.query(
      `insert into staffing_marketplace_jobs
       (id, organization_id, employer_id, title, description, location, pay_rate, currency, remote,
        status, created_at, updated_at, source_event_id, marketplace_published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do update set
         title = excluded.title,
         description = excluded.description,
         location = excluded.location,
         pay_rate = excluded.pay_rate,
         currency = excluded.currency,
         remote = excluded.remote,
         updated_at = excluded.updated_at`,
      [record.id, record.organizationId, record.employerId, record.title, record.description, record.location,
       record.payRate, record.currency, record.remote, record.status, record.createdAt, record.updatedAt,
       record.sourceEventId, record.publishedAt],
    );
  }

  async markEventProcessed(eventId: string, processedAt: string): Promise<void> {
    await this.db.query(
      `insert into staffing_marketplace_event_receipts (event_id, processed_at)
       values ($1,$2) on conflict (event_id) do nothing`,
      [eventId, processedAt],
    );
  }
}
