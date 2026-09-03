import type { RestorationExecutionAuthorization } from "./execution-authorization.js";
import {
  canPromotePostExecutionQc,
  recordPostExecutionQc,
  type PostExecutionQcReceipt,
  type RestorationExecutionStatus,
} from "./post-execution-audit.js";
import type { MusicArtifact, RestorationProvenanceLedger, RestorationVersion } from "./provenance-ledger.js";
import type { RestorationGateDecision, RestorationQcResult, RestorationPlan, RestorationCandidate } from "./types.js";

export interface RestorationArtifactWriter {
  write(input: {
    authorization: RestorationExecutionAuthorization;
  }): Promise<MusicArtifact>;
}

export interface VerifiedRestorationExecutionResult {
  executionId: string;
  status: RestorationExecutionStatus;
  artifact?: MusicArtifact;
  receipt: PostExecutionQcReceipt;
  version?: RestorationVersion;
}

/**
 * Executes an already-authorized restoration and promotes only the artifact
 * actually returned by the writer. No caller-supplied artifact id is trusted
 * as proof of execution.
 */
export async function executeVerifiedRestoration(input: {
  executionId: string;
  authorization: RestorationExecutionAuthorization;
  plan: RestorationPlan;
  candidate: RestorationCandidate;
  ledger: RestorationProvenanceLedger;
  writer: RestorationArtifactWriter;
  gate: RestorationGateDecision;
  qc: RestorationQcResult;
  expectedOutputHash?: string;
  createdAt: string;
}): Promise<VerifiedRestorationExecutionResult> {
  const {
    executionId,
    authorization,
    plan,
    candidate,
    ledger,
    writer,
    gate,
    qc,
    expectedOutputHash,
    createdAt,
  } = input;

  if (!authorization.authorized) {
    throw new Error("Restoration execution denied by authorization boundary.");
  }
  if (authorization.planId !== plan.id || authorization.candidateId !== candidate.id) {
    throw new Error("Execution authorization does not match the supplied restoration plan and candidate.");
  }
  if (candidate.inputArtifactId !== authorization.sourceArtifactId) {
    throw new Error("Candidate input artifact does not match execution authorization source.");
  }

  let artifact: MusicArtifact;
  try {
    artifact = await writer.write({ authorization });
  } catch (error) {
    const receipt = recordPostExecutionQc({
      ledger,
      executionId,
      sourceArtifactId: authorization.sourceArtifactId,
      status: "failed",
      qc,
      gate,
      createdAt,
    });
    return { executionId, status: "failed", receipt };
  }

  if (!artifact.contentHash) throw new Error("Artifact writer returned an artifact without a content hash.");
  if (artifact.parentArtifactId !== authorization.sourceArtifactId) {
    const receipt = recordPostExecutionQc({
      ledger,
      executionId,
      sourceArtifactId: authorization.sourceArtifactId,
      outputArtifactId: artifact.id,
      status: "completed",
      qc: { ...qc, passed: false, reasons: [...qc.reasons, "output-lineage-mismatch"] },
      gate,
      outputHash: artifact.contentHash,
      expectedOutputHash,
      createdAt,
    });
    return { executionId, status: "completed", artifact, receipt };
  }

  if (expectedOutputHash && artifact.contentHash !== expectedOutputHash) {
    const receipt = recordPostExecutionQc({
      ledger,
      executionId,
      sourceArtifactId: authorization.sourceArtifactId,
      outputArtifactId: artifact.id,
      status: "completed",
      qc: { ...qc, passed: false, reasons: [...qc.reasons, "output-hash-mismatch"] },
      gate,
      outputHash: artifact.contentHash,
      expectedOutputHash,
      createdAt,
    });
    return { executionId, status: "completed", artifact, receipt };
  }

  ledger.registerArtifact(artifact);

  const receipt = recordPostExecutionQc({
    ledger,
    executionId,
    sourceArtifactId: authorization.sourceArtifactId,
    outputArtifactId: artifact.id,
    status: "completed",
    qc,
    gate,
    outputHash: artifact.contentHash,
    expectedOutputHash: expectedOutputHash ?? artifact.contentHash,
    createdAt,
  });

  if (!canPromotePostExecutionQc(receipt)) {
    return { executionId, status: "completed", artifact, receipt };
  }

  const version = ledger.createVersion({
    id: `restoration-version:${executionId}`,
    caseId: plan.caseId,
    sourceArtifactId: authorization.sourceArtifactId,
    outputArtifactId: artifact.id,
    candidateId: candidate.id,
    operationClass: candidate.operationClass,
    operation: candidate.operation,
    evidenceIds: [...new Set([...plan.evidenceIds, ...candidate.evidenceIds])],
    authorizationIds: [authorization.id],
    qcPassed: true,
    createdAt,
  });

  return { executionId, status: "completed", artifact, receipt, version };
}
