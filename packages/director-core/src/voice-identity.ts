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
