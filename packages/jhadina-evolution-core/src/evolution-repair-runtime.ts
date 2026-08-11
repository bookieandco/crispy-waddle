import type { EvolutionExecutionPlan } from "./evolution-executor";
import type { GovernedRepairResult } from "./governed-repair-service";
import { ApprovalExecutionGate, type ApprovalExecutionRequest, type EvolutionApprovalGrant } from "./approval-execution-gate";
import type { EvolutionCandidateRepository } from "./evolution-candidate-repository";
import type { GovernedRepairService } from "./governed-repair-service";

export interface EvolutionRepairRuntime {
  execute(input: {
    approval: EvolutionApprovalGrant;
    plan: EvolutionExecutionPlan;
    repair: ApprovalExecutionRequest["repair"];
  }): Promise<GovernedRepairResult>;
}

/** Server-side runtime boundary. The concrete service/Claude wiring belongs here, never in the browser. */
export class GovernedEvolutionRepairRuntime implements EvolutionRepairRuntime {
  private readonly gate: ApprovalExecutionGate;

  constructor(
    candidates: EvolutionCandidateRepository,
    repairService: GovernedRepairService,
  ) {
    this.gate = new ApprovalExecutionGate(candidates, repairService);
  }

  execute(input: {
    approval: EvolutionApprovalGrant;
    plan: EvolutionExecutionPlan;
    repair: ApprovalExecutionRequest["repair"];
  }): Promise<GovernedRepairResult> {
    return this.gate.execute(input);
  }
}
