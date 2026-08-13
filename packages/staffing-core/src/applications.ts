export interface Application {
  id: string;
  organizationId: string;
  jobId: string;
  workerId: string;
  status: "SUBMITTED" | "WITHDRAWN" | "REJECTED" | "ADVANCING" | "HIRED";
  coverNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  organizationId: string;
  jobId: string;
  workerId: string;
  coverNote?: string;
}

export interface ApplicationStore {
  create(application: Application): Promise<Application>;
  findByJobAndWorker(jobId: string, workerId: string): Promise<Application | null>;
}

export interface ApplicationIds { next(prefix: string): string; }
export interface ApplicationClock { now(): string; }
export interface ApplicationEvents { enqueue(event: { id: string; type: "APPLICATION_SUBMITTED"; aggregateId: string; organizationId: string; occurredAt: string; payload: Application }): Promise<void>; }

export class ApplicationService {
  constructor(private readonly store: ApplicationStore, private readonly ids: ApplicationIds, private readonly clock: ApplicationClock, private readonly events: ApplicationEvents) {}

  async submit(input: CreateApplicationInput): Promise<Application> {
    if (!input.organizationId || !input.jobId || !input.workerId) throw new Error("organizationId, jobId, and workerId are required");
    if (await this.store.findByJobAndWorker(input.jobId, input.workerId)) throw new Error("Worker has already applied to this job");
    const now = this.clock.now();
    const application: Application = {
      id: this.ids.next("application"), organizationId: input.organizationId, jobId: input.jobId,
      workerId: input.workerId, status: "SUBMITTED", coverNote: (input.coverNote ?? "").trim(), createdAt: now, updatedAt: now,
    };
    const saved = await this.store.create(application);
    await this.events.enqueue({ id: this.ids.next("event"), type: "APPLICATION_SUBMITTED", aggregateId: saved.id, organizationId: saved.organizationId, occurredAt: now, payload: saved });
    return saved;
  }
}
