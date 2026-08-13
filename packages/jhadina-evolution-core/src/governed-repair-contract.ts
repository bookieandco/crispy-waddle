import type { EvolutionExecutionPlan, ExecutionWorkspace } from "./evolution-executor";
import type { EvolutionExecutionResult } from "./evolution-result";

export interface ClaudeRepairContextContract {
  plan: EvolutionExecutionPlan;
  repository: {
    snapshot: {
      repository: string;
      branch: string;
      commit: string;
    };
  };
}

export interface GovernedRepairRequestContract {
  plan: EvolutionExecutionPlan;
  workspace: ExecutionWorkspace;
  repairId: string;
  approvalGranted: true;
  context: ClaudeRepairContextContract;
}

export interface GovernedRepairExecutor {
  execute(request: GovernedRepairRequestContract): Promise<GovernedRepairExecutionContract>;
}

export interface GovernedRepairExecutionContract {
  workflowResult: EvolutionExecutionResult;
  verified: boolean;
  protectedPathsVerified: boolean;
  evolutionCoreTestsVerified: boolean;
}

export function assertGovernedRepairResult(result: GovernedRepairExecutionContract): void {
  if (!result.verified) throw new Error("Governed repair did not produce verified execution evidence");
  if (!result.protectedPathsVerified) throw new Error("Protected-path verification failed");
  if (!result.evolutionCoreTestsVerified) throw new Error("Evolution-core verification failed");
  if (result.workflowResult.status !== "VERIFIED") throw new Error("Governed repair must terminate in VERIFIED status");
}
