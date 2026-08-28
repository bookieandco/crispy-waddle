import { describe, expect, it } from "vitest";
import { InMemoryAgentEventLog } from "./audit.js";
import { GuardedExecutionGateway } from "./execution-gateway.js";
import type { ActionProposal, ExecutionAuthorization } from "./types.js";

const proposal: ActionProposal<{ loadId: string }> = {
  id: "proposal:1",
  workflowRunId: "run:1",
  agentId: "dispatcher-agent",
  agentVersion: "1.0.0",
  toolId: "booking.execute",
  input: { loadId: "load:123" },
  authorizationContext: {
    actorId: "driver:1",
    carrierId: "carrier:1",
    resourceId: "load:123",
    capabilityId: "freight.booking.execute",
    approvalRequired: true,
  },
  createdAt: "2026-08-27T20:00:00.000Z",
  expiresAt: "2026-08-27T21:00:00.000Z",
};

function authorization(overrides: Partial<ExecutionAuthorization> = {}): ExecutionAuthorization {
  return {
    approvalId: "approval:1",
    proposalId: proposal.id,
    workflowRunId: proposal.workflowRunId,
    approvedBy: "user:1",
    approvedAt: "2026-08-27T20:01:00.000Z",
    authorizationContext: { ...proposal.authorizationContext },
    expiresAt: "2026-08-27T21:00:00.000Z",
    nonce: "nonce:1",
    ...overrides,
  };
}

function tool() {
  return {
    id: "booking.execute",
    name: "Execute booking",
    domain: "marketplace" as const,
    risk: "approval_required" as const,
    execute: async (input: { loadId: string }) => ({ bookingId: `booking-for-${input.loadId}` }),
  };
}

describe("GuardedExecutionGateway", () => {
  it("executes only after validating the authorization context", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });

    const result = await gateway.execute({ authorization: authorization(), proposal, tool: tool() });

    expect(result.executed).toBe(true);
    expect(result.output).toEqual({ bookingId: "booking-for-load:123" });
    expect(events.list("run:1").map((event) => event.type)).toEqual(["execution.started", "execution.completed"]);
    expect(events.verify()).toBe(true);
  });

  it("rejects expired authorization before consuming the nonce", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T22:00:00.000Z") });

    await expect(gateway.execute({ authorization: authorization(), proposal, tool: tool() })).rejects.toThrow("expired");
    expect(events.list()).toHaveLength(0);
  });

  it("rejects mismatched proposal and tool identities", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });

    await expect(gateway.execute({
      authorization: authorization({ proposalId: "proposal:other" }),
      proposal,
      tool: tool(),
    })).rejects.toThrow("proposal mismatch");

    await expect(gateway.execute({
      authorization: authorization(),
      proposal,
      tool: { ...tool(), id: "different.tool" },
    })).rejects.toThrow("tool mismatch");
  });

  it("prevents nonce replay", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });

    await gateway.execute({ authorization: authorization(), proposal, tool: tool() });
    await expect(gateway.execute({ authorization: authorization(), proposal, tool: tool() })).rejects.toThrow("already been consumed");

    expect(events.list("run:1").map((event) => event.type)).toEqual(["execution.started", "execution.completed"]);
  });

  it("records failures without granting a second execution", async () => {
    const events = new InMemoryAgentEventLog();
    const gateway = new GuardedExecutionGateway(events, { now: () => new Date("2026-08-27T20:30:00.000Z") });
    const failingTool = { ...tool(), execute: async () => { throw new Error("provider unavailable"); } };

    await expect(gateway.execute({ authorization: authorization(), proposal, tool: failingTool })).rejects.toThrow("provider unavailable");
    expect(events.list("run:1").map((event) => event.type)).toEqual(["execution.started", "execution.failed"]);
    expect(events.verify()).toBe(true);
  });
});
