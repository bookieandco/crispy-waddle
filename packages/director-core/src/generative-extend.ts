import type { TimelineClip } from './timeline-model';

export type ExtendMediaKind = 'video' | 'audio';
export type ExtendAudioContent = 'room-tone' | 'ambience' | 'foley' | 'sfx' | 'dialogue' | 'music' | 'unknown';

export interface GenerativeExtendRequest {
  id: string;
  projectId: string;
  timelineVersionId: string;
  clipId: string;
  sourceAssetId: string;
  sourceSha256: string;
  mediaKind: ExtendMediaKind;
  side: 'start' | 'end';
  requestedSeconds: number;
  sourceContextSeconds: number;
  audioContent?: ExtendAudioContent;
  instruction?: string;
  evidenceIds: readonly string[];
  seed?: string;
}

export interface GenerativeExtendPolicy {
  maximumVideoSeconds: number;
  maximumAudioSeconds: number;
  minimumSourceContextSeconds: number;
  allowDialogueExtension: false;
  allowMusicExtension: false;
  requireDeterministicSeedForLocalProvider: boolean;
}

export interface GenerativeExtendDecision {
  admissible: boolean;
  reasons: readonly string[];
}

export type ClipExtensionPlan =
  | { mode: 'source-handle'; seconds: number; side: 'start'|'end' }
  | { mode: 'generative-proposal'; sourceHandleSeconds: number; generatedSeconds: number; side: 'start'|'end' }
  | { mode: 'blocked'; reasons: readonly string[] };

export interface GeneratedExtensionArtifact {
  id: string;
  requestId: string;
  provider: string;
  modelId: string;
  assetId: string;
  sha256: string;
  durationSeconds: number;
  generatedRange: { startSeconds: number; endSeconds: number };
  candidateIndex: number;
  attemptId: string;
  qualityScore: number;
  continuityScore: number;
  artifactScore: number;
  evidenceIds: readonly string[];
  provenanceRefs: readonly string[];
  label: 'AI-generated';
}

export function validateGenerativeExtendRequest(
  request: GenerativeExtendRequest,
  policy: GenerativeExtendPolicy,
): GenerativeExtendDecision {
  const reasons: string[] = [];
  if (!request.id.trim() || !request.projectId.trim() || !request.timelineVersionId.trim()) {
    reasons.push('DIRECTOR_EXTEND_IDENTITY_REQUIRED');
  }
  if (!request.sourceAssetId.trim() || !request.sourceSha256.trim()) reasons.push('DIRECTOR_EXTEND_SOURCE_REQUIRED');
  if (!request.evidenceIds.length) reasons.push('DIRECTOR_EXTEND_EVIDENCE_REQUIRED');
  if (!Number.isFinite(request.requestedSeconds) || request.requestedSeconds <= 0) reasons.push('DIRECTOR_EXTEND_DURATION_INVALID');
  if (!Number.isFinite(request.sourceContextSeconds) || request.sourceContextSeconds < policy.minimumSourceContextSeconds) {
    reasons.push('DIRECTOR_EXTEND_SOURCE_CONTEXT_INSUFFICIENT');
  }
  if (request.mediaKind === 'video' && request.requestedSeconds > policy.maximumVideoSeconds) {
    reasons.push('DIRECTOR_EXTEND_VIDEO_LIMIT_EXCEEDED');
  }
  if (request.mediaKind === 'audio') {
    if (request.requestedSeconds > policy.maximumAudioSeconds) reasons.push('DIRECTOR_EXTEND_AUDIO_LIMIT_EXCEEDED');
    if (request.audioContent === 'dialogue') reasons.push('DIRECTOR_EXTEND_DIALOGUE_FORBIDDEN');
    if (request.audioContent === 'music') reasons.push('DIRECTOR_EXTEND_MUSIC_FORBIDDEN');
    if (!request.audioContent || request.audioContent === 'unknown') reasons.push('DIRECTOR_EXTEND_AUDIO_CONTENT_REQUIRED');
  }
  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function planClipExtension(
  clip: TimelineClip,
  input: { side: 'start'|'end'; seconds: number },
): ClipExtensionPlan {
  if (!Number.isFinite(input.seconds) || input.seconds <= 0) {
    return Object.freeze({ mode: 'blocked', reasons: Object.freeze(['DIRECTOR_EXTEND_DURATION_INVALID']) });
  }
  if (!Number.isFinite(clip.sourceDurationSeconds) || (clip.sourceDurationSeconds ?? 0) <= 0) {
    return Object.freeze({
      mode: 'generative-proposal',
      sourceHandleSeconds: 0,
      generatedSeconds: input.seconds,
      side: input.side,
    });
  }

  const speed = clip.speed ?? 1;
  const sourceIn = clip.sourceInSeconds ?? 0;
  const sourceOut = clip.sourceOutSeconds ?? Math.min(clip.sourceDurationSeconds!, sourceIn + clip.durationSeconds * speed);
  const availableSourceSeconds = input.side === 'start'
    ? sourceIn / speed
    : Math.max(0, (clip.sourceDurationSeconds! - sourceOut) / speed);

  const sourceHandleSeconds = Math.min(input.seconds, availableSourceSeconds);
  const generatedSeconds = Math.max(0, input.seconds - sourceHandleSeconds);
  if (generatedSeconds <= 1e-9) {
    return Object.freeze({ mode: 'source-handle', seconds: input.seconds, side: input.side });
  }
  return Object.freeze({
    mode: 'generative-proposal',
    sourceHandleSeconds,
    generatedSeconds,
    side: input.side,
  });
}

export function evaluateGeneratedExtensionArtifact(
  request: GenerativeExtendRequest,
  artifact: GeneratedExtensionArtifact,
  policy: {
    durationToleranceSeconds: number;
    minimumQualityScore: number;
    minimumContinuityScore: number;
    maximumArtifactScore: number;
  },
): GenerativeExtendDecision {
  const reasons: string[] = [];
  if (artifact.requestId !== request.id) reasons.push('DIRECTOR_EXTEND_REQUEST_MISMATCH');
  if (!artifact.assetId.trim() || !artifact.sha256.trim()) reasons.push('DIRECTOR_EXTEND_ARTIFACT_REQUIRED');
  if (!artifact.evidenceIds.length || !artifact.provenanceRefs.length) reasons.push('DIRECTOR_EXTEND_PROVENANCE_REQUIRED');
  if (!Number.isFinite(artifact.durationSeconds) || Math.abs(artifact.durationSeconds-request.requestedSeconds) > policy.durationToleranceSeconds) {
    reasons.push('DIRECTOR_EXTEND_OUTPUT_DURATION_MISMATCH');
  }
  if (!Number.isFinite(artifact.qualityScore) || artifact.qualityScore < policy.minimumQualityScore) reasons.push('DIRECTOR_EXTEND_QUALITY_LOW');
  if (!Number.isFinite(artifact.continuityScore) || artifact.continuityScore < policy.minimumContinuityScore) reasons.push('DIRECTOR_EXTEND_CONTINUITY_LOW');
  if (!Number.isFinite(artifact.artifactScore) || artifact.artifactScore > policy.maximumArtifactScore) reasons.push('DIRECTOR_EXTEND_ARTIFACTS_HIGH');
  if (artifact.label !== 'AI-generated') reasons.push('DIRECTOR_EXTEND_DISCLOSURE_REQUIRED');
  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function chooseBestGeneratedExtension(
  request: GenerativeExtendRequest,
  artifacts: readonly GeneratedExtensionArtifact[],
  policy: {
    durationToleranceSeconds: number;
    minimumQualityScore: number;
    minimumContinuityScore: number;
    maximumArtifactScore: number;
  },
): GeneratedExtensionArtifact | undefined {
  return [...artifacts]
    .filter((artifact) => evaluateGeneratedExtensionArtifact(request,artifact,policy).admissible)
    .sort((a,b) =>
      (b.continuityScore*0.5+b.qualityScore*0.4-b.artifactScore*0.1) -
      (a.continuityScore*0.5+a.qualityScore*0.4-a.artifactScore*0.1) ||
      a.candidateIndex-b.candidateIndex
    )[0];
}
