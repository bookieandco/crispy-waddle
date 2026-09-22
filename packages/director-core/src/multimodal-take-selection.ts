export type TakeScoreDimension =
  | 'continuity'
  | 'technical'
  | 'visual-readability'
  | 'performance'
  | 'dialogue'
  | 'story-function'
  | 'motion'
  | 'lip-sync'
  | 'source-relevance'
  | 'rights-confidence';

export interface TakeDimensionEvidence {
  dimension: TakeScoreDimension;
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
  notes?: readonly string[];
}

export interface MultimodalTakeCandidate {
  takeId: string;
  assetId: string;
  sourceStartSeconds?: number;
  sourceEndSeconds?: number;
  dimensions: readonly TakeDimensionEvidence[];
  hardFailures: readonly string[];
  observationIds: readonly string[];
}

export interface TakeSelectionPolicy {
  id: string;
  requiredDimensions: readonly TakeScoreDimension[];
  weights: Readonly<Partial<Record<TakeScoreDimension, number>>>;
  minimumDimensionConfidence: number;
  minimumOverallScore: number;
  preserveAlternates: number;
}

export interface RankedMultimodalTake {
  takeId: string;
  assetId: string;
  score: number;
  admissible: boolean;
  reasons: readonly string[];
  evidenceIds: readonly string[];
  observationIds: readonly string[];
}

export interface TakeSelectionResult {
  selectedTakeId?: string;
  ranked: readonly RankedMultimodalTake[];
  alternates: readonly string[];
  authority: 'DIRECTOR_SELECTION';
}

/**
 * Jhadina/vision/audio models provide observations and dimension evidence.
 * Director deterministically fuses that evidence, applies hard constraints,
 * preserves alternatives, and records the selection. No model self-approves.
 */
export function rankMultimodalTakes(
  candidates: readonly MultimodalTakeCandidate[],
  policy: TakeSelectionPolicy,
): TakeSelectionResult {
  const ranked = candidates.map((candidate): RankedMultimodalTake => {
    const reasons = [...candidate.hardFailures];
    const byDimension = new Map(candidate.dimensions.map((item) => [item.dimension, item]));

    for (const required of policy.requiredDimensions) {
      const evidence = byDimension.get(required);
      if (!evidence) reasons.push(`DIRECTOR_TAKE_DIMENSION_MISSING:${required}`);
      else {
        if (!Number.isFinite(evidence.score) || evidence.score < 0 || evidence.score > 1) {
          reasons.push(`DIRECTOR_TAKE_SCORE_INVALID:${required}`);
        }
        if (!Number.isFinite(evidence.confidence) || evidence.confidence < policy.minimumDimensionConfidence) {
          reasons.push(`DIRECTOR_TAKE_CONFIDENCE_LOW:${required}`);
        }
        if (!evidence.evidenceIds.length) reasons.push(`DIRECTOR_TAKE_EVIDENCE_REQUIRED:${required}`);
      }
    }

    let weighted = 0;
    let weightTotal = 0;
    for (const [dimension, weight] of Object.entries(policy.weights) as Array<[TakeScoreDimension, number]>) {
      if (!Number.isFinite(weight) || weight <= 0) continue;
      const evidence = byDimension.get(dimension);
      if (!evidence || !Number.isFinite(evidence.score) || !Number.isFinite(evidence.confidence)) continue;
      weighted += evidence.score * evidence.confidence * weight;
      weightTotal += evidence.confidence * weight;
    }

    const score = weightTotal > 0 ? weighted / weightTotal : 0;
    if (score < policy.minimumOverallScore) reasons.push('DIRECTOR_TAKE_OVERALL_SCORE_LOW');

    return Object.freeze({
      takeId: candidate.takeId,
      assetId: candidate.assetId,
      score,
      admissible: reasons.length === 0,
      reasons: Object.freeze(reasons),
      evidenceIds: Object.freeze([...new Set(candidate.dimensions.flatMap((item) => item.evidenceIds))]),
      observationIds: Object.freeze([...candidate.observationIds]),
    });
  }).sort((a, b) =>
    Number(b.admissible) - Number(a.admissible) ||
    b.score - a.score ||
    a.takeId.localeCompare(b.takeId)
  );

  const winner = ranked.find((item) => item.admissible);
  const alternates = ranked
    .filter((item) => item.admissible && item.takeId !== winner?.takeId)
    .slice(0, Math.max(0, policy.preserveAlternates))
    .map((item) => item.takeId);

  return Object.freeze({
    ...(winner ? { selectedTakeId: winner.takeId } : {}),
    ranked: Object.freeze(ranked),
    alternates: Object.freeze(alternates),
    authority: 'DIRECTOR_SELECTION',
  });
}

export const LONG_FORM_TAKE_POLICY: TakeSelectionPolicy = Object.freeze({
  id: 'long-form:v1',
  requiredDimensions: Object.freeze(['technical','visual-readability','performance','dialogue','story-function','continuity'] as const),
  weights: Object.freeze({
    performance: 1.5,
    dialogue: 1.4,
    'story-function': 1.4,
    continuity: 1.2,
    'visual-readability': 1,
    technical: 1,
    motion: 0.5,
  }),
  minimumDimensionConfidence: 0.55,
  minimumOverallScore: 0.62,
  preserveAlternates: 2,
});

export const CARTOON_TAKE_POLICY: TakeSelectionPolicy = Object.freeze({
  id: 'cartoon:v1',
  requiredDimensions: Object.freeze(['technical','visual-readability','story-function','continuity','motion'] as const),
  weights: Object.freeze({
    continuity: 1.6,
    'story-function': 1.4,
    motion: 1.3,
    'visual-readability': 1.2,
    technical: 1,
    'lip-sync': 1,
  }),
  minimumDimensionConfidence: 0.55,
  minimumOverallScore: 0.62,
  preserveAlternates: 2,
});

export const SHORT_FORM_TAKE_POLICY: TakeSelectionPolicy = Object.freeze({
  id: 'short-form:v1',
  requiredDimensions: Object.freeze(['technical','visual-readability','story-function','motion'] as const),
  weights: Object.freeze({
    'story-function': 1.5,
    motion: 1.4,
    'visual-readability': 1.3,
    technical: 1,
    performance: 1,
    dialogue: 0.8,
  }),
  minimumDimensionConfidence: 0.55,
  minimumOverallScore: 0.64,
  preserveAlternates: 1,
});

export const FACELESS_TAKE_POLICY: TakeSelectionPolicy = Object.freeze({
  id: 'faceless:v1',
  requiredDimensions: Object.freeze(['technical','visual-readability','source-relevance','rights-confidence'] as const),
  weights: Object.freeze({
    'source-relevance': 1.7,
    'rights-confidence': 1.6,
    'visual-readability': 1.2,
    technical: 1,
    motion: 0.8,
    'story-function': 1.2,
  }),
  minimumDimensionConfidence: 0.6,
  minimumOverallScore: 0.68,
  preserveAlternates: 2,
});
