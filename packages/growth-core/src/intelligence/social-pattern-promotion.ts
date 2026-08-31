import type { GrowthId } from '../domain/types.js';
import type { PatternExperimentResult } from './social-pattern-experiment.js';
import type { PatternHypothesis } from './social-pattern-transfer.js';

export interface PromotedSocialPattern {
  readonly id: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly strategy: string;
  readonly confidence: number;
  readonly status: 'promoted';
  readonly source: 'validated_experiment';
}

export function promoteValidatedPattern(hypothesis: PatternHypothesis, result: PatternExperimentResult): PromotedSocialPattern | null {
  if (!result.promoted || result.winner !== 'treatment') return null;
  if (result.observations < 30) return null;
  const relativeLift = result.controlMetric > 0 ? (result.treatmentMetric - result.controlMetric) / result.controlMetric : 0;
  const confidence = Math.max(0, Math.min(1, hypothesis.sourceConfidence * 0.5 + Math.min(1, Math.max(0, relativeLift)) * 0.5));
  return {
    id: `promoted-pattern:${hypothesis.id}` as GrowthId,
    hypothesisId: hypothesis.id,
    targetAccountId: hypothesis.targetAccountId,
    targetAudienceId: hypothesis.targetAudienceId,
    targetVoiceId: hypothesis.targetVoiceId,
    strategy: hypothesis.strategy,
    confidence,
    status: 'promoted',
    source: 'validated_experiment',
  };
}
