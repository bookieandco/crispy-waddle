import { RepairFSM, type RepairContext } from "./repair-fsm";
import { buildClaudeRepairContext, renderClaudeRepairPrompt, type ClaudeRepairContext } from "./claude-repair-context";
import { ClaudeCodeEvolutionAdapter, type ClaudeCodeRunner } from "./claude-code-adapter";
import type { EvolutionExecutionPlan, ExecutionWorkspace } from "./evolution-executor";
import type { RepositoryIntelligenceProvider, RepositoryIntelligenceEvidence } from "./repository-intelligence";

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
}

export class GovernedRepairService {
  constructor(
    private readonly intelligence: RepositoryIntelligenceProvider,
    private readonly claudeRunner: ClaudeCodeRunner,
  ) {}

  async execute(request: GovernedRepairRequest): Promise<GovernedRepairResult> {
    if (!request.approvalGranted) {
      throw new Error("Repair execution requires explicit approval");
    }
    if (request.repairId !== request.plan.id) {
      throw new Error("repairId must match plan.id");
    }

    const fsm = new RepairFSM({
      maxAttempts: 3,
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
    const adapter = new ClaudeCodeEvolutionAdapter(this.claudeRunner);
    const prompt = renderClaudeRepairPrompt(claudeContext);

    await adapter.execute({
      plan: claudeContext.plan,
      workspace: request.workspace,
      context: claudeContext,
    });

    return { context, evidence, claudeContext };
  }
}
