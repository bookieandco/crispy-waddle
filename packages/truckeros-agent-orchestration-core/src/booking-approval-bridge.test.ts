import { describe, expect, it } from "vitest";
import { createBookingExecutionProposal, type ExecutionEligibleBookingPackage, type BookingExecutionAuthorization } from "./booking-approval-bridge.js";

const bookingPackage: ExecutionEligibleBookingPackage = {
  bookingPackageId: "bp-1",
  offerId: "offer-1",
  loadId: "load-1",
  carrierId: "carrier-1",
  truckId: "truck-1",
  driverId: "driver-1",
  shipperId: "shipper-1",
  lane: { origin: "Charlotte, NC", destination: "Atlanta, GA" },
  schedule: { pickupAt: "2026-08-28T15:00:00Z", deliveryAt: "2026-08-29T06:00:00Z" },
  rate: { amountMinor: 120000, currency: "USD" },
  status: "EXECUTION_ELIGIBLE",
  approvalRequired: true,
  executionStarted: false,
};

const authorization: BookingExecutionAuthorization = {
  authorizationId: "auth-1",
  actorId: "user-1",
  actorType: "human",
  method: "explicit_user_action",
  authorizedAt: "2026-08-28T12:00:00Z",
  capabilityId: "freight.booking.execute",
  approvalRequired: true,
  scope: "booking:bp-1",
};

describe("createBookingExecutionProposal", () => {
  it("creates a proposal only from an execution-eligible package", () => {
    const proposal = createBookingExecutionProposal({
      bookingPackage,
      authorization,
      workflowRunId: "run-1",
      agentId: "dispatcher-agent",
      agentVersion: "1.0.0",
      toolId: "booking.execute",
      createdAt: "2026-08-28T12:01:00Z",
    });

    expect(proposal.id).toBe("booking-proposal:bp-1:auth-1");
    expect(proposal.input.bookingPackageId).toBe("bp-1");
    expect(proposal.authorizationContext.actorId).toBe("user-1");
    expect(proposal.authorizationContext.resourceId).toBe("bp-1");
  });

  it("rejects pending packages before they can enter orchestration", () => {
    expect(() => createBookingExecutionProposal({
      bookingPackage: { ...bookingPackage, status: "PENDING_APPROVAL" },
      authorization,
      workflowRunId: "run-1",
      agentId: "dispatcher-agent",
      agentVersion: "1.0.0",
      toolId: "booking.execute",
      createdAt: "2026-08-28T12:01:00Z",
    })).toThrow("EXECUTION_ELIGIBLE");
  });

  it("rejects approved-but-not-eligible packages", () => {
    expect(() => createBookingExecutionProposal({
      bookingPackage: { ...bookingPackage, status: "APPROVED" },
      authorization,
      workflowRunId: "run-1",
      agentId: "dispatcher-agent",
      agentVersion: "1.0.0",
      toolId: "booking.execute",
      createdAt: "2026-08-28T12:01:00Z",
    })).toThrow("EXECUTION_ELIGIBLE");
  });

  it("rejects authorization scoped to another booking package", () => {
    expect(() => createBookingExecutionProposal({
      bookingPackage,
      authorization: { ...authorization, scope: "booking:other" },
      workflowRunId: "run-1",
      agentId: "dispatcher-agent",
      agentVersion: "1.0.0",
      toolId: "booking.execute",
      createdAt: "2026-08-28T12:01:00Z",
    })).toThrow("scope does not match package");
  });

  it("rejects system-generated authorization", () => {
    expect(() => createBookingExecutionProposal({
      bookingPackage,
      authorization: { ...authorization, actorType: "system" },
      workflowRunId: "run-1",
      agentId: "dispatcher-agent",
      agentVersion: "1.0.0",
      toolId: "booking.execute",
      createdAt: "2026-08-28T12:01:00Z",
    })).toThrow("explicit human authorization");
  });
});
