export type PlacementStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface Placement {
  id: string;
  organizationId: string;
  applicationId: string;
  jobId: string;
  workerId: string;
  employerId: string;
  agencyId?: string;
  status: PlacementStatus;
  startDate: string;
  endDate?: string;
  payRate: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlacementStore {
  create(placement: Placement): Promise<Placement>;
  findByApplication(applicationId: string): Promise<Placement | null>;
}

export interface PlacementEvents {
  enqueue(event: { id: string; type: "PLACEMENT_CREATED"; aggregateId: string; organizationId: string; occurredAt: string; payload: Placement }): Promise<void>;
}

export class PlacementService {
  constructor(private readonly store: PlacementStore, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }, private readonly events: PlacementEvents) {}

  async create(input: Omit<Placement, "id" | "status" | "createdAt" | "updatedAt">): Promise<Placement> {
    if (!input.organizationId || !input.applicationId || !input.jobId || !input.workerId || !input.employerId) throw new Error("Placement requires organization, application, job, worker, and employer");
    if (!input.startDate) throw new Error("Placement startDate is required");
    if (!Number.isFinite(input.payRate) || input.payRate <= 0) throw new Error("Placement pay rate must be greater than zero");
    if (!/^[A-Za-z]{3}$/.test(input.currency)) throw new Error("currency must be a 3-letter code");
    if (await this.store.findByApplication(input.applicationId)) throw new Error("A placement already exists for this application");
    const now = this.clock.now();
    const placement: Placement = { ...input, id: this.ids.next("placement"), status: "PENDING", currency: input.currency.toUpperCase(), createdAt: now, updatedAt: now };
    const saved = await this.store.create(placement);
    await this.events.enqueue({ id: this.ids.next("event"), type: "PLACEMENT_CREATED", aggregateId: saved.id, organizationId: saved.organizationId, occurredAt: now, payload: saved });
    return saved;
  }
}
