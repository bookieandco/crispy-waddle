import type { RestorationGateDecision, RestorationQcResult } from "./types.js";
import type { RestorationProvenanceLedger } from "./provenance-ledger.js";

export type RestorationExecutionStatus = "completed" | "failed" | "aborted";

export interface PostExecutionQcReceipt {
  id: string;
  executionId: string;
  sourceArtifactId: string;
  outputArtifactId?: string;
  status: RestorationExecutionStatus;
  qc: RestorationQcResult;
  gate: RestorationGateDecision;
  outputHash?: string;
  expectedOutputHash?: string;
  hashVerified: boolean;
  reasons: string[];
  createdAt: string;
}

export interface ExecutionAuditEvent {
  id: string;
  type: "execution-completed" | "execution-failed" | "execution-aborted";
  executionId: string;
  sourceArtifactId: string;
  outputArtifactId?: string;
  receiptId: string;
  contentHash?: string;
  createdAt: string;
}

/**
 * Records the immutable post-execution outcome before a successful output can
 * become a restoration version. Failed/aborted executions are retained as
 * audit evidence and can never be silently promoted.
 */
export function recordPostExecutionQc(input: {
  ledger: RestorationProvenanceLedger;
  executionId: string;
  sourceArtifactId: string;
  outputArtifactId?: string;
  status: RestorationExecutionStatus;
  qc: RestorationQcResult;
  gate: RestorationGateDecision;
  outputHash?: string;
  expectedOutputHash?: string;
  createdAt: string;
}): PostExecutionQcReceipt {
  const hashVerified = Boolean(
    input.outputHash && input.expectedOutputHash && input.outputHash === input.expectedOutputHash,
  );
  const reasons = [...input.qc.reasons];
  if (input.status !== "completed") reasons.push(`execution-${input.status}`);
  if (input.outputHash || input.expectedOutputHash) {
    if (!hashVerified) reasons.push("output-hash-mismatch");
  }
  if (!input.gate.allowed) reasons.push("deterministic-gate-denied");
  if (input.status === "completed" && !input.qc.passed) reasons.push("post-execution-qc-failed");

  const receipt: PostExecutionQcReceipt = {
    id: `qc-receipt:${input.executionId}`,
    executionId: input.executionId,
    sourceArtifactId: input.sourceArtifactId,
    outputArtifactId: input.outputArtifactId,
    status: input.status,
    qc: { ...input.qc, reasons: [...input.qc.reasons] },
    gate: { ...input.gate },
    outputHash: input.outputHash,
    expectedOutputHash: input.expectedOutputHash,
    hashVerified,
    reasons: [...new Set(reasons)],
    createdAt: input.createdAt,
  };

  input.ledger.recordExecutionAudit({
    id: `audit:execution:${input.executionId}`,
    type: `execution-${input.status}`,
    executionId: input.executionId,
    sourceArtifactId: input.sourceArtifactId,
    outputArtifactId: input.outputArtifactId,
    receiptId: receipt.id,
    contentHash: input.outputHash,
    createdAt: input.createdAt,
  });

  return receipt;
}

export function canPromotePostExecutionQc(receipt: PostExecutionQcReceipt): boolean {
  return receipt.status === "completed"
    && receipt.qc.passed
    && receipt.qc.conservationPassed
    && receipt.qc.authenticityPassed
    && receipt.qc.artifactFree
    && receipt.gate.allowed
    && receipt.hashVerified;
}
