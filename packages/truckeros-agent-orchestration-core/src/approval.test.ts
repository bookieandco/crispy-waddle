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
  createdAt: new Date().toISOString(),
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

    const approved = gateway.approve(approvalId, "user:dispatcher-1");
    expect(approved).toMatchObject({
      status: "APPROVED",
      approvedBy: "user:dispatcher-1",
      version: 2,
    });

    const authorization = gateway.authorizeExecution(approvalId);
    expect(authorization).toMatchObject({
      approvalId,
      proposalId: proposal.id,
      workflowRunId: proposal.workflowRunId,
      approvedBy: "user:dispatcher-1",
      authorizationContext: proposal.authorizationContext,
    });
    expect(authorization.nonce).toBeTruthy();
    expect(gateway.get(approvalId).status).toBe("CONSUMED");

    expect(() => gateway.authorizeExecution(approvalId)).toThrow("Execution is not eligible: CONSUMED");
    expect(events.verify()).toBe(true);
    expect(events.list(proposal.workflowRunId).map((event) => event.type)).toEqual([
      "approval.requested",
      "approval.approved",
      "execution.authorized",
    ]);
  });

  it("expires pending approvals and refuses late approval", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new InMemoryApprovalGateway(events);
    const now = Date.now();
    const approvalId = await gateway.request({
      ...proposal,
      id: "proposal:expiring",
      expiresAt: new Date(now + 60_000).toISOString(),
    });

    expect(gateway.get(approvalId).status).toBe("PENDING_APPROVAL");
    expect(() => gateway.approve(approvalId, "user:dispatcher-1", new Date(now + 61_000))).toThrow("Approval expired before approval");
    expect(gateway.get(approvalId).status).toBe("EXPIRED");
    expect(events.verify()).toBe(true);
  });

  it("rejects approval and prevents execution", async () => {
    const gateway = new InMemoryApprovalGateway();
    const approvalId = await gateway.request(proposal);
    gateway.reject(approvalId, "user:dispatcher-2");

    expect(gateway.get(approvalId).status).toBe("REJECTED");
    expect(() => gateway.authorizeExecution(approvalId)).toThrow("Execution is not eligible: REJECTED");
  });
});
