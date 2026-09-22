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
  /** Reusable provider-native clone/design prompt, never a canonical identity by itself. */
  reusablePromptRef?: string;
  /** Optional speaker embedding artifact for provider-side identity conditioning. */
  speakerEmbeddingRef?: string;
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
  /** Provider-neutral speaker identity fingerprints used for post-generation QC. */
  speakerFingerprintRefs?: readonly string[];
  /** Per-character minimum similarity floor across every language/provider. */
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
 * Feature-length production requires provider-independent speaker fingerprints
 * so a provider swap or language change cannot silently create a new voice.
 */
export function validateMovieGradeVoiceIdentity(identity: CharacterVoiceIdentity): readonly string[] {
  const reasons: string[] = [];
  if (!identity.id.trim() || !identity.characterId.trim() || !identity.projectId.trim()) {
    reasons.push('DIRECTOR_VOICE_IDENTITY_REQUIRED');
  }
  if (!identity.defaultVariantId.trim() || !identity.languageVariants.some((variant) => variant.id === identity.defaultVariantId)) {
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

  return Object.freeze(reasons);
}
