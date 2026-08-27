import { AgentRegistry, ToolRegistry } from "./registry.js";
import { DefaultPolicyRule } from "./policy.js";
import { eventId, type AgentEventLog } from "./audit.js";
import type {
  ActionExecutionResult,
  ActionProposal,
  AgentDefinition,
  AgentTool,
  AuthorizationContext,
  WorkflowRun,
} from "./types.js";
import type { ApprovalGateway, PolicyRule } from "./policy.js";

export interface AgentReasoner<Input = unknown> {
  reason(context: Input): Promise<readonly ActionProposal[]>;
}

export interface OrchestrationInput<Context> {
  workflowId: string;
  workflowVersion: string;
  agentId: string;
  context: Context;
}

export class AgentOrchestrator {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly tools: ToolRegistry,
    private readonly policy: PolicyRule = new DefaultPolicyRule(),
    private readonly approvals: ApprovalGateway,
    private readonly events: AgentEventLog,
  ) {}

  async run<Context>(input: OrchestrationInput<Context>, reasoner: AgentReasoner<Context>): Promise<{ run: WorkflowRun; results: readonly ActionExecutionResult[] }> {
    const agent = this.agents.get(input.agentId);
    const run: WorkflowRun = {
      id: `${input.workflowId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      agentId: agent.id,
      status: "running",
      startedAt: new Date().toISOString(),
    };

    this.record(run, "agent.started", { agentId: agent.id, agentVersion: agent.version });
    this.record(run, "context.loaded", { contextType: typeof input.context });

    const proposals = await reasoner.reason(input.context);
    const results: ActionExecutionResult[] = [];

    for (const proposal of proposals) {
      this.record(run, "action.proposed", { proposalId: proposal.id, toolId: proposal.toolId });
      const tool = this.tools.get(proposal.toolId);
      const policyResult = this.policy.decide(agent, tool, proposal);
      this.record(run, "policy.evaluated", { proposalId: proposal.id, decision: policyResult.decision, reason: policyResult.reason });

      if (policyResult.decision === "DENY") {
        results.push({ proposalId: proposal.id, decision: "DENY", executed: false, reason: policyResult.reason });
        continue;
      }

      if (policyResult.decision === "PENDING_APPROVAL") {
        const approvalId = await this.approvals.request(proposal);
        this.record(run, "approval.requested", { proposalId: proposal.id, approvalId });
        results.push({ proposalId: proposal.id, decision: "PENDING_APPROVAL", executed: false, approvalId, reason: policyResult.reason });
        run.status = "waiting_approval";
        continue;
      }

      this.record(run, "execution.started", { proposalId: proposal.id, toolId: tool.id });
      try {
        const output = await tool.execute(proposal.input);
        this.record(run, "execution.completed", { proposalId: proposal.id, toolId: tool.id });
        results.push({ proposalId: proposal.id, decision: "ALLOW", executed: true, output });
      } catch (error) {
        this.record(run, "execution.failed", { proposalId: proposal.id, toolId: tool.id, error: error instanceof Error ? error.message : String(error) });
        results.push({ proposalId: proposal.id, decision: "ALLOW", executed: false, reason: error instanceof Error ? error.message : String(error) });
        run.status = "failed";
      }
    }

    if (run.status === "running") run.status = "completed";
    run.completedAt = new Date().toISOString();
    this.record(run, "agent.completed", { status: run.status });
    return { run, results };
  }

  private record(run: WorkflowRun, type: Parameters<AgentEventLog["append"]>[0]["type"], payload: Record<string, unknown>): void {
    const sequenceHint = this.events.list().length + 1;
    this.events.append({ id: eventId(run.id, sequenceHint, type), type, workflowRunId: run.id, occurredAt: new Date().toISOString(), payload });
  }
}

export function createAuthorizationContext(actorId: string, capabilityId: string, options: Omit<AuthorizationContext, "actorId" | "capabilityId"> = { approvalRequired: false }): AuthorizationContext {
  return { actorId, capabilityId, ...options };
}

export function createProposal<Input>(params: {
  id: string;
  workflowRunId: string;
  agent: AgentDefinition;
  tool: AgentTool<Input>;
  input: Input;
  authorizationContext: AuthorizationContext;
  expiresAt?: string;
}): ActionProposal<Input> {
  return {
    id: params.id,
    workflowRunId: params.workflowRunId,
    agentId: params.agent.id,
    agentVersion: params.agent.version,
    toolId: params.tool.id,
    input: params.input,
    authorizationContext: params.authorizationContext,
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt,
  };
}
