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
  /** Human-authored canonical description. This informs performance and context but never overrides approved visual references. */
  characterDescription?: string;
  /** Human-authored canonical visual description used together with the reference sheet. */
  appearanceDescription?: string;
  /** Stable acting/mannerism/delivery notes for the character across scenes. */
  performanceNotes?: readonly string[];
  /** Monotonic revision for the human-authored description fields. */
  descriptionRevision?: number;
  descriptionUpdatedAt?: string;
  descriptionUpdatedBy?: string;
  behaviorDnaRef?: string;
  rigAssetId?: string;
  canonicalAppearanceVariantId: string;
  appearanceVariants: readonly CharacterAppearanceVariant[];
  voice?: CharacterVoiceIdentityRef;
  lockedTraits: readonly string[];
  /** Provider-neutral face/body identity embeddings or similarity fingerprints. */
  identityFingerprintRefs?: readonly string[];
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

export interface ResolvedCharacterSceneIdentity {
  projectId: string;
  characterId: string;
  continuityRef: string;
  canonicalAppearanceVariantId: string;
  characterDescription?: string;
  appearanceDescription?: string;
  performanceNotes?: readonly string[];
  sceneAppearanceVariantId: string;
  referenceAssetIds: readonly string[];
  referenceSha256s: readonly string[];
  voiceIdentityId?: string;
  voiceVariantId?: string;
  language?: string;
  behaviorDnaRef?: string;
  rigAssetId?: string;
  lockedTraits: readonly string[];
}

export interface DirectorCastResolver {
  resolve(
    characterId: string,
    projectId: string,
    sceneId?: string,
  ): Promise<ResolvedCharacterSceneIdentity>;
}

export function validateCharacterCastRecord(cast: CharacterCastRecord): readonly string[] {
  const reasons: string[] = [];
  if (!cast.id.trim() || !cast.projectId.trim() || !cast.characterId.trim() || !cast.displayName.trim()) {
    reasons.push('DIRECTOR_CAST_IDENTITY_REQUIRED');
  }
  if (!cast.continuityRef.trim()) reasons.push('DIRECTOR_CAST_CONTINUITY_REQUIRED');
  if (cast.characterDescription !== undefined && !cast.characterDescription.trim()) reasons.push('DIRECTOR_CAST_DESCRIPTION_INVALID');
  if (cast.appearanceDescription !== undefined && !cast.appearanceDescription.trim()) reasons.push('DIRECTOR_CAST_APPEARANCE_DESCRIPTION_INVALID');
  if (cast.performanceNotes?.some((note) => !note.trim())) reasons.push('DIRECTOR_CAST_PERFORMANCE_NOTE_INVALID');
  if (cast.descriptionRevision !== undefined && (!Number.isInteger(cast.descriptionRevision) || cast.descriptionRevision < 1)) reasons.push('DIRECTOR_CAST_DESCRIPTION_REVISION_INVALID');
  if (cast.descriptionUpdatedAt !== undefined && !Number.isFinite(Date.parse(cast.descriptionUpdatedAt))) reasons.push('DIRECTOR_CAST_DESCRIPTION_UPDATED_AT_INVALID');
  if (cast.descriptionUpdatedBy !== undefined && !cast.descriptionUpdatedBy.trim()) reasons.push('DIRECTOR_CAST_DESCRIPTION_UPDATED_BY_INVALID');
  if (!cast.appearanceVariants.length) reasons.push('DIRECTOR_CAST_APPEARANCE_REQUIRED');

  const variantIds = new Set<string>();
  for (const variant of cast.appearanceVariants) {
    if (variant.characterId !== cast.characterId) reasons.push(`DIRECTOR_CAST_VARIANT_CHARACTER_MISMATCH:${variant.id}`);
    if (variantIds.has(variant.id)) reasons.push(`DIRECTOR_CAST_VARIANT_DUPLICATE:${variant.id}`);
    variantIds.add(variant.id);
    if (!variant.referenceAssetIds.length) reasons.push(`DIRECTOR_CAST_VARIANT_REFERENCE_REQUIRED:${variant.id}`);
    if (variant.referenceAssetIds.length !== variant.referenceSha256s.length) {
      reasons.push(`DIRECTOR_CAST_VARIANT_REFERENCE_DIGEST_MISMATCH:${variant.id}`);
    }
  }

  const canonical = cast.appearanceVariants.find((variant) => variant.id === cast.canonicalAppearanceVariantId);
  if (!canonical) reasons.push('DIRECTOR_CAST_CANONICAL_APPEARANCE_UNKNOWN');
  else if (canonical.kind !== 'base') reasons.push('DIRECTOR_CAST_CANONICAL_APPEARANCE_MUST_BE_BASE');

  if (!cast.lockedTraits.length) reasons.push('DIRECTOR_CAST_LOCKED_TRAITS_REQUIRED');
  if (cast.voice && (!cast.voice.voiceIdentityId.trim() || !cast.voice.defaultVariantId.trim())) {
    reasons.push('DIRECTOR_CAST_VOICE_IDENTITY_INVALID');
  }
  return Object.freeze(reasons);
}

/**
 * Resolves every scene appearance/voice back to the same canonical cast record.
 * Outfit, age, damage, hair or language may vary, but identity cannot silently
 * drift to a new unapproved reference.
 *
 * The scene binding must always include at least one canonical/base identity
 * reference. A wardrobe/hair/etc variant adds references; it never replaces
 * the identity anchor.
 */
export function validateCharacterSceneBinding(
  cast: CharacterCastRecord,
  binding: CharacterSceneBinding,
): CharacterSceneBindingDecision {
  const reasons = [...validateCharacterCastRecord(cast)];
  if (binding.projectId !== cast.projectId) reasons.push('DIRECTOR_CAST_PROJECT_MISMATCH');
  if (binding.characterId !== cast.characterId) reasons.push('DIRECTOR_CAST_CHARACTER_MISMATCH');
  if (binding.continuityRef !== cast.continuityRef) reasons.push('DIRECTOR_CAST_CONTINUITY_MISMATCH');

  const canonical = cast.appearanceVariants.find((variant) => variant.id === cast.canonicalAppearanceVariantId);
  const appearance = cast.appearanceVariants.find((variant) => variant.id === binding.appearanceVariantId);
  if (!appearance) reasons.push('DIRECTOR_CAST_APPEARANCE_VARIANT_UNKNOWN');

  if (canonical && !canonical.referenceAssetIds.some((assetId) => binding.referenceAssetIds.includes(assetId))) {
    reasons.push('DIRECTOR_CAST_CANONICAL_IDENTITY_REFERENCE_REQUIRED');
  }
  if (
    appearance &&
    appearance.id !== cast.canonicalAppearanceVariantId &&
    !appearance.referenceAssetIds.some((assetId) => binding.referenceAssetIds.includes(assetId))
  ) {
    reasons.push('DIRECTOR_CAST_APPROVED_APPEARANCE_REFERENCE_REQUIRED');
  }

  if (binding.voiceIdentityId) {
    if (!cast.voice) reasons.push('DIRECTOR_CAST_VOICE_NOT_CONFIGURED');
    else if (binding.voiceIdentityId !== cast.voice.voiceIdentityId) reasons.push('DIRECTOR_CAST_VOICE_IDENTITY_MISMATCH');
  }
  if (binding.voiceVariantId && !binding.voiceIdentityId) reasons.push('DIRECTOR_CAST_VOICE_VARIANT_REQUIRES_IDENTITY');

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function validateMovieGradeCastRecord(cast: CharacterCastRecord): readonly string[] {
  const reasons = [...validateCharacterCastRecord(cast)];
  if (!cast.identityFingerprintRefs?.length) reasons.push('DIRECTOR_CAST_IDENTITY_FINGERPRINT_REQUIRED');
  if (!cast.voice) reasons.push('DIRECTOR_CAST_VOICE_REQUIRED_FOR_DIALOGUE_CHARACTER');
  return Object.freeze([...new Set(reasons)]);
}

export function resolveCharacterSceneIdentity(
  cast: CharacterCastRecord,
  binding?: Omit<CharacterSceneBinding, 'referenceAssetIds'> & { referenceAssetIds?: readonly string[] },
): ResolvedCharacterSceneIdentity {
  const castErrors = validateCharacterCastRecord(cast);
  if (castErrors.length) throw new Error(`Invalid cast record: ${castErrors.join('; ')}`);

  const canonical = cast.appearanceVariants.find((variant) => variant.id === cast.canonicalAppearanceVariantId)!;
  const selectedId = binding?.appearanceVariantId ?? cast.canonicalAppearanceVariantId;
  const selected = cast.appearanceVariants.find((variant) => variant.id === selectedId);
  if (!selected) throw new Error('DIRECTOR_CAST_APPEARANCE_VARIANT_UNKNOWN');

  if (binding) {
    const validation = validateCharacterSceneBinding(cast, {
      ...binding,
      referenceAssetIds: binding.referenceAssetIds?.length
        ? binding.referenceAssetIds
        : [...new Set([...canonical.referenceAssetIds, ...selected.referenceAssetIds])],
    });
    if (!validation.valid) throw new Error(`Invalid character scene binding: ${validation.reasons.join('; ')}`);
  }

  const references = [...canonical.referenceAssetIds];
  const digests = [...canonical.referenceSha256s];
  for (let index = 0; index < selected.referenceAssetIds.length; index += 1) {
    const assetId = selected.referenceAssetIds[index]!;
    if (!references.includes(assetId)) {
      references.push(assetId);
      digests.push(selected.referenceSha256s[index]!);
    }
  }

  return Object.freeze({
    projectId: cast.projectId,
    characterId: cast.characterId,
    continuityRef: cast.continuityRef,
    canonicalAppearanceVariantId: cast.canonicalAppearanceVariantId,
    sceneAppearanceVariantId: selected.id,
    ...(cast.characterDescription?.trim() ? { characterDescription: cast.characterDescription.trim() } : {}),
    ...(cast.appearanceDescription?.trim() ? { appearanceDescription: cast.appearanceDescription.trim() } : {}),
    ...(cast.performanceNotes?.length ? { performanceNotes: Object.freeze(cast.performanceNotes.map((note) => note.trim()).filter(Boolean)) } : {}),
    referenceAssetIds: Object.freeze(references),
    referenceSha256s: Object.freeze(digests),
    ...(cast.voice ? {
      voiceIdentityId: binding?.voiceIdentityId ?? cast.voice.voiceIdentityId,
      voiceVariantId: binding?.voiceVariantId ?? cast.voice.defaultVariantId,
      language: binding?.language ?? cast.voice.primaryLanguage,
    } : {}),
    ...(cast.behaviorDnaRef ? { behaviorDnaRef: cast.behaviorDnaRef } : {}),
    ...(cast.rigAssetId ? { rigAssetId: cast.rigAssetId } : {}),
    lockedTraits: Object.freeze([...cast.lockedTraits]),
  });
}
