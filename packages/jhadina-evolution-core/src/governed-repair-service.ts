import { RepairFSM, type RepairContext } from "./repair-fsm";
import { buildClaudeRepairContext, renderClaudeRepairPrompt, type ClaudeRepairContext } from "./claude-repair-context";
import type { ClaudeCodeRunner } from "./claude-code-adapter";
import type { ClaudeWorkflowExecutionResult } from "./claude-github-actions-runner";
import { applyWorkflowResult } from "./claude-actions-fsm-bridge";
import type { EvolutionExecutionPlan, ExecutionWorkspace } from "./evolution-executor";
import type { RepositoryIntelligenceProvider, RepositoryIntelligenceEvidence } from "./repository-intelligence";

export interface GovernedClaudeRunner extends ClaudeCodeRunner {
  runGoverned(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
    context: ClaudeRepairContext;
  }): Promise<ClaudeWorkflowExecutionResult>;
}

export interface GovernedRepairRequest {
  plan: EvolutionExecutionPlan;
  workspace: ExecutionWorkspace;
  repairId: string;
  approvalGranted: boolean;
}

export interface GovernedRepairResult {
  context: RepairContext;
  evidence: RepositoryIntelligenceEvidence;
  claudeContext: ClaudeRepairContext;
  workflowResult: ClaudeWorkflowExecutionResult;
}

export class GovernedRepairService {
  constructor(
    private readonly intelligence: RepositoryIntelligenceProvider,
    private readonly claudeRunner: GovernedClaudeRunner,
    private readonly maxAttempts = 3,
  ) {}

  async execute(request: GovernedRepairRequest): Promise<GovernedRepairResult> {
    if (!request.approvalGranted) throw new Error("Repair execution requires explicit approval");
    if (request.repairId !== request.plan.id) throw new Error("repairId must match plan.id");

    const fsm = new RepairFSM({
      maxAttempts: this.maxAttempts,
      requiresApproval: true,
      protectedPaths: ["/policy", "/values", "/security", "/secrets", "/payments"],
    });

    let context = fsm.create(request.repairId);
    context = fsm.recordDiagnosis(context, request.plan.title);
    context = fsm.transition(context, "advance", "Approved repair entered UNDERSTAND").context;

    const evidence = await this.intelligence.collect({
      repository: request.workspace.path,
      branch: request.workspace.branch,
      query: request.plan.title,
      allowedPaths: request.plan.allowedPaths,
    });

    context = fsm.collect(context, evidence.findings);
    context = fsm.transition(context, "advance", "Repository Intelligence evidence collected").context;
    context = fsm.proposeFix(context, request.plan.title, evidence.snapshot.relevantFiles);
    context = fsm.transition(context, "advance", "Evidence-bound FIX started").context;

    const claudeContext = buildClaudeRepairContext(request.plan, evidence);
    let workflowResult: ClaudeWorkflowExecutionResult | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const prompt = renderClaudeRepairPrompt(claudeContext);
      workflowResult = await this.claudeRunner.runGoverned({
        plan: claudeContext.plan,
        workspace: request.workspace,
        prompt,
        allowedTools: [],
        disallowedTools: [],
        maxTurns: 12,
        context: claudeContext,
      });

      context = applyWorkflowResult(fsm, context, {
        ...workflowResult,
        // The bridge consumes the versioned workflow contract shape below.
        runId: workflowResult.runId,
      } as never);

      if (context.state === "APPROVAL" || context.state === "BLOCKED") break;
      if (context.state !== "FIX") break;
    }

    if (!workflowResult) throw new Error("Repair workflow produced no result");
    if (context.state === "FIX" || context.state === "TEST" || context.state === "VERIFY") {
      context = fsm.transition(context, "fail", "Repair workflow exhausted its execution budget").context;
    }

    return { context, evidence, claudeContext, workflowResult };
  }
}
