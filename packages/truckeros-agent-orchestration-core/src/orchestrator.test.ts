import { describe, expect, it } from "vitest";
import { InMemoryAgentEventLog } from "./audit.js";
import { AgentOrchestrator, createAuthorizationContext, createProposal } from "./orchestrator.js";
import { AgentRegistry, ToolRegistry } from "./registry.js";
import type { ActionProposal, AgentDefinition, AgentTool } from "./types.js";

const agent: AgentDefinition = {
  id: "dispatcher-analysis-agent",
  version: "1.0.0",
  name: "Dispatcher Analysis Agent",
  purpose: "Analyze freight without owning economics or booking.",
  allowedToolIds: ["load.read", "load.book", "money.transfer"],
  policyProfile: "truckeros-default",
  status: "active",
};

function makeHarness() {
  const agents = new AgentRegistry();
  const tools = new ToolRegistry();
  const events = new InMemoryAgentEventLog();
  const approvals: string[] = [];
  agents.register(agent);
  const readTool: AgentTool<{ id: string }, { ok: true }> = {
    id: "load.read",
    name: "Read Load",
    domain: "freight",
    risk: "read",
    execute: async () => ({ ok: true }),
  };
  const bookingTool: AgentTool<{ id: string }, { booked: true }> = {
    id: "load.book",
    name: "Book Load",
    domain: "marketplace",
    risk: "approval_required",
    execute: async () => ({ booked: true }),
  };
  const moneyTool: AgentTool<{ amount: number }, { sent: true }> = {
    id: "money.transfer",
    name: "Transfer Money",
    domain: "money",
    risk: "irreversible",
    execute: async () => ({ sent: true }),
  };
  tools.register(readTool);
  tools.register(bookingTool);
  tools.register(moneyTool);
  const approvalsGateway = { request: async (proposal: ActionProposal) => { approvals.push(proposal.id); return `approval:${proposal.id}`; } };
  const orchestrator = new AgentOrchestrator(agents, tools, undefined, approvalsGateway, events);
  return { orchestrator, events, readTool, bookingTool, moneyTool, approvals };
}

describe("AgentOrchestrator", () => {
  it("executes an allowed read action and records the lifecycle", async () => {
    const h = makeHarness();
    const proposal = createProposal({
      id: "p-read",
      workflowRunId: "run-read",
      agent,
      tool: h.readTool,
      input: { id: "load-1" },
      authorizationContext: createAuthorizationContext("driver-1", "load.read"),
    });
    const result = await h.orchestrator.run({ workflowId: "load-analysis", workflowVersion: "1", agentId: agent.id, context: { loadId: "load-1" } }, { reason: async () => [proposal] });
    expect(result.results[0]).toMatchObject({ decision: "ALLOW", executed: true, output: { ok: true } });
    expect(result.run.status).toBe("completed");
    expect(h.events.verify()).toBe(true);
  });

  it("holds consequential actions for approval and never invokes the tool", async () => {
    const h = makeHarness();
    let invoked = false;
    const guardedTool = { ...h.bookingTool, execute: async () => { invoked = true; return { booked: true as const }; } };
    const proposal = createProposal({ id: "p-book", workflowRunId: "run-book", agent, tool: guardedTool, input: { id: "load-2" }, authorizationContext: createAuthorizationContext("driver-1", "load.book", { approvalRequired: true }) });
    const result = await h.orchestrator.run({ workflowId: "booking", workflowVersion: "1", agentId: agent.id, context: {} }, { reason: async () => [proposal] });
    expect(result.results[0]).toMatchObject({ decision: "PENDING_APPROVAL", executed: false, approvalId: "approval:p-book" });
    expect(invoked).toBe(false);
    expect(h.approvals).toEqual(["p-book"]);
    expect(result.run.status).toBe("waiting_approval");
  });

  it("hard-denies money movement even when the agent allow-lists the tool", async () => {
    const h = makeHarness();
    const proposal = createProposal({ id: "p-money", workflowRunId: "run-money", agent, tool: h.moneyTool, input: { amount: 100 }, authorizationContext: createAuthorizationContext("driver-1", "money.transfer") });
    const result = await h.orchestrator.run({ workflowId: "money", workflowVersion: "1", agentId: agent.id, context: {} }, { reason: async () => [proposal] });
    expect(result.results[0]).toMatchObject({ decision: "DENY", executed: false });
  });
});
