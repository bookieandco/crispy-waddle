import type { ApprovalController } from "./approval.js";
import type { ExecutionGateway } from "./execution-gateway.js";
import type { ToolRegistry } from "./registry.js";
import type { ActionExecutionResult, ActionProposal } from "./types.js";

export class ApprovedExecutionService {
  constructor(
    private readonly approvals: ApprovalController,
    private readonly tools: ToolRegistry,
    private readonly execution: ExecutionGateway,
  ) {}

  async execute<Input, Output>(request: {
    approvalId: string;
    proposal: ActionProposal<Input>;
  }): Promise<ActionExecutionResult & { output?: Output }> {
    const record = this.approvals.get(request.approvalId);
    if (record.proposalId !== request.proposal.id) {
      throw new Error("Approval does not authorize this proposal");
    }
    if (record.workflowRunId !== request.proposal.workflowRunId) {
      throw new Error("Approval does not authorize this workflow");
    }

    const authorization = this.approvals.authorizeExecution(request.approvalId);

    const tool = this.tools.get(request.proposal.toolId) as ReturnType<ToolRegistry["get"]> & {
      execute(input: Input): Promise<Output>;
    };

    return this.execution.execute({
      authorization,
      proposal: request.proposal,
      tool,
    }) as Promise<ActionExecutionResult & { output?: Output }>;
  }
}
