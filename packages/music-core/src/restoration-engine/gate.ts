import type { RestorationGateDecision, RestorationPlan, RestorationQcResult } from "./types.js";

/**
 * Deterministic conservation gate. Director judgment can recommend an outcome,
 * but only this gate can authorize promotion of a restoration candidate.
 */
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
  if (candidate.operationClass === "simulation") {
    return { allowed: false, candidateId, reason: "Simulation outputs cannot be promoted as historical restoration." };
  }
  if (plan.requiresApproval) {
    return { allowed: false, candidateId, reason: "Restoration plan requires explicit approval before promotion." };
  }
  if (candidate.status !== "qc-passed") {
    return { allowed: false, candidateId, reason: "Candidate must be explicitly marked qc-passed before promotion." };
  }
  if (!qc.passed || !qc.conservationPassed || !qc.authenticityPassed || !qc.artifactFree) {
    return { allowed: false, candidateId, reason: "Candidate failed one or more mandatory restoration QC gates." };
  }
  return { allowed: true, candidateId, reason: "Candidate passed deterministic restoration conservation and QC gates." };
}
