import type { GrowthId } from '../domain/types.js';
import type { TrendBuyerConvergence } from './trend-buyer-convergence.js';

export interface CreativePattern {
  readonly id: GrowthId;
  readonly hookStyle: string;
  readonly format: string;
  readonly emotionalFrame: string;
  readonly audienceIds: readonly GrowthId[];
  readonly performanceScore: number;
  readonly provenance: readonly string[];
}

export interface CreativePatternSelection {
  readonly opportunityId: GrowthId;
  readonly patternIds: readonly GrowthId[];
  readonly score: number;
  readonly rationale: readonly string[];
  readonly adaptationRequired: true;
  readonly requiresHumanReview: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function selectCreativePatterns(convergence: TrendBuyerConvergence, patterns: readonly CreativePattern[], limit = 3): CreativePatternSelection {
  const audienceSet = new Set(convergence.audienceIds);
  const ranked = [...patterns]
    .map((pattern) => ({ pattern, score: clamp(pattern.performanceScore) * (pattern.audienceIds.some((id) => audienceSet.has(id)) ? 1.15 : 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
  return {
    opportunityId: convergence.id,
    patternIds: ranked.map(({ pattern }) => pattern.id),
    score: clamp(convergence.convergenceScore * (ranked[0]?.score ?? 0)),
    rationale: [
      `convergence:${convergence.convergenceScore.toFixed(3)}`,
      `selected:${ranked.length}`,
      `audience_match:${ranked.filter(({ pattern }) => pattern.audienceIds.some((id) => audienceSet.has(id))).length}`,
    ],
    adaptationRequired: true,
    requiresHumanReview: true,
  };
}
