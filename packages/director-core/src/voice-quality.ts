import type { CharacterVoiceIdentity, DialogueGenerationRequest } from './voice-identity';

export interface CharacterVoiceArtifact {
  id: string;
  requestId: string;
  projectId: string;
  characterId: string;
  voiceIdentityId: string;
  voiceVariantId: string;
  language: string;
  provider: string;
  modelId: string;
  audioAssetId: string;
  audioSha256: string;
  durationSeconds: number;
  sampleRateHz: number;
  speakerSimilarity: number;
  intelligibilityScore?: number;
  alignmentConfidence?: number;
  pronunciationConfidence?: number;
  evidenceIds: readonly string[];
}

export interface CharacterVoiceQcPolicy {
  minimumSpeakerSimilarity: number;
  minimumIntelligibility?: number;
  minimumAlignmentConfidence?: number;
  minimumPronunciationConfidence?: number;
  maximumDurationDeltaSeconds?: number;
}

export interface CharacterVoiceQcDecision {
  admissible: boolean;
  reasons: readonly string[];
}

/**
 * Generation providers may synthesize the line, but they do not define who the
 * speaker is. Cross-language identity must be proven after generation.
 */
export function evaluateCharacterVoiceArtifact(
  identity: CharacterVoiceIdentity,
  request: DialogueGenerationRequest,
  artifact: CharacterVoiceArtifact,
  policy: CharacterVoiceQcPolicy,
): CharacterVoiceQcDecision {
  const reasons: string[] = [];

  if (artifact.requestId !== request.id) reasons.push('DIRECTOR_VOICE_ARTIFACT_REQUEST_MISMATCH');
  if (artifact.projectId !== identity.projectId) reasons.push('DIRECTOR_VOICE_ARTIFACT_PROJECT_MISMATCH');
  if (artifact.characterId !== identity.characterId) reasons.push('DIRECTOR_VOICE_ARTIFACT_CHARACTER_MISMATCH');
  if (artifact.voiceIdentityId !== identity.id) reasons.push('DIRECTOR_VOICE_ARTIFACT_IDENTITY_MISMATCH');
  if (artifact.voiceVariantId !== request.voiceVariantId) reasons.push('DIRECTOR_VOICE_ARTIFACT_VARIANT_MISMATCH');
  if (artifact.language.toLowerCase() !== request.language.toLowerCase()) reasons.push('DIRECTOR_VOICE_ARTIFACT_LANGUAGE_MISMATCH');
  if (!artifact.audioAssetId.trim() || !artifact.audioSha256.trim()) reasons.push('DIRECTOR_VOICE_ARTIFACT_IDENTITY_REQUIRED');
  if (!Number.isFinite(artifact.durationSeconds) || artifact.durationSeconds <= 0) reasons.push('DIRECTOR_VOICE_ARTIFACT_DURATION_INVALID');
  if (!Number.isInteger(artifact.sampleRateHz) || artifact.sampleRateHz < 8000) reasons.push('DIRECTOR_VOICE_ARTIFACT_SAMPLE_RATE_INVALID');
  if (!artifact.evidenceIds.length) reasons.push('DIRECTOR_VOICE_ARTIFACT_EVIDENCE_REQUIRED');

  if (!Number.isFinite(artifact.speakerSimilarity) || artifact.speakerSimilarity < policy.minimumSpeakerSimilarity) {
    reasons.push('DIRECTOR_VOICE_SPEAKER_SIMILARITY_LOW');
  }
  if (
    policy.minimumIntelligibility !== undefined &&
    (artifact.intelligibilityScore === undefined || artifact.intelligibilityScore < policy.minimumIntelligibility)
  ) reasons.push('DIRECTOR_VOICE_INTELLIGIBILITY_LOW');
  if (
    policy.minimumAlignmentConfidence !== undefined &&
    (artifact.alignmentConfidence === undefined || artifact.alignmentConfidence < policy.minimumAlignmentConfidence)
  ) reasons.push('DIRECTOR_VOICE_ALIGNMENT_LOW');
  if (
    policy.minimumPronunciationConfidence !== undefined &&
    (artifact.pronunciationConfidence === undefined || artifact.pronunciationConfidence < policy.minimumPronunciationConfidence)
  ) reasons.push('DIRECTOR_VOICE_PRONUNCIATION_LOW');

  if (
    policy.maximumDurationDeltaSeconds !== undefined &&
    request.targetDurationSeconds !== undefined &&
    Math.abs(artifact.durationSeconds - request.targetDurationSeconds) > policy.maximumDurationDeltaSeconds
  ) reasons.push('DIRECTOR_VOICE_DURATION_MISMATCH');

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}
