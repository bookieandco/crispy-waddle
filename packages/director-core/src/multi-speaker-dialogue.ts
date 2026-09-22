import type { DialogueGenerationRequest, GeneratedDialogueVoiceArtifact } from './voice-identity';

export interface MultiSpeakerDialogueLine {
  id: string;
  sceneId: string;
  order: number;
  characterId: string;
  voiceIdentityId: string;
  voiceVariantId: string;
  language: string;
  text: string;
  deliveryInstruction?: string;
  targetDurationSeconds?: number;
  evidenceIds: readonly string[];
}

export interface MultiSpeakerDialogueSceneRequest {
  id: string;
  projectId: string;
  sceneId: string;
  lines: readonly MultiSpeakerDialogueLine[];
  batchSize: number;
  seed: number;
  continuityRef?: string;
  evidenceIds: readonly string[];
  providerPreferenceIds?: readonly string[];
}

export interface MultiSpeakerSceneCandidate {
  id: string;
  requestId: string;
  providerId: string;
  providerJobId: string;
  seed: number;
  audioAssetId: string;
  audioSha256: string;
  sampleRateHz: number;
  durationSeconds: number;
  dialogueArtifacts: readonly GeneratedDialogueVoiceArtifact[];
  sceneNaturalnessScore?: number;
  turnTakingScore?: number;
  timingScore?: number;
  crosstalkDetected?: boolean;
  clippingDetected?: boolean;
  wordTimingEvidenceIds?: readonly string[];
  evidenceIds: readonly string[];
  provenanceRefs: readonly string[];
}

export interface MultiSpeakerDialoguePolicy {
  maximumBatchSize: number;
  minimumSceneNaturalness: number;
  minimumTurnTakingScore: number;
  minimumTimingScore: number;
  requirePerLineVoiceEvidence: boolean;
  requireWordTimingEvidence: boolean;
}

export interface MultiSpeakerSceneDecision {
  admissible: boolean;
  score: number;
  reasons: readonly string[];
}

export interface MultiSpeakerSceneSelection {
  selectedCandidateId?: string;
  rankedCandidateIds: readonly string[];
  rejectedCandidateIds: readonly string[];
  authority: 'DIRECTOR_SELECTION';
}

export function validateMultiSpeakerDialogueSceneRequest(
  request: MultiSpeakerDialogueSceneRequest,
  policy: MultiSpeakerDialoguePolicy,
): readonly string[] {
  const reasons: string[] = [];
  if (!request.id.trim() || !request.projectId.trim() || !request.sceneId.trim()) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_IDENTITY_REQUIRED');
  }
  if (!Number.isInteger(request.batchSize) || request.batchSize < 1 || request.batchSize > policy.maximumBatchSize) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_BATCH_INVALID');
  }
  if (!Number.isInteger(request.seed) || request.seed < 0) reasons.push('DIRECTOR_MULTI_SPEAKER_SEED_INVALID');
  if (!request.lines.length) reasons.push('DIRECTOR_MULTI_SPEAKER_LINES_REQUIRED');
  if (!request.evidenceIds.length) reasons.push('DIRECTOR_MULTI_SPEAKER_SCENE_EVIDENCE_REQUIRED');

  const ids = new Set<string>();
  let previousOrder = -1;
  for (const line of [...request.lines].sort((a,b) => a.order - b.order)) {
    if (!line.id.trim() || ids.has(line.id)) reasons.push('DIRECTOR_MULTI_SPEAKER_LINE_ID_INVALID');
    ids.add(line.id);
    if (line.sceneId !== request.sceneId) reasons.push(`DIRECTOR_MULTI_SPEAKER_SCENE_MISMATCH:${line.id}`);
    if (!line.characterId.trim() || !line.voiceIdentityId.trim() || !line.voiceVariantId.trim()) {
      reasons.push(`DIRECTOR_MULTI_SPEAKER_VOICE_IDENTITY_REQUIRED:${line.id}`);
    }
    if (!line.language.trim() || !line.text.trim()) reasons.push(`DIRECTOR_MULTI_SPEAKER_LINE_CONTENT_REQUIRED:${line.id}`);
    if (!line.evidenceIds.length) reasons.push(`DIRECTOR_MULTI_SPEAKER_LINE_EVIDENCE_REQUIRED:${line.id}`);
    if (!Number.isInteger(line.order) || line.order < 0 || line.order === previousOrder) {
      reasons.push(`DIRECTOR_MULTI_SPEAKER_LINE_ORDER_INVALID:${line.id}`);
    }
    previousOrder = line.order;
  }
  return Object.freeze([...new Set(reasons)]);
}

export function lineToDialogueGenerationRequest(
  scene: MultiSpeakerDialogueSceneRequest,
  line: MultiSpeakerDialogueLine,
): DialogueGenerationRequest {
  return Object.freeze({
    id: `${scene.id}:${line.id}`,
    projectId: scene.projectId,
    characterId: line.characterId,
    voiceIdentityId: line.voiceIdentityId,
    voiceVariantId: line.voiceVariantId,
    language: line.language,
    text: line.text,
    sceneId: scene.sceneId,
    lineId: line.id,
    ...(line.deliveryInstruction ? { deliveryInstruction: line.deliveryInstruction } : {}),
    ...(line.targetDurationSeconds !== undefined ? { targetDurationSeconds: line.targetDurationSeconds } : {}),
    evidenceIds: Object.freeze([...line.evidenceIds]),
  });
}

export function evaluateMultiSpeakerSceneCandidate(
  request: MultiSpeakerDialogueSceneRequest,
  candidate: MultiSpeakerSceneCandidate,
  policy: MultiSpeakerDialoguePolicy,
): MultiSpeakerSceneDecision {
  const reasons: string[] = [];
  if (candidate.requestId !== request.id) reasons.push('DIRECTOR_MULTI_SPEAKER_REQUEST_MISMATCH');
  if (!candidate.audioAssetId.trim() || !candidate.audioSha256.trim()) reasons.push('DIRECTOR_MULTI_SPEAKER_AUDIO_PROVENANCE_REQUIRED');
  if (!candidate.evidenceIds.length || !candidate.provenanceRefs.length) reasons.push('DIRECTOR_MULTI_SPEAKER_EVIDENCE_REQUIRED');
  if (!Number.isInteger(candidate.sampleRateHz) || candidate.sampleRateHz < 8_000) reasons.push('DIRECTOR_MULTI_SPEAKER_SAMPLE_RATE_INVALID');
  if (!Number.isFinite(candidate.durationSeconds) || candidate.durationSeconds <= 0) reasons.push('DIRECTOR_MULTI_SPEAKER_DURATION_INVALID');
  if (candidate.crosstalkDetected) reasons.push('DIRECTOR_MULTI_SPEAKER_CROSSTALK_DETECTED');
  if (candidate.clippingDetected) reasons.push('DIRECTOR_MULTI_SPEAKER_CLIPPING_DETECTED');

  if (candidate.sceneNaturalnessScore === undefined || candidate.sceneNaturalnessScore < policy.minimumSceneNaturalness) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_NATURALNESS_LOW');
  }
  if (candidate.turnTakingScore === undefined || candidate.turnTakingScore < policy.minimumTurnTakingScore) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_TURN_TAKING_LOW');
  }
  if (candidate.timingScore === undefined || candidate.timingScore < policy.minimumTimingScore) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_TIMING_LOW');
  }
  if (policy.requireWordTimingEvidence && !(candidate.wordTimingEvidenceIds?.length)) {
    reasons.push('DIRECTOR_MULTI_SPEAKER_WORD_TIMING_REQUIRED');
  }

  const expected = new Map(request.lines.map((line) => [line.id, line]));
  const artifacts = new Map(candidate.dialogueArtifacts.map((artifact) => [artifact.lineId, artifact]));
  if (artifacts.size !== expected.size) reasons.push('DIRECTOR_MULTI_SPEAKER_LINE_COUNT_MISMATCH');

  for (const [lineId,line] of expected) {
    const artifact = artifacts.get(lineId);
    if (!artifact) {
      reasons.push(`DIRECTOR_MULTI_SPEAKER_LINE_ARTIFACT_MISSING:${lineId}`);
      continue;
    }
    if (artifact.characterId !== line.characterId) reasons.push(`DIRECTOR_MULTI_SPEAKER_CHARACTER_DRIFT:${lineId}`);
    if (artifact.voiceIdentityId !== line.voiceIdentityId) reasons.push(`DIRECTOR_MULTI_SPEAKER_VOICE_DRIFT:${lineId}`);
    if (artifact.voiceVariantId !== line.voiceVariantId) reasons.push(`DIRECTOR_MULTI_SPEAKER_VARIANT_DRIFT:${lineId}`);
    if (artifact.language.toLowerCase() !== line.language.toLowerCase()) reasons.push(`DIRECTOR_MULTI_SPEAKER_LANGUAGE_DRIFT:${lineId}`);
    if (policy.requirePerLineVoiceEvidence && !artifact.evidenceIds.length) {
      reasons.push(`DIRECTOR_MULTI_SPEAKER_LINE_VOICE_EVIDENCE_REQUIRED:${lineId}`);
    }
  }

  const naturalness = candidate.sceneNaturalnessScore ?? 0;
  const turns = candidate.turnTakingScore ?? 0;
  const timing = candidate.timingScore ?? 0;
  const score = naturalness * 0.4 + turns * 0.35 + timing * 0.25;

  return Object.freeze({
    admissible: reasons.length === 0,
    score,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function chooseBestMultiSpeakerSceneCandidate(
  request: MultiSpeakerDialogueSceneRequest,
  candidates: readonly MultiSpeakerSceneCandidate[],
  policy: MultiSpeakerDialoguePolicy,
): MultiSpeakerSceneSelection {
  const evaluated = candidates
    .map((candidate) => ({ candidate, decision: evaluateMultiSpeakerSceneCandidate(request,candidate,policy) }))
    .sort((a,b) => b.decision.score - a.decision.score || a.candidate.id.localeCompare(b.candidate.id));

  const admitted = evaluated.filter((item) => item.decision.admissible);
  return Object.freeze({
    ...(admitted[0] ? { selectedCandidateId: admitted[0].candidate.id } : {}),
    rankedCandidateIds: Object.freeze(admitted.map((item) => item.candidate.id)),
    rejectedCandidateIds: Object.freeze(evaluated.filter((item) => !item.decision.admissible).map((item) => item.candidate.id)),
    authority: 'DIRECTOR_SELECTION',
  });
}
