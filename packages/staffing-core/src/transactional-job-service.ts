import type { CreateJobInput, Job, JobIds, JobClock } from "./jobs.js";
import type { JobStore } from "./outbox.js";

export class TransactionalJobService {
  constructor(
    private readonly store: JobStore,
    private readonly ids: JobIds,
    private readonly clock: JobClock,
  ) {}

  async create(input: CreateJobInput): Promise<Job> {
    if (!input.organizationId || !input.employerId) throw new Error("organizationId and employerId are required");
    if (!input.title.trim() || !input.description.trim() || !input.location.trim()) throw new Error("Job title, description, and location are required");
    if (!Number.isFinite(input.payRate) || input.payRate <= 0) throw new Error("Pay rate must be greater than zero");
    if (!/^[A-Za-z]{3}$/.test(input.currency)) throw new Error("currency must be a 3-letter code");

    const now = this.clock.now();
    const job: Job = {
      id: this.ids.next("job"),
      organizationId: input.organizationId,
      employerId: input.employerId,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      payRate: input.payRate,
      currency: input.currency.toUpperCase(),
      remote: input.remote,
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
    };

    return this.store.transaction(async (tx) => {
      const saved = await tx.insertJob(job);
      await tx.enqueueEvent({
        id: this.ids.next("event"),
        type: "JOB_CREATED",
        aggregateId: saved.id,
        organizationId: saved.organizationId,
        occurredAt: now,
        payload: saved,
      });
      await tx.commit();
      return saved;
    });
  }
}
