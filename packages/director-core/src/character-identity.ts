import type { CharacterBehaviorDNA, CharacterArchetype } from './studio-contracts';

export type CharacterIdentityTraitKind =
  | 'face'
  | 'body'
  | 'skin'
  | 'fur'
  | 'marking'
  | 'scar'
  | 'eye'
  | 'hair-base'
  | 'species'
  | 'other';

export interface CharacterIdentityTrait {
  id: string;
  kind: CharacterIdentityTraitKind;
  value: string;
  persistent: true;
  evidenceIds: readonly string[];
}

export interface CharacterIdentityReference {
  assetId: string;
  sha256: string;
  role: 'hero' | 'face' | 'full-body' | 'profile' | 'expression' | 'rig' | 'style-neutral';
  approved: true;
  approvedBy: string;
  approvedAt: string;
}

export interface CanonicalCharacterIdentity {
  characterId: string;
  projectId: string;
  displayName: string;
  archetype: CharacterArchetype;
  revision: number;
  continuityRef: string;
  identityTraits: readonly CharacterIdentityTrait[];
  references: readonly CharacterIdentityReference[];
  behaviorDNA?: CharacterBehaviorDNA;
  voiceProfileIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterSceneAppearance {
  id: string;
  projectId: string;
  characterId: string;
  sceneId: string;
  continuityRef: string;
  wardrobeAssetIds: readonly string[];
  hairstyleAssetId?: string;
  makeupState?: string;
  agePresentation?: string;
  injuryState?: string;
  dirtWeatheringState?: string;
  accessoryAssetIds: readonly string[];
  propAssetIds: readonly string[];
  notes?: readonly string[];
}

export interface CharacterIdentityResolution {
  characterId: string;
  projectId: string;
  continuityRef: string;
  identityReferenceAssetIds: readonly string[];
  identityReferenceSha256: readonly string[];
  voiceProfileIds: readonly string[];
  revision: number;
}

export interface DirectorCharacterIdentityResolver {
  resolve(characterId: string, projectId: string): Promise<CharacterIdentityResolution>;
}

export function validateCanonicalCharacterIdentity(identity: CanonicalCharacterIdentity): readonly string[] {
  const errors: string[] = [];
  if (!identity.characterId.trim() || !identity.projectId.trim() || !identity.displayName.trim()) {
    errors.push('DIRECTOR_CHARACTER_IDENTITY_REQUIRED');
  }
  if (!Number.isInteger(identity.revision) || identity.revision < 1) errors.push('DIRECTOR_CHARACTER_REVISION_INVALID');
  if (!identity.continuityRef.trim()) errors.push('DIRECTOR_CHARACTER_CONTINUITY_REF_REQUIRED');
  if (!identity.references.length) errors.push('DIRECTOR_CHARACTER_REFERENCE_REQUIRED');
  if (identity.references.some(ref => !ref.assetId.trim() || !ref.sha256.trim())) {
    errors.push('DIRECTOR_CHARACTER_REFERENCE_PROVENANCE_REQUIRED');
  }
  if (!identity.identityTraits.length) errors.push('DIRECTOR_CHARACTER_TRAITS_REQUIRED');
  if (identity.behaviorDNA && identity.behaviorDNA.characterId !== identity.characterId) {
    errors.push('DIRECTOR_CHARACTER_BEHAVIOR_ID_MISMATCH');
  }
  return Object.freeze(errors);
}

export function validateCharacterSceneAppearance(
  identity: CanonicalCharacterIdentity,
  state: CharacterSceneAppearance,
): readonly string[] {
  const errors: string[] = [];
  if (state.projectId !== identity.projectId) errors.push('DIRECTOR_CHARACTER_SCENE_PROJECT_MISMATCH');
  if (state.characterId !== identity.characterId) errors.push('DIRECTOR_CHARACTER_SCENE_ID_MISMATCH');
  if (state.continuityRef !== identity.continuityRef) errors.push('DIRECTOR_CHARACTER_SCENE_CONTINUITY_MISMATCH');
  return Object.freeze(errors);
}

export function lockedCharacterReferenceAssetIds(
  identity: CanonicalCharacterIdentity | CharacterIdentityResolution,
): readonly string[] {
  if ('references' in identity) return Object.freeze(identity.references.map(ref => ref.assetId));
  return Object.freeze([...identity.identityReferenceAssetIds]);
}
