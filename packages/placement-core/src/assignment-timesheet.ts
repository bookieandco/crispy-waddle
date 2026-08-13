import type { Assignment, ID, Placement, Timesheet } from "./domain.js";

export interface AssignmentRepository {
  saveAssignment(assignment: Assignment): Promise<void>;
  saveTimesheet(timesheet: Timesheet): Promise<void>;
  getAssignment(id: ID): Promise<Assignment | null>;
  approveTimesheet(id: ID, actorId: ID): Promise<Timesheet>;
}

export interface AssignmentIds { next(prefix: string): ID; }
export interface AssignmentClock { now(): string; }
export interface AssignmentEvents {
  publish(event: {
    type: "ASSIGNMENT_CREATED" | "TIMESHEET_SUBMITTED" | "TIMESHEET_APPROVED";
    assignment?: Assignment;
    timesheet?: Timesheet;
  }): Promise<void>;
}

export class AssignmentTimesheetService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly ids: AssignmentIds,
    private readonly clock: AssignmentClock,
    private readonly events: AssignmentEvents,
  ) {}

  async createAssignment(input: {
    placement: Placement;
    schedule: string;
    supervisorId?: ID;
  }): Promise<Assignment> {
    const assignment: Assignment = {
      id: this.ids.next("assignment"),
      placementId: input.placement.id,
      schedule: input.schedule,
      supervisorId: input.supervisorId,
      status: "ACTIVE",
      createdAt: this.clock.now(),
    };

    await this.repository.saveAssignment(assignment);
    await this.events.publish({ type: "ASSIGNMENT_CREATED", assignment });
    return assignment;
  }

  async submitTimesheet(input: {
    assignment: Assignment;
    workerId: ID;
    periodStart: string;
    periodEnd: string;
    hours: number;
  }): Promise<Timesheet> {
    if (input.hours < 0 || input.hours > 168) throw new Error("Timesheet hours must be between 0 and 168");

    const timesheet: Timesheet = {
      id: this.ids.next("timesheet"),
      assignmentId: input.assignment.id,
      workerId: input.workerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      hours: input.hours,
      status: "SUBMITTED",
      submittedAt: this.clock.now(),
    };

    await this.repository.saveTimesheet(timesheet);
    await this.events.publish({ type: "TIMESHEET_SUBMITTED", timesheet });
    return timesheet;
  }

  async approveTimesheet(id: ID, actorId: ID): Promise<Timesheet> {
    const timesheet = await this.repository.approveTimesheet(id, actorId);
    await this.events.publish({ type: "TIMESHEET_APPROVED", timesheet });
    return timesheet;
  }
}
