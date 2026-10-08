import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  JOB_STATUSES,
  OPEN_JOB_STATUS,
  PLACEMENT_STATUSES,
  TIMESHEET_STATUSES,
  isOpenJob,
} from "./lifecycle.js";

describe("canonical Staffing lifecycle", () => {
  it("uses PUBLISHED as the only open job state", () => {
    expect(JOB_STATUSES).toEqual(["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"]);
    expect(OPEN_JOB_STATUS).toBe("PUBLISHED");
    expect(isOpenJob("PUBLISHED")).toBe(true);
    expect(isOpenJob("OPEN")).toBe(false);
    expect(JOB_STATUSES).not.toContain("FILLED");
  });

  it("uses one placement terminal vocabulary", () => {
    expect(PLACEMENT_STATUSES).toEqual(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"]);
    expect(PLACEMENT_STATUSES).not.toContain("ENDED");
    expect(PLACEMENT_STATUSES).not.toContain("PROPOSED");
  });

  it("permits the billing terminal state used by the timesheet service", () => {
    expect(TIMESHEET_STATUSES).toEqual(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "BILLABLE"]);
    expect(TIMESHEET_STATUSES).not.toContain("DISPUTED");
  });

  it("includes every application state written by review/interview/placement services", () => {
    for (const state of [
      "SUBMITTED","ADVANCING","ADVANCED","REFERRED","ON_HOLD","INTERVIEW",
      "INTERVIEW_SCHEDULED","INTERVIEW_FAILED","PLACEMENT_READY","PLACED",
      "REJECTED","DECLINED","WITHDRAWN","HIRED",
    ]) {
      expect(APPLICATION_STATUSES).toContain(state);
    }
  });
});
