import {
  authorizeRestorationExecution,
  type RestorationExecutionAuthorization,
  type RestorationTrialRenderAuthorization,
} from "./execution-authorization.js";
import { evaluateRestorationGate } from "./gate.js";
import type { MusicDirectorJudgment } from "./music-director-judgment.js";
import {
  canPromotePostExecutionQc,
  recordPostExecutionQc,
  type PostExecutionQcReceipt,
} from "./post-execution-audit.js";
import type {
  MusicArtifact,
  RestorationProvenanceLedger,
  RestorationVersion,
} from "./provenance-ledger.js";
import type { RestorationArtifactWriter } from "./verified-execution.js";
import type {
  RestorationCandidate,
  RestorationGateDecision,
  RestorationPlan,
  RestorationQcResult,
} from "./types.js";

function assertTrialAuthority(input: {
  authorization: RestorationTrialRenderAuthorization;
  plan: RestorationPlan;
  candidate: RestorationCandidate;
  sourceArtifactId: string;
}): void {
  const { authorization, plan, candidate, sourceArtifactId } = input;
  if (!authorization.authorized || authorization.authorityScope !== "render-only") {
    throw new Error("Restoration trial render requires authorized render-only authority.");
  }
  if (authorization.planId !== plan.id || authorization.candidateId !== candidate.id) {
    throw new Error("Trial render authority does not match the supplied plan and candidate.");
  }
  if (!plan.candidates.some((item) => item.id === candidate.id)) {
    throw new Error("Trial render candidate does not belong to the restoration plan.");
  }
  if (candidate.inputArtifactId !== sourceArtifactId || authorization.sourceArtifactId !== sourceArtifactId) {
    throw new Error("Trial render source lineage mismatch.");
  }
}

export interface RestorationTrialRenderResult {
  artifact: MusicArtifact;
  authorization: RestorationTrialRenderAuthorization;
}

/**
 * Render-only execution stage.
 *
 * The returned audio is evidence. This function deliberately has no ledger
 * version path and no promotion authorization path.
 */
export async function renderRestorationTrial(input: {
  authorization: RestorationTrialRenderAuthorization;
  plan: RestorationPlan;
  candidate: RestorationCandidate;
  source: MusicArtifact;
  writer: RestorationArtifactWriter;
}): Promise<RestorationTrialRenderResult> {
  assertTrialAuthority({
    authorization: input.authorization,
    plan: input.plan,
    candidate: input.candidate,
    sourceArtifactId: input.source.id,
  });

  const artifact = await input.writer.write({ authorization: input.authorization });
  if (!artifact.contentHash) throw new Error("Trial render returned an artifact without a content hash.");
  if (artifact.parentArtifactId !== input.source.id) throw new Error("Trial render output lineage mismatch.");
  if (
    artifact.sampleRate !== input.source.sampleRate ||
    artifact.channels !== input.source.channels ||
    artifact.sampleCount !== input.source.sampleCount
  ) {
    throw new Error("Trial render changed source signal geometry.");
  }
  return { artifact, authorization: input.authorization };
}

export interface MeasuredRestorationPromotionResult {
  candidate: RestorationCandidate;
  plan: RestorationPlan;
  judgment: MusicDirectorJudgment;
  gate: RestorationGateDecision;
  promotionAuthorization: RestorationExecutionAuthorization;
  receipt: PostExecutionQcReceipt;
  version?: RestorationVersion;
}

/**
 * Promotion stage for an already-rendered trial.
 *
 * QC arrives here only after the actual output artifact has been measured.
 * The original plan's approval requirement is preserved. Render-only authority
 * is retained as provenance but can never substitute for promotion authority.
 */
export function promoteMeasuredRestorationTrial(input: {
  executionId: string;
  trialAuthorization: RestorationTrialRenderAuthorization;
  plan: RestorationPlan;
  candidate: RestorationCandidate;
  source: MusicArtifact;
  artifact: MusicArtifact;
  qc: RestorationQcResult;
  ledger: RestorationProvenanceLedger;
  createdAt: string;
}): MeasuredRestorationPromotionResult {
  assertTrialAuthority({
    authorization: input.trialAuthorization,
    plan: input.plan,
    candidate: input.candidate,
    sourceArtifactId: input.source.id,
  });
  if (!input.artifact.contentHash) throw new Error("Measured trial artifact hash is required.");
  if (input.artifact.parentArtifactId !== input.source.id) throw new Error("Measured trial output lineage mismatch.");
  if (
    input.artifact.sampleRate !== input.source.sampleRate ||
    input.artifact.channels !== input.source.channels ||
    input.artifact.sampleCount !== input.source.sampleCount
  ) {
    throw new Error("Measured trial changed source signal geometry.");
  }

  const qcPassed =
    input.qc.passed &&
    input.qc.conservationPassed &&
    input.qc.authenticityPassed &&
    input.qc.artifactFree;
  const candidate: RestorationCandidate = {
    ...input.candidate,
    status: qcPassed ? "qc-passed" : "rendered",
    outputArtifactId: input.artifact.id,
    evidenceIds: [...new Set([...input.candidate.evidenceIds, ...input.trialAuthorization.evidenceIds])],
  };
  const plan: RestorationPlan = {
    ...input.plan,
    candidates: input.plan.candidates.map((item) => item.id === candidate.id ? candidate : item),
    evidenceIds: [...new Set([...input.plan.evidenceIds, ...candidate.evidenceIds])],
  };
  const gate = evaluateRestorationGate(plan, candidate.id, input.qc);
  const decision = qcPassed
    ? (candidate.operation === "instrument-replacement" ? "replace" : "restore")
    : "review";
  const judgment: MusicDirectorJudgment = {
    id: `director:measured:${plan.id}:${candidate.id}:${input.executionId}`,
    planId: plan.id,
    candidateId: candidate.id,
    sourceArtifactId: input.source.id,
    candidateArtifactId: input.artifact.id,
    decision,
    confidence: qcPassed ? 1 : 0,
    evidenceIds: [...new Set([...plan.evidenceIds, ...candidate.evidenceIds])],
    reasons: qcPassed
      ? ["Measured post-render QC passed all mandatory restoration checks."]
      : ["Measured post-render QC did not pass all mandatory restoration checks."],
    hardConstraintFailures: qcPassed ? [] : [...input.qc.reasons],
    requiresHumanReview: plan.requiresApproval || !qcPassed,
  };
  const promotionAuthorization = authorizeRestorationExecution({
    plan,
    candidate,
    judgment,
    gate,
    qc: input.qc,
    humanApproved: false,
  });

  if (!input.ledger.getArtifact(input.source.id)) input.ledger.registerArtifact(input.source);
  if (!input.ledger.getArtifact(input.artifact.id)) input.ledger.registerArtifact(input.artifact);
  const receipt = recordPostExecutionQc({
    ledger: input.ledger,
    executionId: input.executionId,
    sourceArtifactId: input.source.id,
    outputArtifactId: input.artifact.id,
    status: "completed",
    qc: input.qc,
    gate,
    outputHash: input.artifact.contentHash,
    expectedOutputHash: input.artifact.contentHash,
    createdAt: input.createdAt,
  });

  if (!promotionAuthorization.authorized || !canPromotePostExecutionQc(receipt)) {
    return { candidate, plan, judgment, gate, promotionAuthorization, receipt };
  }

  const version = input.ledger.createVersion({
    id: `restoration-version:${input.executionId}`,
    caseId: plan.caseId,
    sourceArtifactId: input.source.id,
    outputArtifactId: input.artifact.id,
    candidateId: candidate.id,
    operationClass: candidate.operationClass,
    operation: candidate.operation,
    evidenceIds: [...new Set([...plan.evidenceIds, ...candidate.evidenceIds])],
    authorizationIds: [input.trialAuthorization.id, promotionAuthorization.id],
    qcPassed: true,
    createdAt: input.createdAt,
  });
  return { candidate, plan, judgment, gate, promotionAuthorization, receipt, version };
}
