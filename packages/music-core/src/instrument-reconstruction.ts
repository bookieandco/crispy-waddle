export type ReconstructionScope = "full" | "segments";
export type ReconstructionStatus = "planned" | "rendered";

export interface ReconstructionSegment {
  startMs: number;
  endMs: number;
}

export interface ReconstructionRequest {
  requestId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  instrumentFamily: string;
  scope: ReconstructionScope;
  segments: ReconstructionSegment[];
  fingerprintSimilarity: number;
  expectedGain: number;
  gainConfidence: number;
  approved: boolean;
}

export interface ReconstructionArtifact {
  artifactId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  requestId: string;
  status: ReconstructionStatus;
  createdAt: string;
}

export interface ReconstructionQcEvidence {
  passed: boolean;
  method: string;
  findings: string[];
}

export interface ReconstructionResult {
  artifact: ReconstructionArtifact;
  qc: ReconstructionQcEvidence;
  provenance: {
    requestId: string;
    sourceArtifactId: string;
    replacementArtifactId: string;
  };
}

export interface InstrumentReconstructionProvider {
  reconstruct(request: ReconstructionRequest): Promise<ReconstructionResult>;
}

export function validateReconstructionRequest(request: ReconstructionRequest): void {
  if (!request.requestId.trim()) throw new Error("requestId is required");
  if (!request.sourceArtifactId.trim() || !request.replacementArtifactId.trim()) {
    throw new Error("source and replacement artifacts are required");
  }
  if (request.sourceArtifactId === request.replacementArtifactId) {
    throw new Error("source and replacement artifacts must differ");
  }
  if (!request.instrumentFamily.trim()) throw new Error("instrumentFamily is required");
  for (const [name, value] of [
    ["fingerprintSimilarity", request.fingerprintSimilarity],
    ["expectedGain", request.expectedGain],
    ["gainConfidence", request.gainConfidence],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
  }
  if (request.segments.length === 0) throw new Error("at least one reconstruction segment is required");
  let previousEnd = -1;
  for (const segment of request.segments) {
    if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.startMs < 0 || segment.endMs <= segment.startMs) {
      throw new Error("reconstruction segments must have valid start/end times");
    }
    if (segment.startMs < previousEnd) throw new Error("reconstruction segments must not overlap");
    previousEnd = segment.endMs;
  }
  if (!request.approved) throw new Error("human approval is required before reconstruction");
}

export function createReconstructionResult(
  request: ReconstructionRequest,
  artifact: ReconstructionArtifact,
  qc: ReconstructionQcEvidence,
): ReconstructionResult {
  validateReconstructionRequest(request);
  if (artifact.sourceArtifactId !== request.sourceArtifactId || artifact.replacementArtifactId !== request.replacementArtifactId) {
    throw new Error("reconstruction artifact provenance does not match request");
  }
  if (artifact.requestId !== request.requestId) throw new Error("reconstruction artifact requestId does not match request");
  if (!qc.passed) throw new Error("reconstruction cannot be accepted without passing QC");
  return {
    artifact,
    qc,
    provenance: {
      requestId: request.requestId,
      sourceArtifactId: request.sourceArtifactId,
      replacementArtifactId: request.replacementArtifactId,
    },
  };
}
