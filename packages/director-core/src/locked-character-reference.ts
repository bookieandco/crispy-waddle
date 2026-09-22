export interface LockedCharacterReference {
  id: string;
  projectId: string;
  characterId: string;
  referenceAssetId: string;
  referenceSha256: string;
  continuityRef: string;
  approvedAt: string;
  approvedBy: string;
  palette?: readonly string[];
  proportionNotes?: readonly string[];
}

export interface CharacterConditionedShot {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  referenceAssetIds: readonly string[];
  generationMode: 'reference-to-image' | 'image-to-video' | 'reference-to-video' | 'text-only';
  promptRef?: string;
}

export interface CharacterReferenceDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Once a recurring character is locked, downstream generations must condition
 * on the approved reference rather than re-inventing identity from text.
 */
export function validateLockedCharacterShot(
  lock: LockedCharacterReference,
  shot: CharacterConditionedShot,
): CharacterReferenceDecision {
  const reasons: string[] = [];
  if (shot.projectId !== lock.projectId) reasons.push('DIRECTOR_CHARACTER_PROJECT_MISMATCH');
  if (shot.characterId !== lock.characterId) reasons.push('DIRECTOR_CHARACTER_ID_MISMATCH');
  if (shot.continuityRef !== lock.continuityRef) reasons.push('DIRECTOR_CHARACTER_CONTINUITY_MISMATCH');
  if (shot.generationMode === 'text-only') reasons.push('DIRECTOR_CHARACTER_TEXT_ONLY_REGEN_FORBIDDEN');
  if (!shot.referenceAssetIds.includes(lock.referenceAssetId)) {
    reasons.push('DIRECTOR_CHARACTER_LOCKED_REFERENCE_REQUIRED');
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
