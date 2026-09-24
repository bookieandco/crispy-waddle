import type { GrowthId } from '../domain/types.js';
import type { TrendAssessment } from './trend-emergence.js';

export type OpportunitySignalKind = 'emerging_trend' | 'commercial_momentum';

export interface TrendOpportunitySignal {
  readonly id: GrowthId;
  readonly kind: OpportunitySignalKind;
  readonly trendId: GrowthId;
  readonly stage: TrendAssessment['stage'];
  readonly score: number;
  readonly confidence: number;
  readonly rationale: readonly string[];
  readonly requiresHumanReview: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function trendToOpportunitySignal(assessment: TrendAssessment): TrendOpportunitySignal | null {
  if (assessment.stage !== 'accelerating' && assessment.stage !== 'breakout') return null;
  const stageWeight = assessment.stage === 'breakout' ? 1 : 0.75;
  const velocityScore = clamp(assessment.velocity / 5);
  const accelerationScore = clamp(assessment.acceleration / 2);
  const score = clamp((velocityScore * 0.45) + (accelerationScore * 0.35) + (assessment.sourceDiversity * 0.20)) * stageWeight;
  return {
    id: `opportunity:${assessment.clusterId}` as GrowthId,
    kind: assessment.stage === 'breakout' ? 'commercial_momentum' : 'emerging_trend',
    trendId: assessment.clusterId,
    stage: assessment.stage,
    score,
    confidence: clamp(assessment.confidence),
    rationale: [
      `stage:${assessment.stage}`,
      `velocity:${assessment.velocity.toFixed(3)}`,
      `acceleration:${assessment.acceleration.toFixed(3)}`,
      `source_diversity:${assessment.sourceDiversity.toFixed(3)}`,
    ],
    requiresHumanReview: true,
  };
}
