import type { RestorationGateDecision, RestorationPlan, RestorationQcResult } from "./types.js";

/** Deterministic conservation gate: QC cannot authorize a candidate outside its declared scope. */
export function evaluateRestorationGate(
  plan: RestorationPlan,
  candidateId: string,
  qc: RestorationQcResult,
): RestorationGateDecision {
  const candidate = plan.candidates.find((item) => item.id === candidateId);
  if (!candidate) return { allowed: false, reason: "Candidate does not belong to the restoration plan." };
  if (candidate.operationClass === "production") {
    return { allowed: false, candidateId, reason: "Production operations are outside the restoration gate." };
  }
  if (!qc.passed || !qc.conservationPassed || !qc.authenticityPassed || !qc.artifactFree) {
    return { allowed: false, candidateId, reason: "Candidate failed one or more mandatory restoration QC gates." };
  }
  return { allowed: true, candidateId, reason: "Candidate passed deterministic restoration conservation and QC gates." };
}
