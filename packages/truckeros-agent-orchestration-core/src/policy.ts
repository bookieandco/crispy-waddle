import type { ActionProposal, AgentDefinition, AgentTool, PolicyResult, ToolRisk } from "./types.js";

export interface ApprovalGateway {
  request(proposal: ActionProposal): Promise<string>;
}

export interface PolicyRule {
  version: string;
  decide(agent: AgentDefinition, tool: AgentTool, proposal: ActionProposal): PolicyResult;
}

const terminalRisks = new Set<ToolRisk>(["irreversible", "approval_required"]);

export class DefaultPolicyRule implements PolicyRule {
  constructor(public readonly version = "truckeros-agent-policy-v1") {}

  decide(agent: AgentDefinition, tool: AgentTool, proposal: ActionProposal): PolicyResult {
    if (agent.status !== "active") {
      return { decision: "DENY", reason: `Agent is not active: ${agent.id}`, policyVersion: this.version };
    }
    if (!agent.allowedToolIds.includes(tool.id)) {
      return { decision: "DENY", reason: `Tool is not allow-listed for agent: ${tool.id}`, policyVersion: this.version };
    }
    if (tool.domain === "money") {
      return { decision: "DENY", reason: "Money movement is outside the agent boundary.", policyVersion: this.version };
    }
    if (tool.risk === "irreversible" && !proposal.authorizationContext.approvalRequired) {
      return { decision: "DENY", reason: "Irreversible actions require explicit approval context.", policyVersion: this.version };
    }
    if (terminalRisks.has(tool.risk) || proposal.authorizationContext.approvalRequired) {
      return { decision: "PENDING_APPROVAL", reason: "Explicit human approval is required before execution.", approvalId: proposal.id, policyVersion: this.version };
    }
    return { decision: "ALLOW", reason: "Read/reversible tool is permitted by policy.", policyVersion: this.version };
  }
}
