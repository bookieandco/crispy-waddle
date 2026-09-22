export interface CharacterIdentityObservation {
  id: string;
  projectId: string;
  characterId: string;
  takeId: string;
  frameStart: number;
  frameEnd: number;
  identitySimilarity: number;
  identityFingerprintRefs: readonly string[];
  appearanceVariantId?: string;
  appearanceSimilarity?: number;
  evidenceIds: readonly string[];
  limitations: readonly string[];
}

export interface CharacterIdentityQcPolicy {
  minimumIdentitySimilarity: number;
  minimumObservationCoverage: number;
  minimumAppearanceSimilarity?: number;
}

export interface CharacterIdentityQcDecision {
  admissible: boolean;
  identityScore: number;
  appearanceScore?: number;
  coverage: number;
  reasons: readonly string[];
  evidenceIds: readonly string[];
}

/**
 * Face/body identity and scene appearance are independent QC dimensions.
 * A costume or hair change may alter appearance similarity while the canonical
 * person/creature identity must remain above the same movie-wide threshold.
 */
export function evaluateCharacterIdentityContinuity(
  input: {
    projectId: string;
    characterId: string;
    takeId: string;
    expectedFingerprintRefs: readonly string[];
    expectedAppearanceVariantId?: string;
    frameStart: number;
    frameEnd: number;
    observations: readonly CharacterIdentityObservation[];
  },
  policy: CharacterIdentityQcPolicy,
): CharacterIdentityQcDecision {
  const reasons: string[] = [];
  const totalFrames = Math.max(0, input.frameEnd - input.frameStart + 1);
  if (!totalFrames) reasons.push('DIRECTOR_CHARACTER_QC_FRAME_RANGE_INVALID');
  if (!input.expectedFingerprintRefs.length) reasons.push('DIRECTOR_CHARACTER_QC_FINGERPRINT_REQUIRED');

  const expected = new Set(input.expectedFingerprintRefs);
  const usable = input.observations.filter((observation) =>
    observation.projectId === input.projectId &&
    observation.characterId === input.characterId &&
    observation.takeId === input.takeId &&
    observation.frameEnd >= observation.frameStart &&
    observation.evidenceIds.length > 0 &&
    observation.identityFingerprintRefs.some((ref) => expected.has(ref)),
  );

  const covered = new Set<number>();
  let identityWeighted = 0;
  let identityWeight = 0;
  let appearanceWeighted = 0;
  let appearanceWeight = 0;

  for (const observation of usable) {
    const start = Math.max(input.frameStart, observation.frameStart);
    const end = Math.min(input.frameEnd, observation.frameEnd);
    const frames = Math.max(0, end - start + 1);
    if (!frames) continue;
    for (let frame = start; frame <= end; frame += 1) covered.add(frame);

    if (!Number.isFinite(observation.identitySimilarity) || observation.identitySimilarity < 0 || observation.identitySimilarity > 1) {
      reasons.push(`DIRECTOR_CHARACTER_QC_IDENTITY_SCORE_INVALID:${observation.id}`);
      continue;
    }
    identityWeighted += observation.identitySimilarity * frames;
    identityWeight += frames;

    if (
      input.expectedAppearanceVariantId &&
      observation.appearanceVariantId === input.expectedAppearanceVariantId &&
      observation.appearanceSimilarity !== undefined &&
      Number.isFinite(observation.appearanceSimilarity)
    ) {
      appearanceWeighted += observation.appearanceSimilarity * frames;
      appearanceWeight += frames;
    }
  }

  const coverage = totalFrames ? covered.size / totalFrames : 0;
  const identityScore = identityWeight ? identityWeighted / identityWeight : 0;
  const appearanceScore = appearanceWeight ? appearanceWeighted / appearanceWeight : undefined;

  if (coverage < policy.minimumObservationCoverage) reasons.push('DIRECTOR_CHARACTER_QC_COVERAGE_LOW');
  if (identityScore < policy.minimumIdentitySimilarity) reasons.push('DIRECTOR_CHARACTER_IDENTITY_DRIFT');
  if (
    policy.minimumAppearanceSimilarity !== undefined &&
    input.expectedAppearanceVariantId &&
    (appearanceScore === undefined || appearanceScore < policy.minimumAppearanceSimilarity)
  ) reasons.push('DIRECTOR_CHARACTER_APPEARANCE_VARIANT_DRIFT');

  return Object.freeze({
    admissible: reasons.length === 0,
    identityScore,
    ...(appearanceScore !== undefined ? { appearanceScore } : {}),
    coverage,
    reasons: Object.freeze([...new Set(reasons)]),
    evidenceIds: Object.freeze([...new Set(usable.flatMap((observation) => observation.evidenceIds))]),
  });
}
