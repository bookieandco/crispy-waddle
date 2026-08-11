import type { ClaudeCodeRunner } from "./claude-code-adapter";
import type { ClaudeRepairContext } from "./claude-repair-context";
import type { EvolutionRunLedger } from "./evolution-run-ledger";
import type { ExecutionWorkspace } from "./evolution-executor";
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

export class ClaudeGitHubActionsRunner implements ClaudeCodeRunner {
  constructor(
    private readonly dispatchClient: WorkflowDispatchClient,
    private readonly resultClient: WorkflowResultClient,
    private readonly ledger?: EvolutionRunLedger,
    private readonly workflow = "jhadina-evolution-execute.yml",
  ) {}

  async run(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
    context?: ClaudeRepairContext;
  }): Promise<EvolutionExecutionResult> {
    if (!input.context) throw new Error("ClaudeGitHubActionsRunner requires a ClaudeRepairContext");
    const plan = input.context.plan;
    const repository = input.context.repository.snapshot.repository;
    const dispatch = await this.dispatchClient.dispatch({
      workflow: this.workflow,
      ref: input.workspace.branch,
      inputs: {
        task_id: plan.id,
        prompt: input.prompt,
        base_branch: repository,
        allowed_tools: [...new Set(input.allowedTools)].join(","),
        disallowed_tools: [...new Set(input.disallowedTools)].join(","),
        max_turns: String(input.maxTurns),
      },
    });

    await this.ledger?.append({
      runId: dispatch.runId,
      taskId: plan.id,
      type: "RUN_DISPATCHED",
      occurredAt: new Date().toISOString(),
      payload: {
        baseBranch: repository,
        branch: input.workspace.branch,
        allowedTools: [...new Set(input.allowedTools)],
        disallowedTools: [...new Set(input.disallowedTools)],
        maxTurns: input.maxTurns,
      },
      previousHash: null,
    });

    const result = await this.resultClient.waitForResult(dispatch.runId);
    if (result.taskId !== plan.id) throw new Error(`Workflow task ${result.taskId} does not match repair ${plan.id}`);
    if (result.branch && result.branch !== input.workspace.branch) {
      throw new Error(`Workflow branch ${result.branch} does not match workspace ${input.workspace.branch}`);
    }

    if (this.ledger) {
      const terminalType = result.status === "VERIFIED" ? "RUN_VERIFIED" : result.status === "BLOCKED" ? "RUN_BLOCKED" : "RUN_FAILED";
      await this.ledger.append({
        runId: result.runId,
        taskId: result.taskId,
        type: terminalType,
        occurredAt: new Date().toISOString(),
        payload: {
          baseBranch: result.baseBranch,
          branch: result.branch,
          changedFiles: result.changedFiles,
          diffStat: result.diffStat,
          verification: result.verification,
          draftPr: result.draftPr,
        },
        previousHash: null,
      });
      if (result.draftPr) {
        await this.ledger.append({
          runId: result.runId,
          taskId: result.taskId,
          type: "DRAFT_PR_CREATED",
          occurredAt: new Date().toISOString(),
          payload: { url: result.draftPr },
          previousHash: null,
        });
      }
    }

    return result;
  }
}
