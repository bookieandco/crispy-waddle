import { describe, expect, it } from "vitest";
import { BOOKING_APPROVAL_CAPABILITY, approvePendingBooking, createPendingApproval, isExecutionEligible, markBookingExecutionEligible, type AuthorizationContext } from "./approval-gate";

const auth: AuthorizationContext = {
  authorizationId: "auth-001",
  actorId: "dispatcher-001",
  actorType: "human",
  capability: BOOKING_APPROVAL_CAPABILITY,
  scope: "booking:booking-001",
  method: "explicit_user_action",
  authorizedAt: "2026-08-27T18:00:00.000Z",
};

describe("booking approval gate", () => {
  it("requires PENDING_APPROVAL -> APPROVED -> EXECUTION_ELIGIBLE", () => {
    const pending = createPendingApproval("booking-001");
    expect(isExecutionEligible(pending)).toBe(false);
    const approved = approvePendingBooking(pending, auth, "2026-08-27T18:01:00.000Z");
    expect(approved.status).toBe("APPROVED");
    expect(isExecutionEligible(approved)).toBe(false);
    const eligible = markBookingExecutionEligible(approved, { ...auth, authorizationId: "auth-002" }, "2026-08-27T18:02:00.000Z");
    expect(eligible.status).toBe("EXECUTION_ELIGIBLE");
    expect(isExecutionEligible(eligible)).toBe(true);
    expect(eligible.audit[1].previousAuditHash).toBe(eligible.audit[0].recordHash);
  });

  it("rejects a direct pending -> execution-eligible transition", () => {
    expect(() => markBookingExecutionEligible(createPendingApproval("booking-002"), auth, "2026-08-27T18:01:00.000Z")).toThrow("Invalid approval transition");
  });

  it("requires explicit human authorization for the booking capability", () => {
    const pending = createPendingApproval("booking-003");
    expect(() => approvePendingBooking(pending, { ...auth, actorType: "system" }, "2026-08-27T18:01:00.000Z")).toThrow("explicit human authorization");
    expect(() => approvePendingBooking(pending, { ...auth, capability: "marketplace.booking.create" }, "2026-08-27T18:01:00.000Z")).toThrow("not valid for booking approval");
  });

  it("keeps an append-only audit chain", () => {
    const pending = createPendingApproval("booking-004");
    const approved = approvePendingBooking(pending, auth, "2026-08-27T18:01:00.000Z");
    const first = approved.audit[0];
    const eligible = markBookingExecutionEligible(approved, { ...auth, authorizationId: "auth-002" }, "2026-08-27T18:02:00.000Z");
    expect(approved.audit[0]).toEqual(first);
    expect(eligible.audit[0]).toEqual(first);
    expect(eligible.audit[1].recordHash).not.toBe(first.recordHash);
  });
});
