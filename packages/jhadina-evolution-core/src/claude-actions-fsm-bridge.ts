import type { RepairContext, RepairFSM } from "./repair-fsm";
import type { ExecutionEvidence } from "./evolution-executor";

export type WorkflowOutcome = "VERIFIED" | "FAILED" | "BLOCKED";

export interface WorkflowExecutionResult {
  runId: number;
  taskId: string;
  outcome: WorkflowOutcome;
  changedFiles: string[];
  tests: ExecutionEvidence["tests"];
  securityChecks: ExecutionEvidence["securityChecks"];
  diffSummary: string;
  draftPr?: { url: string; number: number };
}

export function applyWorkflowResult(
  fsm: RepairFSM,
  context: RepairContext,
  result: WorkflowExecutionResult,
): RepairContext {
  if (result.taskId !== context.repairId) {
    throw new Error(`Workflow task ${result.taskId} does not match repair ${context.repairId}`);
  }

  if (result.outcome === "BLOCKED") {
    return fsm.transition(context, "block", "GitHub Actions reported BLOCKED").context;
  }

  if (result.outcome === "FAILED") {
    return fsm.transition(context, "retry", "GitHub Actions repair verification failed").context;
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
