import type { ImprovementEvaluation, ImprovementProposal } from "@jhadina/core-spine";
import { assertGovernedRepairResult, type GovernedRepairExecutor } from "./governed-repair-contract";
import type { EvolutionExecutionPlan, ExecutionWorkspace } from "./evolution-executor";
import type { EvolutionRunLedger } from "./evolution-run-ledger";
import { recordEvolutionExecutionResult } from "./evolution-run-ledger";

export interface PromotionExecutionContext {
  repairId: string;
  plan: EvolutionExecutionPlan;
  workspace: ExecutionWorkspace;
  repository: { snapshot: { repository: string; branch: string; commit: string } };
}

export interface GovernedPromotionDependencies {
  repairExecutor: GovernedRepairExecutor;
  runLedger: EvolutionRunLedger;
  createExecutionContext(proposal: ImprovementProposal, evaluation: ImprovementEvaluation): Promise<PromotionExecutionContext>;
}

export class GovernedEvolutionPromoter {
  constructor(private readonly dependencies: GovernedPromotionDependencies) {}

  async promote(proposal: ImprovementProposal, evaluation: ImprovementEvaluation): Promise<void> {
    if (evaluation.proposalId !== proposal.id) throw new Error("Promotion proposal/evaluation mismatch");
    if (evaluation.recommendation !== "promote") throw new Error("Promotion requires a promote evaluation");
    if (!proposal.reversible) throw new Error("Promotion requires a reversible proposal");

    const context = await this.dependencies.createExecutionContext(proposal, evaluation);
    const result = await this.dependencies.repairExecutor.execute({
      plan: context.plan,
      workspace: context.workspace,
      repairId: context.repairId,
      approvalGranted: true,
      context: { plan: context.plan, repository: context.repository },
    });

    assertGovernedRepairResult(result);
    await recordEvolutionExecutionResult(this.dependencies.runLedger, result.workflowResult);
  }
}
