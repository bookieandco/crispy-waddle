import { describe, expect, it } from "vitest";
import { InMemoryAgentEventLog } from "./audit.js";
import { InMemoryApprovalGateway } from "./approval.js";
import { ApprovedExecutionService } from "./approved-execution.js";
import { GuardedExecutionGateway } from "./execution-gateway.js";
import { ToolRegistry } from "./registry.js";
import type { ActionProposal } from "./types.js";

const proposal: ActionProposal<{ loadId: string }> = {
  id: "proposal:approved-1",
  workflowRunId: "run:approved-1",
  agentId: "dispatcher-agent",
  agentVersion: "1.0.0",
  toolId: "booking.execute",
  input: { loadId: "load:456" },
  authorizationContext: {
    actorId: "driver:1",
    carrierId: "carrier:1",
    resourceId: "load:456",
    capabilityId: "freight.booking.execute",
    approvalRequired: true,
  },
  createdAt: "2026-08-27T20:00:00.000Z",
  expiresAt: "2026-08-27T21:00:00.000Z",
};

describe("ApprovedExecutionService", () => {
  it("transitions approved work through authorization into the execution gateway", async () => {
    const events = new InMemoryAgentEventLog();
    const approvals = new InMemoryApprovalGateway(events);
    const tools = new ToolRegistry();
    tools.register({
      id: "booking.execute",
      name: "Execute booking",
      domain: "marketplace",
      risk: "approval_required",
      execute: async (input: { loadId: string }) => ({ bookingId: `booking:${input.loadId}` }),
    });

    const execution = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });
    const service = new ApprovedExecutionService(approvals, tools, execution);

    const approvalId = await approvals.request(proposal);
    approvals.approve(approvalId, "user:1", new Date("2026-08-27T20:05:00.000Z"));

    const result = await service.execute({ approvalId, proposal });

    expect(result.executed).toBe(true);
    expect(result.output).toEqual({ bookingId: "booking:load:456" });
    expect(approvals.get(approvalId).status).toBe("CONSUMED");
    expect(events.verify()).toBe(true);
  });

  it("refuses an approval issued for another proposal", async () => {
    const events = new InMemoryAgentEventLog();
    const approvals = new InMemoryApprovalGateway(events);
    const tools = new ToolRegistry();
    tools.register({
      id: "booking.execute",
      name: "Execute booking",
      domain: "marketplace",
      risk: "approval_required",
      execute: async () => ({ bookingId: "booking:1" }),
    });

    const execution = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });
    const service = new ApprovedExecutionService(approvals, tools, execution);
    const approvalId = await approvals.request(proposal);
    approvals.approve(approvalId, "user:1", new Date("2026-08-27T20:05:00.000Z"));

    const differentProposal = { ...proposal, id: "proposal:other" };
    await expect(service.execute({ approvalId, proposal: differentProposal })).rejects.toThrow("does not authorize this proposal");
  });
});
