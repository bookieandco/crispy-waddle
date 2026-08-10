import type { RepairContext, RepairFSM } from "./repair-fsm";
import type { EvolutionExecutionResult } from "./evolution-result";

export function applyWorkflowResult(
  fsm: RepairFSM,
  context: RepairContext,
  result: EvolutionExecutionResult,
): RepairContext {
  if (result.taskId !== context.repairId) {
    throw new Error(`Workflow task ${result.taskId} does not match repair ${context.repairId}`);
  }

  if (result.status === "BLOCKED") {
    return fsm.transition(context, "block", "GitHub Actions reported BLOCKED").context;
  }

  if (result.status === "FAILED") {
    return fsm.transition(context, "retry", "GitHub Actions repair verification failed").context;
  }

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
