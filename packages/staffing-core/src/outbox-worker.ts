import type { Job } from "./jobs.js";

export interface OutboxRecord {
  id: string;
  eventType: "JOB_CREATED";
  aggregateId: string;
  organizationId: string;
  occurredAt: string;
  payload: Job;
  attempts: number;
  availableAt: string;
}

export interface OutboxStore {
  claimBatch(limit: number, now: string): Promise<OutboxRecord[]>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  markFailed(id: string, nextAvailableAt: string, error: string): Promise<void>;
}

export interface MarketplacePublisher {
  publishJobCreated(event: OutboxRecord): Promise<void>;
}

export interface OutboxClock {
  now(): string;
}

export interface RetryPolicy {
  next(attempt: number, now: string): string;
}

export class JobOutboxWorker {
  constructor(
    private readonly store: OutboxStore,
    private readonly publisher: MarketplacePublisher,
    private readonly clock: OutboxClock,
    private readonly retry: RetryPolicy,
  ) {}

  async runOnce(limit = 50): Promise<{ published: number; failed: number }> {
    const now = this.clock.now();
    const events = await this.store.claimBatch(limit, now);
    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.publisher.publishJobCreated(event);
        await this.store.markPublished(event.id, this.clock.now());
        published++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown outbox publication failure";
        await this.store.markFailed(event.id, this.retry.next(event.attempts + 1, this.clock.now()), message);
        failed++;
      }
    }

    return { published, failed };
  }
}
