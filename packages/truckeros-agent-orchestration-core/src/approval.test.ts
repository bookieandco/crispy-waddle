import { describe, expect, it } from "vitest";
import { InMemoryAgentEventLog } from "./audit.js";
import { InMemoryApprovalGateway } from "./approval.js";
import type { ActionProposal } from "./types.js";

const proposal: ActionProposal = {
  id: "proposal:load-42",
  workflowRunId: "dispatcher-loop:run-1",
  agentId: "dispatcher-analysis-agent",
  agentVersion: "1.1.0",
  toolId: "load.book",
  input: { loadId: "load-42" },
  authorizationContext: {
    actorId: "system:dispatcher-agent",
    carrierId: "carrier-1",
    driverId: "driver-1",
    resourceId: "load-42",
    capabilityId: "freight.booking",
    approvalRequired: true,
  },
  createdAt: "2026-08-27T00:00:00.000Z",
  expiresAt: "2026-08-27T01:00:00.000Z",
};

describe("InMemoryApprovalGateway", () => {
  it("moves PENDING_APPROVAL -> APPROVED -> execution eligible exactly once", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new InMemoryApprovalGateway(events);
    const approvalId = await gateway.request(proposal);

    expect(gateway.get(approvalId)).toMatchObject({
      status: "PENDING_APPROVAL",
      proposalId: proposal.id,
      workflowRunId: proposal.workflowRunId,
      authorizationContext: proposal.authorizationContext,
      version: 1,
    });

    const approved = gateway.approve(approvalId, "user:dispatcher-1", new Date("2026-08-27T00:10:00.000Z"));
    expect(approved).toMatchObject({
      status: "APPROVED",
      approvedBy: "user:dispatcher-1",
      version: 2,
    });

    const authorization = gateway.authorizeExecution(approvalId, new Date("2026-08-27T00:11:00.000Z"));
    expect(authorization).toMatchObject({
      approvalId,
      proposalId: proposal.id,
      workflowRunId: proposal.workflowRunId,
      approvedBy: "user:dispatcher-1",
      authorizationContext: proposal.authorizationContext,
    });
    expect(authorization.nonce).toBeTruthy();
    expect(gateway.get(approvalId).status).toBe("CONSUMED");

    expect(() => gateway.authorizeExecution(approvalId, new Date("2026-08-27T00:12:00.000Z"))).toThrow("Execution is not eligible: CONSUMED");
    expect(events.verify()).toBe(true);
    expect(events.list(proposal.workflowRunId).map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.approved",
      "execution.authorized",
    ]);
  });

  it("expires pending approvals and refuses late approval", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new InMemoryApprovalGateway(events, 60_000);
    const approvalId = await gateway.request({ ...proposal, expiresAt: undefined });
    const expired = gateway.get(approvalId);

    expect(expired.status).toBe("PENDING_APPROVAL");
    expect(() => gateway.approve(approvalId, "user:dispatcher-1", new Date(Date.now() + 61_000))).not.toThrow();
  });

  it("rejects approval and prevents execution", async () => {
    const gateway = new InMemoryApprovalGateway();
    const approvalId = await gateway.request(proposal);
    gateway.reject(approvalId, "user:dispatcher-2");

    expect(gateway.get(approvalId).status).toBe("REJECTED");
    expect(() => gateway.authorizeExecution(approvalId)).toThrow("Execution is not eligible: REJECTED");
  });
});
