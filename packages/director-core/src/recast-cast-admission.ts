/**
 * Approved Cast appearance matching against Director's already-existing,
 * server-side cast/appearance records. This is an appearance provenance check,
 * never a likeness-consent, tracking or preview-render approval.
 */
export interface RecastCastRow {
  project_id: string
  character_id: string
  canonical_appearance_variant_id: string
  approved_at: string
  approved_by: string
}
export interface RecastAppearanceRow {
  id: string
  project_id: string
  character_id: string
  reference_sha256s: readonly string[]
  approved_at: string
  approved_by: string
}
export interface RecastCastAdmission {
  castAppearanceMatched: boolean
  characterId: string | null
  appearanceVariantId: string | null
  blocker: string | null
  evidenceStatus: 'READ_ONLY_CAST_MATCH' | 'CAST_APPEARANCE_REVIEW_REQUIRED'
  readyForRender: false
}
const nonEmpty = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0
const validTime = (s: unknown): boolean => nonEmpty(s) && Number.isFinite(Date.parse(s as string))

export function evaluateRecastCastAppearance(
  projectId: string,
  selectedImageSha256: string,
  casts: readonly RecastCastRow[],
  variants: readonly RecastAppearanceRow[],
): RecastCastAdmission {
  const matches: { characterId: string; variantId: string }[] = []
  if (/^[a-f0-9]{64}$/i.test(selectedImageSha256) && nonEmpty(projectId)) {
    for (const variant of variants) {
      if (variant.project_id !== projectId || !nonEmpty(variant.id) ||
        !nonEmpty(variant.character_id) || !nonEmpty(variant.approved_by) ||
        !validTime(variant.approved_at) ||
        !Array.isArray(variant.reference_sha256s) ||
        !variant.reference_sha256s.some(hash => typeof hash === 'string' &&
          hash.toLowerCase() === selectedImageSha256.toLowerCase())) continue
      const matchingCast = casts.find(cast =>
        cast.project_id === projectId &&
        cast.character_id === variant.character_id &&
        nonEmpty(cast.canonical_appearance_variant_id) &&
        nonEmpty(cast.approved_by) &&
        validTime(cast.approved_at),
      )
      if (matchingCast) matches.push({ characterId: variant.character_id, variantId: variant.id })
    }
  }
  const uniqueMatches = [...new Map(matches.map(match => [match.characterId + ':' + match.variantId, match])).values()]
  if (uniqueMatches.length !== 1) {
    return Object.freeze({
      castAppearanceMatched: false,
      characterId: null,
      appearanceVariantId: null,
      blocker: uniqueMatches.length > 1
        ? 'DIRECTOR_RECAST_CAST_APPEARANCE_AMBIGUOUS'
        : 'DIRECTOR_RECAST_APPROVED_CAST_REFERENCE_NOT_FOUND',
      evidenceStatus: 'CAST_APPEARANCE_REVIEW_REQUIRED',
      readyForRender: false,
    })
  }
  return Object.freeze({
    castAppearanceMatched: true,
    characterId: uniqueMatches[0].characterId,
    appearanceVariantId: uniqueMatches[0].variantId,
    blocker: null,
    evidenceStatus: 'READ_ONLY_CAST_MATCH',
    readyForRender: false,
  })
}