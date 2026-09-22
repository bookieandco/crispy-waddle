export interface TemporalEnergyPoint {
  timeSeconds: number;
  level: number;
}

export interface VideoConditionedFoleyRequest {
  id: string;
  projectId: string;
  sourceVideoAssetId: string;
  sourceVideoSha256: string;
  startSeconds: number;
  endSeconds: number;
  prompt: string;
  evidenceIds: readonly string[];
  temporalEnvelope?: readonly TemporalEnergyPoint[];
  referenceAudioAssetId?: string;
}

export interface GeneratedFoleyArtifact {
  id: string;
  requestId: string;
  audioAssetId: string;
  provider: string;
  modelId: string;
  sampleRateHz: number;
  durationSeconds: number;
  audioSha256: string;
  evidenceIds: readonly string[];
  measuredDesyncSeconds?: number;
  semanticAlignmentScore?: number;
}

export interface GeneratedFoleyDecision {
  admissible: boolean;
  reasons: readonly string[];
}

export function validateGeneratedFoleyArtifact(
  request: VideoConditionedFoleyRequest,
  artifact: GeneratedFoleyArtifact,
  policy: {
    maximumDesyncSeconds: number;
    minimumSemanticAlignment?: number;
    durationToleranceSeconds: number;
  },
): GeneratedFoleyDecision {
  const reasons: string[] = [];
  if (artifact.requestId !== request.id) reasons.push('DIRECTOR_FOLEY_REQUEST_MISMATCH');
  if (!artifact.audioAssetId.trim() || !artifact.audioSha256.trim()) reasons.push('DIRECTOR_FOLEY_ARTIFACT_IDENTITY_REQUIRED');
  if (!Number.isInteger(artifact.sampleRateHz) || artifact.sampleRateHz < 8000) reasons.push('DIRECTOR_FOLEY_SAMPLE_RATE_INVALID');
  if (!artifact.evidenceIds.length) reasons.push('DIRECTOR_FOLEY_OUTPUT_EVIDENCE_REQUIRED');

  const requestedDuration = request.endSeconds - request.startSeconds;
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) reasons.push('DIRECTOR_FOLEY_REQUEST_RANGE_INVALID');
  if (!Number.isFinite(artifact.durationSeconds) || artifact.durationSeconds <= 0) reasons.push('DIRECTOR_FOLEY_DURATION_INVALID');
  else if (Math.abs(artifact.durationSeconds - requestedDuration) > policy.durationToleranceSeconds) {
    reasons.push('DIRECTOR_FOLEY_DURATION_MISMATCH');
  }

  if (
    artifact.measuredDesyncSeconds === undefined ||
    !Number.isFinite(artifact.measuredDesyncSeconds) ||
    artifact.measuredDesyncSeconds < 0
  ) reasons.push('DIRECTOR_FOLEY_DESYNC_MEASUREMENT_REQUIRED');
  else if (artifact.measuredDesyncSeconds > policy.maximumDesyncSeconds) {
    reasons.push('DIRECTOR_FOLEY_DESYNC_EXCEEDED');
  }

  if (policy.minimumSemanticAlignment !== undefined) {
    if (
      artifact.semanticAlignmentScore === undefined ||
      !Number.isFinite(artifact.semanticAlignmentScore) ||
      artifact.semanticAlignmentScore < policy.minimumSemanticAlignment
    ) reasons.push('DIRECTOR_FOLEY_SEMANTIC_ALIGNMENT_LOW');
  }

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function validateTemporalEnergyEnvelope(
  points: readonly TemporalEnergyPoint[],
  durationSeconds: number,
): readonly string[] {
  const reasons: string[] = [];
  let last = -Infinity;
  for (const point of points) {
    if (
      !Number.isFinite(point.timeSeconds) ||
      point.timeSeconds < 0 ||
      point.timeSeconds > durationSeconds ||
      point.timeSeconds < last
    ) reasons.push('DIRECTOR_FOLEY_ENVELOPE_TIME_INVALID');
    if (!Number.isFinite(point.level) || point.level < 0 || point.level > 1) {
      reasons.push('DIRECTOR_FOLEY_ENVELOPE_LEVEL_INVALID');
    }
    last = point.timeSeconds;
  }
  return Object.freeze([...new Set(reasons)]);
}
