import type { InstrumentFamily } from "./instrument-replacement.js";

export type ReconstructionScope = "segments";
export type ReconstructionStatus = "planned" | "rendered" | "qc-passed" | "rejected";

export interface ReconstructionSegment {
  targetStartMs: number;
  targetEndMs: number;
  replacementStartMs: number;
  replacementEndMs: number;
  gainDb?: number;
  sourceResidualMix?: number;
  fadeMs?: number;
  phaseInvert?: boolean;
}

export interface ReconstructionApproval {
  approvedByUserId: string;
  approvedAt: string;
  evidenceId: string;
}

export interface InstrumentReconstructionRequest {
  requestId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  instrumentFamily: InstrumentFamily;
  scope: ReconstructionScope;
  segments: ReconstructionSegment[];
  fingerprintSimilarity: number;
  expectedGain: number;
  gainConfidence: number;
  evidenceIds: string[];
  approval: ReconstructionApproval;
}

export interface ReconstructionQcEvidence {
  passed: boolean;
  method: string;
  findings: string[];
  requiresAudition: boolean;
}

export interface ReconstructionArtifactSummary {
  artifactId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  requestId: string;
  status: ReconstructionStatus;
  sha256: string;
  createdAt: string;
}

export interface ReconstructionResult {
  artifact: ReconstructionArtifactSummary;
  qc: ReconstructionQcEvidence;
  provenance: {
    requestId: string;
    sourceArtifactId: string;
    replacementArtifactId: string;
    evidenceIds: string[];
    approvalEvidenceId: string;
  };
}

const bounded01 = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return value;
};

function finiteMs(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and >= 0`);
  return value;
}

export function validateReconstructionRequest(
  request: InstrumentReconstructionRequest,
  options: {
    ownerUserId?: string;
    minimumSimilarity?: number;
    minimumExpectedGain?: number;
    minimumGainConfidence?: number;
  } = {},
): void {
  if (!request.requestId.trim()) throw new Error("requestId is required");
  if (!request.sourceArtifactId.trim() || !request.replacementArtifactId.trim()) {
    throw new Error("source and replacement artifacts are required");
  }
  if (request.sourceArtifactId === request.replacementArtifactId) {
    throw new Error("source and replacement artifacts must differ");
  }
  if (!request.instrumentFamily.trim()) throw new Error("instrumentFamily is required");
  if (request.scope !== "segments") throw new Error("only segment reconstruction is admitted");
  if (!request.segments.length) throw new Error("at least one reconstruction segment is required");
  if (!request.approval.approvedByUserId.trim() || !request.approval.evidenceId.trim()) {
    throw new Error("explicit reconstruction approval evidence is required");
  }
  if (!Number.isFinite(Date.parse(request.approval.approvedAt))) {
    throw new Error("reconstruction approval timestamp is invalid");
  }
  if (options.ownerUserId && request.approval.approvedByUserId !== options.ownerUserId) {
    throw new Error("reconstruction approval owner mismatch");
  }

  const similarity = bounded01(request.fingerprintSimilarity, "fingerprintSimilarity");
  const gain = bounded01(request.expectedGain, "expectedGain");
  const gainConfidence = bounded01(request.gainConfidence, "gainConfidence");
  const minimumSimilarity = options.minimumSimilarity ?? 0.82;
  const minimumExpectedGain = options.minimumExpectedGain ?? 0.15;
  const minimumGainConfidence = options.minimumGainConfidence ?? 0.70;
  bounded01(minimumSimilarity, "minimumSimilarity");
  bounded01(minimumExpectedGain, "minimumExpectedGain");
  bounded01(minimumGainConfidence, "minimumGainConfidence");

  if (similarity < minimumSimilarity) throw new Error("fingerprint similarity is below reconstruction admission threshold");
  if (gain < minimumExpectedGain) throw new Error("expected restoration gain is below reconstruction admission threshold");
  if (gainConfidence < minimumGainConfidence) throw new Error("gain evidence confidence is below reconstruction admission threshold");

  let previousTargetEnd = -1;
  for (const segment of request.segments) {
    finiteMs(segment.targetStartMs, "targetStartMs");
    finiteMs(segment.targetEndMs, "targetEndMs");
    finiteMs(segment.replacementStartMs, "replacementStartMs");
    finiteMs(segment.replacementEndMs, "replacementEndMs");
    if (segment.targetEndMs <= segment.targetStartMs) throw new Error("target reconstruction segment duration must be positive");
    if (segment.replacementEndMs <= segment.replacementStartMs) throw new Error("replacement reconstruction segment duration must be positive");
    if (segment.targetStartMs < previousTargetEnd) throw new Error("target reconstruction segments must not overlap");
    previousTargetEnd = segment.targetEndMs;

    const targetDuration = segment.targetEndMs - segment.targetStartMs;
    const replacementDuration = segment.replacementEndMs - segment.replacementStartMs;
    const tempo = replacementDuration / targetDuration;
    if (tempo < 0.5 || tempo > 2) throw new Error("replacement time-fit ratio must remain between 0.5x and 2x");

    const gainDb = segment.gainDb ?? 0;
    if (!Number.isFinite(gainDb) || Math.abs(gainDb) > 12) throw new Error("reconstruction gain must remain within +/-12 dB");

    const residual = segment.sourceResidualMix ?? 0.05;
    if (!Number.isFinite(residual) || residual < 0 || residual > 0.25) {
      throw new Error("sourceResidualMix must remain between 0 and 0.25");
    }

    const fadeMs = segment.fadeMs ?? Math.min(20, targetDuration / 4);
    if (!Number.isFinite(fadeMs) || fadeMs < 0 || fadeMs > 250 || fadeMs * 2 >= targetDuration) {
      throw new Error("reconstruction fade must fit inside the target segment and remain <= 250 ms");
    }
  }
}

export function createReconstructionResult(
  request: InstrumentReconstructionRequest,
  artifact: ReconstructionArtifactSummary,
  qc: ReconstructionQcEvidence,
): ReconstructionResult {
  validateReconstructionRequest(request);
  if (artifact.sourceArtifactId !== request.sourceArtifactId ||
      artifact.replacementArtifactId !== request.replacementArtifactId ||
      artifact.requestId !== request.requestId) {
    throw new Error("reconstruction artifact provenance does not match request");
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) throw new Error("reconstruction artifact SHA-256 is invalid");
  if (!qc.passed) throw new Error("reconstruction cannot be accepted without passing structural QC");
  return {
    artifact,
    qc,
    provenance: {
      requestId: request.requestId,
      sourceArtifactId: request.sourceArtifactId,
      replacementArtifactId: request.replacementArtifactId,
      evidenceIds: [...new Set(request.evidenceIds)],
      approvalEvidenceId: request.approval.evidenceId,
    },
  };
}
