import { authorizeRestorationExecution, type RestorationExecutionAuthorization } from "./execution-authorization.js";
import { evaluateRestorationGate } from "./gate.js";
import type { MusicDirectorJudgment } from "./music-director-judgment.js";
import type { RestorationCandidate, RestorationPlan, RestorationQcResult } from "./types.js";

export interface RestorationPlanGateIntegrationInput {
  plan: RestorationPlan;
  candidateId: string;
  judgment: MusicDirectorJudgment;
  qc: RestorationQcResult;
  humanApproved?: boolean;
}

/**
 * Single integration boundary for probabilistic-plan candidates.
 * It composes the existing deterministic gate and execution-authorization
 * boundary without introducing a parallel authorization path.
 */
export function authorizeCompiledRestorationPlan(
  input: RestorationPlanGateIntegrationInput,
): RestorationExecutionAuthorization {
  const candidate = findCandidate(input.plan, input.candidateId);
  const gate = evaluateRestorationGate(input.plan, input.candidateId, input.qc);
  return authorizeRestorationExecution({
    plan: input.plan,
    candidate,
    judgment: input.judgment,
    gate,
    qc: input.qc,
    humanApproved: input.humanApproved,
  });
}

export function canExecuteCompiledRestorationPlan(
  input: RestorationPlanGateIntegrationInput,
): boolean {
  return authorizeCompiledRestorationPlan(input).authorized;
}

function findCandidate(plan: RestorationPlan, candidateId: string): RestorationCandidate {
  const candidate = plan.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error("Candidate does not belong to the restoration plan.");
  return candidate;
}
