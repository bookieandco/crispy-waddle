import type { Job } from "./jobs.js";
import type { OutboxRecord } from "./outbox-worker.js";

export interface MarketplaceJobRecord extends Job {
  sourceEventId: string;
  publishedAt: string;
}

export interface MarketplaceJobStore {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  publishJob(record: MarketplaceJobRecord): Promise<void>;
  markEventProcessed(eventId: string, processedAt: string): Promise<void>;
}

export interface MarketplaceConsumerClock {
  now(): string;
}

export class JobCreatedMarketplaceConsumer {
  constructor(
    private readonly store: MarketplaceJobStore,
    private readonly clock: MarketplaceConsumerClock,
  ) {}

  async consume(event: OutboxRecord): Promise<void> {
    if (event.eventType !== "JOB_CREATED") throw new Error(`Unsupported marketplace event: ${event.eventType}`);
    if (await this.store.hasProcessedEvent(event.id)) return;

    const publishedAt = this.clock.now();
    await this.store.publishJob({
      ...event.payload,
      sourceEventId: event.id,
      publishedAt,
    });
    await this.store.markEventProcessed(event.id, publishedAt);
  }
}
