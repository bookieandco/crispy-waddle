import type { GrowthId } from '../domain/types.js';
import type { SocialPattern } from './social-intelligence.js';

export interface SocialExperimentResult {
  readonly patternId: GrowthId;
  readonly experimentId: GrowthId;
  readonly observations: number;
  readonly conversions: number;
  readonly spend: number;
  readonly revenue: number;
  readonly contributionMargin?: number;
  readonly contributionRoas?: number;
  readonly attributionConfidence: number;
}

export interface SocialPatternLearningUpdate {
  readonly patternId: GrowthId;
  readonly priorConfidence: number;
  readonly updatedConfidence: number;
  readonly evidenceWeight: number;
  readonly direction: 'positive' | 'negative' | 'neutral';
  readonly reason: string;
}

export function learnFromSocialExperiment(
  pattern: SocialPattern,
  result: SocialExperimentResult,
): SocialPatternLearningUpdate {
  const roas = result.contributionRoas ?? (result.spend > 0 ? (result.contributionMargin ?? result.revenue) / result.spend : undefined);
  const sampleWeight = Math.min(1, Math.log10(Math.max(1, result.observations)) / 4);
  const attributionWeight = Math.max(0, Math.min(1, result.attributionConfidence));
  const evidenceWeight = sampleWeight * attributionWeight;

  let direction: SocialPatternLearningUpdate['direction'] = 'neutral';
  let delta = 0;
  if (roas !== undefined) {
    if (roas >= 1.5) {
      direction = 'positive';
      delta = 0.2 * evidenceWeight;
    } else if (roas < 1) {
      direction = 'negative';
      delta = -0.15 * evidenceWeight;
    }
  }

  const updatedConfidence = Math.max(0, Math.min(1, pattern.confidence + delta));
  return {
    patternId: pattern.id,
    priorConfidence: pattern.confidence,
    updatedConfidence,
    evidenceWeight,
    direction,
    reason: `Updated from ${result.experimentId} using contribution performance and attribution confidence; sample size was weighted to prevent a single small result from dominating learning.`,
  };
}
