import { describe, expect, it } from "vitest";
import { InMemoryAgentEventLog } from "./audit.js";
import { AgentOrchestrator, createDispatcherAnalysisReasoner } from "./index.js";
import { AgentRegistry, ToolRegistry } from "./registry.js";
import type { ActionProposal, AgentDefinition, AgentTool } from "./types.js";

const agent: AgentDefinition = {
  id: "dispatcher-analysis-agent",
  version: "1.1.0",
  name: "Dispatcher Analysis Agent",
  purpose: "Turn deterministic Dispatcher evaluations into governed proposals.",
  allowedToolIds: ["load.book"],
  policyProfile: "truckeros-default",
  status: "active",
};

describe("DispatcherAnalysisAgent", () => {
  it("turns an accept/counter result into an approval-gated proposal", async () => {
    const agents = new AgentRegistry();
    const tools = new ToolRegistry();
    const events = new InMemoryAgentEventLog();
    const approvals: ActionProposal[] = [];
    let invoked = false;

    agents.register(agent);
    const bookingTool: AgentTool = {
      id: "load.book",
      name: "Book Load",
      domain: "marketplace",
      risk: "approval_required",
      execute: async () => {
        invoked = true;
        return { booked: true };
      },
    };
    tools.register(bookingTool);

    const approvalGateway = {
      request: async (proposal: ActionProposal) => {
        approvals.push(proposal);
        return `approval:${proposal.id}`;
      },
    };

    const orchestrator = new AgentOrchestrator(agents, tools, undefined, approvalGateway, events);
    const result = await orchestrator.run(
      {
        workflowId: "dispatcher-loop",
        workflowVersion: "1",
        agentId: agent.id,
        context: {
          carrierId: "carrier-1",
          driverId: "driver-1",
          analysisVersion: "dispatcher-v1",
          topCandidate: { loadId: "load-42", recommendation: "accept", score: 982 },
          candidates: [{ loadId: "load-42", recommendation: "accept", score: 982 }],
        },
      },
      createDispatcherAnalysisReasoner({ agent, bookingToolId: "load.book" }),
    );

    expect(result.results[0]).toMatchObject({
      decision: "PENDING_APPROVAL",
      executed: false,
      approvalId: expect.stringContaining("approval:"),
    });
    expect(approvals[0]).toMatchObject({
      toolId: "load.book",
      authorizationContext: {
        driverId: "driver-1",
        carrierId: "carrier-1",
        resourceId: "load-42",
        approvalRequired: true,
      },
    });
    expect(approvals[0].workflowRunId).toBe(result.run.id);
    expect(invoked).toBe(false);
    expect(events.verify()).toBe(true);
  });

  it("does not manufacture a booking proposal for a decline", async () => {
    const agentWithNoTools: AgentDefinition = { ...agent, allowedToolIds: [] };
    const reasoner = createDispatcherAnalysisReasoner({ agent: agentWithNoTools, bookingToolId: "load.book" });
    const proposals = await reasoner.reason(
      {
        carrierId: "carrier-1",
        driverId: "driver-1",
        analysisVersion: "dispatcher-v1",
        topCandidate: { loadId: "load-99", recommendation: "decline", score: -10 },
        candidates: [{ loadId: "load-99", recommendation: "decline", score: -10 }],
      },
      {
        id: "run-1",
        workflowId: "dispatcher-loop",
        workflowVersion: "1",
        agentId: agentWithNoTools.id,
        status: "running",
        startedAt: new Date().toISOString(),
      },
    );

    expect(proposals).toEqual([]);
  });
});
