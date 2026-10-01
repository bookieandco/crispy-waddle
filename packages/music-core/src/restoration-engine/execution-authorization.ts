import type { MusicDirectorDecision, MusicDirectorJudgment } from "./music-director-judgment.js";
import type { RestorationCandidate, RestorationGateDecision, RestorationPlan, RestorationQcResult } from "./types.js";

export interface RestorationExecutionAuthorization {
  id: string;
  authorityScope?: "promotion";
  planId: string;
  candidateId: string;
  sourceArtifactId: string;
  outputArtifactId?: string;
  decision: MusicDirectorDecision;
  authorized: boolean;
  requiresHumanReview: boolean;
  gateReason: string;
  evidenceIds: string[];
  reasons: string[];
}

const unique = (values: string[]): string[] => [...new Set(values)];

/**
 * Final authorization boundary between judgment and an audio executor.
 * A Director judgment is advisory; only an allowed deterministic gate result
 * can authorize execution. This function never renders or mutates audio.
 */
export function authorizeRestorationExecution(input: {
  plan: RestorationPlan;
  candidate: RestorationCandidate;
  judgment: MusicDirectorJudgment;
  gate: RestorationGateDecision;
  qc: RestorationQcResult;
  humanApproved?: boolean;
}): RestorationExecutionAuthorization {
  const failures: string[] = [];
  const reasons: string[] = [];
  const { plan, candidate, judgment, gate, qc } = input;

  if (!plan.candidates.some((item) => item.id === candidate.id)) failures.push("Candidate does not belong to the restoration plan.");
  if (candidate.inputArtifactId !== judgment.sourceArtifactId) failures.push("Candidate input artifact does not match the judgment source artifact.");
  if (judgment.candidateId !== candidate.id) failures.push("Judgment does not authorize this candidate.");
  if (judgment.decision !== "restore" && judgment.decision !== "replace") failures.push("Director decision is not executable.");
  if (judgment.requiresHumanReview && !input.humanApproved) failures.push("Explicit human approval is required before execution.");
  if (!gate.allowed) failures.push(`Deterministic restoration gate denied execution: ${gate.reason}`);
  if (!qc.passed || !qc.conservationPassed || !qc.authenticityPassed || !qc.artifactFree) failures.push("Mandatory QC requirements are not satisfied.");
  if (candidate.operationClass === "production") failures.push("Production operations cannot execute through the restoration boundary.");
  if (candidate.operationClass === "simulation") failures.push("Simulation output cannot execute as historical restoration.");

  const authorized = failures.length === 0;
  if (authorized) reasons.push("Execution is authorized only after Director judgment, deterministic gate, and mandatory QC agree.");
  else reasons.push("No audio mutation is authorized while any execution boundary check fails.");

  return {
    id: `execution-auth:${plan.id}:${candidate.id}:${judgment.id}`,
    authorityScope: "promotion",
    planId: plan.id,
    candidateId: candidate.id,
    sourceArtifactId: candidate.inputArtifactId,
    outputArtifactId: candidate.outputArtifactId,
    decision: judgment.decision,
    authorized,
    requiresHumanReview: !authorized && (judgment.requiresHumanReview || Boolean(plan.requiresApproval)),
    gateReason: gate.reason,
    evidenceIds: unique([...plan.evidenceIds, ...candidate.evidenceIds, ...judgment.evidenceIds]),
    reasons: unique([...reasons, ...failures]),
  };
}

/** Executor contract: implementations receive authorization, not Director cognition. */
export interface RestorationTrialRenderAuthorization {
  id: string;
  planId: string;
  candidateId: string;
  sourceArtifactId: string;
  authorityScope: "render-only";
  authorized: boolean;
  requiresHumanReview: true;
  evidenceIds: string[];
  reasons: string[];
}

export type RestorationArtifactRenderAuthorization =
  | RestorationExecutionAuthorization
  | RestorationTrialRenderAuthorization;

export function authorizeRestorationTrialRender(input: {
  plan: RestorationPlan;
  candidateId: string;
}): RestorationTrialRenderAuthorization {
  const candidate = input.plan.candidates.find((item) => item.id === input.candidateId);
  const failures: string[] = [];
  if (!candidate) failures.push("Candidate does not belong to the restoration plan.");
  if (candidate?.operationClass === "production") failures.push("Production operations cannot render through restoration trial authority.");
  if (candidate?.operationClass === "simulation") failures.push("Simulation output cannot render as historical restoration evidence.");
  if (candidate?.operationClass === "analysis") failures.push("Analysis candidates do not produce restoration trial audio.");
  if (candidate && !candidate.inputArtifactId.trim()) failures.push("Candidate source artifact is required.");

  return {
    id: `trial-render-auth:${input.plan.id}:${input.candidateId}`,
    planId: input.plan.id,
    candidateId: input.candidateId,
    sourceArtifactId: candidate?.inputArtifactId ?? "",
    authorityScope: "render-only",
    authorized: failures.length === 0,
    requiresHumanReview: true,
    evidenceIds: unique([
      ...input.plan.evidenceIds,
      ...(candidate?.evidenceIds ?? []),
    ]),
    reasons: failures.length
      ? unique(["Trial render denied.", ...failures])
      : ["Trial render is authorized for measurement only and cannot create a restoration version."],
  };
}

export interface RestorationExecutor {
  execute(authorization: RestorationExecutionAuthorization): Promise<{ outputArtifactId: string }>;
}

export async function executeAuthorizedRestoration(
  authorization: RestorationExecutionAuthorization,
  executor: RestorationExecutor,
): Promise<{ outputArtifactId: string }> {
  if (!authorization.authorized) throw new Error("Restoration execution denied by authorization boundary.");
  return executor.execute(authorization);
}
