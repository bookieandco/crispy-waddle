export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "BILLABLE";

export interface Timesheet {
  id: string;
  organizationId: string;
  placementId: string;
  workerId: string;
  periodStart: string;
  periodEnd: string;
  regularHours: number;
  overtimeHours: number;
  status: TimesheetStatus;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetStore {
  create(timesheet: Timesheet): Promise<Timesheet>;
  findByPlacementPeriod(placementId: string, periodStart: string, periodEnd: string): Promise<Timesheet | null>;
  update(timesheet: Timesheet): Promise<Timesheet>;
}

export class TimesheetService {
  constructor(private readonly store: TimesheetStore, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async create(input: Omit<Timesheet, "id" | "status" | "createdAt" | "updatedAt">): Promise<Timesheet> {
    if (!input.organizationId || !input.placementId || !input.workerId) throw new Error("Timesheet requires organization, placement, and worker");
    if (input.periodEnd < input.periodStart) throw new Error("Timesheet period is invalid");
    if (input.regularHours < 0 || input.overtimeHours < 0) throw new Error("Timesheet hours cannot be negative");
    if (await this.store.findByPlacementPeriod(input.placementId, input.periodStart, input.periodEnd)) throw new Error("Timesheet already exists for this placement period");
    const now = this.clock.now();
    return this.store.create({ ...input, id: this.ids.next("timesheet"), status: "DRAFT", createdAt: now, updatedAt: now });
  }

  async transition(timesheet: Timesheet, next: Exclude<TimesheetStatus, "DRAFT">): Promise<Timesheet> {
    const allowed: Record<Exclude<TimesheetStatus, "DRAFT">, TimesheetStatus[]> = {
      SUBMITTED: ["DRAFT"], APPROVED: ["SUBMITTED"], REJECTED: ["SUBMITTED"], BILLABLE: ["APPROVED"],
    };
    if (!allowed[next].includes(timesheet.status)) throw new Error(`Invalid timesheet transition ${timesheet.status} -> ${next}`);
    const now = this.clock.now();
    return this.store.update({ ...timesheet, status: next, submittedAt: next === "SUBMITTED" ? now : timesheet.submittedAt, approvedAt: next === "APPROVED" ? now : timesheet.approvedAt, updatedAt: now });
  }
}
