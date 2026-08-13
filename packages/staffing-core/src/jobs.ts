export type JobId = string;
export type OrganizationId = string;

export interface CreateJobInput {
  organizationId: OrganizationId;
  employerId: string;
  title: string;
  description: string;
  location: string;
  payRate: number;
  currency: string;
  remote: boolean;
}

export interface Job {
  id: JobId;
  organizationId: OrganizationId;
  employerId: string;
  title: string;
  description: string;
  location: string;
  payRate: number;
  currency: string;
  remote: boolean;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

export interface JobRepository {
  create(job: Job): Promise<Job>;
}

export interface StaffingEventBus {
  publish(event: {
    id: string;
    type: "JOB_CREATED";
    occurredAt: string;
    organizationId: OrganizationId;
    aggregateId: JobId;
    payload: Job;
  }): Promise<void>;
}

export interface JobIds { next(prefix: string): string; }
export interface JobClock { now(): string; }

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly events: StaffingEventBus,
    private readonly ids: JobIds,
    private readonly clock: JobClock,
  ) {}

  async create(input: CreateJobInput): Promise<Job> {
    if (!input.organizationId || !input.employerId) throw new Error("organizationId and employerId are required");
    if (!input.title.trim() || !input.description.trim() || !input.location.trim()) throw new Error("Job title, description, and location are required");
    if (!Number.isFinite(input.payRate) || input.payRate <= 0) throw new Error("Pay rate must be greater than zero");
    if (!input.currency) throw new Error("currency is required");

    const now = this.clock.now();
    const job: Job = {
      id: this.ids.next("job"),
      organizationId: input.organizationId,
      employerId: input.employerId,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      payRate: input.payRate,
      currency: input.currency,
      remote: input.remote,
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repository.create(job);
    await this.events.publish({ id: this.ids.next("event"), type: "JOB_CREATED", occurredAt: now, organizationId: saved.organizationId, aggregateId: saved.id, payload: saved });
    return saved;
  }
}
