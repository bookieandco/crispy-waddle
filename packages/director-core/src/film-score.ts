export interface FilmScoreCue {
  id: string;
  projectId: string;
  sceneId: string;
  startSeconds: number;
  endSeconds: number;
  dramaticPurpose: string;
  emotionalArc?: string;
  tempoBpm?: number;
  meter?: string;
  keyCenter?: string;
  instrumentation?: readonly string[];
  motifIds?: readonly string[];
  dialoguePriority: boolean;
  syncPoints?: readonly { timeSeconds: number; label: string }[];
  evidenceIds: readonly string[];
}

export interface FilmScoreArtifact {
  id: string;
  cueId: string;
  masterAssetId: string;
  stemAssetIds: readonly string[];
  providerId: string;
  modelId?: string;
  durationSeconds: number;
  sampleRateHz: number;
  rightsStatus: 'owned' | 'licensed-commercial' | 'generated-commercial-safe' | 'unknown';
  provenanceEvidenceIds: readonly string[];
}

export function validateFilmScoreCue(cue: FilmScoreCue, projectDurationSeconds?: number): readonly string[] {
  const errors: string[] = [];
  if (!cue.id.trim() || !cue.projectId.trim() || !cue.sceneId.trim()) errors.push('DIRECTOR_SCORE_CUE_IDENTITY_REQUIRED');
  if (!cue.dramaticPurpose.trim()) errors.push('DIRECTOR_SCORE_PURPOSE_REQUIRED');
  if (
    !Number.isFinite(cue.startSeconds) ||
    !Number.isFinite(cue.endSeconds) ||
    cue.startSeconds < 0 ||
    cue.endSeconds <= cue.startSeconds
  ) errors.push('DIRECTOR_SCORE_RANGE_INVALID');
  if (projectDurationSeconds !== undefined && cue.endSeconds > projectDurationSeconds) errors.push('DIRECTOR_SCORE_OUTSIDE_PROJECT');
  if (!cue.evidenceIds.length) errors.push('DIRECTOR_SCORE_EVIDENCE_REQUIRED');
  return Object.freeze(errors);
}

export function validateFilmScoreArtifact(cue: FilmScoreCue, artifact: FilmScoreArtifact): readonly string[] {
  const errors: string[] = [];
  if (artifact.cueId !== cue.id) errors.push('DIRECTOR_SCORE_ARTIFACT_CUE_MISMATCH');
  if (!artifact.masterAssetId.trim()) errors.push('DIRECTOR_SCORE_MASTER_REQUIRED');
  if (!Number.isInteger(artifact.sampleRateHz) || artifact.sampleRateHz < 8000) errors.push('DIRECTOR_SCORE_SAMPLE_RATE_INVALID');
  if (artifact.rightsStatus === 'unknown') errors.push('DIRECTOR_SCORE_RIGHTS_REQUIRED');
  if (!artifact.provenanceEvidenceIds.length) errors.push('DIRECTOR_SCORE_PROVENANCE_REQUIRED');
  const cueDuration = cue.endSeconds - cue.startSeconds;
  if (Math.abs(artifact.durationSeconds - cueDuration) > 0.1) errors.push('DIRECTOR_SCORE_DURATION_MISMATCH');
  return Object.freeze(errors);
}
