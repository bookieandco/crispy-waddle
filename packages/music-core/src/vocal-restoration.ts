export type VocalRepairOperation =
  | "denoise"
  | "declick"
  | "declip"
  | "eq"
  | "gain";

export interface VocalHierarchyContext {
  sectionId?: string;
  phraseId?: string;
  word?: string;
  syllable?: string;
  phoneme?: string;
  previousPhoneme?: string;
  nextPhoneme?: string;
}

export interface VocalRepairSegment {
  startMs: number;
  endMs: number;
  operation: VocalRepairOperation;
  parameters?: Record<string, string | number | boolean>;
  sourceResidualMix?: number;
  fadeMs?: number;
  hierarchy?: VocalHierarchyContext;
  evidenceIds: string[];
}

export interface VocalRestorationApproval {
  approvedByUserId: string;
  approvedAt: string;
  evidenceId: string;
}

export interface VocalRestorationRequest {
  requestId: string;
  sourceArtifactId: string;
  segments: VocalRepairSegment[];
  evidenceIds: string[];
  approval: VocalRestorationApproval;
}

export interface VocalPreservationMetrics {
  passed: boolean;
  sourceVoicedFraction: number;
  outputVoicedFraction: number;
  voicedFractionDelta: number;
  sourceMedianF0Hz?: number;
  outputMedianF0Hz?: number;
  medianF0CentsDelta?: number;
  sourceF0SpreadCents?: number;
  outputF0SpreadCents?: number;
  f0SpreadCentsDelta?: number;
  sourceSpectralCentroidHz: number;
  outputSpectralCentroidHz: number;
  spectralCentroidRelativeDelta: number;
  sourceRmsDb: number;
  outputRmsDb: number;
  rmsDbDelta: number;
  sourceHarmonicity: number;
  outputHarmonicity: number;
  harmonicityDelta: number;
  reasons: string[];
}

export interface VocalRestorationQcEvidence {
  passed: boolean;
  method: "vocal-identity-preservation-v1";
  preservation: VocalPreservationMetrics;
  requiresAudition: true;
  findings: string[];
}

export interface VocalRestorationArtifactSummary {
  artifactId: string;
  sourceArtifactId: string;
  requestId: string;
  sha256: string;
  createdAt: string;
}

export interface VocalRestorationResult {
  artifact: VocalRestorationArtifactSummary;
  qc: VocalRestorationQcEvidence;
  provenance: {
    requestId: string;
    sourceArtifactId: string;
    evidenceIds: string[];
    approvalEvidenceId: string;
  };
}

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and >= 0`);
  return value;
};

const bounded = (value: number, min: number, max: number, label: string): number => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return value;
};

function validateOperation(segment: VocalRepairSegment): void {
  const parameters = segment.parameters ?? {};
  if (segment.operation === "gain") {
    bounded(Number(parameters.gainDb ?? 0), -6, 6, "vocal gainDb");
    return;
  }
  if (segment.operation === "eq") {
    bounded(Number(parameters.frequencyHz ?? 0), 80, 16000, "vocal EQ frequencyHz");
    bounded(Number(parameters.gainDb ?? 0), -6, 6, "vocal EQ gainDb");
    bounded(Number(parameters.q ?? 0), 0.2, 10, "vocal EQ q");
    return;
  }
  if (segment.operation === "denoise") {
    bounded(Number(parameters.noiseFloorDb ?? -55), -70, -30, "vocal denoise noiseFloorDb");
    return;
  }
  if (segment.operation === "declick" || segment.operation === "declip") return;
  const exhaustive: never = segment.operation;
  throw new Error(`unsupported vocal repair operation: ${String(exhaustive)}`);
}

export function validateVocalRestorationRequest(
  request: VocalRestorationRequest,
  options: { ownerUserId?: string } = {},
): void {
  if (!request.requestId.trim()) throw new Error("vocal restoration requestId is required");
  if (!request.sourceArtifactId.trim()) throw new Error("vocal restoration sourceArtifactId is required");
  if (!request.segments.length || request.segments.length > 64) {
    throw new Error("vocal restoration requires between 1 and 64 segments");
  }
  if (!request.approval.approvedByUserId.trim() || !request.approval.evidenceId.trim()) {
    throw new Error("explicit vocal restoration approval evidence is required");
  }
  if (!Number.isFinite(Date.parse(request.approval.approvedAt))) {
    throw new Error("vocal restoration approval timestamp is invalid");
  }
  if (options.ownerUserId && request.approval.approvedByUserId !== options.ownerUserId) {
    throw new Error("vocal restoration approval owner mismatch");
  }

  let previousEnd = -1;
  for (const segment of request.segments) {
    finiteNonNegative(segment.startMs, "vocal segment startMs");
    finiteNonNegative(segment.endMs, "vocal segment endMs");
    if (segment.endMs <= segment.startMs) throw new Error("vocal segment duration must be positive");
    if (segment.endMs - segment.startMs < 20) throw new Error("vocal segment must be at least 20 ms");
    if (segment.startMs < previousEnd) throw new Error("vocal restoration segments must not overlap");
    previousEnd = segment.endMs;

    const residual = segment.sourceResidualMix ?? 0.08;
    bounded(residual, 0, 0.25, "vocal sourceResidualMix");

    const duration = segment.endMs - segment.startMs;
    const fadeMs = segment.fadeMs ?? Math.min(20, duration / 4);
    bounded(fadeMs, 0, 100, "vocal fadeMs");
    if (fadeMs * 2 >= duration) throw new Error("vocal fade must fit inside the segment");

    if (!Array.isArray(segment.evidenceIds)) throw new Error("vocal segment evidenceIds are required");
    validateOperation(segment);
  }
}

export function createVocalRestorationResult(
  request: VocalRestorationRequest,
  artifact: VocalRestorationArtifactSummary,
  preservation: VocalPreservationMetrics,
): VocalRestorationResult {
  validateVocalRestorationRequest(request);
  if (artifact.sourceArtifactId !== request.sourceArtifactId || artifact.requestId !== request.requestId) {
    throw new Error("vocal restoration artifact provenance does not match request");
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
    throw new Error("vocal restoration artifact SHA-256 is invalid");
  }
  if (!preservation.passed) {
    throw new Error(`vocal restoration identity preservation failed: ${preservation.reasons.join("; ")}`);
  }
  return {
    artifact,
    qc: {
      passed: true,
      method: "vocal-identity-preservation-v1",
      preservation,
      requiresAudition: true,
      findings: [
        "source and output duration/geometry must remain stable",
        "voicing and F0 drift stayed inside conservative identity limits",
        "spectral/RMS/harmonicity drift stayed inside conservative limits",
        "human A/B audition remains required before promotion",
      ],
    },
    provenance: {
      requestId: request.requestId,
      sourceArtifactId: request.sourceArtifactId,
      evidenceIds: [...new Set([
        ...request.evidenceIds,
        ...request.segments.flatMap(segment => segment.evidenceIds),
      ])],
      approvalEvidenceId: request.approval.evidenceId,
    },
  };
}
