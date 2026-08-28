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
    const authorization = this.approvals.authorizeExecution(request.approvalId);

    if (authorization.proposalId !== request.proposal.id) {
      throw new Error("Approval does not authorize this proposal");
    }
    if (authorization.workflowRunId !== request.proposal.workflowRunId) {
      throw new Error("Approval does not authorize this workflow");
    }

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
