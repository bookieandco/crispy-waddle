import type { ImprovementEvaluation, ImprovementProposal } from "@jhadina/core-spine";
import {
  assertGovernedRepairResult,
  type GovernedRepairExecutor,
} from "./governed-repair-contract";
import type { EvolutionExecutionPlan, ExecutionWorkspace } from "./evolution-executor";

export interface PromotionExecutionContext {
  repairId: string;
  plan: EvolutionExecutionPlan;
  workspace: ExecutionWorkspace;
  repository: {
    snapshot: {
      repository: string;
      branch: string;
      commit: string;
    };
  };
}

export interface GovernedPromotionDependencies {
  repairExecutor: GovernedRepairExecutor;
  createExecutionContext(
    proposal: ImprovementProposal,
    evaluation: ImprovementEvaluation,
  ): Promise<PromotionExecutionContext>;
}

/**
 * The only promoter used by the Core Spine adapter. It has no direct access
 * to a coding agent; execution is possible only through GovernedRepairExecutor.
 */
export class GovernedEvolutionPromoter {
  constructor(private readonly dependencies: GovernedPromotionDependencies) {}

  async promote(
    proposal: ImprovementProposal,
    evaluation: ImprovementEvaluation,
  ): Promise<void> {
    if (evaluation.proposalId !== proposal.id) {
      throw new Error("Promotion proposal/evaluation mismatch");
    }
    if (evaluation.recommendation !== "promote") {
      throw new Error("Promotion requires a promote evaluation");
    }
    if (!proposal.reversible) {
      throw new Error("Promotion requires a reversible proposal");
    }

    const context = await this.dependencies.createExecutionContext(proposal, evaluation);
    const result = await this.dependencies.repairExecutor.execute({
      plan: context.plan,
      workspace: context.workspace,
      repairId: context.repairId,
      approvalGranted: true,
      context: {
        plan: context.plan,
        repository: context.repository,
      },
    });

    assertGovernedRepairResult(result);
  }
}
