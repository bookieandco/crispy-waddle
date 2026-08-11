import { RepairFSM, type RepairContext } from "./repair-fsm";
import { buildClaudeRepairContext, renderClaudeRepairPrompt, type ClaudeRepairContext } from "./claude-repair-context";
import type { ClaudeCodeRunner } from "./claude-code-adapter";
import type { EvolutionExecutionResult, EvolutionExecutionStatus } from "./evolution-result";
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
  }): Promise<EvolutionExecutionResult>;
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
  workflowResult: EvolutionExecutionResult;
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
    let workflowResult: EvolutionExecutionResult | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      workflowResult = await this.claudeRunner.runGoverned({
        workspace: request.workspace,
        prompt: renderClaudeRepairPrompt(claudeContext),
        allowedTools: [],
        disallowedTools: [],
        maxTurns: 12,
        context: claudeContext,
      });

      context = applyWorkflowResult(fsm, context, workflowResult);
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

function applyWorkflowResult(fsm: RepairFSM, context: RepairContext, result: EvolutionExecutionResult): RepairContext {
  if (result.taskId !== context.repairId) throw new Error(`Workflow task ${result.taskId} does not match repair ${context.repairId}`);
  if (result.status === "BLOCKED") return fsm.transition(context, "block", "GitHub Actions reported BLOCKED").context;
  if (result.status === "FAILED") return fsm.transition(context, "retry", "GitHub Actions repair verification failed").context;
  if (result.verification.protectedPaths !== "success" || result.verification.evolutionCoreTests !== "success") {
    return fsm.transition(context, "retry", "Verified status lacked required verification evidence").context;
  }

  let next = context;
  if (next.state === "TEST") {
    next = fsm.recordTestResult(next, true);
    next = fsm.transition(next, "advance", "GitHub Actions verification passed").context;
  }
  if (next.state === "VERIFY") {
    next = fsm.recordVerification(next, true);
    next = fsm.transition(next, "advance", "Independent workflow verification passed").context;
  }
  return next;
}
