import type {
  Assignment,
  CareerPassportSnapshot,
  ID,
  JobOrder,
  MatchDecision,
  Placement,
  Referral,
  Timesheet,
} from "./domain.js";
import { PlacementVerticalSlice } from "./vertical-slice.js";

export interface PlacementActor {
  userId: ID;
  organizationId: ID;
  roles: string[];
}

export interface PlacementCommandContext {
  actor: PlacementActor;
  requestId: string;
}

export interface PlacementCommandResult<T> {
  data: T;
  requestId: string;
}

export interface PlacementCommandAuthorizer {
  assertAllowed(input: {
    actor: PlacementActor;
    action: string;
    resourceType: string;
    resourceId?: ID;
  }): Promise<void>;
}

export class PlacementCommandApi {
  constructor(
    private readonly service: PlacementVerticalSlice,
    private readonly authorization: PlacementCommandAuthorizer,
  ) {}

  async createJob(ctx: PlacementCommandContext, job: JobOrder): Promise<PlacementCommandResult<JobOrder>> {
    await this.authorization.assertAllowed({ actor: ctx.actor, action: "jobs.create", resourceType: "job" });
    const data = await this.service.createJob(job);
    return { data, requestId: ctx.requestId };
  }

  async createReferral(ctx: PlacementCommandContext, input: {
    job: JobOrder;
    worker: CareerPassportSnapshot;
    agencyId: ID;
    match: MatchDecision;
    consentId: ID;
  }): Promise<PlacementCommandResult<Referral>> {
    await this.authorization.assertAllowed({ actor: ctx.actor, action: "referrals.create", resourceType: "job", resourceId: input.job.id });
    const data = await this.service.createReferral(input);
    return { data, requestId: ctx.requestId };
  }

  async acceptAndPlace(ctx: PlacementCommandContext, input: {
    referral: Referral;
    job: JobOrder;
    worker: CareerPassportSnapshot;
    agreedPayRate: number;
    startsAt: string;
  }): Promise<PlacementCommandResult<Placement>> {
    await this.authorization.assertAllowed({ actor: ctx.actor, action: "placements.create", resourceType: "referral", resourceId: input.referral.id });
    const data = await this.service.acceptAndPlace(input);
    return { data, requestId: ctx.requestId };
  }

  async createAssignment(ctx: PlacementCommandContext, input: {
    placement: Placement;
    schedule: string;
    supervisorId?: ID;
  }): Promise<PlacementCommandResult<Assignment>> {
    await this.authorization.assertAllowed({ actor: ctx.actor, action: "assignments.create", resourceType: "placement", resourceId: input.placement.id });
    const data = await this.service.createAssignment(input);
    return { data, requestId: ctx.requestId };
  }

  async submitTimesheet(ctx: PlacementCommandContext, input: {
    assignment: Assignment;
    workerId: ID;
    periodStart: string;
    periodEnd: string;
    hours: number;
  }): Promise<PlacementCommandResult<Timesheet>> {
    await this.authorization.assertAllowed({ actor: ctx.actor, action: "timesheets.submit", resourceType: "assignment", resourceId: input.assignment.id });
    const data = await this.service.submitTimesheet(input);
    return { data, requestId: ctx.requestId };
  }
}
