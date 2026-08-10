import { RepairFSM, type RepairContext, type RepairEvent, type RepairPolicy } from "./repair-fsm";
import type {
  CodingAgentAdapter,
  ExecutionEvidence,
  EvolutionExecutionPlan,
  ExecutionWorkspace,
} from "./evolution-executor";

export interface RepairRunResult {
  context: RepairContext;
  events: RepairEvent[];
  evidence: ExecutionEvidence[];
}

/**
 * Coordinates the deterministic Repair FSM with a coding-agent worker.
 * The worker may propose/apply a patch and run verification, but the FSM
 * decides whether another attempt is allowed and whether approval is needed.
 */
export class GovernedRepairOrchestrator {
  private readonly fsm: RepairFSM;

  constructor(
    private readonly policy: RepairPolicy,
    private readonly agent: CodingAgentAdapter,
  ) {
    this.fsm = new RepairFSM(policy);
  }

  async run(
    repairId: string,
    plan: EvolutionExecutionPlan,
    workspace: ExecutionWorkspace,
    approvalGranted = false,
  ): Promise<RepairRunResult> {
    let context = this.fsm.create(repairId);
    const events: RepairEvent[] = [];
    const evidence: ExecutionEvidence[] = [];

    if (approvalGranted) context = { ...context, approvalGranted: true };

    context = this.fsm.recordDiagnosis(context, plan.title);
    ({ context } = this.recordTransition(context, "advance", "Repair diagnosis recorded", events));

    context = this.fsm.collect(context, [
      `Allowed paths: ${plan.allowedPaths.join(", ") || "none"}`,
      `Required tests: ${plan.testCommands.join(", ") || "none"}`,
      `Required security checks: ${plan.securityChecks.join(", ") || "none"}`,
    ]);
    ({ context } = this.recordTransition(context, "advance", "Repair constraints collected", events));

    for (;;) {
      if (context.state === "FAILED" || context.state === "BLOCKED" || context.state === "COMPLETED") break;

      context = this.fsm.proposeFix(context, plan.title, plan.allowedPaths);
      ({ context } = this.recordTransition(context, "advance", `Attempt ${context.attempt + 1} patch execution`, events));

      let attemptEvidence: ExecutionEvidence;
      try {
        attemptEvidence = await this.agent.execute({ plan, workspace });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Coding agent execution failed.";
        ({ context } = this.recordTransition(context, "fail", reason, events));
        break;
      }
      evidence.push(attemptEvidence);

      context = this.fsm.recordTestResult(context, attemptEvidence.tests.every((test) => test.passed));
      if (!context.testsPassed) {
        ({ context } = this.recordTransition(context, "retry", `Attempt ${context.attempt} failed verification tests`, events));
        if (context.state === "FAILED") break;
        continue;
      }

      ({ context } = this.recordTransition(context, "advance", "Tests passed", events));
      context = this.fsm.recordVerification(
        context,
        attemptEvidence.tests.every((test) => test.passed) &&
          attemptEvidence.securityChecks.every((check) => check.passed),
      );

      if (!context.verified) {
        ({ context } = this.recordTransition(context, "retry", `Attempt ${context.attempt} failed security verification`, events));
        if (context.state === "FAILED") break;
        continue;
      }

      ({ context } = this.recordTransition(context, "advance", "Tests and security verification passed", events));

      if (context.state === "APPROVAL") {
        if (!approvalGranted) break;
        ({ context } = this.recordTransition(
          { ...context, approvalGranted: true },
          "approve",
          "User approval granted",
          events,
        ));
      }
      break;
    }

    return { context, events, evidence };
  }

  private recordTransition(
    context: RepairContext,
    action: Parameters<RepairFSM["transition"]>[1],
    reason: string,
    events: RepairEvent[],
  ) {
    const result = this.fsm.transition(context, action, reason);
    events.push(result.event);
    return result;
  }
}
