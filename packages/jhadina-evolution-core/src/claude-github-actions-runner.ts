import type { ClaudeCodeRunner } from "./claude-code-adapter";
import type { ClaudeRepairContext } from "./claude-repair-context";
import type { ExecutionEvidence, ExecutionWorkspace } from "./evolution-executor";
import type { EvolutionExecutionResult } from "./evolution-result";

export interface WorkflowDispatchClient {
  dispatch(input: {
    workflow: string;
    ref: string;
    inputs: Record<string, string>;
  }): Promise<{ runId: number }>;
}

export interface WorkflowResultClient {
  waitForResult(runId: number): Promise<EvolutionExecutionResult>;
}

export interface ClaudeWorkflowExecutionResult {
  runId: number;
  taskId: string;
  outcome: EvolutionExecutionResult["outcome"];
  changedFiles: string[];
  tests: ExecutionEvidence["tests"];
  securityChecks: ExecutionEvidence["securityChecks"];
  diffSummary: string;
  draftPr?: EvolutionExecutionResult["draftPr"];
}

export class ClaudeGitHubActionsRunner implements ClaudeCodeRunner {
  constructor(
    private readonly dispatchClient: WorkflowDispatchClient,
    private readonly resultClient: WorkflowResultClient,
    private readonly workflow = "jhadina-evolution-execute.yml",
  ) {}

  async run(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
    context?: ClaudeRepairContext;
  }) {
    if (!input.context) {
      throw new Error("ClaudeGitHubActionsRunner requires a ClaudeRepairContext");
    }
    return this.runGoverned(input);
  }

  async runGoverned(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
    context: ClaudeRepairContext;
  }): Promise<ClaudeWorkflowExecutionResult> {
    const plan = input.context.plan;
    const repository = input.context.repository.snapshot.repository;

    const dispatch = await this.dispatchClient.dispatch({
      workflow: this.workflow,
      ref: input.workspace.branch,
      inputs: {
        task_id: plan.id,
        prompt: input.prompt,
        base_branch: repository,
      },
    });

    const result = await this.resultClient.waitForResult(dispatch.runId);
    if (result.taskId !== plan.id) {
      throw new Error(`Workflow task ${result.taskId} does not match repair ${plan.id}`);
    }
    if (result.branch && result.branch !== input.workspace.branch) {
      throw new Error(`Workflow branch ${result.branch} does not match workspace ${input.workspace.branch}`);
    }

    return result;
  }
}
