import type { GrowthId } from '../domain/types.js';
import type { PatternExperimentResult } from './social-pattern-experiment.js';
import type { PatternHypothesis } from './social-pattern-transfer.js';

export interface PromotedSocialPattern {
  readonly id: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly sourcePatternId: GrowthId;
  readonly sourceAccountId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly strategy: string;
  readonly confidence: number;
  readonly status: 'promoted';
  readonly source: 'validated_experiment';
}

export function promoteValidatedPattern(
  hypothesis: PatternHypothesis,
  result: PatternExperimentResult,
): PromotedSocialPattern | null {
  if (result.evaluationSource !== 'pattern-experiment-evaluator') return null;
  if (result.experimentId !== `pattern-experiment:${hypothesis.id}`) return null;
  if (result.hypothesisId !== hypothesis.id) return null;
  if (result.targetAccountId !== hypothesis.targetAccountId) return null;
  if (result.targetAudienceId !== hypothesis.targetAudienceId) return null;
  if (result.targetVoiceId !== hypothesis.targetVoiceId) return null;
  if (result.successMetric === undefined) return null;
  if (result.evaluationId.length === 0 || !result.evaluatedAt) return null;
  if (result.winner !== 'treatment' || !result.promoted) return null;
  if (result.observations < result.minimumObservations) return null;
  if (result.controlObservations <= 0 || result.treatmentObservations <= 0) return null;

  const relativeLift = result.controlMetric > 0
    ? (result.treatmentMetric - result.controlMetric) / result.controlMetric
    : 0;
  if (relativeLift < 0.1) return null;

  const confidence = Math.max(
    0,
    Math.min(1, hypothesis.sourceConfidence * 0.5 + Math.min(1, relativeLift) * 0.5),
  );
  return {
    id: `promoted-pattern:${hypothesis.id}` as GrowthId,
    hypothesisId: hypothesis.id,
    sourcePatternId: hypothesis.sourcePatternId,
    sourceAccountId: hypothesis.sourceAccountId,
    targetAccountId: hypothesis.targetAccountId,
    targetAudienceId: hypothesis.targetAudienceId,
    targetVoiceId: hypothesis.targetVoiceId,
    strategy: hypothesis.strategy,
    confidence,
    status: 'promoted',
    source: 'validated_experiment',
  };
}
