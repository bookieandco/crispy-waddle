export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "ADVANCING",
  "ADVANCED",
  "REFERRED",
  "ON_HOLD",
  "INTERVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_FAILED",
  "PLACEMENT_READY",
  "PLACED",
  "REJECTED",
  "DECLINED",
  "WITHDRAWN",
  "HIRED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PLACEMENT_STATUSES = ["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export const TIMESHEET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "BILLABLE"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const OPEN_JOB_STATUS: JobStatus = "PUBLISHED";

export function isOpenJob(status: string): status is JobStatus {
  return status === OPEN_JOB_STATUS;
}
