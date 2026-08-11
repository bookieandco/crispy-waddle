export type ID = string;

export type JobStatus = "DRAFT" | "OPEN" | "PAUSED" | "FILLED" | "CLOSED";
export type ReferralStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
export type PlacementStatus = "PROPOSED" | "ACCEPTED" | "CANCELLED" | "ACTIVE" | "COMPLETED";
export type AssignmentStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "DISPUTED";

export interface JobOrder {
  id: ID;
  employerId: ID;
  agencyId?: ID;
  title: string;
  openings: number;
  location: string;
  payMin: number;
  payMax: number;
  currency: string;
  shift: string;
  startsAt: string;
  requirements: string[];
  status: JobStatus;
  source?: { system: string; externalId: string };
}

export interface CareerPassportSnapshot {
  workerId: ID;
  skills: string[];
  verifiedCredentials: string[];
  availability: string;
  workHistory: string[];
  consentScopes: string[];
}

export interface MatchDecision {
  workerId: ID;
  jobId: ID;
  score: number;
  reasons: string[];
  unmetRequirements: string[];
}

export interface Referral {
  id: ID;
  workerId: ID;
  jobId: ID;
  agencyId: ID;
  consentId: ID;
  match: MatchDecision;
  status: ReferralStatus;
}

export interface Placement {
  id: ID;
  referralId: ID;
  workerId: ID;
  agencyId: ID;
  employerId: ID;
  jobId: ID;
  agreedPayRate: number;
  currency: string;
  startsAt: string;
  status: PlacementStatus;
}

export interface Assignment {
  id: ID;
  placementId: ID;
  schedule: string;
  supervisorId?: ID;
  status: AssignmentStatus;
}

export interface Timesheet {
  id: ID;
  assignmentId: ID;
  workerId: ID;
  periodStart: string;
  periodEnd: string;
  hours: number;
  status: TimesheetStatus;
}

export type StaffingEvent =
  | { type: "JOB_CREATED"; job: JobOrder }
  | { type: "MATCH_CREATED"; match: MatchDecision }
  | { type: "REFERRAL_CREATED"; referral: Referral }
  | { type: "REFERRAL_ACCEPTED"; referralId: ID }
  | { type: "PLACEMENT_CREATED"; placement: Placement }
  | { type: "ASSIGNMENT_CREATED"; assignment: Assignment }
  | { type: "TIMESHEET_SUBMITTED"; timesheet: Timesheet };
