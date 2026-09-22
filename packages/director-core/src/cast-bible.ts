export type CharacterAppearanceVariantKind =
  | 'base'
  | 'wardrobe'
  | 'age'
  | 'damage'
  | 'hair'
  | 'makeup'
  | 'environment'
  | 'custom';

export interface CharacterAppearanceVariant {
  id: string;
  characterId: string;
  kind: CharacterAppearanceVariantKind;
  label: string;
  referenceAssetIds: readonly string[];
  referenceSha256s: readonly string[];
  wardrobeNotes?: readonly string[];
  appearanceNotes?: readonly string[];
  approvedAt: string;
  approvedBy: string;
}

export interface CharacterVoiceIdentityRef {
  voiceIdentityId: string;
  primaryLanguage: string;
  defaultVariantId: string;
}

export interface CharacterCastRecord {
  id: string;
  projectId: string;
  characterId: string;
  displayName: string;
  archetype: 'human' | 'cartoon' | 'puppet' | 'creature';
  continuityRef: string;
  behaviorDnaRef?: string;
  rigAssetId?: string;
  canonicalAppearanceVariantId: string;
  appearanceVariants: readonly CharacterAppearanceVariant[];
  voice?: CharacterVoiceIdentityRef;
  lockedTraits: readonly string[];
  approvedAt: string;
  approvedBy: string;
}

export interface CharacterSceneBinding {
  projectId: string;
  characterId: string;
  continuityRef: string;
  appearanceVariantId: string;
  voiceIdentityId?: string;
  voiceVariantId?: string;
  language?: string;
  referenceAssetIds: readonly string[];
}

export interface CharacterSceneBindingDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Resolves every scene appearance/voice back to the same canonical cast record.
 * Outfit, age, damage, hair or language may vary, but identity cannot silently
 * drift to a new unapproved reference.
 */
export function validateCharacterSceneBinding(
  cast: CharacterCastRecord,
  binding: CharacterSceneBinding,
): CharacterSceneBindingDecision {
  const reasons: string[] = [];
  if (binding.projectId !== cast.projectId) reasons.push('DIRECTOR_CAST_PROJECT_MISMATCH');
  if (binding.characterId !== cast.characterId) reasons.push('DIRECTOR_CAST_CHARACTER_MISMATCH');
  if (binding.continuityRef !== cast.continuityRef) reasons.push('DIRECTOR_CAST_CONTINUITY_MISMATCH');

  const appearance = cast.appearanceVariants.find((variant) => variant.id === binding.appearanceVariantId);
  if (!appearance) reasons.push('DIRECTOR_CAST_APPEARANCE_VARIANT_UNKNOWN');
  else if (!appearance.referenceAssetIds.some((assetId) => binding.referenceAssetIds.includes(assetId))) {
    reasons.push('DIRECTOR_CAST_APPROVED_APPEARANCE_REFERENCE_REQUIRED');
  }

  if (binding.voiceIdentityId) {
    if (!cast.voice) reasons.push('DIRECTOR_CAST_VOICE_NOT_CONFIGURED');
    else if (binding.voiceIdentityId !== cast.voice.voiceIdentityId) reasons.push('DIRECTOR_CAST_VOICE_IDENTITY_MISMATCH');
  }
  if (binding.voiceVariantId && !binding.voiceIdentityId) reasons.push('DIRECTOR_CAST_VOICE_VARIANT_REQUIRES_IDENTITY');

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
