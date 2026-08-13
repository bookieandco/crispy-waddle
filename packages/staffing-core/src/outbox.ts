import type { Job } from "./jobs.js";

export interface JobStoreTransaction {
  insertJob(job: Job): Promise<Job>;
  enqueueEvent(event: OutboxEvent): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface JobStore {
  transaction<T>(work: (tx: JobStoreTransaction) => Promise<T>): Promise<T>;
}

export interface OutboxEvent {
  id: string;
  type: "JOB_CREATED";
  aggregateId: string;
  organizationId: string;
  occurredAt: string;
  payload: Job;
}

export class TransactionalJobRepository {
  constructor(private readonly store: JobStore) {}

  async create(job: Job, event: OutboxEvent): Promise<Job> {
    return this.store.transaction(async (tx) => {
      const saved = await tx.insertJob(job);
      await tx.enqueueEvent({ ...event, payload: saved });
      await tx.commit();
      return saved;
    });
  }
}
