export type VoiceIdentitySource = 'owned-recording' | 'consented-clone' | 'designed' | 'preset';

export interface VoiceReferenceSample {
  id: string;
  assetId: string;
  sha256: string;
  language: string;
  transcript?: string;
  durationSeconds: number;
  rightsRef: string;
  qualityEvidenceIds: readonly string[];
}

export interface VoiceProviderBinding {
  id: string;
  provider: string;
  modelId: string;
  providerVoiceRef?: string;
  referenceSampleIds: readonly string[];
  supportedLanguages: readonly string[];
  sampleRateHz?: number;
  provenanceRefs: readonly string[];
}

export interface VoiceLanguageVariant {
  id: string;
  voiceIdentityId: string;
  language: string;
  locale?: string;
  pronunciationLexiconRef?: string;
  accentPolicy: 'preserve-identity' | 'native-target' | 'directed';
  deliveryStyle?: string;
  providerBindingIds: readonly string[];
}

export interface CharacterVoiceIdentity {
  id: string;
  projectId: string;
  characterId: string;
  displayName: string;
  source: VoiceIdentitySource;
  consentRef?: string;
  primaryLanguage: string;
  referenceSamples: readonly VoiceReferenceSample[];
  providerBindings: readonly VoiceProviderBinding[];
  languageVariants: readonly VoiceLanguageVariant[];
  defaultVariantId: string;
  /** Provider-neutral speaker identity evidence shared across languages/providers. */
  speakerFingerprintRefs?: readonly string[];
  minimumSpeakerSimilarity?: number;
  approvedAt: string;
  approvedBy: string;
}

export interface DialogueGenerationRequest {
  id: string;
  projectId: string;
  characterId: string;
  voiceIdentityId: string;
  voiceVariantId: string;
  language: string;
  text: string;
  sceneId: string;
  lineId: string;
  deliveryInstruction?: string;
  targetDurationSeconds?: number;
  evidenceIds: readonly string[];
}

export interface DialogueGenerationDecision {
  valid: boolean;
  reasons: readonly string[];
  providerBindings: readonly VoiceProviderBinding[];
}

export interface GeneratedDialogueVoiceArtifact {
  id: string;
  requestId: string;
  projectId: string;
  characterId: string;
  voiceIdentityId: string;
  voiceVariantId: string;
  providerBindingId: string;
  audioAssetId: string;
  audioSha256: string;
  language: string;
  sampleRateHz: number;
  durationSeconds: number;
  wordTimingEvidenceId?: string;
  speakerSimilarity?: number;
  intelligibilityScore?: number;
  prosodyMatchScore?: number;
  pronunciationConfidence?: number;
  clippingDetected?: boolean;
  evidenceIds: readonly string[];
}

export interface DialogueVoiceQcPolicy {
  minimumSpeakerSimilarity: number;
  minimumIntelligibility: number;
  minimumProsodyMatch?: number;
  minimumPronunciationConfidence?: number;
  maximumDurationDriftSeconds?: number;
  requireWordTimingEvidence: boolean;
}

export interface DialogueVoiceQcDecision {
  admissible: boolean;
  reasons: readonly string[];
}

/**
 * Keeps the same canonical speaker identity across languages while allowing
 * language-specific providers/accents/delivery. Providers generate audio; they
 * never define who the character is.
 */
export function resolveDialogueVoice(
  identity: CharacterVoiceIdentity,
  request: DialogueGenerationRequest,
): DialogueGenerationDecision {
  const reasons: string[] = [];
  if (request.projectId !== identity.projectId) reasons.push('DIRECTOR_VOICE_PROJECT_MISMATCH');
  if (request.characterId !== identity.characterId) reasons.push('DIRECTOR_VOICE_CHARACTER_MISMATCH');
  if (request.voiceIdentityId !== identity.id) reasons.push('DIRECTOR_VOICE_IDENTITY_MISMATCH');
  if (!request.text.trim()) reasons.push('DIRECTOR_VOICE_DIALOGUE_REQUIRED');
  if (!request.evidenceIds.length) reasons.push('DIRECTOR_VOICE_DIALOGUE_EVIDENCE_REQUIRED');

  const variant = identity.languageVariants.find((item) => item.id === request.voiceVariantId);
  if (!variant) reasons.push('DIRECTOR_VOICE_VARIANT_UNKNOWN');
  else {
    if (variant.voiceIdentityId !== identity.id) reasons.push('DIRECTOR_VOICE_VARIANT_IDENTITY_MISMATCH');
    if (variant.language.toLowerCase() !== request.language.toLowerCase()) reasons.push('DIRECTOR_VOICE_LANGUAGE_MISMATCH');
  }

  const bindingIds = new Set(variant?.providerBindingIds ?? []);
  const bindings = identity.providerBindings.filter((binding) =>
    bindingIds.has(binding.id) &&
    binding.supportedLanguages.some((language) => language.toLowerCase() === request.language.toLowerCase()),
  );
  if (!bindings.length) reasons.push('DIRECTOR_VOICE_PROVIDER_UNAVAILABLE_FOR_LANGUAGE');

  if ((identity.source === 'owned-recording' || identity.source === 'consented-clone') && !identity.referenceSamples.length) {
    reasons.push('DIRECTOR_VOICE_REFERENCE_SAMPLE_REQUIRED');
  }
  if (identity.source === 'consented-clone' && !identity.consentRef?.trim()) {
    reasons.push('DIRECTOR_VOICE_CONSENT_REQUIRED');
  }

  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    providerBindings: Object.freeze(bindings),
  });
}

/**
 * A provider result must still sound like the same canonical character.
 * Language/provider changes are allowed; identity drift is not.
 */
export function validateGeneratedDialogueVoice(
  identity: CharacterVoiceIdentity,
  request: DialogueGenerationRequest,
  artifact: GeneratedDialogueVoiceArtifact,
  policy: DialogueVoiceQcPolicy,
): DialogueVoiceQcDecision {
  const reasons: string[] = [];
  const resolution = resolveDialogueVoice(identity, request);
  if (!resolution.valid) reasons.push(...resolution.reasons);

  if (artifact.requestId !== request.id) reasons.push('DIRECTOR_VOICE_ARTIFACT_REQUEST_MISMATCH');
  if (artifact.projectId !== identity.projectId) reasons.push('DIRECTOR_VOICE_ARTIFACT_PROJECT_MISMATCH');
  if (artifact.characterId !== identity.characterId) reasons.push('DIRECTOR_VOICE_ARTIFACT_CHARACTER_MISMATCH');
  if (artifact.voiceIdentityId !== identity.id) reasons.push('DIRECTOR_VOICE_ARTIFACT_IDENTITY_MISMATCH');
  if (artifact.voiceVariantId !== request.voiceVariantId) reasons.push('DIRECTOR_VOICE_ARTIFACT_VARIANT_MISMATCH');
  if (artifact.language.toLowerCase() !== request.language.toLowerCase()) reasons.push('DIRECTOR_VOICE_ARTIFACT_LANGUAGE_MISMATCH');
  if (!artifact.audioAssetId.trim() || !artifact.audioSha256.trim()) reasons.push('DIRECTOR_VOICE_ARTIFACT_PROVENANCE_REQUIRED');
  if (!artifact.evidenceIds.length) reasons.push('DIRECTOR_VOICE_ARTIFACT_EVIDENCE_REQUIRED');
  if (!Number.isInteger(artifact.sampleRateHz) || artifact.sampleRateHz < 8_000) reasons.push('DIRECTOR_VOICE_ARTIFACT_SAMPLE_RATE_INVALID');
  if (!Number.isFinite(artifact.durationSeconds) || artifact.durationSeconds <= 0) reasons.push('DIRECTOR_VOICE_ARTIFACT_DURATION_INVALID');
  if (!resolution.providerBindings.some(binding => binding.id === artifact.providerBindingId)) {
    reasons.push('DIRECTOR_VOICE_PROVIDER_BINDING_NOT_AUTHORIZED');
  }
  if (artifact.clippingDetected) reasons.push('DIRECTOR_VOICE_CLIPPING_DETECTED');

  const identitySimilarityFloor = identity.minimumSpeakerSimilarity ?? 0;
  const speakerSimilarityFloor = Math.max(identitySimilarityFloor, policy.minimumSpeakerSimilarity);
  if (artifact.speakerSimilarity === undefined || artifact.speakerSimilarity < speakerSimilarityFloor) {
    reasons.push('DIRECTOR_VOICE_SPEAKER_SIMILARITY_LOW');
  }
  if (artifact.intelligibilityScore === undefined || artifact.intelligibilityScore < policy.minimumIntelligibility) {
    reasons.push('DIRECTOR_VOICE_INTELLIGIBILITY_LOW');
  }
  if (
    policy.minimumProsodyMatch !== undefined &&
    (artifact.prosodyMatchScore === undefined || artifact.prosodyMatchScore < policy.minimumProsodyMatch)
  ) reasons.push('DIRECTOR_VOICE_PROSODY_MATCH_LOW');
  if (
    policy.minimumPronunciationConfidence !== undefined &&
    (artifact.pronunciationConfidence === undefined || artifact.pronunciationConfidence < policy.minimumPronunciationConfidence)
  ) reasons.push('DIRECTOR_VOICE_PRONUNCIATION_LOW');

  if (
    request.targetDurationSeconds !== undefined &&
    policy.maximumDurationDriftSeconds !== undefined &&
    Math.abs(artifact.durationSeconds - request.targetDurationSeconds) > policy.maximumDurationDriftSeconds
  ) reasons.push('DIRECTOR_VOICE_DURATION_DRIFT');

  if (policy.requireWordTimingEvidence && !artifact.wordTimingEvidenceId?.trim()) {
    reasons.push('DIRECTOR_VOICE_WORD_TIMING_REQUIRED');
  }

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export type VoiceProviderCapability =
  | 'voice-clone'
  | 'voice-design'
  | 'multilingual'
  | 'streaming'
  | 'style-control'
  | 'accent-conversion'
  | 'singing'
  | 'word-timestamps'
  | 'speaker-similarity-qc'
  | 'multi-speaker'
  | 'lora-adaptation'
  | 'batch-variation'
  | 'queue-management';

function voiceCapabilities(...values: VoiceProviderCapability[]): readonly VoiceProviderCapability[] {
  return Object.freeze(values);
}

export interface VoiceProviderProfile {
  id: string;
  name: string;
  license: string;
  capabilities: readonly VoiceProviderCapability[];
  languageCount?: number;
  notes: readonly string[];
  runtimeRole: 'generation-provider' | 'gateway' | 'qc-toolkit' | 'reference-only';
}

export const DIRECTOR_VOICE_PROVIDER_PROFILES: readonly VoiceProviderProfile[] = Object.freeze([
  Object.freeze({
    id: 'qwen3-tts',
    name: 'Qwen3-TTS',
    license: 'Apache-2.0',
    capabilities: voiceCapabilities('voice-clone','voice-design','multilingual','streaming','style-control'),
    languageCount: 10,
    notes: Object.freeze(['Supports reusable clone prompts; strong canonical-character voice candidate.']),
    runtimeRole: 'generation-provider',
  }),
  Object.freeze({
    id: 'voxcpm2',
    name: 'VoxCPM2',
    license: 'Apache-2.0',
    capabilities: voiceCapabilities('voice-clone','voice-design','multilingual','streaming','style-control','word-timestamps'),
    languageCount: 30,
    notes: Object.freeze(['48kHz output; broad multilingual fallback/alternate character voice renderer.']),
    runtimeRole: 'generation-provider',
  }),
  Object.freeze({
    id: 'voicebox',
    name: 'Voicebox',
    license: 'MIT',
    capabilities: voiceCapabilities('voice-clone','voice-design','multilingual','style-control'),
    languageCount: 23,
    notes: Object.freeze(['Local multi-engine profile/generation gateway; provider profiles remain Director-owned.']),
    runtimeRole: 'gateway',
  }),
  Object.freeze({
    id: 'amphion',
    name: 'Amphion',
    license: 'MIT code; model/dataset licenses vary',
    capabilities: voiceCapabilities('voice-clone','multilingual','accent-conversion','singing','speaker-similarity-qc'),
    notes: Object.freeze(['Useful for voice conversion and QC metrics; each checkpoint/dataset needs separate license admission.']),
    runtimeRole: 'qc-toolkit',
  }),
  Object.freeze({
    id: 'voice-pro',
    name: 'Voice-Pro',
    license: 'GPL-3.0',
    capabilities: voiceCapabilities('voice-clone','multilingual'),
    notes: Object.freeze(['Keep behind optional external boundary; celebrity-reference workflows require separate rights review.']),
    runtimeRole: 'reference-only',
  }),
  Object.freeze({
    id: 'vibevoice-fusion',
    name: 'VibeVoiceFusion',
    license: 'UNVERIFIED — README badge says MIT, GitHub repository metadata reports no license',
    capabilities: voiceCapabilities(
      'voice-clone',
      'multi-speaker',
      'multilingual',
      'style-control',
      'lora-adaptation',
      'batch-variation',
      'queue-management',
    ),
    notes: Object.freeze([
      'Full-stack VibeVoice workflow with persistent speaker samples, ordered dialogue sessions, narration, 2-20 seeded batch variations, LoRA adaptation and GPU/CPU offloading.',
      'REST API is suitable for an optional local provider adapter after explicit license admission.',
      'Director Voice Identity remains canonical; VibeVoice project/speaker IDs are implementation references only.',
    ]),
    runtimeRole: 'reference-only',
  }),
]);


/** Feature-film voice identities need provider-independent speaker fingerprints. */
export function validateMovieGradeVoiceIdentity(identity: CharacterVoiceIdentity): readonly string[] {
  const reasons: string[] = [];
  if (!identity.id.trim() || !identity.projectId.trim() || !identity.characterId.trim()) {
    reasons.push('DIRECTOR_VOICE_IDENTITY_REQUIRED');
  }
  if (!identity.languageVariants.some((variant) => variant.id === identity.defaultVariantId)) {
    reasons.push('DIRECTOR_VOICE_DEFAULT_VARIANT_INVALID');
  }
  if (!identity.providerBindings.length) reasons.push('DIRECTOR_VOICE_PROVIDER_BINDING_REQUIRED');
  if (!identity.speakerFingerprintRefs?.length) reasons.push('DIRECTOR_VOICE_SPEAKER_FINGERPRINT_REQUIRED');
  if (
    identity.minimumSpeakerSimilarity === undefined ||
    !Number.isFinite(identity.minimumSpeakerSimilarity) ||
    identity.minimumSpeakerSimilarity <= 0 ||
    identity.minimumSpeakerSimilarity > 1
  ) reasons.push('DIRECTOR_VOICE_SIMILARITY_FLOOR_REQUIRED');

  const sampleIds = new Set(identity.referenceSamples.map((sample) => sample.id));
  for (const binding of identity.providerBindings) {
    if (!binding.provenanceRefs.length) reasons.push(`DIRECTOR_VOICE_PROVIDER_PROVENANCE_REQUIRED:${binding.id}`);
    if (binding.referenceSampleIds.some((id) => !sampleIds.has(id))) {
      reasons.push(`DIRECTOR_VOICE_PROVIDER_REFERENCE_UNKNOWN:${binding.id}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}
