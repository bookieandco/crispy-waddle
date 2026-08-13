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

export interface PlacementRepository {
  saveJob(job: JobOrder): Promise<void>;
  saveReferral(referral: Referral): Promise<void>;
  savePlacement(placement: Placement): Promise<void>;
  saveAssignment(assignment: Assignment): Promise<void>;
  saveTimesheet(timesheet: Timesheet): Promise<void>;
}

export interface PlacementEventSink {
  publish(event: unknown): Promise<void>;
}

export interface ConsentGateway {
  assertGranted(workerId: ID, agencyId: ID, scopes: string[]): Promise<void>;
}

export interface PlacementPolicy {
  assertPlacementAllowed(input: {
    job: JobOrder;
    worker: CareerPassportSnapshot;
    referral: Referral;
  }): Promise<void>;
}

export interface StaffingIds {
  next(prefix: string): ID;
}

export interface StaffingClock {
  now(): string;
}

export class PlacementVerticalSlice {
  constructor(
    private readonly repo: PlacementRepository,
    private readonly events: PlacementEventSink,
    private readonly consent: ConsentGateway,
    private readonly policy: PlacementPolicy,
    private readonly ids: StaffingIds,
    private readonly clock: StaffingClock,
  ) {}

  async createJob(job: JobOrder): Promise<JobOrder> {
    await this.repo.saveJob(job);
    await this.events.publish({ type: "JOB_CREATED", job });
    return job;
  }

  async createReferral(input: {
    job: JobOrder;
    worker: CareerPassportSnapshot;
    agencyId: ID;
    match: MatchDecision;
    consentId: ID;
  }): Promise<Referral> {
    await this.consent.assertGranted(input.worker.workerId, input.agencyId, input.worker.consentScopes);

    const referral: Referral = {
      id: this.ids.next("ref"),
      workerId: input.worker.workerId,
      jobId: input.job.id,
      agencyId: input.agencyId,
      consentId: input.consentId,
      match: input.match,
      status: "PENDING",
    };

    await this.repo.saveReferral(referral);
    await this.events.publish({ type: "MATCH_CREATED", match: input.match });
    await this.events.publish({ type: "REFERRAL_CREATED", referral });
    return referral;
  }

  async acceptAndPlace(input: {
    referral: Referral;
    job: JobOrder;
    worker: CareerPassportSnapshot;
    agreedPayRate: number;
    startsAt: string;
  }): Promise<Placement> {
    await this.policy.assertPlacementAllowed(input);

    const placement: Placement = {
      id: this.ids.next("plc"),
      referralId: input.referral.id,
      workerId: input.worker.workerId,
      agencyId: input.referral.agencyId,
      employerId: input.job.employerId,
      jobId: input.job.id,
      agreedPayRate: input.agreedPayRate,
      currency: input.job.currency,
      startsAt: input.startsAt,
      status: "ACCEPTED",
    };

    await this.repo.savePlacement(placement);
    await this.events.publish({ type: "REFERRAL_ACCEPTED", referralId: input.referral.id });
    await this.events.publish({ type: "PLACEMENT_CREATED", placement });
    return placement;
  }

  async createAssignment(input: {
    placement: Placement;
    schedule: string;
    supervisorId?: ID;
  }): Promise<Assignment> {
    const assignment: Assignment = {
      id: this.ids.next("asg"),
      placementId: input.placement.id,
      schedule: input.schedule,
      supervisorId: input.supervisorId,
      status: "SCHEDULED",
    };

    await this.repo.saveAssignment(assignment);
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
    const timesheet: Timesheet = {
      id: this.ids.next("ts"),
      assignmentId: input.assignment.id,
      workerId: input.workerId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      hours: input.hours,
      status: "SUBMITTED",
    };

    await this.repo.saveTimesheet(timesheet);
    await this.events.publish({ type: "TIMESHEET_SUBMITTED", timesheet });
    return timesheet;
  }
}
