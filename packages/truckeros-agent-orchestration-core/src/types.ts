export type AgentStatus = "draft" | "active" | "disabled";
export type ToolRisk = "read" | "reversible" | "approval_required" | "irreversible";
export type PolicyDecision = "ALLOW" | "PENDING_APPROVAL" | "DENY";

export type ApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONSUMED";

export interface AgentDefinition {
  id: string;
  version: string;
  name: string;
  purpose: string;
  allowedToolIds: readonly string[];
  policyProfile: string;
  status: AgentStatus;
}

export interface AgentTool<Input = unknown, Output = unknown> {
  id: string;
  name: string;
  domain: "freight" | "dispatcher" | "route" | "stop" | "communication" | "marketplace" | "money";
  risk: ToolRisk;
  execute(input: Input): Promise<Output>;
}

export interface AuthorizationContext {
  actorId: string;
  carrierId?: string;
  driverId?: string;
  resourceId?: string;
  capabilityId: string;
  approvalRequired: boolean;
}

export interface ActionProposal<Input = unknown> {
  id: string;
  workflowRunId: string;
  agentId: string;
  agentVersion: string;
  toolId: string;
  input: Input;
  authorizationContext: AuthorizationContext;
  createdAt: string;
  expiresAt?: string;
}

export interface ApprovalRecord {
  id: string;
  proposalId: string;
  workflowRunId: string;
  status: ApprovalStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  expiresAt: string;
  authorizationContext: AuthorizationContext;
  version: number;
}

export interface ExecutionAuthorization {
  approvalId: string;
  proposalId: string;
  workflowRunId: string;
  approvedBy: string;
  approvedAt: string;
  authorizationContext: AuthorizationContext;
  expiresAt: string;
  nonce: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
  approvalId?: string;
  policyVersion: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersion: string;
  agentId: string;
  status: "running" | "waiting_approval" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
}

export type AgentEventType =
  | "agent.started"
  | "context.loaded"
  | "action.proposed"
  | "policy.evaluated"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.expired"
  | "execution.authorized"
  | "execution.started"
  | "execution.completed"
  | "execution.failed"
  | "agent.completed";

export interface AgentEvent {
  id: string;
  sequence: number;
  type: AgentEventType;
  workflowRunId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
  hash: string;
}

export interface ActionExecutionResult {
  proposalId: string;
  decision: PolicyDecision;
  executed: boolean;
  output?: unknown;
  approvalId?: string;
  reason?: string;
}
