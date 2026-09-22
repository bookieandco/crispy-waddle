export type VoiceRightsStatus =
  | 'owned'
  | 'licensed'
  | 'explicit-consent'
  | 'synthetic-designed'
  | 'unknown';

export interface CharacterVoiceReference {
  assetId: string;
  sha256: string;
  transcript?: string;
  language: string;
  durationSeconds: number;
  approved: true;
  evidenceIds: readonly string[];
}

export interface CharacterVoiceProfile {
  voiceProfileId: string;
  projectId: string;
  characterId: string;
  revision: number;
  displayName: string;
  defaultLanguage: string;
  supportedLanguages: readonly string[];
  referenceSamples: readonly CharacterVoiceReference[];
  voiceIdentityArtifactRef?: string;
  timbreDescription?: string;
  baselineProsody?: {
    pace?: number;
    pitchDescription?: string;
    energy?: number;
    cadenceDescription?: string;
  };
  pronunciationLexicon?: Readonly<Record<string, string>>;
  preferredProviderIds: readonly string[];
  rightsStatus: VoiceRightsStatus;
  consentEvidenceIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterDialogueLine {
  id: string;
  projectId: string;
  sceneId: string;
  characterId: string;
  voiceProfileId: string;
  text: string;
  language: string;
  delivery?: string;
  emotion?: string;
  targetDurationSeconds?: number;
  startSeconds?: number;
}

export interface CharacterVoiceArtifact {
  id: string;
  dialogueLineId: string;
  characterId: string;
  voiceProfileId: string;
  providerId: string;
  modelId: string;
  audioAssetId: string;
  audioSha256: string;
  sampleRateHz: number;
  durationSeconds: number;
  language: string;
  wordTimingEvidenceId?: string;
  speakerSimilarity?: number;
  intelligibilityScore?: number;
  evidenceIds: readonly string[];
}

export interface CharacterVoiceSynthesisProvider {
  readonly id: string;
  readonly supportedLanguages: readonly string[];
  synthesize(
    profile: CharacterVoiceProfile,
    line: CharacterDialogueLine,
  ): Promise<CharacterVoiceArtifact>;
}

export function validateCharacterVoiceProfile(profile: CharacterVoiceProfile): readonly string[] {
  const errors: string[] = [];
  if (!profile.voiceProfileId.trim() || !profile.characterId.trim() || !profile.projectId.trim()) {
    errors.push('DIRECTOR_VOICE_PROFILE_IDENTITY_REQUIRED');
  }
  if (!Number.isInteger(profile.revision) || profile.revision < 1) errors.push('DIRECTOR_VOICE_PROFILE_REVISION_INVALID');
  if (!profile.supportedLanguages.includes(profile.defaultLanguage)) errors.push('DIRECTOR_VOICE_DEFAULT_LANGUAGE_UNSUPPORTED');
  if (profile.rightsStatus === 'unknown') errors.push('DIRECTOR_VOICE_RIGHTS_REQUIRED');
  if ((profile.rightsStatus === 'owned' || profile.rightsStatus === 'licensed' || profile.rightsStatus === 'explicit-consent') && !profile.consentEvidenceIds.length) {
    errors.push('DIRECTOR_VOICE_CONSENT_EVIDENCE_REQUIRED');
  }
  if (!profile.referenceSamples.length && profile.rightsStatus !== 'synthetic-designed') {
    errors.push('DIRECTOR_VOICE_REFERENCE_REQUIRED');
  }
  return Object.freeze(errors);
}

export function validateCharacterDialogueLine(
  profile: CharacterVoiceProfile,
  line: CharacterDialogueLine,
): readonly string[] {
  const errors: string[] = [];
  if (line.projectId !== profile.projectId) errors.push('DIRECTOR_DIALOGUE_PROJECT_MISMATCH');
  if (line.characterId !== profile.characterId) errors.push('DIRECTOR_DIALOGUE_CHARACTER_MISMATCH');
  if (line.voiceProfileId !== profile.voiceProfileId) errors.push('DIRECTOR_DIALOGUE_VOICE_PROFILE_MISMATCH');
  if (!line.text.trim()) errors.push('DIRECTOR_DIALOGUE_TEXT_REQUIRED');
  if (!profile.supportedLanguages.includes(line.language)) errors.push('DIRECTOR_DIALOGUE_LANGUAGE_UNSUPPORTED');
  return Object.freeze(errors);
}

export function validateCharacterVoiceArtifact(
  profile: CharacterVoiceProfile,
  line: CharacterDialogueLine,
  artifact: CharacterVoiceArtifact,
  policy: {
    minimumSpeakerSimilarity?: number;
    minimumIntelligibility?: number;
    maximumDurationDriftSeconds?: number;
  },
): readonly string[] {
  const errors: string[] = [];
  if (artifact.dialogueLineId !== line.id) errors.push('DIRECTOR_VOICE_ARTIFACT_LINE_MISMATCH');
  if (artifact.characterId !== profile.characterId) errors.push('DIRECTOR_VOICE_ARTIFACT_CHARACTER_MISMATCH');
  if (artifact.voiceProfileId !== profile.voiceProfileId) errors.push('DIRECTOR_VOICE_ARTIFACT_PROFILE_MISMATCH');
  if (artifact.language !== line.language) errors.push('DIRECTOR_VOICE_ARTIFACT_LANGUAGE_MISMATCH');
  if (!artifact.audioAssetId.trim() || !artifact.audioSha256.trim()) errors.push('DIRECTOR_VOICE_ARTIFACT_PROVENANCE_REQUIRED');
  if (!Number.isInteger(artifact.sampleRateHz) || artifact.sampleRateHz < 8000) errors.push('DIRECTOR_VOICE_ARTIFACT_SAMPLE_RATE_INVALID');
  if (policy.minimumSpeakerSimilarity !== undefined) {
    if (artifact.speakerSimilarity === undefined || artifact.speakerSimilarity < policy.minimumSpeakerSimilarity) {
      errors.push('DIRECTOR_VOICE_SPEAKER_SIMILARITY_LOW');
    }
  }
  if (policy.minimumIntelligibility !== undefined) {
    if (artifact.intelligibilityScore === undefined || artifact.intelligibilityScore < policy.minimumIntelligibility) {
      errors.push('DIRECTOR_VOICE_INTELLIGIBILITY_LOW');
    }
  }
  if (
    line.targetDurationSeconds !== undefined &&
    policy.maximumDurationDriftSeconds !== undefined &&
    Math.abs(artifact.durationSeconds - line.targetDurationSeconds) > policy.maximumDurationDriftSeconds
  ) errors.push('DIRECTOR_VOICE_DURATION_DRIFT');
  return Object.freeze(errors);
}
