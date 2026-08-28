import type { ActionExecutionResult, ActionProposal, AgentEventLog, AgentTool, ExecutionAuthorization } from "./types.js";
import { eventId } from "./audit.js";
import {
  executionReceiptId,
  outputRefFromOutput,
  providerIdFromOutput,
  type ExecutionReceiptStore,
} from "./execution-receipt.js";

export interface ExecutionGatewayClock {
  now(): Date;
}

const systemClock: ExecutionGatewayClock = { now: () => new Date() };

export interface ExecutionGateway {
  execute<Input, Output>(request: {
    authorization: ExecutionAuthorization;
    proposal: ActionProposal<Input>;
    tool: AgentTool<Input, Output>;
    clock?: ExecutionGatewayClock;
  }): Promise<ActionExecutionResult & { output?: Output }>;
}

export class GuardedExecutionGateway implements ExecutionGateway {
  private readonly consumedNonces = new Set<string>();

  constructor(
    private readonly events: AgentEventLog,
    private readonly clock: ExecutionGatewayClock = systemClock,
    private readonly receipts?: ExecutionReceiptStore,
  ) {}

  async execute<Input, Output>(request: {
    authorization: ExecutionAuthorization;
    proposal: ActionProposal<Input>;
    tool: AgentTool<Input, Output>;
    clock?: ExecutionGatewayClock;
  }): Promise<ActionExecutionResult & { output?: Output }> {
    const clock = request.clock ?? this.clock;
    const { authorization, proposal, tool } = request;
    const now = clock.now();

    this.validateAuthorization(authorization, proposal, tool, now);

    if (this.consumedNonces.has(authorization.nonce)) {
      throw new Error("Execution authorization nonce has already been consumed");
    }
    this.consumedNonces.add(authorization.nonce);

    this.append(proposal.workflowRunId, "execution.started", {
      proposalId: proposal.id,
      approvalId: authorization.approvalId,
      nonce: authorization.nonce,
      toolId: tool.id,
      approvedBy: authorization.approvedBy,
    }, now);

    try {
      const output = await tool.execute(proposal.input);
      const completedAt = clock.now();
      this.append(proposal.workflowRunId, "execution.completed", {
        proposalId: proposal.id,
        approvalId: authorization.approvalId,
        nonce: authorization.nonce,
        toolId: tool.id,
      }, completedAt);
      this.recordReceipt({
        proposalId: proposal.id,
        workflowRunId: proposal.workflowRunId,
        approvalId: authorization.approvalId,
        authorizationNonce: authorization.nonce,
        toolId: tool.id,
        providerId: providerIdFromOutput(output),
        outcome: "COMPLETED",
        startedAt: now.toISOString(),
        completedAt: completedAt.toISOString(),
        outputRef: outputRefFromOutput(output),
      });

      return {
        proposalId: proposal.id,
        decision: "ALLOW",
        executed: true,
        output,
        approvalId: authorization.approvalId,
        reason: "Execution authorization validated",
      };
    } catch (error) {
      const failedAt = clock.now();
      const message = error instanceof Error ? error.message : String(error);
      this.append(proposal.workflowRunId, "execution.failed", {
        proposalId: proposal.id,
        approvalId: authorization.approvalId,
        nonce: authorization.nonce,
        toolId: tool.id,
        error: message,
      }, failedAt);
      this.recordReceipt({
        proposalId: proposal.id,
        workflowRunId: proposal.workflowRunId,
        approvalId: authorization.approvalId,
        authorizationNonce: authorization.nonce,
        toolId: tool.id,
        outcome: "FAILED",
        startedAt: now.toISOString(),
        completedAt: failedAt.toISOString(),
        error: message,
      });
      throw error;
    }
  }

  private recordReceipt(receipt: Omit<import("./execution-receipt.js").ExecutionReceipt, "id">): void {
    this.receipts?.record({
      id: executionReceiptId(receipt.workflowRunId, receipt.proposalId, receipt.authorizationNonce),
      ...receipt,
    });
  }

  private validateAuthorization<Input, Output>(
    authorization: ExecutionAuthorization,
    proposal: ActionProposal<Input>,
    tool: AgentTool<Input, Output>,
    now: Date,
  ): void {
    if (now >= new Date(authorization.expiresAt)) throw new Error("Execution authorization expired");
    if (authorization.proposalId !== proposal.id) throw new Error("Execution authorization proposal mismatch");
    if (authorization.workflowRunId !== proposal.workflowRunId) throw new Error("Execution authorization workflow mismatch");
    if (authorization.approvedBy.trim() === "") throw new Error("Execution authorization approver is required");
    if (!authorization.authorizationContext.approvalRequired) throw new Error("Execution authorization context is not approval-gated");
    if (authorization.authorizationContext.actorId !== proposal.authorizationContext.actorId) throw new Error("Execution authorization actor mismatch");
    if (authorization.authorizationContext.capabilityId !== proposal.authorizationContext.capabilityId) throw new Error("Execution authorization capability mismatch");
    if (tool.id !== proposal.toolId) throw new Error("Execution tool mismatch");
    if (tool.risk !== "approval_required" && tool.risk !== "irreversible") throw new Error("Execution gateway requires an approval-gated tool");
    if (!authorization.nonce.trim()) throw new Error("Execution authorization nonce is required");
  }

  private append(
    workflowRunId: string,
    type: "execution.started" | "execution.completed" | "execution.failed",
    payload: Record<string, unknown>,
    occurredAt: Date,
  ): void {
    const sequenceHint = this.events.list().length + 1;
    this.events.append({
      id: eventId(workflowRunId, sequenceHint, type),
      type,
      workflowRunId,
      occurredAt: occurredAt.toISOString(),
      payload,
    });
  }
}
